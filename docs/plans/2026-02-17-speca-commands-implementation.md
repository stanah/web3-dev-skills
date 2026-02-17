# SPECA Commands Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement 7 Claude Code custom commands that form the SPECA (Specification-to-Checklist Auditing) pipeline for Solidity smart contract security auditing.

**Architecture:** Each command is a standalone `.md` file in `.claude/commands/` with frontmatter and structured instructions. Commands communicate via JSON artifacts in the `.speca/` directory. A sample project is included for end-to-end validation.

**Tech Stack:** Claude Code custom commands (Markdown), JSON artifact schemas, Solidity (sample), Foundry (sample tests)

**Design Doc:** `docs/plans/2026-02-17-speca-commands-design.md`

---

### Task 1: Create command directory and sample project scaffold

**Files:**
- Create: `.claude/commands/` (directory)
- Create: `examples/simple-vault/docs/spec.md`
- Create: `examples/simple-vault/docs/interface.yaml`
- Create: `examples/simple-vault/contracts/Vault.sol`

**Step 1: Create directory structure**

```bash
mkdir -p .claude/commands
mkdir -p examples/simple-vault/docs
mkdir -p examples/simple-vault/contracts
```

**Step 2: Write sample specification (Markdown)**

Create `examples/simple-vault/docs/spec.md`:

```markdown
# SimpleVault Specification

## Overview
SimpleVault is a contract that allows an owner to deposit and withdraw ETH, with a whitelist for additional depositors.

## Requirements

### Access Control
- R-AUTH-001: Only the contract owner MUST be able to call `withdraw()`.
- R-AUTH-002: The contract owner MUST be able to add and remove addresses from the whitelist.
- R-AUTH-003: Only whitelisted addresses or the owner MUST be able to call `deposit()`.

### Deposit
- R-DEP-001: `deposit()` MUST accept ETH and credit the sender's balance.
- R-DEP-002: `deposit()` MUST revert if `msg.value` is 0.
- R-DEP-003: A `Deposited(address, uint256)` event MUST be emitted on successful deposit.

### Withdrawal
- R-WDR-001: `withdraw(uint256 amount)` MUST transfer the specified amount to the owner.
- R-WDR-002: `withdraw()` MUST revert if `amount` exceeds the contract balance.
- R-WDR-003: A `Withdrawn(address, uint256)` event MUST be emitted on successful withdrawal.
- R-WDR-004: Withdrawal SHOULD follow the checks-effects-interactions pattern.

### Emergency
- R-EMR-001: `emergencyPause()` MUST halt all deposits and withdrawals.
- R-EMR-002: Only the owner MUST be able to call `emergencyPause()` and `emergencyUnpause()`.
```

**Step 3: Write sample specification (YAML)**

Create `examples/simple-vault/docs/interface.yaml`:

```yaml
name: SimpleVault
version: "1.0"
functions:
  deposit:
    visibility: external
    payable: true
    access: whitelist_or_owner
    requirements:
      - msg.value must be greater than 0
      - caller must be whitelisted or owner
    events:
      - Deposited(address indexed sender, uint256 amount)

  withdraw:
    visibility: external
    params:
      - name: amount
        type: uint256
    access: owner_only
    requirements:
      - amount must not exceed contract balance
      - must follow checks-effects-interactions
    events:
      - Withdrawn(address indexed to, uint256 amount)

  emergencyPause:
    visibility: external
    access: owner_only
    requirements:
      - halts all deposits and withdrawals

  emergencyUnpause:
    visibility: external
    access: owner_only

  addToWhitelist:
    visibility: external
    access: owner_only
    params:
      - name: addr
        type: address

  removeFromWhitelist:
    visibility: external
    access: owner_only
    params:
      - name: addr
        type: address
```

**Step 4: Write sample Solidity contract (intentionally has bugs)**

Create `examples/simple-vault/contracts/Vault.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Vault {
    address public owner;
    bool public paused;
    mapping(address => bool) public whitelist;
    mapping(address => uint256) public balances;

    event Deposited(address indexed sender, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // BUG: missing whitelist check (violates R-AUTH-003)
    function deposit() external payable {
        require(!paused, "Paused");
        require(msg.value > 0, "Zero deposit");
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    // BUG: sends before state update (violates R-WDR-004, reentrancy)
    function withdraw(uint256 amount) external onlyOwner {
        require(!paused, "Paused");
        require(amount <= address(this).balance, "Insufficient balance");
        emit Withdrawn(msg.sender, amount);
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        // state update after external call - reentrancy risk
    }

    function emergencyPause() external onlyOwner {
        paused = true;
    }

    // BUG: missing onlyOwner modifier (violates R-EMR-002)
    function emergencyUnpause() external {
        paused = false;
    }

    function addToWhitelist(address addr) external onlyOwner {
        whitelist[addr] = true;
    }

    function removeFromWhitelist(address addr) external onlyOwner {
        whitelist[addr] = false;
    }
}
```

**Step 5: Commit**

```bash
git add .claude/commands examples/
git commit -m "feat: add command directory and sample vault project for SPECA testing"
```

---

### Task 2: Implement `/speca-init` command

**Files:**
- Create: `.claude/commands/speca-init.md`

**Step 1: Write the command file**

Create `.claude/commands/speca-init.md` with:
- Frontmatter (name, description)
- Purpose section
- Interactive flow for collecting spec paths, source paths, threat model
- config.json generation logic
- Validation that paths exist

Key instructions the command must encode:
1. Ask user for spec file paths (md/yaml)
2. Ask user for Solidity source paths
3. Ask user to define actors and trust levels (TRUSTED/SEMI_TRUSTED/UNTRUSTED)
4. Ask user for trust boundaries
5. Ask user for security assumptions
6. Create `.speca/` directory
7. Write `config.json`
8. Print summary of configuration

**Step 2: Verify command file is well-formed**

```bash
head -5 .claude/commands/speca-init.md
# Verify frontmatter is present and correct
```

**Step 3: Commit**

```bash
git add .claude/commands/speca-init.md
git commit -m "feat: add /speca-init command for project setup"
```

---

### Task 3: Implement `/speca-extract` command

**Files:**
- Create: `.claude/commands/speca-extract.md`

**Step 1: Write the command file**

Create `.claude/commands/speca-extract.md` with:
- Frontmatter (name, description)
- Prerequisites check (config.json must exist)
- File format detection logic (md vs yaml by extension)
- Markdown extraction rules: scan for RFC 2119 modal verbs (MUST, SHOULD, MAY, SHALL), extract surrounding context, assign IDs
- YAML extraction rules: parse structure, extract field constraints, validation rules, access control annotations
- Traceability ID generation scheme (e.g., `SPEC-<CATEGORY>-NNN`)
- Type classification (access_control, validation, event, state_transition, etc.)
- Output schema definition for `requirements.json`
- Instruction to write result to `.speca/requirements.json`

**Step 2: Verify command file is well-formed**

```bash
head -5 .claude/commands/speca-extract.md
```

**Step 3: Commit**

```bash
git add .claude/commands/speca-extract.md
git commit -m "feat: add /speca-extract command for requirement extraction"
```

---

### Task 4: Implement `/speca-map` command

**Files:**
- Create: `.claude/commands/speca-map.md`

**Step 1: Write the command file**

Create `.claude/commands/speca-map.md` with:
- Frontmatter (name, description)
- Prerequisites check (requirements.json must exist)
- Solidity source parsing instructions: identify functions, modifiers, events, state variables, inheritance
- Two-phase mapping approach:
  1. Keyword search: match requirement text against function names, modifier names, event names
  2. Semantic refinement: read candidate code, verify semantic match with requirement
- Confidence scoring (0.0-1.0)
- Unmapped requirement flagging (status: "unmapped" with explanatory note)
- Output schema definition for `mapping.json`
- Instruction to write result to `.speca/mapping.json`

**Step 2: Verify command file is well-formed**

```bash
head -5 .claude/commands/speca-map.md
```

**Step 3: Commit**

```bash
git add .claude/commands/speca-map.md
git commit -m "feat: add /speca-map command for implementation mapping"
```

---

### Task 5: Implement `/speca-checklist` command

**Files:**
- Create: `.claude/commands/speca-checklist.md`

**Step 1: Write the command file**

Create `.claude/commands/speca-checklist.md` with:
- Frontmatter (name, description)
- Prerequisites check (requirements.json + mapping.json must exist)
- Inline Solidity vulnerability pattern database (all 10 categories from design doc):
  - Reentrancy patterns
  - Access Control patterns
  - Integer patterns
  - Logic patterns
  - External Call patterns
  - Gas/DoS patterns
  - Oracle/Price patterns
  - ERC Standard patterns
  - Upgradability patterns
  - Cryptographic patterns
- For each mapped requirement:
  1. Derive testable properties (positive and negative cases)
  2. Match against pattern DB for applicable vulnerability patterns
  3. Cross-reference threat model to exclude out-of-scope checks
  4. Assign check_type (static/dynamic) and priority (critical/high/medium/low)
- Output schema definition for `checklist.json`
- Instruction to write result to `.speca/checklist.json`

**Step 2: Verify command file is well-formed**

```bash
head -5 .claude/commands/speca-checklist.md
```

**Step 3: Commit**

```bash
git add .claude/commands/speca-checklist.md
git commit -m "feat: add /speca-checklist command with Solidity vulnerability patterns"
```

---

### Task 6: Implement `/speca-audit` command

**Files:**
- Create: `.claude/commands/speca-audit.md`

**Step 1: Write the command file**

Create `.claude/commands/speca-audit.md` with:
- Frontmatter (name, description)
- Prerequisites check (checklist.json must exist)
- Load threat model from config.json
- Sort checklist items by priority (critical > high > medium > low)
- For each checklist item, perform three-phase inspection:
  1. **Presence**: Does code exist addressing this requirement? Read the mapped location.
  2. **Correctness**: Does the code correctly implement the requirement? Check logic, conditions, edge cases.
  3. **Completeness**: Are all conditions and edge cases handled? Check boundary values, error paths.
- Threat model filtering: for each potential finding, verify the attack vector is within defined trust boundaries
- Proof trace generation: include exact file paths, line numbers, code snippets, and reasoning chain
- False positive risk assessment (low/medium/high) based on threat model alignment
- Severity classification: Critical (fund loss) > High (access control breach) > Medium (logic error) > Low (best practice) > Informational
- Output schema definition for `findings.json`
- Instruction to write result to `.speca/findings.json`

**Step 2: Verify command file is well-formed**

```bash
head -5 .claude/commands/speca-audit.md
```

**Step 3: Commit**

```bash
git add .claude/commands/speca-audit.md
git commit -m "feat: add /speca-audit command for static audit (Strategy A)"
```

---

### Task 7: Implement `/speca-test` command

**Files:**
- Create: `.claude/commands/speca-test.md`

**Step 1: Write the command file**

Create `.claude/commands/speca-test.md` with:
- Frontmatter (name, description)
- Prerequisites check (checklist.json + findings.json must exist, Foundry recommended)
- Filter checklist for items with check_type "dynamic" or findings needing reproduction
- For each testable item:
  1. Generate Foundry test contract (`.t.sol` file)
  2. Include setup with appropriate state
  3. Write test function targeting the specific property
  4. For findings: generate PoC that demonstrates the vulnerability
- Test naming convention: `test_<checklist_id>_<property_description>`
- If Foundry is available (`forge --version`), run `forge test` and capture results
- If Foundry is not available, still generate test files with a note
- Output: test files in project's test directory

**Step 2: Verify command file is well-formed**

```bash
head -5 .claude/commands/speca-test.md
```

**Step 3: Commit**

```bash
git add .claude/commands/speca-test.md
git commit -m "feat: add /speca-test command for dynamic test generation (Strategy C)"
```

---

### Task 8: Implement `/speca-report` command

**Files:**
- Create: `.claude/commands/speca-report.md`

**Step 1: Write the command file**

Create `.claude/commands/speca-report.md` with:
- Frontmatter (name, description)
- Prerequisites check (findings.json must exist)
- Load all artifacts: requirements.json, mapping.json, checklist.json, findings.json
- **Markdown report generation** (`reports/YYYY-MM-DD-report.md`):
  1. Executive Summary: finding counts by severity, checklist completion rate
  2. Threat Model: actors, boundaries, assumptions from config.json
  3. Findings (descending severity):
     - Title, severity, description
     - Proof trace with code references
     - Recommendation
     - Related checklist item and requirement
  4. Checklist Coverage: items checked / total, pass / fail / skipped
  5. Unmapped Requirements: potential missing implementations
  6. Methodology note: reference to SPECA framework
- **SARIF v2.1.0 generation** (`reports/YYYY-MM-DD-report.sarif`):
  - `$schema`, `version`
  - `runs[0].tool.driver`: name "speca", version, rules array from checklist
  - `runs[0].results`: one result per finding with location, message, level
  - Map severity: critical/high -> "error", medium -> "warning", low/info -> "note"
- Write both files to `.speca/reports/`

**Step 2: Verify command file is well-formed**

```bash
head -5 .claude/commands/speca-report.md
```

**Step 3: Commit**

```bash
git add .claude/commands/speca-report.md
git commit -m "feat: add /speca-report command for Markdown and SARIF output"
```

---

### Task 9: End-to-end validation with sample project

**Files:**
- Read: `examples/simple-vault/` (all files)
- Read: `.claude/commands/speca-*.md` (all commands)

**Step 1: Initialize SPECA for sample project**

Run `/speca-init` in the `examples/simple-vault/` directory context with:
- spec_paths: `["docs/spec.md", "docs/interface.yaml"]`
- source_paths: `["contracts/"]`
- threat_model: external_caller = UNTRUSTED, owner = TRUSTED

**Step 2: Run extraction**

Run `/speca-extract` and verify `requirements.json` contains all 12 requirements from spec.md + additional from interface.yaml.

**Step 3: Run mapping**

Run `/speca-map` and verify all requirements are mapped to `Vault.sol` functions.

**Step 4: Run checklist generation**

Run `/speca-checklist` and verify checklist items cover the 3 intentional bugs:
1. Missing whitelist check in deposit() (R-AUTH-003)
2. Reentrancy in withdraw() (R-WDR-004)
3. Missing onlyOwner on emergencyUnpause() (R-EMR-002)

**Step 5: Run audit**

Run `/speca-audit` and verify findings.json catches at least the 3 intentional bugs.

**Step 6: Run report**

Run `/speca-report` and verify both Markdown and SARIF outputs are generated.

**Step 7: Commit validation results**

```bash
git add examples/simple-vault/.speca/
git commit -m "test: validate SPECA pipeline with sample vault project"
```

---

### Task 10: Final cleanup and documentation

**Files:**
- Modify: `README.md` (if exists) or create project-level docs

**Step 1: Add command usage documentation**

Add a section to the project describing:
- Command inventory (7 commands)
- Quick start: `/speca-init` -> `/speca-extract` -> `/speca-map` -> `/speca-checklist` -> `/speca-audit` -> `/speca-report`
- Artifact descriptions
- Prerequisites (Claude Code with custom command support)

**Step 2: Final commit**

```bash
git add -A
git commit -m "docs: add SPECA commands usage documentation"
```
