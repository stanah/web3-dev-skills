# SPECA — Specification-to-Checklist Auditing for Solidity

An AI-agent skill for Solidity smart contract security auditing, based on the SPECA methodology. Works with [Claude Code](https://docs.anthropic.com/en/docs/claude-code), claude.ai, Cursor, and other agents that support the skills format.

> **Note:** This is an **unofficial, independent implementation** inspired by the SPECA methodology. It is not affiliated with or endorsed by the original authors.
>
> **Reference:** Kamba, M. & Sannai, A. (2025). *SPECA: Specification-to-Checklist Agentic Auditing for Multi-Implementation Systems*. [arXiv:2602.07513v2](https://arxiv.org/abs/2602.07513v2)

## Installation

```bash
# Claude Code
npx skills add stanah/web3-dev-skills --skill speca

# Or clone and symlink manually
git clone https://github.com/stanah/web3-dev-skills.git
```

| Environment | Skill directory |
|---|---|
| Claude Code (project) | `.claude/skills/speca` |
| Claude Code (global) | `~/.claude/skills/speca` |
| claude.ai sandbox | `/mnt/skills/user/speca` |
| Cursor | `.cursor/skills/speca` |
| `npx skills add` | `skills/speca` |

## Quick Start

Run the phases in order inside your AI agent:

```
/speca init        # Setup project, define threat model
/speca extract     # Extract requirements from specs (md/yaml)
/speca map         # Map requirements to Solidity source
/speca checklist   # Generate security checklist with vulnerability patterns
/speca audit       # Run static audit against the checklist
/speca test        # Generate Foundry tests and PoCs (optional)
/speca report      # Generate Markdown + SARIF reports
```

Each phase reads the artifacts produced by previous steps from the `.speca/` directory. **Split sessions at phase boundaries** to enable human review of intermediate artifacts.

## Phases

| Phase | Command | Description |
|-------|---------|-------------|
| Setup | `/speca init` | Interactively collect spec paths, source paths, and threat model; write `.speca/config.json` |
| 1a - Extract | `/speca extract` | Parse Markdown (RFC 2119) and YAML specs into structured requirements |
| 1b - Map | `/speca map` | Map each requirement to Solidity source locations with confidence scoring |
| 2 - Checklist | `/speca checklist` | Generate property-based checklist with built-in vulnerability pattern matching |
| 3 - Audit | `/speca audit` | Three-phase static inspection with batch processing and checkpoint resume (`--resume`) |
| 4 - Test | `/speca test` | Generate Foundry test contracts for boundary checks and PoC reproduction |
| 5 - Report | `/speca report` | Produce a Markdown audit report and a SARIF v2.1.0 file for CI/CD integration |

## CLI

All data access and operations go through a unified CLI:

```bash
node skills/speca/scripts/speca-cli.mjs <subcommand> [options]
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

## Artifacts

All pipeline artifacts are stored under `.speca/` in the project root:

```
.speca/
  config.json          # Project config: spec paths, source paths, threat model
  requirements.json    # Extracted requirements with IDs, types, and severity
  mapping.json         # Requirement-to-source-code mappings with confidence scores
  checklist.json       # Security checklist with vulnerability pattern references
  findings.json        # Audit findings with proof traces and recommendations
  test-results.json    # Foundry test execution results
  reports/
    YYYY-MM-DD-report.md      # Human-readable Markdown report
    YYYY-MM-DD-report.sarif   # Machine-readable SARIF v2.1.0 for GitHub Code Scanning
```

Generated Foundry tests are placed in `test/speca/`.

## Supported Spec Formats

### Markdown

Standard Markdown files using RFC 2119 modal verbs (`MUST`, `MUST NOT`, `SHALL`,
`SHALL NOT`, `SHOULD`, `SHOULD NOT`, `MAY`) to express normative requirements.

### YAML

Structured YAML with function definitions including `requirements`, `access`,
`params`, and `events` fields.

## Test Cases

Verification test cases are included under `skills/speca/tests/cases/`:

| Case | Description |
|------|-------------|
| `liquid-ron` | LiquidRon staking protocol — liquid staking with validator tracking |
| `compound-v2-ctoken` | Compound V2 CToken — lending/borrowing with interest rate models |

## Benchmarks

Automated benchmarks for measuring audit accuracy are in `benchmarks/`:

```
benchmarks/
  cases/              # Ground-truth annotated test cases
  scripts/            # collect, evaluate, and format-results scripts
  results/            # Benchmark run outputs
```

## Requirements

- **Node.js** >= 20.11.0 (for CLI scripts)
- **Foundry** (optional) — required only for `/speca test` execution.
  Install from [https://getfoundry.sh](https://getfoundry.sh).

## Project Structure

```
skills/speca/
  SKILL.md                    # Skill entry point and routing
  phases/                     # Phase instruction files (init, extract, map, ...)
  reference/
    vulnerability-patterns.md # Solidity vulnerability pattern database
    context-rules.md          # Context management rules
    scaling-guide.md          # Human review protocol and session splitting
  scripts/
    speca-cli.mjs             # Unified CLI
    lib/                      # Shared libraries (config, errors, progress, query)
    __tests__/                # Unit tests (node --test)
  tests/
    cases/                    # Verification test cases
benchmarks/                   # Audit accuracy benchmarks
```

## License

MIT
