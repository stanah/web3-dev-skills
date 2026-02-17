# SPECA Commands for Claude Code

A set of [Claude Code](https://docs.anthropic.com/en/docs/claude-code) custom slash commands for Solidity smart contract security auditing, based on the SPECA (SPEcification-to-Checklist Auditing) methodology.

> **Note:** This is an **unofficial, independent implementation** inspired by the SPECA methodology. It is not affiliated with or endorsed by the original authors.
>
> **Reference:** Kamba, M. & Sannai, A. (2025). *SPECA: Specification-to-Checklist Agentic Auditing for Multi-Implementation Systems*. [arXiv:2602.07513v2](https://arxiv.org/abs/2602.07513v2)

## Quick Start

Run the commands in order inside Claude Code:

```
/speca-init        # Setup project, define threat model
/speca-extract     # Extract requirements from specs (md/yaml)
/speca-map         # Map requirements to Solidity source
/speca-checklist   # Generate security checklist with vulnerability patterns
/speca-audit       # Run static audit against the checklist
/speca-test        # Generate Foundry tests and PoCs (optional)
/speca-report      # Generate Markdown + SARIF reports
```

Each command reads the artifacts produced by previous steps from the `.speca/` directory.

## Command Inventory

| Command | Phase | Description |
|---------|-------|-------------|
| `/speca-init` | Setup | Interactively collect spec paths, source paths, and threat model; write `.speca/config.json` |
| `/speca-extract` | 1a - Extract | Parse Markdown (RFC 2119) and YAML specs into structured requirements |
| `/speca-map` | 1b - Map | Map each requirement to Solidity source locations with confidence scoring |
| `/speca-checklist` | 2 - Checklist | Generate property-based checklist with built-in vulnerability pattern matching |
| `/speca-audit` | 3 - Audit | Three-phase static inspection (presence, correctness, completeness) with threat model filtering |
| `/speca-test` | 4 - Test | Generate Foundry test contracts for boundary checks and PoC reproduction |
| `/speca-report` | 5 - Report | Produce a Markdown audit report and a SARIF v2.1.0 file for CI/CD integration |

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
`params`, and `events` fields. See `examples/simple-vault/docs/interface.yaml`
for the expected schema.

## Requirements

- **Claude Code** with custom command support (`.claude/commands/` directory)
- **Foundry** (optional) -- required only for `/speca-test` execution.
  Install from [https://getfoundry.sh](https://getfoundry.sh).

## Sample Project

A minimal reference project is included at `examples/simple-vault/`:

```
examples/simple-vault/
  contracts/Vault.sol        # Sample Solidity contract
  docs/spec.md               # Markdown specification with RFC 2119 requirements
  docs/interface.yaml        # YAML interface definition
```

Run the full pipeline against it to see each artifact produced.

## License

MIT
