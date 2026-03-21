# SPECA Audit Phase

You are performing a static security audit of Solidity smart contract source code against the specification-derived checklist. This is the core value-producing step. Your goal is to identify real vulnerabilities with concrete code evidence while minimizing false positives through threat model filtering.

## Context Management
Read `$SPECA_DIR/reference/context-rules.md` and follow strictly.

## Prerequisites Check

1. Run `node $SPECA_DIR/scripts/speca-cli.mjs config --action summary`. If missing, stop: "Run `/speca init` first."
2. Extract `threat_model` and `language` (default: `"en"`).
3. Run `node $SPECA_DIR/scripts/speca-cli.mjs filter --input .speca/checklist.json --type static --batch-index 0 --batch-size 1` to verify checklist exists. If missing, stop: "Run `/speca checklist` first."
4. Run `node $SPECA_DIR/scripts/speca-cli.mjs query --file mapping --mode get --id <req_id>` to verify mapping exists. If missing, stop: "Run `/speca map` first."
5. Load Solidity source files listed in mapping data's `source_files` using the Read tool with `offset`/`limit` parameters matching `line_range` from mapping data.

### Checkpoint Support

Determine config hash and check for existing progress:

```bash
node $SPECA_DIR/scripts/speca-cli.mjs config --action hash
```

```bash
node $SPECA_DIR/scripts/speca-cli.mjs progress --phase audit --action should-resume
```

- `"fresh"` → Start from beginning
- `"resume"` → Continue from `progress.current_batch`
- `"restart"` → Config changed, start over
- `"completed"` → Inform user, ask if re-run desired

If `$ARGUMENTS` contains `--resume`, force resume behavior.

---

## Phase 1: Sort and Batch Checklist

### Step 1a: Filter Static Checks

Use `speca-cli.mjs` to get static checks sorted by priority:

```bash
node $SPECA_DIR/scripts/speca-cli.mjs filter \
  --input .speca/checklist.json \
  --type static \
  --batch-index 0 --batch-size 5
```

This returns the first batch of 5 static checklist items with metadata:
```json
{
  "meta": { "totalFiltered": <N>, "totalBatches": <N>, "batchIndex": 0, "batchSize": 5 },
  "items": [...]
}
```

### Step 1b: Initialize Findings

For a fresh start, initialize the findings file:

```bash
node $SPECA_DIR/scripts/speca-cli.mjs record \
  --init \
  --audited-at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --checklist-version "<generated_at from checklist.json>"
```

Also create batch output directory:
```bash
mkdir -p .speca/progress/audit-batches
```

### Step 1c: Initialize Progress

```bash
echo '{"phase":"audit","status":"in_progress","started_at":"<ISO timestamp>","updated_at":"<ISO timestamp>","total_items":<totalFiltered>,"completed_items":0,"current_batch":0,"batch_size":5,"config_hash":"<hash>"}' | node $SPECA_DIR/scripts/speca-cli.mjs progress --phase audit --action save
```

---

## Phase 2: Three-Phase Inspection (Per Batch)

For each batch of 5 checklist items:

### Step 2a: Load Batch

```bash
node $SPECA_DIR/scripts/speca-cli.mjs filter \
  --input .speca/checklist.json \
  --type static \
  --mapping .speca/mapping.json \
  --batch-index <N> --batch-size 5
```

The `--mapping` flag enriches items with `_locations` and `_requirement_text` from mappings.

### Step 2b: For Each Item — Three-Phase Inspection

For each checklist item in the batch:

#### Phase 2b-i: Presence Check
1. Find code at mapped location via `requirement_id` → `mappings` → `locations`.
2. Use the Read tool with `offset` and `limit` parameters matching the `line_range` from the mapping data to read only the relevant portion of each source file.
3. If unmapped: create finding "Missing implementation for <requirement_id>".
4. If code exists: proceed.

#### Phase 2b-ii: Correctness Check
1. Does code correctly implement the requirement?
2. Are conditions/guards correct? (operators, require, modifiers, state vars)
3. Does logic match specification?
4. Check against `pattern_refs` vulnerability patterns.

#### Phase 2b-iii: Completeness Check
1. All edge cases handled? (zero, max, address(0))
2. Error paths covered?
3. All code paths reachable?
4. State consistency after execution?

### Step 2c: Threat Model Filtering

For each potential finding:
1. **Identify attacker**: Who can trigger this? (UNTRUSTED/SEMI_TRUSTED/TRUSTED)
2. **Classify false positive risk**:
   - Within threat model → `false_positive_risk: "low"`
   - Partially outside → `false_positive_risk: "medium"` + `threat_model_note`
   - Outside threat model → `false_positive_risk: "high"` + `threat_model_note`
   - **Still include all findings** — do NOT silently discard

### Step 2d: Construct Findings

Each finding MUST include:

```json
{
  "id": "FIND-NNN",
  "checklist_id": "CHK-...",
  "severity": "critical|high|medium|low|informational",
  "title": "Short descriptive title",
  "description": "Detailed description",
  "proof_trace": {
    "code_refs": [{ "file": "...", "lines": [start, end], "snippet": "verbatim code" }],
    "reasoning": "Specification says: ... Code does: ... Gap: ... Impact: ..."
  },
  "recommendation": "Specific fix suggestion",
  "false_positive_risk": "low|medium|high",
  "threat_model_note": "..."
}
```

**Proof traces are non-negotiable.** Every finding must reference actual code with verbatim snippets.

### Step 2e: Save Batch Results

Save this batch's findings to a batch file:

```bash
echo '<JSON array of findings>' | node $SPECA_DIR/scripts/speca-cli.mjs record --write-batch --batch-index <N>
```

### Step 2f: Update Progress

```bash
echo '{"phase":"audit","status":"in_progress","started_at":"<original>","updated_at":"<ISO timestamp>","total_items":<total>,"completed_items":<completed>,"current_batch":<next_batch>,"batch_size":5,"config_hash":"<hash>"}' | node $SPECA_DIR/scripts/speca-cli.mjs progress --phase audit --action save
```

### Step 2g: Repeat

Continue to next batch until all batches processed.

---

## Phase 3: Merge and Finalize

After all batches complete, merge findings:

```bash
node $SPECA_DIR/scripts/speca-cli.mjs merge \
  --audited-at "<timestamp>" \
  --checklist-version "<checklist generated_at>"
```

This reads all `batch-*.json` files, deduplicates, sorts by severity, and writes `.speca/findings.json`.

---

## Phase 4: Compute Statistics

```bash
node $SPECA_DIR/scripts/speca-cli.mjs stats \
  --findings .speca/findings.json \
  --checklist .speca/checklist.json \
  --format text
```

---

## Phase 5: Print Summary

Print in configured `language`:

```
Static security audit complete!

Findings Summary:
| Severity      | Count |
|---------------|-------|
| Critical      | <N>   |
| High          | <N>   |
| Medium        | <N>   |
| Low           | <N>   |
| Informational | <N>   |
| TOTAL         | <N>   |

Findings:
| ID       | Severity | Title                    | File:Line              | FP Risk |
|----------|----------|--------------------------|------------------------|---------|
| FIND-001 | critical | ...                      | contracts/Vault.sol:23 | low     |

Checklist Coverage:
  Static checks audited: <N> / <total>
  Dynamic checks skipped: <N> (to be tested with /speca test)

Output written to: .speca/findings.json

Next steps:
  - Run /speca test to generate PoC tests for critical/high findings
  - Run /speca report to generate the full audit report
```

Mark progress completed:
```bash
echo '{"phase":"audit","status":"completed","config_hash":"<hash>","updated_at":"<ISO timestamp>"}' | node $SPECA_DIR/scripts/speca-cli.mjs progress --phase audit --action save
```

---

## Severity Classification

- **Critical**: Direct fund loss, contract drain, permanent DoS.
- **High**: Access control bypass, privilege escalation, state corruption with potential fund impact.
- **Medium**: Logic errors without direct fund impact, DoS with recovery, spec deviations.
- **Low**: Best practice violations, gas inefficiency, minor spec deviations.
- **Informational**: Suggestions, style recommendations, documentation gaps.

## Critical Audit Principles

1. **Be thorough but not paranoid.** Only report issues with concrete code evidence.
2. **Three-phase inspection order is mandatory.** Presence → Correctness → Completeness.
3. **Threat model filtering happens AFTER finding issues.** Find first, evaluate second.
4. **False positives waste reviewer time.** Be honest about uncertainty via `false_positive_risk`.
5. **False negatives miss vulnerabilities.** Be especially thorough with critical/high items.
6. **Proof traces are non-negotiable.** Copy relevant lines verbatim.
7. **Severity must match impact.** Don't inflate or deflate.

## Error Handling
- Missing prerequisites → tell user which `/speca` phase to run
- Missing source file → warn, skip checks, record finding
- Empty checklist → stop with message
- Existing findings.json → overwrite (idempotent)

## Notes
- **Non-interactive.** Read all prerequisites, perform audit, write output, print summary.
- All paths must be **relative** to project root.
- Dynamic checks (`check_type: "dynamic"`) are skipped — handled by `/speca test`.
- When multiple checklist items point to same issue, create one finding referencing all.
