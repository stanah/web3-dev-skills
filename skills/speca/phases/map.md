# SPECA Map Phase

## Context Management
Read `$SPECA_DIR/reference/context-rules.md` and follow strictly.

You are mapping extracted requirements to their corresponding Solidity source code locations and producing `.speca/mapping.json`. This is Phase 1b of the SPECA pipeline. Mapping quality directly affects audit accuracy — wrong mappings cause the auditor to examine the wrong code, and unmapped requirements may indicate missing implementations.

## Prerequisites Check

1. Run `node $SPECA_DIR/scripts/speca-cli.mjs config --action summary`. If missing, stop: "No SPECA config found. Run `/speca init` first."
2. Extract `source_paths` and `language` (default: `"en"`).
3. Run `node $SPECA_DIR/scripts/speca-cli.mjs query --file requirements --mode summary`. If missing, stop: "No requirements found. Run `/speca extract` first."
4. If requirements array is empty, stop: "No requirements. Run `/speca extract` to populate."

### Checkpoint Support

Check for existing progress:
```bash
node $SPECA_DIR/scripts/speca-cli.mjs config --action hash
```
```bash
node $SPECA_DIR/scripts/speca-cli.mjs progress --phase map --action should-resume
```

If `action` is `"resume"`, continue from the last completed batch.

### Batch Processing

Process requirements in batches of 10:
```bash
# Get total count first
node $SPECA_DIR/scripts/speca-cli.mjs query --file requirements --mode summary
# Process in batches of 10
node $SPECA_DIR/scripts/speca-cli.mjs query --file requirements --mode batch --index 0 --size 10
```

For each batch, perform Phases 1-3 below. Save progress after each batch.

---

## Phase 1: Solidity Source Analysis

For each directory in `source_paths`, use Glob to find `.sol` files: `<directory>/**/*.sol`. NEVER read an entire `.sol` file. Instead:
- Use Glob to find `.sol` files under source_paths
- Use Grep to find specific identifiers (function names, modifiers, events, state variables)
- Use Read tool with `offset`/`limit` for targeted line ranges ONLY

For each `.sol` file, identify:

### 1a: Contract Definitions
- name, kind (contract/abstract/interface/library), inherits, line number

### 1b: Function Signatures
- name, visibility, modifiers, parameters, return_types, line_start, line_end, contract

### 1c: Modifier Definitions
- name, line_start, line_end, contract

### 1d: Event Definitions
- name, parameters, line, contract

### 1e: State Variables
- name, type, visibility, line, contract

### 1f: Constructor Logic
- initialized state variables, parameters, checks

Store all analysis as `source_catalog`, organized by file path then contract name.

---

## Phase 2: Keyword-Based Candidate Narrowing

For each requirement in the current batch:

### Step 2a: Extract Keywords
Extract Solidity identifiers from requirement text:
- Function names (patterns like `functionName()`)
- Modifier names, Event names, State variable names
- General keywords (nouns/verbs excluding stop words)

### Step 2b: Search Source Catalog
Match keywords: exact match > substring match > component match (camelCase splitting).

### Step 2c: Build Candidate List
Each candidate: `{ file, contract, element_type, element_name, line_range, keyword_matches }`

Special handling by requirement type:
- `access_control` → prioritize functions with modifiers
- `event_emission` → prioritize functions with `emit` statements
- `validation` → prioritize functions with `require`/`revert`
- `state_transition` → prioritize functions that modify state

---

## Phase 3: Semantic Refinement

### Step 3a: Read Candidate Code
Use Read tool with `offset`/`limit` for targeted line ranges at each candidate location. NEVER read an entire `.sol` file.

### Step 3b: Assess Semantic Match
Evaluate whether code semantically addresses the requirement.

### Step 3c: Assign Confidence Score
- **0.9-1.0**: Direct, clear implementation
- **0.7-0.89**: Likely implements but some ambiguity
- **0.5-0.69**: Partially addresses
- **Below 0.5**: Weak match, possibly unrelated

### Step 3d: Record Evidence
For confidence >= 0.5, record a one-sentence `evidence` string.

### Step 3e: Filter Candidates
Discard candidates with confidence below 0.5. Sort by confidence descending.

### Save Batch Progress
After each batch:
```bash
echo '{"phase":"map","status":"in_progress","completed_batches":<N>,"total_batches":<total>,"config_hash":"<hash>","updated_at":"<ISO>"}' | node $SPECA_DIR/scripts/speca-cli.mjs progress --phase map --action save
```

---

## Phase 4: Unmapped Detection

Requirements with no candidates at confidence >= 0.5 are "unmapped":
- Set `status` to `"unmapped"`
- Add `note` explaining why (no identifiers found / low confidence / function not found)
- Unmapped requirements are **high-value audit findings**

---

## Phase 5: Write Output

Write `.speca/mapping.json`:

```json
{
  "mapped_at": "<ISO 8601>",
  "source_files": ["<.sol files>"],
  "total_requirements": <N>,
  "mapped": <N>,
  "unmapped": <N>,
  "mappings": [
    {
      "requirement_id": "<string>",
      "requirement_text": "<string>",
      "locations": [
        {
          "file": "<path>",
          "contract": "<name>",
          "function": "<signature>",
          "line_range": [<start>, <end>],
          "confidence": <float>,
          "modifiers": ["<list>"],
          "evidence": "<string>"
        }
      ],
      "status": "<mapped|unmapped>"
    }
  ]
}
```

For unmapped entries, add `"note"` field.

---

## Phase 6: Print Summary

Print in configured `language`:

```
Requirement-to-code mapping complete!

Source files analyzed: <list>
Total requirements: <N>
  Mapped:   <count> (<pct>%)
  Unmapped: <count> (<pct>%)

Confidence distribution:
  High   (0.9-1.0): <count>
  Medium (0.7-0.89): <count>
  Low    (0.5-0.69): <count>

Output written to: .speca/mapping.json
Next step: Run /speca checklist to generate the audit checklist.
```

If unmapped, print warnings section.

Mark progress completed:
```bash
echo '{"phase":"map","status":"completed","config_hash":"<hash>","updated_at":"<ISO>"}' | node $SPECA_DIR/scripts/speca-cli.mjs progress --phase map --action save
```

---

## Error Handling

- Missing config → `/speca init`
- Missing requirements → `/speca extract`
- No `.sol` files found → error
- Existing mapping.json → overwrite (idempotent)

## Notes

- **Non-interactive.** Read config, process files, write output, print summary.
- All paths must be **relative** to project root.
- Be conservative with confidence scores — under-scoring is better than over-scoring.
- Unmapped requirements are the most valuable output.
