# SPECA Checklist Phase

You are generating a property-based security checklist from extracted requirements, code mappings, and a vulnerability pattern database. This produces `.speca/checklist.json`. This is the keystone step: the checklist determines what gets audited.

## Prerequisites Check

1. Read `.speca/config.json`. If missing, stop: "Run `/speca init` first."
2. Extract `threat_model` (actors, boundaries, assumptions) and `language` (default: `"en"`).
3. Read `.speca/requirements.json`. If missing, stop: "Run `/speca extract` first."
4. Read `.speca/mapping.json`. If missing, stop: "Run `/speca map` first."
5. Parse both JSON files.

### Checkpoint Support

```bash
node -e "import {getConfigHash} from '.claude/skills/speca/scripts/lib/config.mjs'; console.log(getConfigHash('.'))"
```
```bash
node -e "import {loadProgress, shouldResume} from '.claude/skills/speca/scripts/lib/progress.mjs'; const p = loadProgress('.', 'checklist'); console.log(JSON.stringify({progress: p, action: shouldResume(p, '<config_hash>')}))"
```

### Load Vulnerability Pattern Database

Read the vulnerability pattern database:
```
Read .claude/skills/speca/reference/vulnerability-patterns.md
```

This contains 10 categories with 26 patterns. Use these patterns when matching against mapped code.

---

## Phase 1: Derive Testable Properties from Mapped Requirements

Process mappings in batches (batch size: 10 mappings). For each mapped requirement (`status: "mapped"`):

### Step 1a: Positive Case Properties
Derive at least one property: correct behavior MUST occur when preconditions satisfied.
Format: `"<function>() <expected behavior> when <preconditions>"`

### Step 1b: Negative Case Properties
Derive at least one property: function MUST revert when preconditions NOT satisfied.
Format: `"<function>() reverts when <violated precondition>"`

### Step 1c: Edge Case Properties
Derive edge cases: zero values, max values, boundary conditions, state transitions.
Format: `"<function>() <expected behavior> when <edge condition>"`

### Save Batch Progress
After each batch of mappings:
```bash
node -e "import {saveProgress} from '.claude/skills/speca/scripts/lib/progress.mjs'; saveProgress('.', 'checklist', {phase:'checklist', status:'in_progress', completed_batches: <N>, total_batches: <total>, config_hash:'<hash>', updated_at: new Date().toISOString()})"
```

---

## Phase 2: Match Against Vulnerability Pattern Database

For each mapped requirement, examine code at mapped locations and match against patterns from `reference/vulnerability-patterns.md`.

### Step 2a: Determine Applicable Categories
Use the Pattern-to-Requirement Type Mapping table from the vulnerability patterns reference.

### Step 2b: Pattern Matching
For each applicable pattern:
1. Read code at each mapped location (use `line_range` from mapping).
2. Determine if code exhibits characteristics from the pattern's "What to check".
3. Only create check items for relevant patterns.

### Step 2c: Create Pattern-Based Check Items
For each matched pattern:
- **property**: Specific, testable statement referencing actual function name and vulnerability.
- **pattern_refs**: Array of pattern IDs (e.g., `["REENT-001"]`).
- **check_type**: `"static"` if verifiable by inspection, `"dynamic"` if requires test execution.

---

## Phase 3: Apply Threat Model Filter

For each generated check item:

### Step 3a: Read Threat Model
From config: actors, boundaries, assumptions.

### Step 3b: Filter Logic
1. Identify attacker capability required for the check.
2. Match against actors and boundaries.
3. Check if assumptions reduce applicability.

### Step 3c: Apply Filters
- **Within threat model**: Keep. Set `threat_model_filter` to relevant boundary.
- **Outside threat model**: **Exclude** from checklist. Record exclusion count.
- **Assumption reduces applicability**: Keep but lower priority one level. Explain in `threat_model_filter`.

---

## Phase 4: Handle Unmapped Requirements

For each `status: "unmapped"` mapping:
- **id**: `CHK-UNMAP-<NNN>` (zero-padded, starting 001)
- **property**: `"Verify whether requirement <id> is implemented: <text>"`
- **check_type**: `"static"`
- **pattern_refs**: `[]`
- **priority**: `"high"`

---

## Phase 5: Assign IDs and Priority

### Step 5a: Check IDs
Pattern: `CHK-<CATEGORY>-<PATTERN_NUM>-<SUFFIX>`

Categories: AUTH, VAL, STATE, EVT, ERR, DATA, LCY, GEN, REENT, ACCESS, INT, LOGIC, EXTCALL, GAS, ORACLE, ERC, UPGRADE, CRYPTO

### Step 5b: Priority
Combine requirement `severity_hint` with pattern severity:

| Req Severity | Pattern Severity | Priority |
|---|---|---|
| high | critical/high | critical |
| high | medium | high |
| medium | critical | high |
| medium | high | high |
| medium | medium | medium |
| low | critical | high |
| low | high | medium |
| low | medium | low |

---

## Phase 6: Write Output

Write `.speca/checklist.json`:

```json
{
  "generated_at": "<ISO 8601>",
  "total_checks": <N>,
  "pattern_db_version": "1.0",
  "summary": {
    "by_priority": { "critical": <N>, "high": <N>, "medium": <N>, "low": <N> },
    "by_check_type": { "static": <N>, "dynamic": <N> },
    "unmapped_checks": <N>,
    "threat_model_exclusions": <N>
  },
  "checklist": [
    {
      "id": "CHK-AUTH-001-a",
      "requirement_id": "R-AUTH-001",
      "property": "<testable property>",
      "check_type": "static|dynamic",
      "pattern_refs": ["ACCESS-001"],
      "threat_model_filter": "<boundary string>",
      "priority": "critical|high|medium|low"
    }
  ]
}
```

Order checklist by priority (critical first), then by ID within each priority.

---

## Phase 7: Print Summary

Print in configured `language`:

```
Security checklist generation complete!

Total check items: <N>

By priority:   Critical: <N>, High: <N>, Medium: <N>, Low: <N>
By check type: Static: <N>, Dynamic: <N>

Unmapped requirement checks: <N>
Threat model exclusions:     <N>

Pattern categories matched: <list>

Output written to: .speca/checklist.json
Next step: Run /speca audit to execute the audit.
```

Mark progress completed.

---

## Error Handling
- Missing prerequisites → tell user which `/speca` phase to run
- Empty requirements/mappings → stop with message
- Existing checklist.json → overwrite (idempotent)

## Notes
- **Non-interactive.**
- The vulnerability pattern database is the core differentiator. Be thorough in pattern matching.
- Create separate check items for each distinct vulnerability concern.
- Threat model filtering reduces false positives (56.8% per SPECA paper).
- Unmapped requirements are high-priority findings.
- If in doubt about check_type, classify as `"dynamic"`.
