# SPECA Context Guard — Design Spec

**Date:** 2026-03-20
**Status:** Approved
**Problem:** SPECA pipeline agents consume excessive context by directly reading intermediate JSON files (`.speca/*.json`) and full Solidity source files, causing context window exhaustion across all phases.

---

## Solution Overview

Three components working together:

1. **`speca-cli.mjs`** — Unified CLI replacing all direct file reads and individual scripts
2. **`reference/context-rules.md`** — Shared rules file loaded at the start of every phase
3. **Phase file rewrites** — Remove all direct Read instructions, replace with `speca-cli.mjs` commands

---

## Component 1: `speca-cli.mjs`

Unified CLI entry point at `.claude/skills/speca/scripts/speca-cli.mjs`.

Internally imports existing script functions (`filterChecklist`, `computeStats`, `generateSarif`, etc.) — no logic duplication.

Existing individual scripts are retained for test compatibility only. Their CLI entry points (`if (process.argv[1] === import.meta.filename)`) continue to work with their current flags, but phase instructions reference only `speca-cli.mjs`.

### Global Flag

All subcommands accept `--project-root <path>` (default: `.`). This is passed to all underlying functions that take `projectRoot`. All file paths are resolved relative to this root.

### Subcommands

| Subcommand | Read | Write |
|------------|------|-------|
| `query` | summary, batch, get for all intermediate files | — |
| `filter` | Checklist filtering with priority/type/batch | — |
| `stats` | Findings + checklist statistics | — |
| `config` | summary, hash, validate | init (stdin) |
| `record` | — | init, append, write-batch |
| `merge` | — | Batch findings merge → findings.json |
| `report` | — | md, sarif, or both |
| `progress` | load, should-resume | save (stdin) |

### Error Handling

All subcommands exit with code 1 and a JSON error object on failure:

```json
{ "error": "<message>", "code": "<ERROR_CODE>" }
```

Error codes: `FILE_NOT_FOUND`, `INVALID_ARGS`, `UNSUPPORTED_MODE`, `PARSE_ERROR`, `WRITE_ERROR`.

If an unsupported `--mode` is passed (e.g., `--file config --mode batch`), exit 1 with `UNSUPPORTED_MODE`.

### Subcommand Details

#### `query` — Read-only access to intermediate files

```bash
# Summary: counts and metadata only (~20 lines of context)
speca-cli.mjs query --file <name> --mode summary

# Batch: slice extraction (~50 lines per batch)
speca-cli.mjs query --file <name> --mode batch --index 0 --size 10

# Get: single record by ID (~10 lines)
speca-cli.mjs query --file <name> --mode get --id <ID>
```

Supported `--file` values and their behavior:

| `--file` | Path | `summary` output | `batch` unit | `get` key |
|-----------|------|-----------------|-------------|-----------|
| `config` | `.speca/config.json` | version, language, paths, actor names, boundary/assumption counts | _(unsupported)_ | _(unsupported)_ |
| `requirements` | `.speca/requirements.json` | total, by_type counts, by_severity counts, spec_sources | requirement object | `id` |
| `mapping` | `.speca/mapping.json` | total, mapped/unmapped counts, confidence distribution, source_files | mapping object | `requirement_id` |
| `checklist` | `.speca/checklist.json` | total_checks, by_priority, by_check_type, unmapped_checks, threat_model_exclusions | checklist item | `id` |
| `findings` | `.speca/findings.json` | total_findings, by_severity, checklist_version | finding object | `id` |
| `test-results` | `.speca/test-results.json` | total_test_files, total_test_functions, property/poc summary | test_file object | `checklist_id` |

For `config`: only `summary` mode is supported. `batch` and `get` exit with `UNSUPPORTED_MODE`.

#### `filter` — Checklist filtering

```bash
speca-cli.mjs filter \
  --input .speca/checklist.json \
  --type static --priority critical,high \
  --batch-index 0 --batch-size 5 \
  --mapping .speca/mapping.json   # optional: enrich with locations
```

Note: The mapping enrichment logic (currently in `filter-checklist.mjs`'s CLI block, not the exported function) must be moved into the exported `filterChecklist()` function as an optional `mappingData` parameter, so `speca-cli.mjs` can call it directly.

#### `stats` — Statistics computation

```bash
speca-cli.mjs stats \
  --findings .speca/findings.json \
  --checklist .speca/checklist.json \
  --format text|json
```

#### `config` — Configuration management

```bash
# Read
speca-cli.mjs config --action summary
speca-cli.mjs config --action hash
speca-cli.mjs config --action validate

# Write (stdin)
echo '{"version":"1.0",...}' | speca-cli.mjs config --action init
```

`validate` checks: file exists, valid JSON, has required fields (`version`, `spec_paths`, `source_paths`, `threat_model`). Exits 0 with `{"valid": true}` or exit 1 with validation errors.

#### `record` — Findings recording

```bash
# Initialize empty findings.json
speca-cli.mjs record --init --audited-at "..." --checklist-version "..."

# Append single finding (stdin)
echo '{"id":"FIND-001",...}' | speca-cli.mjs record --append

# Write batch file to .speca/progress/audit-batches/batch-<N>.json (stdin)
echo '[...]' | speca-cli.mjs record --write-batch --batch-index 0
```

Action determination: `--init`, `--append`, and `--write-batch` are mutually exclusive flags. Exactly one must be provided. If none or multiple are given, exit 1 with `INVALID_ARGS`.

Batch files are always written to `.speca/progress/audit-batches/batch-<N>.json` — the same path that `merge` reads from. This directory is created automatically.

#### `merge` — Batch findings merge

```bash
speca-cli.mjs merge \
  --audited-at "..." --checklist-version "..."
```

`--total-checks` is removed. `merge` auto-computes `total_checks_audited` from `.speca/checklist.json` by counting items where `check_type === "static"`. This eliminates the risk of stat divergence between `merge` and `stats`.

Reads batch files from `.speca/progress/audit-batches/batch-*.json`, deduplicates, sorts by severity, writes `.speca/findings.json`.

#### `report` — Report generation (Markdown + SARIF)

```bash
# Markdown only
speca-cli.mjs report --format md \
  --output .speca/reports/2026-03-20-report.md \
  --date 2026-03-20 --target-name "MyVault"

# SARIF only
speca-cli.mjs report --format sarif \
  --output .speca/reports/2026-03-20-report.sarif

# Both (uses --output-dir instead of --output)
speca-cli.mjs report --format md,sarif \
  --output-dir .speca/reports/ \
  --date 2026-03-20 --target-name "MyVault"
```

`--output` and `--output-dir` are mutually exclusive. Single format requires `--output`; multi-format (`md,sarif`) requires `--output-dir`. Passing the wrong one exits with `INVALID_ARGS`.

Input files (`config.json`, `findings.json`, `checklist.json`) are auto-resolved from `--project-root`/.speca/. No need to pass them explicitly.

`--checklist` is optional for SARIF format (defaults to empty checklist if absent, consistent with existing `generateSarif` behavior).

#### `progress` — Checkpoint management

```bash
# Load progress object (returns JSON or null if none)
speca-cli.mjs progress --phase <phase> --action load

# Determine resume action (auto-reads config hash)
speca-cli.mjs progress --phase <phase> --action should-resume

# Save progress (stdin)
echo '{"status":"in_progress",...}' | speca-cli.mjs progress --phase <phase> --action save
```

**`should-resume` output format:**

```json
{ "action": "fresh|resume|restart|completed", "config_hash": "<hash>", "progress": <object|null> }
```

**`save` stdin schema (required fields):**

```json
{
  "phase": "<string>",
  "status": "in_progress|completed",
  "config_hash": "<string>",
  "updated_at": "<ISO 8601>"
}
```

Additional fields are allowed and preserved (e.g., `completed_batches`, `total_batches`, `started_at`). Missing required fields cause exit 1 with `INVALID_ARGS`.

When `--action save` is used, `config_hash` is auto-populated from `config --action hash` if not present in stdin, reducing agent burden.

### Internal Architecture

```
speca-cli.mjs (unified entry point)
  ├── import { filterChecklist } from './filter-checklist.mjs'
  ├── import { computeStats } from './compute-stats.mjs'
  ├── import { initFindings, appendFinding } from './append-finding.mjs'
  ├── import { mergeFindings } from './merge-findings.mjs'
  ├── import { generateSarif } from './generate-sarif.mjs'
  ├── import { generateReportSkeleton } from './generate-report-skeleton.mjs'
  ├── import { readConfig, getConfigHash } from './lib/config.mjs'
  └── import { loadProgress, saveProgress, shouldResume } from './lib/progress.mjs'
```

### Intermediate File Schemas

All intermediate files follow these schemas. The `query` subcommand operates on these structures.

#### `test-results.json`

```json
{
  "generated_at": "<ISO 8601>",
  "foundry_available": true,
  "tests_executed": true,
  "total_test_files": 5,
  "total_test_functions": 15,
  "test_files": [
    {
      "file": "test/speca/Test_CHK_AUTH_001_a.t.sol",
      "checklist_id": "CHK-AUTH-001-a",
      "finding_id": "FIND-001",
      "test_functions": [
        {
          "name": "test_CHK_AUTH_001_a_positive",
          "type": "property_positive|property_negative|poc",
          "result": "pass|fail|not_executed",
          "interpretation": "<string>"
        }
      ]
    }
  ],
  "summary": {
    "property_tests": { "total": 10, "passed": 8, "failed": 2 },
    "poc_tests": { "total": 5, "passed": 3, "failed": 2 },
    "compilation_errors": 1
  }
}
```

#### `requirements.json`

```json
{
  "extracted_at": "<ISO 8601>",
  "spec_sources": ["./docs/spec.md"],
  "total_requirements": 42,
  "requirements": [
    {
      "id": "SPEC-AUTH-001",
      "text": "<string>",
      "type": "access_control|validation|state_transition|event_emission|error_handling|data_integrity|lifecycle|other",
      "severity_hint": "high|medium|low",
      "source": { "file": "<path>", "line": 10, "section": "<heading>" },
      "modal": "MUST|MUST NOT|SHALL|SHALL NOT|SHOULD|SHOULD NOT|MAY",
      "cross_refs": ["<string>"]
    }
  ]
}
```

---

## Component 2: `reference/context-rules.md`

Placed at `.claude/skills/speca/reference/context-rules.md`.

Loaded at the start of every phase via:

```markdown
## Context Management
Read `.claude/skills/speca/reference/context-rules.md` and follow strictly.
```

### Rules Content

**Absolute prohibitions — never Read these files directly:**
- `.speca/config.json`
- `.speca/requirements.json`
- `.speca/mapping.json`
- `.speca/checklist.json`
- `.speca/findings.json`
- `.speca/test-results.json`
- `.speca/progress/*.json`
- Solidity source files (full-file reads)

**Mandatory: all access via `speca-cli.mjs`:**
1. Use `summary` mode first to understand the data shape
2. Use `batch` or `get` for specific data needed
3. Maximum batch size: 10 items

**Solidity source exception:**
- Use mapping's `line_range` and Read tool's `offset`/`limit` parameters
- Read only the required line range, never the full file

**Allowed direct reads:**
- Phase instruction files (`phases/*.md`)
- Reference files (`reference/*.md`)
- Generated report files (`.speca/reports/*.md`) — for post-generation polishing only

---

## Component 3: Phase File Rewrites

### Common change: checkpoint boilerplate removal

All 6 phases currently have verbose inline `node -e` checkpoint commands. These are replaced with:

```bash
speca-cli.mjs config --action hash
speca-cli.mjs progress --phase <phase> --action should-resume
echo '{"status":"in_progress",...}' | speca-cli.mjs progress --phase <phase> --action save
```

### Per-phase changes

#### init.md (small)
- Config existence check → `speca-cli.mjs config --action validate`
- Config write → `echo '{...}' | speca-cli.mjs config --action init`

#### extract.md (medium)
- `Read .speca/config.json` → `speca-cli.mjs config --action summary`
- All checkpoint inline code → `speca-cli.mjs progress` / `speca-cli.mjs config --action hash`

#### map.md (large)
- `Read .speca/config.json` → `speca-cli.mjs config --action summary`
- `Read .speca/requirements.json` → `speca-cli.mjs query --file requirements --mode summary` + `--mode batch`
- Full Solidity source reads → keyword-based Grep, then Read with `offset`/`limit` only
- All checkpoint inline code → `speca-cli.mjs progress`

#### checklist.md (large)
- `Read .speca/requirements.json` → `speca-cli.mjs query --file requirements --mode batch`
- `Read .speca/mapping.json` → `speca-cli.mjs query --file mapping --mode batch`
- `Read vulnerability-patterns.md` → allowed (reference file)
- All checkpoint inline code → `speca-cli.mjs progress`

#### audit.md (large)
- `Read .speca/mapping.json` → `speca-cli.mjs query --file mapping --mode get --id <req_id>`
- Full Solidity reads → Read with `offset`/`limit` using mapping line_range
- `echo '...' > batch-N.json` → `echo '[...]' | speca-cli.mjs record --write-batch --batch-index N`
- `append-finding.mjs --init` → `speca-cli.mjs record --init`
- `merge-findings.mjs` → `speca-cli.mjs merge`
- `compute-stats.mjs` → `speca-cli.mjs stats`
- All checkpoint inline code → `speca-cli.mjs progress`

#### test.md (medium)
- `Read .speca/findings.json` → `speca-cli.mjs query --file findings --mode summary` + `--mode batch`
- `Read .speca/mapping.json` → `speca-cli.mjs query --file mapping --mode get`
- `Read .speca/checklist.json` → `speca-cli.mjs query --file checklist --mode batch`
- Solidity source → Read with `offset`/`limit`

#### report.md (small)
- `generate-report-skeleton.mjs` → `speca-cli.mjs report --format md`
- `generate-sarif.mjs` → `speca-cli.mjs report --format sarif`
- `compute-stats.mjs` → `speca-cli.mjs stats`
- All direct reads → unnecessary (report subcommand handles internally)
- Generated report Read-back for polishing → allowed (see context-rules.md)
