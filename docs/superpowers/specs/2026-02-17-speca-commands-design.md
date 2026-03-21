# SPECA Commands Design - Solidity Specification-to-Checklist Auditing

**Date:** 2026-02-17
**Status:** Approved
**Reference:** [SPECA: Specification-to-Checklist Agentic Auditing (arXiv:2602.07513v2)](https://arxiv.org/abs/2602.07513v2)

## Overview

SPECA (SPEcification-to-Checklist Auditing) framework as a set of Claude Code custom commands for Solidity smart contract security auditing. The commands transform natural-language or structured specification documents into property-based checklists, map them to implementation locations, and perform systematic audits.

### Key Design Decisions

- **Solidity-focused**: Targets Solidity smart contracts with custom specification documents (not limited to ERC standards)
- **Single-implementation primary**: Optimized for auditing one contract against its spec (Strategy A & C). Strategy B (cross-implementation) is deprioritized.
- **Command set architecture**: 7 independent commands with JSON artifact handoff via `.speca/` directory
- **Dual output format**: Markdown reports + SARIF v2.1.0 for CI/CD integration
- **Explicit threat model**: Learned from SPECA paper's finding that 56.8% of false positives came from threat model misalignment

## Architecture

### Pipeline Flow

```
Spec (md/yaml) --> /speca-extract --> requirements.json
                                          |
Source (*.sol) --+                         v
                 +--> /speca-map --> mapping.json
                 |                        |
                 |                        v
Patterns (builtin) -+--> /speca-checklist --> checklist.json
                 |                              |
                 |                              v
                 +--> /speca-audit --> findings.json
                 |                         |
                 +--> /speca-test --> test results
                 |                         |
                 |                         v
                 +--> /speca-report --> report.md + report.sarif
```

### Artifact Directory

```
<project-root>/
  .speca/
    config.json          # Project config (incl. threat model)
    requirements.json    # Phase 1a: Extracted spec requirements
    mapping.json         # Phase 1b: Requirement-to-code mapping
    checklist.json       # Phase 1c: Property-based checklist
    findings.json        # Phase 2: Discovered issues
    reports/
      YYYY-MM-DD-report.md
      YYYY-MM-DD-report.sarif
```

## Command Inventory

| # | Command | Phase | Input | Output |
|---|---------|-------|-------|--------|
| 0 | `/speca-init` | Setup | Interactive | `.speca/config.json` |
| 1 | `/speca-extract` | Phase 1a | Spec files (md/yaml) | `requirements.json` |
| 2 | `/speca-map` | Phase 1b | requirements.json + *.sol | `mapping.json` |
| 3 | `/speca-checklist` | Phase 1c | requirements + mapping + patterns | `checklist.json` |
| 4 | `/speca-audit` | Phase 2a (Strategy A) | checklist + *.sol | `findings.json` |
| 5 | `/speca-test` | Phase 2b (Strategy C) | checklist + findings + *.sol | Test files |
| 6 | `/speca-report` | Output | findings + checklist + requirements | .md + .sarif |

## Command File Structure

```
.claude/commands/
  speca-init.md
  speca-extract.md
  speca-map.md
  speca-checklist.md
  speca-audit.md
  speca-test.md
  speca-report.md
```

## Detailed Command Designs

### 0. `/speca-init` - Project Setup

**Purpose:** Initialize `.speca/` directory and create `config.json` interactively.

**Process:**
1. Create `.speca/` directory
2. Interactively collect:
   - Specification file paths (md/yaml)
   - Source code paths (*.sol)
   - Threat model definition (actors, trust boundaries, assumptions)
3. Write `config.json`

**Config Schema:**
```json
{
  "spec_paths": ["./docs/spec.md", "./docs/interface.yaml"],
  "source_paths": ["./contracts/"],
  "threat_model": {
    "actors": {
      "contract_owner": "TRUSTED",
      "external_caller": "UNTRUSTED",
      "oracle": "SEMI_TRUSTED"
    },
    "boundaries": [
      "external_caller -> public/external functions",
      "oracle -> callback functions"
    ],
    "assumptions": [
      "EVM execution is deterministic",
      "Block timestamp can be manipulated within ~15s"
    ]
  }
}
```

### 1. `/speca-extract` - Requirement Extraction

**Purpose:** Extract auditable normalized requirements from specification documents.

**Process:**
1. Detect file format (md / yaml)
2. **Markdown**: Scan for RFC 2119 modal verbs (MUST, SHOULD, MAY, SHALL), extract as normalized requirements
3. **YAML**: Structurally extract field definitions, type constraints, validation rules, conditional logic
4. Assign traceability IDs (e.g., `SPEC-AUTH-001`)
5. Infer inter-requirement dependencies

**Output Schema (`requirements.json`):**
```json
{
  "spec_source": "docs/spec.md",
  "requirements": [
    {
      "id": "SPEC-AUTH-001",
      "text": "Only the contract owner MUST be able to call withdraw()",
      "type": "access_control",
      "severity_hint": "high",
      "source": { "file": "spec.md", "line": 42 },
      "modal": "MUST"
    }
  ]
}
```

### 2. `/speca-map` - Implementation Mapping

**Purpose:** Identify where each requirement is implemented in Solidity source.

**Process:**
1. Parse Solidity source (function signatures, modifiers, events, state variables)
2. Keyword-based candidate narrowing per requirement
3. LLM semantic matching for final mapping
4. Flag unmapped requirements (potential missing implementations)

**Output Schema (`mapping.json`):**
```json
{
  "mappings": [
    {
      "requirement_id": "SPEC-AUTH-001",
      "locations": [
        {
          "file": "contracts/Vault.sol",
          "function": "withdraw(uint256)",
          "line_range": [45, 52],
          "confidence": 0.95,
          "modifiers": ["onlyOwner"]
        }
      ],
      "status": "mapped"
    }
  ]
}
```

### 3. `/speca-checklist` - Checklist Generation

**Purpose:** Generate property-based check items from requirements, mappings, and vulnerability patterns.

**Process:**
1. Derive inspectable properties for each mapped requirement
2. Match against pattern DB for applicable vulnerability patterns
3. Filter by threat model (exclude out-of-scope checks)
4. Assign recommended check method (static/dynamic)

**Output Schema (`checklist.json`):**
```json
{
  "checklist": [
    {
      "id": "CHK-AUTH-001-a",
      "requirement_id": "SPEC-AUTH-001",
      "property": "withdraw() reverts when msg.sender != owner",
      "check_type": "static",
      "pattern_refs": ["ACCESS-CTRL-001"],
      "threat_model_filter": "external_caller -> withdraw()",
      "priority": "high"
    }
  ]
}
```

### 4. `/speca-audit` - Static Audit (Strategy A)

**Purpose:** Statically audit source code against the checklist.

**Process:**
1. Sort checklist items by priority
2. For each item, read target code
3. Three-phase inspection: **Presence** (code exists?) -> **Correctness** (correct implementation?) -> **Completeness** (edge cases covered?)
4. Filter false positive candidates against threat model
5. Attach proof trace (code citation + reasoning) to each finding

**Output Schema (`findings.json`):**
```json
{
  "findings": [
    {
      "id": "FIND-001",
      "checklist_id": "CHK-AUTH-001-b",
      "severity": "medium",
      "title": "onlyOwner bypass via delegatecall from proxy",
      "description": "...",
      "proof_trace": {
        "code_refs": [
          { "file": "contracts/Vault.sol", "lines": [45, 52] }
        ],
        "reasoning": "msg.sender in delegatecall context refers to the proxy caller"
      },
      "recommendation": "Use address(this) check or implement initializable pattern",
      "false_positive_risk": "low"
    }
  ]
}
```

### 5. `/speca-test` - Dynamic Test Generation (Strategy C)

**Purpose:** Generate executable tests for boundary conditions.

**Process:**
1. Extract testable items from checklist
2. Prioritize reproduction tests for findings
3. Generate test code in Foundry (`forge test`) format
4. Execute if environment available, record results

### 6. `/speca-report` - Report Generation

**Purpose:** Output audit results in human-readable and machine-readable formats.

**Markdown Report Structure:**
- Executive Summary (finding counts by severity)
- Threat model assumptions
- Findings list (descending severity, with proof traces)
- Checklist completion rate
- Unmapped requirements list

**SARIF Output:** SARIF v2.1.0 format for GitHub Code Scanning integration.

## Vulnerability Pattern Database

Built-in Solidity-specific patterns embedded in `/speca-checklist` command:

| Category | Example Patterns | Severity |
|----------|-----------------|----------|
| Reentrancy | Missing state update before external call, cross-function reentrancy | Critical/High |
| Access Control | Missing modifier, tx.origin auth, unprotected initializer | High |
| Integer | Unchecked arithmetic (Solidity <0.8), type cast truncation | High |
| Logic | Conditional branch errors, off-by-one, incorrect operators | Medium-High |
| External Call | Unchecked return value, delegatecall target trust | High |
| Gas/DoS | Unbounded loops, block gas limit, storage concentration | Medium |
| Oracle/Price | Manipulable oracle reference, flash loan attack paths | High |
| ERC Standard | ERC-20/721/1155 spec violations (approve race condition etc.) | Medium |
| Upgradability | Storage collision, uninitialized proxy, selfdestruct | High |
| Cryptographic | Weak randomness (block.timestamp, blockhash), signature replay | High |

## Threat Model Design (V2 Lesson)

The SPECA paper found that 56.8% of false positives stemmed from threat model misalignment. To address this:

- Threat model is an **explicit, required** artifact in `config.json`
- `/speca-init` forces interactive threat model definition
- `/speca-audit` filters findings against the defined threat model
- Each finding includes `false_positive_risk` assessment based on threat model alignment

## Supported Specification Formats

| Format | Use Case |
|--------|----------|
| Markdown (`.md`) | Natural-language specs (EIP/ERC style), README-based specs |
| YAML (`.yaml`/`.yml`) | Structured spec definitions, OpenAPI-style interface definitions, custom schema specs |

Format is auto-detected in `/speca-extract` based on file extension.
