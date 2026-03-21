# SPECA Report Phase

## Context Management
Read `$SPECA_DIR/reference/context-rules.md` and follow strictly.

You are generating the final audit report from SPECA pipeline artifacts. This produces two output files: a human-readable Markdown report and a machine-readable SARIF v2.1.0 file. This is the final step of the SPECA pipeline.

## Prerequisites Check

1. Query findings summary to check existence and extract metadata:
   ```bash
   node $SPECA_DIR/scripts/speca-cli.mjs query --file findings --mode summary
   ```
   If findings are missing, stop: "Run `/speca audit` first."
   Extract: `audited_at`, `checklist_version`, `total_checks_audited`, `total_findings`, `findings_by_severity`.

2. Query config summary to extract target and language settings:
   ```bash
   node $SPECA_DIR/scripts/speca-cli.mjs config --action summary
   ```
   If config is missing, warn. Set `has_config = false`.
   If config exists, extract `threat_model`, `language` (default: `"en"`), and determine `targetName` from project directory.

3. Other `.speca/` files (checklist, requirements, mapping, test-results) are read internally by the report subcommand — no manual reads needed.

---

## Phase 1: Markdown Report Generation

### Step 1a: Prepare Directory
```bash
mkdir -p .speca/reports
```

### Step 1b: Generate Report with speca-cli

Use the report subcommand to generate the full Markdown report skeleton:

```bash
node $SPECA_DIR/scripts/speca-cli.mjs report \
  --format md \
  --output .speca/reports/YYYY-MM-DD-report.md \
  --date "YYYY-MM-DD" \
  --target-name "<name>"
```

This generates:
- Report header with date, framework, target
- Executive summary table (severity counts)
- Checklist coverage line
- Threat model section (actors, boundaries, assumptions)
- Finding sections with proof traces
- Methodology section

### Step 1c: Localize and Polish (LLM Task)

**Note:** Reading back `.speca/reports/*.md` for polishing is ALLOWED per context-rules.md.

After the skeleton is generated, read the skeleton file and:

1. **Localize** all section headers, labels, and static text to the configured `language`.
   - If `language` is `"en"`, no localization needed.
   - If `language` is `"ja"`, translate headers: "Executive Summary" → "エグゼクティブサマリー", etc.
2. **Polish** finding descriptions, recommendations, and reasoning for clarity.
3. **Add** any additional sections the skeleton doesn't cover:
   - Unmapped Requirements table (if `has_requirements` and `has_mapping`)
   - Test Results table (if `has_test_results`)
   - Checklist Coverage table (computed from checklist + findings data)

### Step 1d: Compute Coverage Statistics

```bash
node $SPECA_DIR/scripts/speca-cli.mjs stats \
  --findings .speca/findings.json \
  --checklist .speca/checklist.json \
  --format json
```

Use the output to add the Checklist Coverage table:

```markdown
## Checklist Coverage

| Priority | Checked | Passed | Failed | Skipped |
|----------|---------|--------|--------|---------|
| Critical | N | N | N | N |
| High | N | N | N | N |
| Medium | N | N | N | N |
| Low | N | N | N | N |
| **Total** | **N** | **N** | **N** | **N** |
```

### Step 1e: Add Unmapped Requirements

If `has_requirements` and `has_mapping`:
- List unmapped requirements from mappings with `status: "unmapped"`.
- If none: "All requirements successfully mapped."

### Step 1f: Add Test Results

If `has_test_results`:
- Include test results table from `.speca/test-results.json`.

---

## Phase 2: SARIF v2.1.0 Generation (Fully Script-Driven)

The SARIF generation is entirely handled by the CLI:

```bash
node $SPECA_DIR/scripts/speca-cli.mjs report \
  --format sarif \
  --output .speca/reports/YYYY-MM-DD-report.sarif
```

This produces a valid SARIF v2.1.0 file with:
- Tool driver: `speca` v1.0
- Rules: derived from unique checklist IDs in findings
- Results: one per finding with locations from code_refs
- Severity mapping: critical/high → error, medium → warning, low/info → note

No LLM processing needed for SARIF — it's fully deterministic.

---

## Phase 3: Completion

### Step 3a: Print Summary

Print in configured `language`:

```
Audit report generation complete!

Reports written to:
  Markdown: .speca/reports/YYYY-MM-DD-report.md
  SARIF:    .speca/reports/YYYY-MM-DD-report.sarif

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

If `has_checklist`: `Checklist Coverage: X/Y checks audited (Z%)`
If `has_requirements` and `has_mapping`: `Requirements Mapped: X/Y (Z%)`

### Step 3b: Next Steps

```
Next steps:
  - Upload SARIF to GitHub Code Scanning or review the Markdown report
  - Share the Markdown report with stakeholders for human review
```

---

## Language Handling

**In Markdown report:**
- Section headers, labels, static text → localized to `language`
- Finding descriptions, recommendations, reasoning → localized to `language`
- Identifiers (FIND-NNN, CHK-XXX), severity names, code snippets, file paths → always English

**In SARIF:**
- Always English (machine-readable format)

**In console output:**
- All text localized to `language`

---

## Error Handling
- Missing findings.json → stop, tell user to run `/speca audit`
- Missing other files → warn and continue (omit dependent sections)
- Empty findings array → valid state (clean audit), generate "No findings" report
- Existing reports → overwrite (idempotent)

## Notes
- **Non-interactive.**
- SARIF generation is fully script-driven (zero LLM cost).
- Markdown skeleton is script-generated; LLM only polishes prose and localizes.
- Report date = generation date, not audit date.
- Both reports must have findings in same order: severity descending, then by ID.
