---
name: speca-extract
description: Extract normative requirements from specification documents (md/yaml) into structured JSON
---

# /speca-extract - Extract Requirements from Specifications

You are extracting normative requirements from specification documents and producing a structured JSON file at `.speca/requirements.json`. This is Phase 1a of the SPECA (SPEcification-to-Checklist Auditing) pipeline. Accuracy is critical — missed requirements create gaps in the audit checklist, and incorrect classification affects priority ordering.

---

## Phase 0: Prerequisites Check

1. Read `.speca/config.json` using the Read tool.
2. If the file does not exist, stop and tell the user: "No SPECA config found. Please run `/speca-init` first to initialize the project."
3. Parse the JSON and extract the `spec_paths` array and the `threat_model` object. You will need both.
4. Validate that each file listed in `spec_paths` exists by reading it. If any file is missing, report which file(s) are missing and stop.

---

## Phase 1: Process Markdown Specification Files

For each file in `spec_paths` that has a `.md` extension, perform the following steps.

### Step 1a: Read the File

Read the entire file content using the Read tool. You will need line numbers for source tracking, so note the line number of each requirement you extract.

### Step 1b: Scan for RFC 2119 Modal Verbs

Search every line for the following RFC 2119 modal verbs, matching them **case-sensitively in UPPERCASE only**:

- `MUST`
- `MUST NOT`
- `SHALL`
- `SHALL NOT`
- `SHOULD`
- `SHOULD NOT`
- `MAY`

A requirement is any sentence, bullet point, or list item that contains one or more of these modal verbs. Extract the **full text** of that sentence or bullet (not just the fragment around the verb).

### Step 1c: Extract Requirement Metadata

For each identified requirement, determine these fields:

1. **id**: Check if the requirement text contains an explicit ID matching the pattern `R-XXX-NNN:` (e.g., `R-AUTH-001:`). If it does, use that exact ID. If not, auto-generate an ID later in Phase 3.

2. **text**: The full requirement text. If the text begins with an explicit ID followed by a colon, include the ID in the text field as well (e.g., `"R-AUTH-001: Only the contract owner MUST be able to call withdraw()"`). Trim leading bullet markers (`-`, `*`, numbers) and whitespace.

3. **modal**: The primary modal verb found. If multiple modals appear, use the **strongest** one. Strength order (strongest to weakest): `MUST NOT` > `MUST` > `SHALL NOT` > `SHALL` > `SHOULD NOT` > `SHOULD` > `MAY`. Always check for two-word modals (`MUST NOT`, `SHALL NOT`, `SHOULD NOT`) before single-word modals.

4. **type**: Classify into exactly one of these categories based on the requirement content:
   - `access_control` — Who can call a function, permission checks, role-based access, whitelist/blacklist logic, ownership restrictions. Look for keywords: owner, caller, whitelist, permission, only, access, role, admin, authorized.
   - `validation` — Input validation, parameter constraints, precondition checks, revert conditions on bad input. Look for keywords: revert, require, check, validate, must be, must not exceed, greater than, less than, zero, invalid.
   - `state_transition` — Ordering of operations, state changes, checks-effects-interactions pattern, storage updates. Look for keywords: pattern, before, after, update, state, transition, order, follow.
   - `event_emission` — Events that must or should be emitted. Look for keywords: event, emit, emitted, log.
   - `error_handling` — Revert messages, error codes, failure modes, graceful degradation. Look for keywords: revert, error, fail, throw, panic, handle.
   - `data_integrity` — Balance tracking, accounting correctness, overflow/underflow protection, storage consistency. Look for keywords: balance, credit, debit, track, accounting, integrity, overflow.
   - `lifecycle` — Pause/unpause, initialization, destruction, upgrade patterns, deployment. Look for keywords: pause, unpause, halt, initialize, destroy, upgrade, deploy, emergency.
   - `other` — Anything that does not clearly fit the above categories.

   When a requirement could fit multiple categories, prefer the most **specific** category. For example, "Only the owner MUST be able to call `emergencyPause()`" is `access_control` (not `lifecycle`), because the primary concern is the access restriction.

5. **severity_hint**: Based on the modal verb:
   - `MUST`, `MUST NOT`, `SHALL`, `SHALL NOT` -> `"high"`
   - `SHOULD`, `SHOULD NOT` -> `"medium"`
   - `MAY` -> `"low"`

6. **source**: An object with:
   - `file`: The relative path of the spec file (as listed in `spec_paths`).
   - `line`: The line number in the file where the requirement appears (1-indexed, as reported by the Read tool).
   - `section`: The most recent Markdown heading (`#`, `##`, `###`, etc.) that precedes the requirement line. Use the heading text without the `#` markers.

### Step 1d: Collect All Markdown Requirements

Accumulate all extracted requirements into a list called `md_requirements`.

---

## Phase 2: Process YAML Specification Files

For each file in `spec_paths` that has a `.yaml` or `.yml` extension, perform the following steps.

### Step 2a: Read and Parse the YAML

Read the file using the Read tool. Parse the YAML structure mentally — do not execute code to parse it; interpret the YAML directly.

### Step 2b: Extract Requirements from Function Definitions

For each entry under the `functions` key, extract requirements from these sub-fields:

#### From `requirements` arrays:

Each string in a function's `requirements` array becomes a separate requirement. Set fields as follows:

- **text**: The requirement string as-is from the YAML.
- **modal**: If the text contains an RFC 2119 modal verb (case-insensitive here since YAML specs are typically lowercase), use the appropriate modal in UPPERCASE. If no explicit modal is present, infer `MUST` (since items in a `requirements` array are implicitly mandatory).
- **type**: Classify using the same rules as Phase 1, Step 1c.4.
- **severity_hint**: Derive from the modal as in Phase 1, Step 1c.5.
- **source**: `{ "file": "<yaml_file_path>", "line": null, "section": "<function_name>" }`. Set `line` to `null` since YAML line tracking is imprecise; use the function name as the section.

#### From `access` fields:

Each function's `access` value becomes an access control requirement:

- **text**: `"<function_name>() access is restricted to <access_value>"`. For example: `"withdraw() access is restricted to owner_only"`.
- **modal**: `MUST`
- **type**: `access_control`
- **severity_hint**: `"high"`
- **source**: `{ "file": "<yaml_file_path>", "line": null, "section": "<function_name>.access" }`

Additionally, map the `access` value to the threat model actors when possible:
- `owner_only` maps to the actor with trust level `TRUSTED`
- `whitelist_or_owner` maps to actors that are `TRUSTED` or `SEMI_TRUSTED`
- If the access field does not match a known pattern, record it as-is.

#### From `params` with type constraints:

Each parameter defined under `params` becomes a validation requirement:

- **text**: `"<function_name>() parameter '<param_name>' must be of type <param_type>"`.
- **modal**: `MUST`
- **type**: `validation`
- **severity_hint**: `"high"`
- **source**: `{ "file": "<yaml_file_path>", "line": null, "section": "<function_name>.params" }`

#### From `events`:

Each event in a function's `events` array becomes an event emission requirement:

- **text**: `"<function_name>() must emit <event_signature>"`. For example: `"deposit() must emit Deposited(address indexed sender, uint256 amount)"`.
- **modal**: `MUST`
- **type**: `event_emission`
- **severity_hint**: `"high"`
- **source**: `{ "file": "<yaml_file_path>", "line": null, "section": "<function_name>.events" }`

### Step 2c: Collect All YAML Requirements

Accumulate all extracted requirements into a list called `yaml_requirements`. None of these will have explicit IDs from the source, so leave `id` as `null` for now.

---

## Phase 3: Deduplication and Merging

When both Markdown and YAML spec files exist, requirements may overlap. Perform deduplication:

### Step 3a: Detect Duplicates

Compare each YAML requirement against each Markdown requirement. Two requirements are duplicates if they describe the **same functional constraint on the same function or behavior**. Use semantic comparison, not exact string matching. Examples of duplicates:

- MD: `"deposit() MUST revert if msg.value is 0"` and YAML: `"msg.value must be greater than 0"` (same validation on deposit)
- MD: `"A Deposited(address, uint256) event MUST be emitted on successful deposit"` and YAML: `"deposit() must emit Deposited(address indexed sender, uint256 amount)"` (same event requirement)

### Step 3b: Merge Duplicates

For each duplicate pair:
1. Keep the **more detailed** version (usually the Markdown version since it tends to have more context).
2. Add a `cross_refs` field to the kept requirement that references the other source. Format: `"<file>:<function_name>.<sub_field>"`. For example: `"docs/interface.yaml:withdraw.access"`.
3. Remove the duplicate from the other list.

### Step 3c: Combine Lists

Merge `md_requirements` and the remaining (non-duplicate) `yaml_requirements` into a single `all_requirements` list. Order:
1. Markdown requirements first, in the order they appeared in the file.
2. Then remaining YAML requirements, in the order of function definitions.

---

## Phase 4: Assign IDs

For each requirement in `all_requirements` that does not already have an explicit ID:

1. Determine the category abbreviation from the `type` field:
   - `access_control` -> `AUTH`
   - `validation` -> `VAL`
   - `state_transition` -> `STATE`
   - `event_emission` -> `EVT`
   - `error_handling` -> `ERR`
   - `data_integrity` -> `DATA`
   - `lifecycle` -> `LCY`
   - `other` -> `GEN`

2. Auto-generate an ID using the pattern `SPEC-<ABBREV>-NNN`, where `NNN` is a zero-padded three-digit counter. The counter is per-category and starts at `001`. For example, the first auto-generated access control requirement gets `SPEC-AUTH-001`, the second gets `SPEC-AUTH-002`, and so on.

3. Do **not** reassign IDs to requirements that already have explicit IDs from the Markdown source (e.g., `R-AUTH-001`). Those keep their original IDs.

---

## Phase 5: Write Output

### Step 5a: Build the Output JSON

Construct the output object with this exact schema:

```json
{
  "extracted_at": "<ISO 8601 timestamp>",
  "spec_sources": ["<path1>", "<path2>"],
  "total_requirements": <integer>,
  "requirements": [
    {
      "id": "<string>",
      "text": "<string>",
      "type": "<access_control|validation|state_transition|event_emission|error_handling|data_integrity|lifecycle|other>",
      "severity_hint": "<high|medium|low>",
      "source": {
        "file": "<string>",
        "line": <integer or null>,
        "section": "<string>"
      },
      "modal": "<MUST|MUST NOT|SHALL|SHALL NOT|SHOULD|SHOULD NOT|MAY>",
      "cross_refs": ["<string>"]
    }
  ]
}
```

Field details:
- `extracted_at`: Current date and time in ISO 8601 format (e.g., `"2026-02-17T12:00:00Z"`).
- `spec_sources`: The `spec_paths` array from config.json.
- `total_requirements`: The count of items in the `requirements` array.
- `requirements`: The `all_requirements` list from Phase 4.
- `cross_refs`: Only include this field on requirements that have cross-references. If a requirement has no cross-references, **omit** the `cross_refs` field entirely (do not include an empty array).

### Step 5b: Write the File

Write the JSON to `.speca/requirements.json` using the Write tool. Use 2-space indentation for readability.

---

## Phase 6: Print Summary

After writing the file, print a summary to the user in this format:

```
Requirements extraction complete!

Source files processed:
  - <file1>
  - <file2>

Total requirements extracted: <N>

By type:
  access_control:    <count>
  validation:        <count>
  state_transition:  <count>
  event_emission:    <count>
  error_handling:    <count>
  data_integrity:    <count>
  lifecycle:         <count>
  other:             <count>

By severity:
  high:   <count>
  medium: <count>
  low:    <count>

Duplicates merged: <count>

Output written to: .speca/requirements.json

Next step: Run /speca-map to map requirements to source code.
```

Only include type rows that have a non-zero count.

---

## Error Handling

- If `.speca/config.json` does not exist, stop and tell the user to run `/speca-init`.
- If a spec file listed in `spec_paths` does not exist, report the missing file and stop.
- If a spec file has an unsupported extension (not `.md`, `.yaml`, or `.yml`), skip it and warn the user.
- If no requirements are found in any spec file, write an empty requirements array and warn the user that no normative requirements were detected. Suggest checking that the spec uses RFC 2119 modal verbs.
- If `.speca/requirements.json` already exists, overwrite it without asking (extraction is idempotent and re-runnable).

---

## Notes

- This command is **non-interactive**. Do not prompt the user for input during extraction. Read the config, process the files, write the output, and print the summary.
- All file paths in the output must be **relative** to the project root, matching the format in `config.json`.
- The quality of the downstream audit depends entirely on the completeness and accuracy of this extraction. Be thorough: scan every line of Markdown files and every field of YAML function definitions.
- When in doubt about requirement classification, prefer `access_control` for anything about who can call what, `validation` for anything about input correctness, and `event_emission` for anything about events.
