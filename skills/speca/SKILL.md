---
name: speca
description: SPECA (SPEcification-to-Checklist Auditing) pipeline for Solidity smart contract security auditing. Use when the user requests a security audit of Solidity contracts against a specification document.
metadata:
  author: stanah
  version: "1.0.0"
---

# /speca - SPECA Security Audit Pipeline

You are executing the SPECA pipeline for Solidity smart contract security auditing. This skill routes to the appropriate phase based on the provided argument.

## Setup

Before executing any phase, determine this skill's installation directory and set `SPECA_DIR`:

```
SPECA_DIR=<directory containing this SKILL.md>
```

All commands and file references in this skill use `$SPECA_DIR` as prefix. Replace with the resolved path.

### Agent-Specific Notes

| Environment | Typical `SPECA_DIR` path |
|---|---|
| Claude Code (project) | `.claude/skills/speca` |
| Claude Code (global) | `~/.claude/skills/speca` |
| claude.ai sandbox | `/mnt/skills/user/speca` |
| Cursor | `.cursor/skills/speca` |
| `npx skills add` | `skills/speca` |

The path may vary depending on where the user installed the skill.

## Usage

```
/speca <phase>
```

Where `<phase>` is one of:

| Phase | Description |
|-------|-------------|
| `init` | Initialize project — creates `.speca/config.json` with threat model |
| `extract` | Extract normative requirements from specification documents |
| `map` | Map requirements to Solidity source code locations |
| `checklist` | Generate property-based security checklist |
| `audit` | Static security audit against checklist (batch processing with checkpoints) |
| `test` | Generate Foundry test contracts for findings |
| `report` | Generate audit report in Markdown and SARIF |

## Argument Routing

Parse `$ARGUMENTS` to determine the phase. The first word after `/speca` is the phase name.

**IMPORTANT:** Read the corresponding phase instruction file and follow it exactly.

### Phase Dispatch

1. Extract the phase name from `$ARGUMENTS`: `$ARGUMENTS` contains everything after `/speca`. Trim whitespace and take the first word.

2. Read the phase instruction file:
   - `init` → Read `$SPECA_DIR/phases/init.md`
   - `extract` → Read `$SPECA_DIR/phases/extract.md`
   - `map` → Read `$SPECA_DIR/phases/map.md`
   - `checklist` → Read `$SPECA_DIR/phases/checklist.md`
   - `audit` → Read `$SPECA_DIR/phases/audit.md`
   - `test` → Read `$SPECA_DIR/phases/test.md`
   - `report` → Read `$SPECA_DIR/phases/report.md`

3. Follow the phase instructions completely.

4. Pass any remaining arguments after the phase name to the phase (e.g., `/speca audit --resume` passes `--resume` to the audit phase).

## CLI

All data access and operations go through the unified CLI:

```
node $SPECA_DIR/scripts/speca-cli.mjs <subcommand> [options]
```

| Subcommand | Purpose |
|------------|---------|
| `query` | Read intermediate files (summary/batch/get) |
| `filter` | Filter and batch checklist items |
| `stats` | Compute findings/checklist statistics |
| `config` | Read/write/validate `.speca/config.json` |
| `record` | Initialize, append, batch-write findings |
| `merge` | Merge batch finding files |
| `report` | Generate Markdown and/or SARIF reports |
| `progress` | Checkpoint management for session resume |

## Reference Data

- `$SPECA_DIR/reference/vulnerability-patterns.md` — Solidity vulnerability pattern database for checklist generation
- `$SPECA_DIR/reference/context-rules.md` — Context management rules (loaded by all phases)

## No Arguments — Help

If `$ARGUMENTS` is empty or not a recognized phase, display this help:

```
SPECA Pipeline — Specification-to-Checklist Auditing for Solidity

Usage: /speca <phase>

Phases (run in order):
  init       Initialize project with threat model
  extract    Extract requirements from specs
  map        Map requirements to source code
  checklist  Generate security checklist
  audit      Run static audit (supports --resume)
  test       Generate Foundry tests for findings
  report     Generate Markdown + SARIF report

Reference: https://arxiv.org/abs/2602.07513
```
