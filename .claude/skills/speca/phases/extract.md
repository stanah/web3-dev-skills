# SPECA Extract Phase

You are extracting normative requirements from specification documents and producing `.speca/requirements.json`. This is Phase 1a of the SPECA pipeline. Accuracy is critical — missed requirements create gaps in the audit checklist.

## Prerequisites Check

1. Read `.speca/config.json`. If missing, stop: "No SPECA config found. Run `/speca init` first."
2. Extract `spec_paths`, `threat_model`, and `language` (default: `"en"`).
3. Validate each file in `spec_paths` exists. Report missing files and stop if any are missing.

### Checkpoint Support

For projects with many spec files, use checkpoint-based processing:

1. Run: `node .claude/skills/speca/scripts/lib/config.mjs` is available as a library. Use the config hash for change detection:
   ```bash
   node -e "import {getConfigHash} from '.claude/skills/speca/scripts/lib/config.mjs'; console.log(getConfigHash('.'))"
   ```

2. Check for existing progress:
   ```bash
   node -e "import {loadProgress, shouldResume} from '.claude/skills/speca/scripts/lib/progress.mjs'; const p = loadProgress('.', 'extract'); console.log(JSON.stringify({progress: p, action: shouldResume(p, '<config_hash>')}))"
   ```

3. If `action` is `"resume"`, continue from the last completed spec file.
4. If `action` is `"restart"` or `"fresh"`, start from the beginning.
5. If `action` is `"completed"`, inform user and ask if they want to re-run.

---

## Phase 1: Process Markdown Specification Files

For each `.md` file in `spec_paths`:

### Step 1a: Read the File
Read the entire file. Note line numbers for source tracking.

### Step 1b: Scan for RFC 2119 Modal Verbs
Search every line for these modal verbs (**case-sensitive, UPPERCASE only**):
- `MUST`, `MUST NOT`, `SHALL`, `SHALL NOT`, `SHOULD`, `SHOULD NOT`, `MAY`

A requirement is any sentence or bullet containing one or more of these verbs.

### Step 1c: Extract Requirement Metadata

For each requirement, determine:

1. **id**: Check for explicit ID pattern `R-XXX-NNN:`. If found, use it. Otherwise, auto-generate later.
2. **text**: Full requirement text, trimmed of bullet markers.
3. **modal**: Primary (strongest) modal verb. Strength: `MUST NOT` > `MUST` > `SHALL NOT` > `SHALL` > `SHOULD NOT` > `SHOULD` > `MAY`. Check two-word modals first.
4. **type**: Classify as one of:
   - `access_control` — permission checks, role-based access, whitelist logic
   - `validation` — input validation, parameter constraints, revert conditions
   - `state_transition` — operation ordering, state changes, CEI pattern
   - `event_emission` — events that must be emitted
   - `error_handling` — revert messages, error codes, failure modes
   - `data_integrity` — balance tracking, accounting correctness
   - `lifecycle` — pause/unpause, initialization, upgrades
   - `other` — anything else
5. **severity_hint**: `MUST/MUST NOT/SHALL/SHALL NOT` → `"high"`, `SHOULD/SHOULD NOT` → `"medium"`, `MAY` → `"low"`
6. **source**: `{ "file": "<path>", "line": <number>, "section": "<nearest heading>" }`

### Step 1d: Save Progress After Each File
After processing each spec file, save progress:
```bash
node -e "import {saveProgress} from '.claude/skills/speca/scripts/lib/progress.mjs'; saveProgress('.', 'extract', {phase:'extract', status:'in_progress', completed_files: <N>, total_files: <total>, config_hash:'<hash>', updated_at: new Date().toISOString()})"
```

---

## Phase 2: Process YAML Specification Files

For each `.yaml`/`.yml` file in `spec_paths`:

### Step 2a: Read and Parse
Read the file. Interpret YAML structure directly (do not execute code to parse).

### Step 2b: Extract Requirements from Function Definitions

From each entry under `functions`:

- **`requirements` arrays**: Each string becomes a requirement. Infer `MUST` if no explicit modal.
- **`access` fields**: Generate `"<fn>() access is restricted to <value>"` with type `access_control`.
- **`params`**: Generate `"<fn>() parameter '<name>' must be of type <type>"` with type `validation`.
- **`events`**: Generate `"<fn>() must emit <event_signature>"` with type `event_emission`.

---

## Phase 3: Deduplication and Merging

When both MD and YAML specs exist:

1. **Detect duplicates**: Compare semantically (same functional constraint on same function).
2. **Merge**: Keep the more detailed version (usually Markdown). Add `cross_refs` field referencing the other source.
3. **Combine**: Markdown requirements first, then remaining YAML requirements.

---

## Phase 4: Assign IDs

For requirements without explicit IDs, auto-generate using pattern `SPEC-<ABBREV>-NNN`:

| Type | Abbreviation |
|------|-------------|
| `access_control` | `AUTH` |
| `validation` | `VAL` |
| `state_transition` | `STATE` |
| `event_emission` | `EVT` |
| `error_handling` | `ERR` |
| `data_integrity` | `DATA` |
| `lifecycle` | `LCY` |
| `other` | `GEN` |

Counter is per-category, zero-padded to 3 digits, starting at 001.

---

## Phase 5: Write Output

Write `.speca/requirements.json`:

```json
{
  "extracted_at": "<ISO 8601>",
  "spec_sources": ["<paths>"],
  "total_requirements": <N>,
  "requirements": [
    {
      "id": "<string>",
      "text": "<string>",
      "type": "<category>",
      "severity_hint": "<high|medium|low>",
      "source": { "file": "<path>", "line": <int|null>, "section": "<string>" },
      "modal": "<MODAL>",
      "cross_refs": ["<string>"]  // only if present
    }
  ]
}
```

---

## Phase 6: Print Summary

Print summary in the configured `language`:

```
Requirements extraction complete!

Source files processed: <list>
Total requirements extracted: <N>

By type:  <non-zero counts>
By severity: <counts>
Duplicates merged: <count>

Output written to: .speca/requirements.json
Next step: Run /speca map to map requirements to source code.
```

Mark progress as completed:
```bash
node -e "import {saveProgress} from '.claude/skills/speca/scripts/lib/progress.mjs'; saveProgress('.', 'extract', {phase:'extract', status:'completed', config_hash:'<hash>', updated_at: new Date().toISOString()})"
```

---

## Error Handling

- Missing config → tell user to run `/speca init`
- Missing spec file → report and stop
- Unsupported extension → skip with warning
- No requirements found → write empty array, warn about RFC 2119 modal verbs
- Existing requirements.json → overwrite (extraction is idempotent)

## Notes

- This phase is **non-interactive**. Read config, process files, write output, print summary.
- All paths must be **relative** to project root.
- Be thorough: scan every line of Markdown and every field of YAML function definitions.
