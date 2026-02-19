# SPECA Test Phase

You are generating executable Foundry test contracts for boundary condition verification and PoC reproduction of audit findings. This implements Strategy C from the SPECA paper, turning static findings into executable evidence.

## Prerequisites Check

1. Read `.speca/checklist.json`. If missing, stop: "Run `/speca checklist` first."
2. Read `.speca/findings.json`. If missing, warn: "No findings file. Continuing with checklist-only test generation." Set `has_findings = false`.
3. Read `.speca/mapping.json`. If missing, stop: "Run `/speca map` first."
4. Read `.speca/config.json`. If missing, stop: "Run `/speca init` first."
5. Extract `source_paths` and `language` (default: `"en"`).
6. Load all Solidity source files from mapping.json's `source_files`.
7. Check Foundry: `forge --version`. Set `foundry_available` accordingly.

### Checkpoint Support

```bash
node -e "import {getConfigHash} from '.claude/skills/speca/scripts/lib/config.mjs'; console.log(getConfigHash('.'))"
```
```bash
node -e "import {loadProgress, shouldResume} from '.claude/skills/speca/scripts/lib/progress.mjs'; const p = loadProgress('.', 'test'); console.log(JSON.stringify({progress: p, action: shouldResume(p, '<config_hash>')}))"
```

---

## Phase 1: Identify Testable Items

Process findings in batches of 3.

### Step 1a: Checklist-Derived Tests
Select items where `check_type` is `"dynamic"` or has corresponding finding.

### Step 1b: Finding-Derived PoC Items
By severity:
- **Critical**: MUST have PoC test
- **High**: SHOULD have PoC test
- **Medium**: MAY have PoC if demonstrable
- **Low/Informational**: Optional

### Step 1c: Deduplicate
Combine checklist + finding into single test file per checklist item.

---

## Phase 2: Test Generation

### Step 2a: Create Test Directory
```bash
mkdir -p test/speca
```

### Step 2b: Determine Import Paths
Use mappings to find source file → construct relative import from `test/speca/`.

### Step 2c: Generate Test Contracts

**File naming:** `test/speca/Test_<sanitized_checklist_id>.t.sol`
(Replace hyphens with underscores)

**Property test template:**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "<relative_import_path>";

/// @title SPECA Test: <checklist_id>
/// @notice Property: <property statement>
contract Test_<sanitized_id> is Test {
    <TargetContract> target;
    address owner = makeAddr("owner");
    address attacker = makeAddr("attacker");

    function setUp() public {
        vm.startPrank(owner);
        target = new <TargetContract>(<constructor_args>);
        vm.stopPrank();
    }

    function test_<id>_positive() public { /* Arrange-Act-Assert */ }
    function test_<id>_negative() public { /* expect revert */ }
}
```

**PoC test template** (added to same contract when finding exists):
```solidity
    /// @notice PoC for <finding_id>: <title>
    /// @dev If PASSES, vulnerability CONFIRMED
    function test_<finding_id>_poc() public { /* attack sequence */ }
```

### Step 2d: Fill In Test Logic

**Pattern-specific guidance:**
- **REENT-***: Deploy malicious reentering contract
- **ACCESS-***: `vm.prank(attacker)` on protected functions
- **INT-***: Boundary values (`type(uint256).max`, `0`)
- **LOGIC-***: Exact boundary conditions
- **EXTCALL-***: Mock external calls
- **GAS-***: Large arrays for gas exhaustion
- **ORACLE-***: Mock stale/manipulated data

### Step 2e: Write Test Files and Save Progress

After each batch of 3 findings:
```bash
node -e "import {saveProgress} from '.claude/skills/speca/scripts/lib/progress.mjs'; saveProgress('.', 'test', {phase:'test', status:'in_progress', completed_batches: <N>, total_batches: <total>, config_hash:'<hash>', updated_at: new Date().toISOString()})"
```

---

## Phase 3: Execution (Optional)

### Step 3a: Run Tests (if Foundry available)
```bash
forge test --match-path "test/speca/*" -vvv 2>&1
```

### Step 3b: Interpret Results
- Property test PASSES → property holds
- Property test FAILS → potential bug
- PoC PASSES → **vulnerability CONFIRMED**
- PoC FAILS → not reproducible

### Step 3c: Handle Compilation Errors
Warn but do NOT auto-fix. Tests are a starting point needing minimal human editing.

### Step 3d: Skip if No Foundry
Print: "Foundry not found. Run `forge test --match-path test/speca/ -vvv` to execute."

---

## Phase 4: Write Summary Output

Write `.speca/test-results.json`:

```json
{
  "generated_at": "<ISO 8601>",
  "foundry_available": true,
  "tests_executed": true,
  "total_test_files": <N>,
  "total_test_functions": <N>,
  "test_files": [
    {
      "file": "test/speca/Test_CHK_AUTH_001_a.t.sol",
      "checklist_id": "CHK-AUTH-001-a",
      "finding_id": "FIND-001",
      "test_functions": [
        { "name": "test_...", "type": "property_positive|property_negative|poc", "result": "pass|fail|not_executed", "interpretation": "..." }
      ]
    }
  ],
  "summary": {
    "property_tests": { "total": <N>, "passed": <N>, "failed": <N> },
    "poc_tests": { "total": <N>, "passed": <N>, "failed": <N> },
    "compilation_errors": <N>
  }
}
```

Print summary in configured `language`.

Mark progress completed.

---

## Test Quality Guidelines

1. Use `forge-std/Test.sol` only.
2. Use labeled addresses (`makeAddr("owner")`).
3. Include descriptive comments.
4. Relative import paths from `test/speca/`.
5. Each test file is self-contained with its own `setUp()`.
6. Match project's Solidity pragma.
7. Provide constructor arguments based on source analysis.
8. For reentrancy PoCs: create inline attacker contract.
9. All test functions start with `test_`.

## Error Handling
- Missing prerequisites → tell user which `/speca` phase to run
- No findings.json → warn but continue (checklist-only)
- No testable items → print message
- Existing files → overwrite (idempotent)

## Notes
- **Non-interactive.**
- Strategy C was least effective standalone (5.9%), but PoC generation for confirmed findings is highly valuable for human reviewers.
- Generated tests are a starting point (80-90% correct, minimal human editing needed).
- Prefer simplest PoC when multiple attack paths exist.
