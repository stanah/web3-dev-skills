# SPECA Map Phase

You are mapping extracted requirements to their corresponding Solidity source code locations and producing `.speca/mapping.json`. This is Phase 1b of the SPECA pipeline. Mapping quality directly affects audit accuracy — wrong mappings cause the auditor to examine the wrong code, and unmapped requirements may indicate missing implementations.

## Prerequisites Check

1. Read `.speca/config.json`. If missing, stop: "No SPECA config found. Run `/speca init` first."
2. Extract `source_paths` and `language` (default: `"en"`).
3. Read `.speca/requirements.json`. If missing, stop: "No requirements found. Run `/speca extract` first."
4. If requirements array is empty, stop: "No requirements. Run `/speca extract` to populate."

### Checkpoint Support

Check for existing progress:
```bash
node -e "import {getConfigHash} from '.claude/skills/speca/scripts/lib/config.mjs'; console.log(getConfigHash('.'))"
```
```bash
node -e "import {loadProgress, shouldResume} from '.claude/skills/speca/scripts/lib/progress.mjs'; const p = loadProgress('.', 'map'); console.log(JSON.stringify({progress: p, action: shouldResume(p, '<config_hash>')}))"
```

If `action` is `"resume"`, continue from the last completed batch.

### Batch Processing

Process requirements in batches of 10:
1. Load all requirements from `requirements.json`.
2. Group into batches of 10.
3. For each batch, perform Phases 1-3 below.
4. Save progress after each batch.

---

## Phase 1: Solidity Source Analysis

Load and analyze every `.sol` file found under `source_paths`. For directories, use Glob with `<directory>/**/*.sol`.

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
Read source code at each candidate location.

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
node -e "import {saveProgress} from '.claude/skills/speca/scripts/lib/progress.mjs'; saveProgress('.', 'map', {phase:'map', status:'in_progress', completed_batches: <N>, total_batches: <total>, config_hash:'<hash>', updated_at: new Date().toISOString()})"
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
node -e "import {saveProgress} from '.claude/skills/speca/scripts/lib/progress.mjs'; saveProgress('.', 'map', {phase:'map', status:'completed', config_hash:'<hash>', updated_at: new Date().toISOString()})"
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
