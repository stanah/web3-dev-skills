---
name: speca-report
description: Generate audit reports in Markdown and SARIF v2.1.0 from SPECA findings
---

# /speca-report - Generate Audit Reports

You are generating the final audit report from SPECA pipeline artifacts. This produces two output files: a human-readable Markdown report and a machine-readable SARIF v2.1.0 file for CI/CD integration. This is the final output step of the SPECA (SPEcification-to-Checklist Auditing) pipeline.

---

## Phase 0: Prerequisites Check

1. Read `.speca/findings.json` using the Read tool.
2. If the file does not exist, stop and tell the user: "No findings found. Please run `/speca-audit` first to perform the security audit."
3. Parse the JSON and extract: `audited_at`, `checklist_version`, `total_checks_audited`, `total_findings`, `findings_by_severity`, and the `findings` array.
4. Read `.speca/checklist.json` using the Read tool.
5. If the file does not exist, print a warning: "No checklist found (`.speca/checklist.json`). Coverage statistics will be omitted from the report." Set an internal flag `has_checklist = false` and continue.
6. If the file exists, parse the JSON and extract the `checklist` array and the `summary` object. Set `has_checklist = true`.
7. Read `.speca/requirements.json` using the Read tool.
8. If the file does not exist, print a warning: "No requirements found (`.speca/requirements.json`). Unmapped requirements section will be omitted from the report." Set an internal flag `has_requirements = false` and continue.
9. If the file exists, parse the JSON and extract the `requirements` array. Set `has_requirements = true`.
10. Read `.speca/mapping.json` using the Read tool.
11. If the file does not exist, print a warning: "No mapping found (`.speca/mapping.json`). Code references in the report will rely on findings data only." Set an internal flag `has_mapping = false` and continue.
12. If the file exists, parse the JSON and extract the `mappings` array. Set `has_mapping = true`.
13. Read `.speca/config.json` using the Read tool.
14. If the file does not exist, print a warning: "No config found (`.speca/config.json`). Threat model section will be omitted from the report." Set an internal flag `has_config = false` and continue.
15. If the file exists, parse the JSON and extract the `threat_model` object and determine the project target name: use the project directory name as the target name. Set `has_config = true`.
16. Read `.speca/test-results.json` using the Read tool.
17. If the file does not exist, set an internal flag `has_test_results = false` and continue silently (test results are optional).
18. If the file exists, parse the JSON and extract the `test_files` array. Set `has_test_results = true`.

---

## Phase 1: Markdown Report Generation

### Step 1a: Prepare Report Directory

Create the reports directory if it does not exist:

```bash
mkdir -p .speca/reports
```

### Step 1b: Determine Report Date

Use the current date in `YYYY-MM-DD` format for the report filename and the Date field in the report header.

### Step 1c: Compute Statistics

Before writing the report, compute the following statistics from the loaded data:

**Severity counts** (from `findings_by_severity` in `findings.json`):
- `critical_count`: Number of critical findings.
- `high_count`: Number of high findings.
- `medium_count`: Number of medium findings.
- `low_count`: Number of low findings.
- `info_count`: Number of informational findings.
- `total_findings`: Sum of all severity counts.

**Checklist coverage** (if `has_checklist` is true):
- For each priority level (`critical`, `high`, `medium`, `low`), count:
  - `checked`: Number of checklist items at that priority.
  - `passed`: Number of checklist items at that priority that do NOT have a corresponding finding in `findings.json` (match by `checklist_id`).
  - `failed`: Number of checklist items at that priority that DO have a corresponding finding in `findings.json`.
  - `skipped`: Number of checklist items with `check_type: "dynamic"` that were not audited (they appear in the checklist but were skipped during the static audit).
- `total_checks`: Total checklist items.
- `checks_audited`: Total checklist items minus skipped dynamic checks.
- `coverage_pct`: `(checks_audited / total_checks) * 100`, rounded to one decimal place.

**Requirements coverage** (if `has_requirements` and `has_mapping` are both true):
- `total_requirements`: Length of the `requirements` array.
- `mapped_requirements`: Number of entries in the `mappings` array with `status: "mapped"`.
- `unmapped_requirements`: Number of entries in the `mappings` array with `status: "unmapped"`.
- `mapping_pct`: `(mapped_requirements / total_requirements) * 100`, rounded to one decimal place.

### Step 1d: Write the Markdown Report

Write the report to `.speca/reports/YYYY-MM-DD-report.md` using the Write tool. Use the exact structure below, filling in computed values. Omit sections whose prerequisite data is unavailable (as indicated by the `has_*` flags).

```markdown
# SPECA Security Audit Report

**Date:** YYYY-MM-DD
**Framework:** SPECA v1.0
**Target:** [project name from config or directory name]

---

## Executive Summary

| Severity | Count |
|----------|-------|
| Critical | N |
| High | N |
| Medium | N |
| Low | N |
| Informational | N |
| **Total** | **N** |

**Checklist Coverage:** X/Y checks audited (Z%)
**Requirements Mapped:** X/Y requirements mapped (Z%)
```

If `has_checklist` is false, omit the "Checklist Coverage" line. If `has_requirements` or `has_mapping` is false, omit the "Requirements Mapped" line.

```markdown
---

## Threat Model
```

Include this section only if `has_config` is true. Populate from `config.json`:

```markdown
### Actors

| Actor | Trust Level |
|-------|------------|
| actor_name | TRUSTED/SEMI_TRUSTED/UNTRUSTED |

### Trust Boundaries

- boundary string 1
- boundary string 2

### Assumptions

- assumption string 1
- assumption string 2

---
```

```markdown
## Findings
```

For each finding in the `findings` array, sorted by severity descending (critical first, then high, medium, low, informational), and by finding ID within the same severity, write:

```markdown
### [FIND-NNN] Title (Severity)

**Severity:** Critical/High/Medium/Low/Informational
**Checklist Item:** CHK-XXX-NNN
**Requirement:** SPEC-XXX-NNN
**False Positive Risk:** Low/Medium/High

**Description:**
(finding description text)

**Proof Trace:**
```solidity
// file:startLine-endLine
code snippet from proof_trace.code_refs
```

**Reasoning:**
(finding proof_trace.reasoning text)

**Recommendation:**
(finding recommendation text)

---
```

For the "Requirement" field: look up the finding's `checklist_id` in the checklist to find the associated `requirement_id`. If the checklist is not available, check if the finding has any reference to a requirement ID in its description or checklist_id pattern, and use that. If no requirement can be determined, write "N/A".

For the "Proof Trace" code block: iterate over all entries in `proof_trace.code_refs`. For each entry, include a comment line with `// file:startLine-endLine` and then the `snippet` text. If there are multiple code references, include them all in the same fenced code block separated by a blank line.

If the `findings` array is empty, write:

```markdown
No findings were identified during this audit.

---
```

```markdown
## Checklist Coverage
```

Include this section only if `has_checklist` is true:

```markdown
| Priority | Checked | Passed | Failed | Skipped |
|----------|---------|--------|--------|---------|
| Critical | N | N | N | N |
| High | N | N | N | N |
| Medium | N | N | N | N |
| Low | N | N | N | N |
| **Total** | **N** | **N** | **N** | **N** |
```

```markdown
## Unmapped Requirements
```

Include this section only if `has_requirements` and `has_mapping` are both true. List requirements from the `mappings` array that have `status: "unmapped"`. For each, look up the full requirement text from `requirements.json` by matching the `requirement_id`.

If there are unmapped requirements:

```markdown
Requirements from the specification that could not be mapped to source code:

| ID | Text | Severity |
|----|------|----------|
| SPEC-XXX-NNN | requirement text (truncated to 120 chars if longer) | high/medium/low |
```

The "Severity" column uses the requirement's `severity_hint` field from `requirements.json`.

If there are no unmapped requirements:

```markdown
All requirements successfully mapped.
```

```markdown
## Test Results
```

Include this section only if `has_test_results` is true:

```markdown
| Test | Result | Finding |
|------|--------|---------|
| test_function_name | PASS/FAIL | FIND-NNN or N/A |
```

For each test file in `test_files`, iterate over its `test_functions` array. The "Test" column is the function name. The "Result" column is the `result` field in UPPERCASE. The "Finding" column is the `finding_id` from the parent test file object; if `finding_id` is null or absent, write "N/A".

If no tests were executed (`tests_executed` is false in `test-results.json`), write:

```markdown
Tests were generated but not executed. Run `forge test --match-path test/speca/ -vvv` to execute.
```

```markdown
## Methodology

This audit was performed using the SPECA (SPEcification-to-Checklist Auditing) framework v1.0.

**Pipeline:** `/speca-init` -> `/speca-extract` -> `/speca-map` -> `/speca-checklist` -> `/speca-audit` -> `/speca-test` -> `/speca-report`

**Reference:** [SPECA: Scalable LLM-Driven Specification-to-Checklist Auditing of Smart Contracts](https://arxiv.org/abs/2602.07513)
```

### Step 1e: Handle Existing Report

If a file already exists at the target path, overwrite it without asking. Report generation is idempotent.

---

## Phase 2: SARIF v2.1.0 Generation

### Step 2a: Build the Rules Array

For each unique `checklist_id` referenced by any finding in the `findings` array, create a SARIF rule entry:

```json
{
  "id": "<checklist_id>",
  "shortDescription": { "text": "<property from checklist item, or finding title if checklist unavailable>" },
  "defaultConfiguration": { "level": "<sarif_level>" }
}
```

To determine `<sarif_level>` for each rule, use the **highest severity** among all findings that reference that `checklist_id`, mapped as follows:

- `critical` -> `"error"`
- `high` -> `"error"`
- `medium` -> `"warning"`
- `low` -> `"note"`
- `informational` -> `"note"`

If `has_checklist` is true, look up the checklist item by `id` to get the `property` text for `shortDescription`. If the checklist is not available, use the finding's `title` instead.

### Step 2b: Build the Results Array

For each finding in the `findings` array, create a SARIF result entry:

```json
{
  "ruleId": "<checklist_id from the finding>",
  "level": "<sarif_level based on finding severity>",
  "message": { "text": "<finding title>: <finding description>" },
  "locations": [
    {
      "physicalLocation": {
        "artifactLocation": { "uri": "<file path from code_refs>" },
        "region": {
          "startLine": <start_line from code_refs>,
          "endLine": <end_line from code_refs>
        }
      }
    }
  ]
}
```

Severity to SARIF level mapping for each result:
- `critical` -> `"error"`
- `high` -> `"error"`
- `medium` -> `"warning"`
- `low` -> `"note"`
- `informational` -> `"note"`

For `locations`: iterate over all entries in `proof_trace.code_refs`. For each entry:
- `uri`: Use the `file` field as-is (relative path).
- `startLine`: Use the first element of the `lines` array.
- `endLine`: Use the second element of the `lines` array.

If a finding has multiple `code_refs`, include all of them as separate location entries in the `locations` array.

If a finding has no `code_refs` or the `lines` field is missing, omit the `locations` array entirely for that result.

### Step 2c: Build the Full SARIF Document

Construct the complete SARIF document:

```json
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [
    {
      "tool": {
        "driver": {
          "name": "speca",
          "version": "1.0",
          "informationUri": "https://arxiv.org/abs/2602.07513",
          "rules": [
            // rules array from Step 2a
          ]
        }
      },
      "results": [
        // results array from Step 2b
      ]
    }
  ]
}
```

If the `findings` array is empty, the `rules` array and `results` array should both be empty arrays `[]`.

### Step 2d: Write the SARIF File

Write the SARIF JSON to `.speca/reports/YYYY-MM-DD-report.sarif` using the Write tool. Use 2-space indentation for readability. The date in the filename must match the date used for the Markdown report.

### Step 2e: Handle Existing File

If a file already exists at the target path, overwrite it without asking. SARIF generation is idempotent.

---

## Phase 3: Completion

After writing both files, print the following output to the user:

### Step 3a: Print File Paths

```
Audit report generation complete!

Reports written to:
  Markdown: .speca/reports/YYYY-MM-DD-report.md
  SARIF:    .speca/reports/YYYY-MM-DD-report.sarif
```

### Step 3b: Print Executive Summary Inline

```
Executive Summary:
| Severity      | Count |
|---------------|-------|
| Critical      | <N>   |
| High          | <N>   |
| Medium        | <N>   |
| Low           | <N>   |
| Informational | <N>   |
| TOTAL         | <N>   |
```

If `has_checklist` is true, also print:
```
Checklist Coverage: X/Y checks audited (Z%)
```

If `has_requirements` and `has_mapping` are both true, also print:
```
Requirements Mapped: X/Y requirements mapped (Z%)
```

### Step 3c: Print Next Steps

```
Next steps:
  - Upload the SARIF file to GitHub Code Scanning or review the Markdown report
  - To upload SARIF to GitHub: gh api repos/{owner}/{repo}/code-scanning/sarifs -f "sarif=$(cat .speca/reports/YYYY-MM-DD-report.sarif | base64)"
  - Share the Markdown report with stakeholders for human review
```

---

## Error Handling

- If `.speca/findings.json` does not exist, stop and tell the user: "No findings found. Please run `/speca-audit` first to perform the security audit."
- If `.speca/findings.json` exists but the `findings` array is empty, proceed normally. Generate a report with "No findings were identified" and an empty SARIF results array. This is a valid state (clean audit).
- If `.speca/checklist.json` does not exist, warn and continue. Omit checklist-dependent sections.
- If `.speca/requirements.json` does not exist, warn and continue. Omit unmapped requirements section.
- If `.speca/mapping.json` does not exist, warn and continue. Omit mapping-dependent statistics.
- If `.speca/config.json` does not exist, warn and continue. Omit threat model section.
- If `.speca/test-results.json` does not exist, continue silently. Omit test results section.
- If the `.speca/reports/` directory does not exist, create it.
- If report files already exist at the target paths, overwrite without asking. Report generation is idempotent and re-runnable.

---

## Notes

- This skill is **non-interactive**. Do not prompt the user for input during report generation. Read all prerequisites, generate both reports, and print the summary.
- All file paths in the reports must be **relative** to the project root, matching the format used in `findings.json` and `mapping.json`.
- The Markdown report is designed for human consumption: clear structure, severity-sorted findings, and actionable recommendations.
- The SARIF report is designed for machine consumption: GitHub Code Scanning, IDE integrations, and CI/CD pipelines. It must be valid SARIF v2.1.0 JSON.
- Findings in both reports must be in the same order: sorted by severity descending (critical -> high -> medium -> low -> informational), then by finding ID within the same severity.
- The SARIF `level` field only supports three values (`error`, `warning`, `note`). Both `critical` and `high` map to `error` because SARIF does not distinguish between them. The Markdown report preserves the full five-level severity scale.
- When truncating requirement text for the unmapped requirements table, truncate at 120 characters and append `...` if the text was longer.
- The report date should reflect when the report was generated, not when the audit was performed (`audited_at`). Include the `audited_at` timestamp in the report metadata for traceability.
