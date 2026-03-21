# SPECA Skill + Node.js Hybrid Architecture Design

**Date:** 2026-02-19
**Status:** Approved
**Supersedes:** Current `.claude/commands/speca-*.md` command-based architecture

## Problem

The current SPECA pipeline uses Claude Code commands that load entire intermediate JSON files into the LLM context window. For larger projects this causes context overflow, making it impossible to complete pipeline phases in a single session. Additionally, deterministic operations (JSON filtering, statistics computation, SARIF generation) waste LLM context when they could be handled by scripts.

## Solution

Migrate from 7 separate commands to a single Claude Code skill with Node.js helper scripts. The skill orchestrates the pipeline while scripts handle all deterministic data processing.

### Design Principles

1. **LLM does reasoning, scripts do data**: JSON parsing, filtering, aggregation, and formatting are delegated to Node.js scripts
2. **Batch processing with checkpoints**: Large workloads are split into batches with progress saved between sessions
3. **Single skill, progressive disclosure**: One `/speca` skill entry point, phase-specific instructions loaded on demand via `Read`
4. **Self-contained**: All scripts and reference docs live inside the skill directory

## Architecture

### Directory Structure

```
.claude/
  skills/
    speca/
      SKILL.md                          # Entry point: routes $ARGUMENTS to phases
      phases/
        init.md                         # /speca init
        extract.md                      # /speca extract
        map.md                          # /speca map
        checklist.md                    # /speca checklist
        audit.md                        # /speca audit
        test.md                         # /speca test
        report.md                       # /speca report
      reference/
        vulnerability-patterns.md       # Pattern DB for checklist generation
        rfc2119-rules.md                # Extraction rules for requirements
      scripts/
        package.json                    # No external dependencies
        lib/
          config.mjs                    # config.json read/write utilities
          progress.mjs                  # Checkpoint management
        filter-checklist.mjs            # Filter and sort checklist items
        compute-stats.mjs              # Coverage and severity statistics
        append-finding.mjs             # Append findings to findings.json
        merge-findings.mjs             # Merge batch results into single file
        generate-sarif.mjs             # SARIF v2.1.0 generation (no LLM needed)
        generate-report-skeleton.mjs   # Pre-generate report tables and stats
```

### Invocation

```
/speca init       → SKILL.md → Read phases/init.md → interactive setup
/speca extract    → SKILL.md → Read phases/extract.md → script + LLM
/speca audit      → SKILL.md → Read phases/audit.md → batch processing
/speca report     → SKILL.md → Read phases/report.md → mostly scripts
/speca            → SKILL.md → show usage if no arguments
```

### Responsibility Split

| Processing | Owner | Reason |
|------------|-------|--------|
| JSON read/filter/aggregate | Node.js scripts | Deterministic, fast, no context needed |
| Solidity code analysis, threat evaluation | LLM | Requires reasoning |
| Report prose generation | LLM | Natural language generation |
| Progress management, checkpoints | Node.js scripts | Enables resume across sessions |
| Orchestration (what to run when) | Skill (LLM) | Requires situational judgment |

### Processing Flow Example (/speca audit)

```
1. Skill → Bash: node scripts/filter-checklist.mjs \
     --input .speca/checklist.json \
     --priority critical,high --type static \
     --batch-index 0 --batch-size 5
   Output: 5 checklist items + corresponding code locations

2. LLM: Three-phase inspection (Presence → Correctness → Completeness)

3. Skill → Bash: node scripts/append-finding.mjs < batch_0_findings.json
   Result: findings.json updated, progress saved

4. Repeat for batch 1, 2, ... Split sessions if context is tight.

5. Skill → Bash: node scripts/compute-stats.mjs
   Output: Summary displayed to user
```

## Node.js Scripts

### Script Inventory

| Script | Input | Output | Purpose |
|--------|-------|--------|---------|
| `filter-checklist.mjs` | checklist.json + options | Filtered JSON (stdout) | Extract batch of items for processing |
| `compute-stats.mjs` | findings.json + checklist.json | Summary text (stdout) | Coverage and severity aggregation |
| `append-finding.mjs` | findings.json + stdin | findings.json (updated) | Append batch findings |
| `merge-findings.mjs` | `.speca/progress/batch-*.json` | findings.json | Merge split-session results |
| `generate-sarif.mjs` | findings.json + checklist.json | report.sarif | Full SARIF generation without LLM |
| `generate-report-skeleton.mjs` | All intermediate files | Draft markdown (stdout) | Pre-generate tables/stats, leave placeholders for LLM prose |

### Dependencies

Zero external dependencies. Uses only Node.js built-in modules: `fs`, `path`, `process`.

### Key Interface Examples

```bash
# Filter checklist for batch processing
node scripts/filter-checklist.mjs \
  --input .speca/checklist.json \
  --priority critical,high \
  --type static \
  --batch-index 0 \
  --batch-size 5

# Generate SARIF (entirely script-driven, no LLM)
node scripts/generate-sarif.mjs \
  --findings .speca/findings.json \
  --checklist .speca/checklist.json \
  --output .speca/reports/2026-02-19-report.sarif

# Generate report skeleton (tables/stats pre-built, prose placeholders for LLM)
node scripts/generate-report-skeleton.mjs \
  --config .speca/config.json \
  --findings .speca/findings.json \
  --checklist .speca/checklist.json \
  --output .speca/reports/draft.md
```

## Batch Processing and Checkpoints

### Checkpoint Schema

```
.speca/
  progress/
    audit-progress.json
    extract-progress.json
    ...
```

```json
{
  "phase": "audit",
  "started_at": "2026-02-19T10:00:00Z",
  "updated_at": "2026-02-19T10:15:00Z",
  "status": "in_progress",
  "total_items": 42,
  "completed_items": 15,
  "current_batch": 3,
  "batch_size": 5,
  "partial_results": ".speca/progress/audit-batches/",
  "config_hash": "abc123"
}
```

### Resume Logic

| State | Action |
|-------|--------|
| No progress file | Start fresh |
| `status: "in_progress"` | Resume from `current_batch` |
| `status: "completed"` | Ask user if they want to re-run |
| `config_hash` changed | Config changed since last run, suggest restart |

### Recommended Batch Sizes

| Phase | Batch Size | Rationale |
|-------|-----------|-----------|
| `/speca extract` | 1 spec file | Each file processed independently |
| `/speca map` | 10 requirements | Moderate context per item |
| `/speca checklist` | 10 mappings | Pattern matching needs code context |
| `/speca audit` | 5 checklist items | Heaviest context consumer (code + reasoning) |
| `/speca test` | 3 findings | Test code generation is verbose |

## Migration Strategy

### Phase 1: Foundation

- Core script libraries (`config.mjs`, `progress.mjs`)
- `SKILL.md` entry point with argument routing
- `/speca init` (simplest phase, minimal script dependency)

### Phase 2: Data Processing

- `/speca extract` + extraction scripts
- `/speca map`
- `/speca checklist` + move vulnerability patterns to `reference/`

### Phase 3: Analysis (highest impact)

- `/speca audit` + batch processing + checkpoints
- `/speca test`

### Phase 4: Output

- `/speca report` + `generate-sarif.mjs` + `generate-report-skeleton.mjs`

### Coexistence

- Existing `.claude/commands/speca-*.md` remain during migration
- Skills take precedence once complete; commands removed after validation
- `examples/simple-vault/` maintained as test fixture

### Testing

- **Script unit tests**: Use `examples/simple-vault/.speca/` as test data
- **Skill E2E tests**: Run full pipeline on `examples/simple-vault/`, compare output quality with existing results
- **Acceptance criteria**: Output quality equivalent to current command-based pipeline
