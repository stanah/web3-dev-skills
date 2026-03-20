# SPECA Context Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent SPECA pipeline agents from consuming excessive context by enforcing all intermediate file access through `speca-cli.mjs` unified CLI.

**Architecture:** A unified CLI (`speca-cli.mjs`) wraps existing script functions behind 8 subcommands. A shared `context-rules.md` is loaded at the start of every phase. All 7 phase files are rewritten to use CLI commands instead of direct Read.

**Tech Stack:** Node.js >= 20 (ESM), `node:util/parseArgs`, existing SPECA script functions.

**Spec:** `docs/superpowers/specs/2026-03-20-speca-context-guard-design.md`

**Assumption:** All commands assume cwd is the repository root (`/Users/stanah/work/github.com/stanah/web3-dev-agent`).

---

## File Structure

### New files
| File | Responsibility |
|------|----------------|
| `.claude/skills/speca/scripts/speca-cli.mjs` | Unified CLI entry point — routes subcommands to existing functions |
| `.claude/skills/speca/scripts/lib/query.mjs` | `query` subcommand logic — summary/batch/get for `config`, `requirements`, `mapping`, `checklist`, `findings`, `test-results` |
| `.claude/skills/speca/scripts/lib/errors.mjs` | Shared error helper — JSON error output with exit code 1 |
| `.claude/skills/speca/scripts/__tests__/speca-cli.test.mjs` | Integration tests for CLI subcommands |
| `.claude/skills/speca/scripts/__tests__/query.test.mjs` | Unit tests for query logic |
| `.claude/skills/speca/scripts/__tests__/errors.test.mjs` | Unit tests for error helper |
| `.claude/skills/speca/reference/context-rules.md` | Shared context management rules |

### Modified files
| File | Change |
|------|--------|
| `.claude/skills/speca/scripts/filter-checklist.mjs` | Move mapping enrichment into exported `filterChecklist()` |
| `.claude/skills/speca/scripts/merge-findings.mjs` | Auto-compute `total_checks_audited` from checklist |
| `.claude/skills/speca/SKILL.md` | Update Helper Scripts table to reference `speca-cli.mjs` |
| `.claude/skills/speca/phases/init.md` | Replace direct Read/Write with CLI commands |
| `.claude/skills/speca/phases/extract.md` | Replace direct Read + checkpoint boilerplate |
| `.claude/skills/speca/phases/map.md` | Replace direct Read + checkpoint boilerplate |
| `.claude/skills/speca/phases/checklist.md` | Replace direct Read + checkpoint boilerplate |
| `.claude/skills/speca/phases/audit.md` | Replace direct Read/Write + all script references |
| `.claude/skills/speca/phases/test.md` | Replace direct Read + checkpoint boilerplate |
| `.claude/skills/speca/phases/report.md` | Replace script references with CLI commands |

---

## Task 1: Shared error helper

**Files:**
- Create: `.claude/skills/speca/scripts/lib/errors.mjs`
- Create: `.claude/skills/speca/scripts/__tests__/errors.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// __tests__/errors.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatError, ERROR_CODES } from '../lib/errors.mjs';

describe('formatError', () => {
  it('returns JSON error object', () => {
    const result = formatError('file not found', ERROR_CODES.FILE_NOT_FOUND);
    assert.deepStrictEqual(result, { error: 'file not found', code: 'FILE_NOT_FOUND' });
  });

  it('has all defined error codes', () => {
    const expected = ['FILE_NOT_FOUND', 'INVALID_ARGS', 'UNSUPPORTED_MODE', 'PARSE_ERROR', 'WRITE_ERROR'];
    assert.deepStrictEqual(Object.keys(ERROR_CODES), expected);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/errors.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```js
// lib/errors.mjs
export const ERROR_CODES = {
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  INVALID_ARGS: 'INVALID_ARGS',
  UNSUPPORTED_MODE: 'UNSUPPORTED_MODE',
  PARSE_ERROR: 'PARSE_ERROR',
  WRITE_ERROR: 'WRITE_ERROR',
};

export function formatError(message, code) {
  return { error: message, code };
}

export function exitWithError(message, code) {
  console.error(JSON.stringify(formatError(message, code)));
  process.exit(1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/errors.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/speca/scripts/lib/errors.mjs .claude/skills/speca/scripts/__tests__/errors.test.mjs
git commit -m "feat(speca): add shared error helper for speca-cli"
```

---

## Task 2: Query module — summary/batch/get logic

**Files:**
- Create: `.claude/skills/speca/scripts/lib/query.mjs`
- Create: `.claude/skills/speca/scripts/__tests__/query.test.mjs`

- [ ] **Step 1: Write failing tests**

```js
// __tests__/query.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { querySummary, queryBatch, queryGet } from '../lib/query.mjs';

const mockRequirements = {
  extracted_at: '2026-03-20T00:00:00Z',
  spec_sources: ['./docs/spec.md'],
  total_requirements: 3,
  requirements: [
    { id: 'SPEC-AUTH-001', text: 'Must check owner', type: 'access_control', severity_hint: 'high', modal: 'MUST', source: { file: './docs/spec.md', line: 10, section: 'Auth' } },
    { id: 'SPEC-VAL-001', text: 'Must validate input', type: 'validation', severity_hint: 'high', modal: 'MUST', source: { file: './docs/spec.md', line: 20, section: 'Validation' } },
    { id: 'SPEC-VAL-002', text: 'Should check bounds', type: 'validation', severity_hint: 'medium', modal: 'SHOULD', source: { file: './docs/spec.md', line: 30, section: 'Validation' } },
  ]
};

describe('querySummary', () => {
  it('returns metadata and counts for requirements', () => {
    const result = querySummary('requirements', mockRequirements);
    assert.equal(result.file, 'requirements');
    assert.equal(result.total, 3);
    assert.deepStrictEqual(result.by_type, { access_control: 1, validation: 2 });
    assert.deepStrictEqual(result.by_severity, { high: 2, medium: 1 });
    assert.deepStrictEqual(result.spec_sources, ['./docs/spec.md']);
  });

  it('returns config summary with actor names', () => {
    const mockConfig = {
      version: '1.0', language: 'en',
      spec_paths: ['./docs/spec.md'], source_paths: ['./contracts/'],
      threat_model: {
        actors: { owner: 'TRUSTED', attacker: 'UNTRUSTED' },
        boundaries: ['owner -> admin functions'],
        assumptions: ['Solidity ^0.8.x']
      }
    };
    const result = querySummary('config', mockConfig);
    assert.equal(result.version, '1.0');
    assert.deepStrictEqual(result.actor_names, ['owner', 'attacker']);
    assert.equal(result.boundary_count, 1);
    assert.equal(result.assumption_count, 1);
  });
});

describe('queryBatch', () => {
  it('returns sliced items with meta', () => {
    const result = queryBatch('requirements', mockRequirements, 0, 2);
    assert.equal(result.meta.totalItems, 3);
    assert.equal(result.meta.totalBatches, 2);
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].id, 'SPEC-AUTH-001');
  });

  it('throws for unsupported file type', () => {
    assert.throws(() => queryBatch('config', {}, 0, 10), /unsupported/i);
  });
});

describe('queryGet', () => {
  it('returns single item by id', () => {
    const result = queryGet('requirements', mockRequirements, 'SPEC-VAL-001');
    assert.equal(result.id, 'SPEC-VAL-001');
    assert.equal(result.text, 'Must validate input');
  });

  it('returns null for missing id', () => {
    const result = queryGet('requirements', mockRequirements, 'NONEXISTENT');
    assert.equal(result, null);
  });

  it('throws for unsupported file type', () => {
    assert.throws(() => queryGet('config', {}, 'x'), /unsupported/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/query.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement query.mjs**

Implement `querySummary`, `queryBatch`, `queryGet` for all 6 file types (`config`, `requirements`, `mapping`, `checklist`, `findings`, `test-results`). Each file type has its own summary extractor and array accessor.

Key design:
- `FILE_METADATA` map defines `arrayKey` and `idKey` per file type
- `querySummary(fileType, data)` — extracts metadata per file type
- `queryBatch(fileType, data, index, size)` — slices the array, returns `{ meta, items }`
- `queryGet(fileType, data, id)` — finds by ID key
- `config` only supports `summary` — `batch`/`get` throw with "unsupported" message

- [ ] **Step 4: Run test to verify it passes**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/query.test.mjs`
Expected: PASS

- [ ] **Step 5: Add tests for mapping, checklist, findings, test-results summaries**

Add similar test cases for each file type's summary output to ensure complete coverage.

- [ ] **Step 5a: Run tests to verify new cases fail**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/query.test.mjs`
Expected: New test cases FAIL

- [ ] **Step 5b: Implement missing summary handlers**

- [ ] **Step 6: Run all tests**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/query.test.mjs`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/speca/scripts/lib/query.mjs .claude/skills/speca/scripts/__tests__/query.test.mjs
git commit -m "feat(speca): add query module for summary/batch/get access"
```

---

## Task 3: Modify `filter-checklist.mjs` — move mapping enrichment into exported function

**Files:**
- Modify: `.claude/skills/speca/scripts/filter-checklist.mjs`
- Modify: `.claude/skills/speca/scripts/__tests__/filter-checklist.test.mjs`

- [ ] **Step 1: Write failing test for new `mappingData` parameter**

Add to existing test file:

```js
it('enriches items with locations when mappingData provided', () => {
  const checklistData = {
    checklist: [
      { id: 'CHK-AUTH-001-a', requirement_id: 'SPEC-AUTH-001', check_type: 'static', priority: 'critical', property: 'test' }
    ]
  };
  const mappingData = {
    mappings: [
      { requirement_id: 'SPEC-AUTH-001', requirement_text: 'Must check owner', locations: [{ file: 'Vault.sol', line_range: [10, 20] }] }
    ]
  };
  const result = filterChecklist(checklistData, { includeMeta: true, mappingData });
  assert.deepStrictEqual(result.items[0]._locations, [{ file: 'Vault.sol', line_range: [10, 20] }]);
  assert.equal(result.items[0]._requirement_text, 'Must check owner');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/filter-checklist.test.mjs`
Expected: FAIL — `_locations` is undefined

- [ ] **Step 3: Move enrichment logic into `filterChecklist()`**

Add `mappingData` to the options destructuring. Move the enrichment loop (currently in CLI block, lines 71-82) into the function body, after filtering and slicing. Update the CLI block to pass `mappingData` through options instead of enriching inline.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/filter-checklist.test.mjs`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/speca/scripts/filter-checklist.mjs .claude/skills/speca/scripts/__tests__/filter-checklist.test.mjs
git commit -m "refactor(speca): move mapping enrichment into filterChecklist export"
```

---

## Task 4: Modify `merge-findings.mjs` — auto-compute total_checks_audited

**Files:**
- Modify: `.claude/skills/speca/scripts/merge-findings.mjs`
- Modify: `.claude/skills/speca/scripts/__tests__/findings.test.mjs`

- [ ] **Step 1: Write failing test**

```js
it('auto-computes totalChecksAudited from checklist', () => {
  // Setup: create temp dir with .speca/checklist.json and batch files
  const tmpDir = join(import.meta.dirname, '__tmp_merge_test__');
  mkdirSync(join(tmpDir, '.speca', 'progress', 'audit-batches'), { recursive: true });

  writeFileSync(join(tmpDir, '.speca', 'checklist.json'), JSON.stringify({
    total_checks: 5,
    summary: { by_check_type: { static: 3, dynamic: 2 } },
    checklist: [
      { id: 'CHK-1', check_type: 'static', priority: 'high' },
      { id: 'CHK-2', check_type: 'static', priority: 'medium' },
      { id: 'CHK-3', check_type: 'static', priority: 'low' },
      { id: 'CHK-4', check_type: 'dynamic', priority: 'high' },
      { id: 'CHK-5', check_type: 'dynamic', priority: 'medium' },
    ]
  }));
  writeFileSync(join(tmpDir, '.speca', 'progress', 'audit-batches', 'batch-0.json'), JSON.stringify([
    { id: 'FIND-001', severity: 'high', checklist_id: 'CHK-1', title: 'Test' }
  ]));

  // Call mergeFindings without totalChecksAudited (3-arg form)
  mergeFindings(tmpDir, '2026-03-20T00:00:00Z', '2026-03-20T00:00:00Z');

  const result = JSON.parse(readFileSync(join(tmpDir, '.speca', 'findings.json'), 'utf-8'));
  assert.equal(result.total_checks_audited, 3); // auto-computed from static count
  assert.equal(result.total_findings, 1);

  rmSync(tmpDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/findings.test.mjs`
Expected: FAIL — `mergeFindings` still requires 4 arguments

- [ ] **Step 3: Modify `mergeFindings()` signature**

Change to `mergeFindings(projectRoot, auditedAt, checklistVersion)`. Inside the function, read `.speca/checklist.json` and count items with `check_type === 'static'` to set `total_checks_audited`. Update CLI block to remove `--total-checks` parsing.

- [ ] **Step 4: Run all findings tests**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/findings.test.mjs`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/speca/scripts/merge-findings.mjs .claude/skills/speca/scripts/__tests__/findings.test.mjs
git commit -m "refactor(speca): merge auto-computes total_checks from checklist"
```

---

## Task 5: `speca-cli.mjs` — CLI entry point and subcommand routing

**Files:**
- Create: `.claude/skills/speca/scripts/speca-cli.mjs`
- Create: `.claude/skills/speca/scripts/__tests__/speca-cli.test.mjs`

- [ ] **Step 1: Write failing integration tests**

Test the CLI via `node:child_process.execFile` (NOT exec — to avoid shell injection) to verify stdout/stderr/exit codes:

```js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const run = promisify(execFile);
const CLI = join(import.meta.dirname, '..', 'speca-cli.mjs');
const TMP = join(import.meta.dirname, '__tmp_cli_test__');

describe('speca-cli', () => {
  before(() => {
    mkdirSync(join(TMP, '.speca'), { recursive: true });
    writeFileSync(join(TMP, '.speca', 'config.json'), JSON.stringify({
      version: '1.0', language: 'en',
      spec_paths: ['./docs/spec.md'], source_paths: ['./contracts/'],
      threat_model: { actors: { owner: 'TRUSTED' }, boundaries: [], assumptions: [] }
    }));
  });
  after(() => rmSync(TMP, { recursive: true, force: true }));

  it('no subcommand exits with INVALID_ARGS', async () => {
    await assert.rejects(
      run('node', [CLI, '--project-root', TMP]),
      (err) => { assert.equal(JSON.parse(err.stderr).code, 'INVALID_ARGS'); return true; }
    );
  });

  it('query --file config --mode summary returns config summary', async () => {
    const { stdout } = await run('node', [CLI, 'query', '--file', 'config', '--mode', 'summary', '--project-root', TMP]);
    const result = JSON.parse(stdout);
    assert.equal(result.version, '1.0');
  });

  it('query --file config --mode batch exits with UNSUPPORTED_MODE', async () => {
    await assert.rejects(
      run('node', [CLI, 'query', '--file', 'config', '--mode', 'batch', '--project-root', TMP]),
      (err) => { assert.equal(JSON.parse(err.stderr).code, 'UNSUPPORTED_MODE'); return true; }
    );
  });

  it('config --action hash returns 12-char hex', async () => {
    const { stdout } = await run('node', [CLI, 'config', '--action', 'hash', '--project-root', TMP]);
    assert.match(stdout.trim(), /^[a-f0-9]{12}$/);
  });

  it('progress --phase test --action should-resume returns fresh', async () => {
    const { stdout } = await run('node', [CLI, 'progress', '--phase', 'test', '--action', 'should-resume', '--project-root', TMP]);
    const result = JSON.parse(stdout);
    assert.equal(result.action, 'fresh');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/speca-cli.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement speca-cli.mjs**

Structure:

```js
#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { exitWithError, ERROR_CODES } from './lib/errors.mjs';
import { querySummary, queryBatch, queryGet } from './lib/query.mjs';
// ... other imports

const SUBCOMMANDS = ['query', 'filter', 'stats', 'config', 'record', 'merge', 'report', 'progress'];

// Extract --project-root before subcommand routing
// Route subcommand to handler
// Each handler: parse subcommand-specific args, call underlying function, output JSON
```

Each subcommand handler:
- `handleQuery(args, projectRoot)` — reads file, delegates to query.mjs
- `handleFilter(args, projectRoot)` — delegates to filterChecklist
- `handleStats(args, projectRoot)` — delegates to computeStats
- `handleConfig(args, projectRoot)` — summary/hash/validate/init
- `handleRecord(args, projectRoot)` — init/append/write-batch (mutually exclusive flags)
- `handleMerge(args, projectRoot)` — delegates to mergeFindings
- `handleReport(args, projectRoot)` — md/sarif/both, validates --output vs --output-dir
- `handleProgress(args, projectRoot)` — load/should-resume/save

- [ ] **Step 4: Run integration tests**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/speca-cli.test.mjs`
Expected: All PASS

- [ ] **Step 5: Add integration tests for remaining subcommands**

Add tests for `filter`, `stats`, `record`, `merge`, `report`, `progress`. Each test creates minimal fixture files in the temp directory. Must include these specific tests:

```js
// record: mutual exclusivity of --init, --append, --write-batch
it('record with no action flag exits with INVALID_ARGS', async () => {
  await assert.rejects(
    run('node', [CLI, 'record', '--project-root', TMP]),
    (err) => { assert.equal(JSON.parse(err.stderr).code, 'INVALID_ARGS'); return true; }
  );
});

it('record with --init and --append exits with INVALID_ARGS', async () => {
  await assert.rejects(
    run('node', [CLI, 'record', '--init', '--append', '--project-root', TMP]),
    (err) => { assert.equal(JSON.parse(err.stderr).code, 'INVALID_ARGS'); return true; }
  );
});

// report: --output vs --output-dir mutual exclusivity
it('report --format md,sarif with --output exits with INVALID_ARGS', async () => {
  await assert.rejects(
    run('node', [CLI, 'report', '--format', 'md,sarif', '--output', 'x.md', '--project-root', TMP]),
    (err) => { assert.equal(JSON.parse(err.stderr).code, 'INVALID_ARGS'); return true; }
  );
});

// progress: auto-populate config_hash on save
it('progress save auto-populates config_hash when missing from stdin', async () => {
  const { stdout } = await run('node', [CLI, 'progress', '--phase', 'test', '--action', 'save', '--project-root', TMP],
    { input: JSON.stringify({ phase: 'test', status: 'in_progress', updated_at: '2026-03-20T00:00:00Z' }) });
  // Load and verify config_hash was auto-populated
  const { stdout: loaded } = await run('node', [CLI, 'progress', '--phase', 'test', '--action', 'load', '--project-root', TMP]);
  const result = JSON.parse(loaded);
  assert.match(result.config_hash, /^[a-f0-9]{12}$/);
});
```

- [ ] **Step 6: Run all tests (existing + new)**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/*.test.mjs`
Expected: All PASS (existing tests unaffected)

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/speca/scripts/speca-cli.mjs .claude/skills/speca/scripts/__tests__/speca-cli.test.mjs
git commit -m "feat(speca): add speca-cli.mjs unified CLI entry point"
```

---

## Task 6: Create `reference/context-rules.md`

**Files:**
- Create: `.claude/skills/speca/reference/context-rules.md`

- [ ] **Step 1: Write context-rules.md**

Write the file with exact content from spec lines 290-314. Key sections:

**Prohibited direct reads:** `.speca/config.json`, `.speca/requirements.json`, `.speca/mapping.json`, `.speca/checklist.json`, `.speca/findings.json`, `.speca/test-results.json`, `.speca/progress/*.json`, Solidity source files (full-file reads).

**Required access pattern:** (1) Use `summary` mode first, (2) Use `batch` or `get` for specific data, (3) Maximum batch size: 10.

**Solidity exception:** Read with `offset`/`limit` using mapping `line_range` only.

**Allowed direct reads:** `phases/*.md`, `reference/*.md`, `.speca/reports/*.md` (post-generation polishing only).

- [ ] **Step 2: Verify file renders correctly**

Read the file back and check formatting.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/speca/reference/context-rules.md
git commit -m "feat(speca): add context management rules reference"
```

---

## Task 7: Update SKILL.md

**Files:**
- Modify: `.claude/skills/speca/SKILL.md`

- [ ] **Step 1: Replace Helper Scripts table with unified CLI reference**

Replace the current "Helper Scripts" section with a "CLI" section listing `speca-cli.mjs` subcommands.

- [ ] **Step 2: Add context-rules.md to Reference Data section**

- [ ] **Step 3: Verify changes**

Read back SKILL.md and confirm:
- Helper Scripts table is replaced with CLI subcommand table
- `speca-cli.mjs` is the only CLI reference
- Reference Data lists both `vulnerability-patterns.md` and `context-rules.md`

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/speca/SKILL.md
git commit -m "docs(speca): update SKILL.md with unified CLI reference"
```

---

## Task 8: Rewrite `phases/init.md`

**Files:**
- Modify: `.claude/skills/speca/phases/init.md`

- [ ] **Step 1: Add context management header after first heading**

```markdown
## Context Management
Read `.claude/skills/speca/reference/context-rules.md` and follow strictly.
```

- [ ] **Step 2: Replace config existence check**

Use `speca-cli.mjs config --action validate` instead of direct Read.

- [ ] **Step 3: Replace config write in Step 5b**

Use `echo '<JSON>' | speca-cli.mjs config --action init` instead of direct Write.

- [ ] **Step 4: Verify no remaining direct Read/Write of .speca files**

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/speca/phases/init.md
git commit -m "refactor(speca): rewrite init.md to use speca-cli"
```

---

## Task 9: Rewrite `phases/extract.md`

**Files:**
- Modify: `.claude/skills/speca/phases/extract.md`

- [ ] **Step 1: Add context management header**

- [ ] **Step 2: Replace `Read .speca/config.json` with `speca-cli.mjs config --action summary`**

- [ ] **Step 3: Replace all checkpoint boilerplate**

Replace `node -e "import {getConfigHash}..."` → `speca-cli.mjs config --action hash`
Replace `node -e "import {loadProgress, shouldResume}..."` → `speca-cli.mjs progress --phase extract --action should-resume`
Replace `node -e "import {saveProgress}..."` → `echo '...' | speca-cli.mjs progress --phase extract --action save`

- [ ] **Step 4: Verify no remaining direct Read of .speca files or inline `node -e`**

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/speca/phases/extract.md
git commit -m "refactor(speca): rewrite extract.md to use speca-cli"
```

---

## Task 10: Rewrite `phases/map.md`

**Files:**
- Modify: `.claude/skills/speca/phases/map.md`

- [ ] **Step 1: Add context management header**

- [ ] **Step 2: Replace prerequisites — config and requirements access via CLI**

- [ ] **Step 3: Replace checkpoint boilerplate**

- [ ] **Step 4: Replace Solidity source reading instructions**

Change "Read every .sol file" to: Glob for files, Grep for identifiers, Read with offset/limit for targeted ranges.

- [ ] **Step 5: Replace batch processing to use `query --file requirements --mode batch`**

All `--mode batch` calls MUST use `--size 10` (max batch size per context-rules.md).

- [ ] **Step 6: Verify no remaining prohibited reads**

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/speca/phases/map.md
git commit -m "refactor(speca): rewrite map.md to use speca-cli"
```

---

## Task 11: Rewrite `phases/checklist.md`

**Files:**
- Modify: `.claude/skills/speca/phases/checklist.md`

- [ ] **Step 1: Add context management header**

- [ ] **Step 2: Replace prerequisites — config, requirements, mapping via CLI**

Keep `Read vulnerability-patterns.md` (allowed reference file).

- [ ] **Step 3: Replace checkpoint boilerplate**

- [ ] **Step 4: Update batch processing to use `query --mode batch`**

All `--mode batch` calls MUST use `--size 10` (max batch size per context-rules.md).

- [ ] **Step 5: Verify no remaining prohibited reads**

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/speca/phases/checklist.md
git commit -m "refactor(speca): rewrite checklist.md to use speca-cli"
```

---

## Task 12: Rewrite `phases/audit.md`

**Files:**
- Modify: `.claude/skills/speca/phases/audit.md`

Largest rewrite — most direct reads and script references.

- [ ] **Step 1: Add context management header**

- [ ] **Step 2: Replace prerequisites via CLI**

- [ ] **Step 3: Replace checkpoint boilerplate**

- [ ] **Step 4: Replace `filter-checklist.mjs` → `speca-cli.mjs filter`**

- [ ] **Step 5: Replace findings operations**

- `append-finding.mjs --init` → `speca-cli.mjs record --init`
- `echo > batch-N.json` → `echo | speca-cli.mjs record --write-batch --batch-index N`
- `merge-findings.mjs` → `speca-cli.mjs merge`

- [ ] **Step 6: Replace `compute-stats.mjs` → `speca-cli.mjs stats`**

- [ ] **Step 7: Replace Solidity source reading with offset/limit pattern**

- [ ] **Step 8: Verify no remaining prohibited reads or old script references**

- [ ] **Step 9: Commit**

```bash
git add .claude/skills/speca/phases/audit.md
git commit -m "refactor(speca): rewrite audit.md to use speca-cli"
```

---

## Task 13: Rewrite `phases/test.md`

**Files:**
- Modify: `.claude/skills/speca/phases/test.md`

- [ ] **Step 1: Add context management header**

- [ ] **Step 2: Replace prerequisites — checklist, findings, mapping, config via CLI**

- [ ] **Step 3: Replace checkpoint boilerplate**

- [ ] **Step 4: Replace Solidity source reading with offset/limit**

- [ ] **Step 5: Verify no remaining prohibited reads**

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/speca/phases/test.md
git commit -m "refactor(speca): rewrite test.md to use speca-cli"
```

---

## Task 14: Rewrite `phases/report.md`

**Files:**
- Modify: `.claude/skills/speca/phases/report.md`

- [ ] **Step 1: Add context management header**

- [ ] **Step 2: Replace report generation scripts with `speca-cli.mjs report`**

- [ ] **Step 3: Replace `compute-stats.mjs` → `speca-cli.mjs stats`**

- [ ] **Step 4: Remove all direct reads of .speca files**

Report subcommand reads internally. Only allowed read-back is generated `.speca/reports/*.md` for polishing.

- [ ] **Step 5: Verify no remaining prohibited reads**

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/speca/phases/report.md
git commit -m "refactor(speca): rewrite report.md to use speca-cli"
```

---

## Task 15: Final integration verification

- [ ] **Step 1: Run all script tests**

```bash
cd .claude/skills/speca/scripts && node --test __tests__/*.test.mjs
```

Expected: All PASS

- [ ] **Step 2: Grep for remaining prohibited patterns in phase files**

```bash
grep -rn "Read.*\.speca/" .claude/skills/speca/phases/
grep -rn 'node -e "import' .claude/skills/speca/phases/
grep -rn 'filter-checklist\.mjs\|compute-stats\.mjs\|append-finding\.mjs\|merge-findings\.mjs\|generate-sarif\.mjs\|generate-report-skeleton\.mjs' .claude/skills/speca/phases/
```

Expected: No matches (all replaced with speca-cli.mjs)

- [ ] **Step 3: Verify context-rules.md is referenced in all phase files**

```bash
grep -l "context-rules.md" .claude/skills/speca/phases/*.md | wc -l
```

Expected: 7 (all phases)

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A .claude/skills/speca/
git commit -m "chore(speca): final verification and fixes"
```
