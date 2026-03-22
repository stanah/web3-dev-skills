# SPECA Verification Test — Agent Instructions

This document is the complete instruction set for running a SPECA pipeline verification test. An agent should be able to execute this end-to-end without additional context.

## Prerequisites

- Node.js >= 20
- Access to Bash tool

## Step 1: Setup Test Workspace

```bash
node $SPECA_DIR/tests/setup-test.mjs --case liquid-ron --output /tmp/speca-verify --clean
```

This creates `/tmp/speca-verify` with contracts, docs, and `.speca/config.json`.

## Step 2: Read Context Rules

Read `$SPECA_DIR/reference/context-rules.md` and follow strictly throughout all phases.

Key rules:
- NEVER Read `.speca/*.json` files directly — use `speca-cli.mjs`
- Solidity files: Read with `offset`/`limit` only, never full files
- Phase/reference files: direct Read is allowed

CLI path: `node $SPECA_DIR/scripts/speca-cli.mjs <subcommand> --project-root /tmp/speca-verify`

## Step 3: Execute Pipeline Phases

Execute each phase in order. For each phase:
1. Read the phase instruction file at `$SPECA_DIR/phases/<phase>.md`
2. Follow the instructions completely
3. Write the output file to `/tmp/speca-verify/.speca/`

### Phase order:
1. **extract** — Read spec, extract requirements → `requirements.json`
2. **map** — Map requirements to Solidity source → `mapping.json`
3. **checklist** — Generate security checklist → `checklist.json`
4. **audit** — Static audit against checklist → `findings.json`
5. **report** — Generate reports → `reports/` (Markdown + SARIF)

## Step 4: Verify Output

```bash
node $SPECA_DIR/tests/verify-output.mjs --project-root /tmp/speca-verify
```

This runs automated checks on all output files. Exit code 0 = all checks pass.

## Step 5: Report Results

Report to the team lead:
1. Setup result (ok/error)
2. Each phase: completed/failed + any errors
3. Verification result: pass/fail + details
4. Findings summary (count by severity)
