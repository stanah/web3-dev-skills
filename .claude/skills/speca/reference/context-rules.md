# SPECA Context Management Rules

All SPECA pipeline phases MUST follow these rules to prevent context window exhaustion.

## Prohibited: Direct File Reads

NEVER use the Read tool on these files:

- `.speca/config.json`
- `.speca/requirements.json`
- `.speca/mapping.json`
- `.speca/checklist.json`
- `.speca/findings.json`
- `.speca/test-results.json`
- `.speca/progress/*.json`
- Solidity source files (full-file reads)

Violation of these rules wastes context and degrades audit quality.

## Required: speca-cli.mjs Access Pattern

All intermediate data access MUST go through `speca-cli.mjs`:

```
CLI=".claude/skills/speca/scripts/speca-cli.mjs"
```

### Step 1: Get overview with summary

```
node $CLI query --file <name> --mode summary
```

### Step 2: Get specific data with batch or get

```
# Batch (max size: 10)
node $CLI query --file <name> --mode batch --index 0 --size 10

# Single record
node $CLI query --file <name> --mode get --id <ID>
```

### Step 3: For config operations

```
node $CLI config --action summary     # read config
node $CLI config --action hash        # change detection
node $CLI progress --phase <p> --action should-resume  # checkpoint
```

## Exception: Solidity Source Code

Solidity files may be read with the Read tool, but ONLY specific line ranges:

1. Get the `line_range` from mapping data via `speca-cli.mjs query --file mapping --mode get --id <req_id>`
2. Use Read tool with `offset` and `limit` parameters matching the line range
3. NEVER read an entire `.sol` file

## Allowed Direct Reads

These files may be read directly with the Read tool:

- Phase instruction files: `.claude/skills/speca/phases/*.md`
- Reference files: `.claude/skills/speca/reference/*.md`
- Generated reports: `.speca/reports/*.md` (for post-generation polishing only)
