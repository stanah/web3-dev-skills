---
name: speca-cross
description: Cross-implementation vulnerability checking (Strategy B) — propagate findings across multiple Solidity implementations of the same interface or standard
---

# /speca-cross - Cross-Implementation Vulnerability Check

You are performing cross-implementation vulnerability checking, known as **Strategy B** in the SPECA methodology. This strategy was responsible for 76.5% of valid findings in the original SPECA research. The core insight: a vulnerability pattern found in one implementation of a specification is likely to exist in other implementations of the same specification, often in a structurally similar but syntactically different form.

This command takes a finding (or set of findings) from a completed audit and checks whether the same vulnerability pattern exists in one or more alternative implementations.

**Typical use cases in Solidity:**
- Comparing OpenZeppelin and Solmate implementations of the same ERC standard.
- Checking multiple vault/lending protocol forks that share a common specification.
- Propagating a finding from one DeFi protocol to its forks.

---

## Phase 0: Prerequisites Check and Argument Parsing

### Step 0a: Parse Arguments

Parse `$ARGUMENTS` for the following flags:

- `--finding=FIND-NNN`: (Optional) Specific finding ID to propagate. If omitted, propagate ALL findings from the primary audit.
- `--finding-severity=LEVEL`: (Optional) Propagate only findings at this severity or above. One of `critical`, `high`, `medium`, `low`. Default: `high` (propagate critical and high findings).
- `--targets=PATH1,PATH2,...`: (Required) Comma-separated list of target repository or directory paths containing alternative Solidity implementations.
- `--interface=PATH`: (Optional) Path to a shared interface file (.sol) or ERC standard identifier (e.g., `ERC20`, `ERC721`, `ERC4626`). Used to align functions across implementations.

If `--targets` is not provided, stop and tell the user: "The --targets flag is required. Provide comma-separated paths to alternative implementations. Example: `/speca-cross --targets=./repo-b,./repo-c`"

### Step 0b: Load Primary Audit Artifacts

1. Read `.speca/config.json`. If not found, stop and tell the user to run `/speca-init`.
2. Extract the `language` field (default `"en"`).
3. Read `.speca/findings.json`. If not found, stop and tell the user to run `/speca-audit` first.
4. Read `.speca/checklist.json`. If not found, stop and tell the user to run `/speca-checklist` first.
5. Read `.speca/mapping.json`. If not found, stop and tell the user to run `/speca-map` first.
6. Read `.speca/requirements.json`. If not found, stop and tell the user to run `/speca-extract` first.
7. Read `.claude/speca/patterns-v1.json` for vulnerability pattern definitions.

### Step 0c: Select Findings to Propagate

Based on the arguments:
- If `--finding=FIND-NNN` is specified, select only that finding.
- If `--finding-severity=LEVEL` is specified, select findings at that severity or above.
- Otherwise, select all findings with severity `critical` or `high`.

If no findings match the selection criteria, tell the user: "No findings match the propagation criteria. Specify a different --finding or --finding-severity."

### Step 0d: Validate Target Paths

For each path in `--targets`:
1. Verify the directory exists using the Glob tool (`<path>/**/*.sol`).
2. If no `.sol` files are found in a target path, warn the user and skip that target.
3. Record the list of valid target paths and their Solidity files.

---

## Phase 1: Abstract Vulnerability Patterns

For each selected finding, extract an abstract vulnerability pattern that can be matched against different implementations.

### Step 1a: Extract the Pattern Signature

From the finding's `proof_trace`, extract:

1. **Vulnerability class**: The `pattern_refs` from the associated checklist item (e.g., `REENT-001`, `ACCESS-001`). If no pattern_refs, classify based on the finding title and description.

2. **Structural pattern**: Abstract the specific code issue into a structural pattern:
   - **Function signature pattern**: The type of function involved (e.g., "external state-changing function", "withdrawal function", "token transfer function").
   - **Missing guard pattern**: What check or guard is missing (e.g., "missing reentrancy guard", "missing access control on admin function", "unchecked return value").
   - **Data flow pattern**: How data flows through the vulnerability (e.g., "user input → arithmetic → state update without bounds check").

3. **Requirement pattern**: The requirement text abstracted to remove implementation-specific identifiers. For example:
   - Original: "withdraw() MUST only be callable by the vault owner"
   - Abstracted: "withdrawal function MUST have caller access control"

Record this as a `propagation_pattern`:

```json
{
  "source_finding_id": "FIND-001",
  "vulnerability_class": ["ACCESS-001"],
  "structural_pattern": {
    "function_type": "external_state_changing",
    "missing_guard": "access_control_on_privileged_operation",
    "data_flow": null
  },
  "abstracted_requirement": "withdrawal function MUST have caller access control",
  "original_code_pattern": {
    "file": "contracts/Vault.sol",
    "function_signature": "withdraw(uint256)",
    "issue_summary": "Missing onlyOwner modifier on withdraw function"
  }
}
```

### Step 1b: Identify Matching Functions via Interface Alignment

Determine which functions in the target implementations correspond to the vulnerable function in the primary implementation.

**If `--interface` is an ERC standard identifier** (e.g., `ERC20`, `ERC4626`):
- Use the known function signatures of that standard to align functions across implementations.
- For example, for ERC4626: `deposit()`, `withdraw()`, `redeem()`, `mint()` are standard functions.

**If `--interface` is a `.sol` file path**:
- Read the interface file and extract all function signatures.
- Use these signatures to find matching functions in target implementations.

**If no `--interface` is provided**:
- Use function name and parameter type matching to find candidates.
- Look for functions with similar names (e.g., `withdraw`, `_withdraw`, `processWithdrawal`).
- Look for functions with similar parameter types and return types.
- Rank candidates by signature similarity.

---

## Phase 2: Scan Target Implementations

For each valid target path, scan for the abstracted vulnerability pattern.

### Step 2a: Load Target Source Files

For each target directory:
1. Use Glob to find all `.sol` files: `<target_path>/**/*.sol`.
2. Read each file. Build a source catalog (same as `/speca-map` Phase 1):
   - Contract definitions, function signatures, modifiers, events, state variables.

### Step 2b: Locate Candidate Functions

For each propagation pattern, find candidate functions in the target that match:

1. **By interface alignment** (if available): Direct signature match.
2. **By function name similarity**: Match function names using:
   - Exact match (case-insensitive).
   - Substring match (e.g., "withdraw" matches "emergencyWithdraw").
   - Semantic match based on function type (e.g., any function that sends ETH/tokens to msg.sender).
3. **By structural similarity**: Functions that:
   - Have the same visibility (public/external).
   - Modify similar state variables (balances, allowances, etc.).
   - Make external calls (for reentrancy patterns).
   - Emit similar events.

Record each candidate with a match confidence (0.0–1.0).

### Step 2c: Deep Inspection

For each candidate function (confidence >= 0.5), perform a targeted inspection based on the propagation pattern:

1. **Read the full function code** at the candidate location.
2. **Apply the pattern's what_to_check** from `patterns-v1.json`:
   - Look up the vulnerability class (e.g., `ACCESS-001`) in the pattern database.
   - Execute the `what_to_check` instructions against the candidate code.
3. **Compare against the structural pattern**:
   - Does the candidate function have the same missing guard?
   - Does the candidate function exhibit the same data flow issue?
   - Is the code structurally similar to the original vulnerability?

4. **Determine match result**:
   - **CONFIRMED**: The same vulnerability pattern exists in the target. Code evidence found.
   - **VARIANT**: A related but different manifestation of the same vulnerability class. The pattern is present but in a different form.
   - **MITIGATED**: The target implementation has a mitigation that the primary implementation lacks (e.g., the target has a reentrancy guard where the primary does not).
   - **NOT_FOUND**: The vulnerability pattern does not apply to this candidate.

---

## Phase 3: Construct Cross-Implementation Findings

For each CONFIRMED or VARIANT result, construct a cross-implementation finding.

### Finding Schema

```json
{
  "id": "XFIND-NNN",
  "source_finding_id": "FIND-001",
  "target_path": "./repo-b",
  "match_type": "CONFIRMED|VARIANT|MITIGATED",
  "severity": "critical|high|medium|low|informational",
  "title": "Short descriptive title",
  "description": "Detailed description including how this relates to the original finding",
  "proof_trace": {
    "code_refs": [
      {
        "file": "repo-b/contracts/Vault.sol",
        "lines": [30, 38],
        "snippet": "actual code lines from target"
      }
    ],
    "reasoning": "Step-by-step reasoning: (1) Original finding says..., (2) Target code does..., (3) Pattern match because..., (4) Impact in target context is..."
  },
  "propagation_pattern": {
    "vulnerability_class": ["ACCESS-001"],
    "structural_similarity": 0.85,
    "abstracted_requirement": "withdrawal function MUST have caller access control"
  },
  "recommendation": "Specific fix for the target implementation",
  "comparison_note": "How the target's implementation differs from the primary (if VARIANT)"
}
```

### Finding ID Assignment

- Cross-implementation findings use the prefix `XFIND-` to distinguish them from primary findings.
- Assign IDs sequentially: `XFIND-001`, `XFIND-002`, etc.
- Order by severity, then by target path.

### Severity Assignment

- **CONFIRMED** findings inherit the severity of the source finding.
- **VARIANT** findings: start with source severity, adjust based on:
  - If the variant is less severe (partial mitigation exists), downgrade by one level.
  - If the variant is more severe (additional attack surface), keep or upgrade.
- **MITIGATED** results: Record as `informational` with a note about what mitigation exists. These are positive findings showing the target is better protected.

---

## Phase 4: Write Output

### Step 4a: Build the Output JSON

```json
{
  "cross_audit_at": "<ISO 8601 timestamp>",
  "primary_findings_file": ".speca/findings.json",
  "findings_propagated": <integer>,
  "targets_scanned": <integer>,
  "total_cross_findings": <integer>,
  "cross_findings_by_severity": {
    "critical": <integer>,
    "high": <integer>,
    "medium": <integer>,
    "low": <integer>,
    "informational": <integer>
  },
  "cross_findings_by_match_type": {
    "CONFIRMED": <integer>,
    "VARIANT": <integer>,
    "MITIGATED": <integer>
  },
  "targets": [
    {
      "path": "./repo-b",
      "sol_files_scanned": <integer>,
      "findings_count": <integer>
    }
  ],
  "cross_findings": [
    { "...": "finding objects as defined above" }
  ]
}
```

### Step 4b: Write the File

Write the JSON to `.speca/cross-findings.json` using the Write tool. Use 2-space indentation.

---

## Phase 5: Print Summary

After writing the file, print a summary. **All console output text MUST be written in the language specified by `language`.**

```
Cross-implementation vulnerability check complete!

Primary findings propagated: <N>
Targets scanned: <N>

Cross-Implementation Findings:
| ID        | Severity | Match Type | Target  | Title                              |
|-----------|----------|------------|---------|------------------------------------|
| XFIND-001 | critical | CONFIRMED  | repo-b  | Missing access control on withdraw |
| XFIND-002 | high     | VARIANT    | repo-c  | Partial reentrancy guard           |
| XFIND-003 | info     | MITIGATED  | repo-b  | Reentrancy guard present           |

Summary by match type:
  CONFIRMED: <N> (same vulnerability exists)
  VARIANT:   <N> (related vulnerability in different form)
  MITIGATED: <N> (target has mitigation primary lacks)

Output written to: .speca/cross-findings.json

Next steps:
  - Review CONFIRMED findings — these are high-confidence cross-implementation vulnerabilities.
  - Investigate VARIANT findings — the vulnerability class is present but manifestation differs.
  - Consider MITIGATED findings — the target's mitigations may be worth backporting to the primary.
  - Run /speca-report to include cross-implementation findings in the final report.
```

---

## Batch Control

For audits with many findings or many targets, use batch control.

### Batch Parameters

Parse `$ARGUMENTS` for:

- `--batch=N`: Process batch N of the findings×targets matrix. Each batch processes `BATCH_SIZE` finding-target pairs.
- `--batch-size=N`: Number of finding-target pairs per batch. Default: 5.
- `--resume`: Continue from `.speca/cross_progress.json`.

### Progress Tracking

After each batch, write `.speca/cross_progress.json`:

```json
{
  "last_processed_pair": <integer>,
  "total_pairs": <integer>,
  "batch_size": <integer>,
  "completed_batches": <integer>,
  "remaining": <integer>
}
```

### Merging

When in batch mode, append new cross-findings to existing `.speca/cross-findings.json`. Re-assign XFIND IDs after the final batch.

---

## Error Handling

- If `.speca/findings.json` does not exist, stop and tell the user to run `/speca-audit`.
- If `--targets` is not provided, stop with usage instructions.
- If a target directory does not exist or contains no `.sol` files, warn and skip that target.
- If `--finding=FIND-NNN` references a finding that does not exist, stop and tell the user.
- If `.speca/cross-findings.json` already exists and no batch flags are set, overwrite it.
- If `--resume` is specified but `.speca/cross_progress.json` does not exist, tell the user to start with `--batch=1`.

---

## Notes

- This command is **non-interactive**. Do not prompt the user for input.
- Cross-implementation findings are stored separately from primary findings in `cross-findings.json`. The `/speca-report` command should detect and include them if present.
- The structural similarity score (0.0–1.0) in the propagation_pattern reflects how closely the target code matches the original vulnerability's structure. A score of 0.9+ indicates nearly identical code patterns; 0.5–0.7 indicates the same vulnerability class but different code structure.
- MITIGATED results are valuable: they show where the target implementation is more secure, and the mitigation strategy may be worth backporting to the primary implementation.
- When scanning large targets with many contracts, focus on contracts that implement the same interface or inherit from the same base as the primary audit target. Do not scan unrelated utility contracts.
- All file paths in cross-findings are relative to the project root for the respective target (e.g., `repo-b/contracts/Vault.sol`).
