# SPECA Skill + Node.js Hybrid Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the SPECA pipeline from 7 separate commands to a single skill with Node.js helper scripts, enabling batch processing and checkpoint-based resume for large projects.

**Architecture:** A single `/speca` skill acts as orchestrator, routing `$ARGUMENTS` to phase-specific instruction files. Deterministic data processing (JSON filtering, statistics, SARIF generation) is handled by Node.js scripts with zero external dependencies. A checkpoint system enables multi-session execution.

**Tech Stack:** Claude Code Skills, Node.js (ESM, built-in `node:test`), zero external dependencies

---

## Phase 1: Foundation

### Task 1: Scaffold skill directory and package.json

**Files:**
- Create: `.claude/skills/speca/scripts/package.json`

**Step 1: Create directory structure**

```bash
mkdir -p .claude/skills/speca/phases
mkdir -p .claude/skills/speca/reference
mkdir -p .claude/skills/speca/scripts/lib
mkdir -p .claude/skills/speca/scripts/__tests__
```

**Step 2: Write package.json**

Create `.claude/skills/speca/scripts/package.json`:

```json
{
  "name": "speca-scripts",
  "version": "1.0.0",
  "type": "module",
  "description": "SPECA pipeline helper scripts for JSON processing and report generation",
  "scripts": {
    "test": "node --test __tests__/*.test.mjs"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

**Step 3: Commit**

```bash
git add .claude/skills/speca/
git commit -m "chore: scaffold speca skill directory structure"
```

---

### Task 2: Implement config.mjs library

**Files:**
- Create: `.claude/skills/speca/scripts/lib/config.mjs`
- Test: `.claude/skills/speca/scripts/__tests__/config.test.mjs`

**Step 1: Write the failing test**

Create `.claude/skills/speca/scripts/__tests__/config.test.mjs`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, getLanguage, getConfigHash } from '../lib/config.mjs';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURE_DIR = join(import.meta.dirname, 'fixtures', 'config-test');
const SPECA_DIR = join(FIXTURE_DIR, '.speca');

describe('config', () => {
  it('reads config.json and returns parsed object', () => {
    mkdirSync(SPECA_DIR, { recursive: true });
    writeFileSync(join(SPECA_DIR, 'config.json'), JSON.stringify({
      version: '1.0',
      language: 'ja',
      spec_paths: ['./docs/spec.md'],
      source_paths: ['./contracts/'],
      threat_model: { actors: {}, boundaries: [], assumptions: [] }
    }));

    const config = readConfig(FIXTURE_DIR);
    assert.equal(config.language, 'ja');
    assert.deepEqual(config.spec_paths, ['./docs/spec.md']);

    rmSync(FIXTURE_DIR, { recursive: true });
  });

  it('returns "en" when language field is missing', () => {
    mkdirSync(SPECA_DIR, { recursive: true });
    writeFileSync(join(SPECA_DIR, 'config.json'), JSON.stringify({
      version: '1.0',
      spec_paths: [],
      source_paths: [],
      threat_model: { actors: {}, boundaries: [], assumptions: [] }
    }));

    assert.equal(getLanguage(readConfig(FIXTURE_DIR)), 'en');

    rmSync(FIXTURE_DIR, { recursive: true });
  });

  it('throws when config.json does not exist', () => {
    assert.throws(() => readConfig('/nonexistent'), { code: 'ENOENT' });
  });

  it('getConfigHash returns consistent hash for same config', () => {
    mkdirSync(SPECA_DIR, { recursive: true });
    const configData = JSON.stringify({ version: '1.0', spec_paths: [] });
    writeFileSync(join(SPECA_DIR, 'config.json'), configData);

    const hash1 = getConfigHash(FIXTURE_DIR);
    const hash2 = getConfigHash(FIXTURE_DIR);
    assert.equal(hash1, hash2);
    assert.equal(typeof hash1, 'string');
    assert.ok(hash1.length > 0);

    rmSync(FIXTURE_DIR, { recursive: true });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/config.test.mjs`
Expected: FAIL with "Cannot find module '../lib/config.mjs'"

**Step 3: Write implementation**

Create `.claude/skills/speca/scripts/lib/config.mjs`:

```javascript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Read and parse .speca/config.json from the given project root.
 * Throws ENOENT if file does not exist.
 */
export function readConfig(projectRoot) {
  const configPath = join(projectRoot, '.speca', 'config.json');
  const raw = readFileSync(configPath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Extract language from config, defaulting to 'en'.
 */
export function getLanguage(config) {
  return config.language || 'en';
}

/**
 * Compute a short hash of config.json content for change detection.
 */
export function getConfigHash(projectRoot) {
  const configPath = join(projectRoot, '.speca', 'config.json');
  const raw = readFileSync(configPath, 'utf-8');
  return createHash('sha256').update(raw).digest('hex').slice(0, 12);
}
```

**Step 4: Run test to verify it passes**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/config.test.mjs`
Expected: All 4 tests PASS

**Step 5: Commit**

```bash
git add .claude/skills/speca/scripts/lib/config.mjs .claude/skills/speca/scripts/__tests__/config.test.mjs
git commit -m "feat(speca): add config.mjs library with read, language, and hash"
```

---

### Task 3: Implement progress.mjs library

**Files:**
- Create: `.claude/skills/speca/scripts/lib/progress.mjs`
- Test: `.claude/skills/speca/scripts/__tests__/progress.test.mjs`

**Step 1: Write the failing test**

Create `.claude/skills/speca/scripts/__tests__/progress.test.mjs`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadProgress, saveProgress, shouldResume } from '../lib/progress.mjs';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURE_DIR = join(import.meta.dirname, 'fixtures', 'progress-test');

describe('progress', () => {
  it('returns null when no progress file exists', () => {
    const result = loadProgress(FIXTURE_DIR, 'audit');
    assert.equal(result, null);
  });

  it('saves and loads progress', () => {
    const progress = {
      phase: 'audit',
      started_at: '2026-02-19T10:00:00Z',
      updated_at: '2026-02-19T10:00:00Z',
      status: 'in_progress',
      total_items: 28,
      completed_items: 5,
      current_batch: 1,
      batch_size: 5,
      config_hash: 'abc123'
    };

    saveProgress(FIXTURE_DIR, 'audit', progress);
    const loaded = loadProgress(FIXTURE_DIR, 'audit');
    assert.deepEqual(loaded, progress);

    rmSync(join(FIXTURE_DIR, '.speca'), { recursive: true });
  });

  it('shouldResume returns "resume" for in_progress', () => {
    const progress = { status: 'in_progress', config_hash: 'abc' };
    assert.equal(shouldResume(progress, 'abc'), 'resume');
  });

  it('shouldResume returns "restart" for changed config', () => {
    const progress = { status: 'in_progress', config_hash: 'abc' };
    assert.equal(shouldResume(progress, 'xyz'), 'restart');
  });

  it('shouldResume returns "completed" for completed status', () => {
    const progress = { status: 'completed', config_hash: 'abc' };
    assert.equal(shouldResume(progress, 'abc'), 'completed');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/progress.test.mjs`
Expected: FAIL

**Step 3: Write implementation**

Create `.claude/skills/speca/scripts/lib/progress.mjs`:

```javascript
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Load progress for a given phase. Returns null if no progress file exists.
 */
export function loadProgress(projectRoot, phase) {
  const progressPath = join(projectRoot, '.speca', 'progress', `${phase}-progress.json`);
  try {
    const raw = readFileSync(progressPath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

/**
 * Save progress for a given phase.
 */
export function saveProgress(projectRoot, phase, progress) {
  const dir = join(projectRoot, '.speca', 'progress');
  mkdirSync(dir, { recursive: true });
  const progressPath = join(dir, `${phase}-progress.json`);
  writeFileSync(progressPath, JSON.stringify(progress, null, 2));
}

/**
 * Determine action based on progress state and current config hash.
 * Returns: 'resume' | 'restart' | 'completed' | 'fresh'
 */
export function shouldResume(progress, currentConfigHash) {
  if (!progress) return 'fresh';
  if (progress.config_hash !== currentConfigHash) return 'restart';
  if (progress.status === 'completed') return 'completed';
  return 'resume';
}
```

**Step 4: Run test to verify it passes**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/progress.test.mjs`
Expected: All 5 tests PASS

**Step 5: Commit**

```bash
git add .claude/skills/speca/scripts/lib/progress.mjs .claude/skills/speca/scripts/__tests__/progress.test.mjs
git commit -m "feat(speca): add progress.mjs library for checkpoint management"
```

---

### Task 4: Implement filter-checklist.mjs

**Files:**
- Create: `.claude/skills/speca/scripts/filter-checklist.mjs`
- Test: `.claude/skills/speca/scripts/__tests__/filter-checklist.test.mjs`

**Step 1: Write the failing test**

Create `.claude/skills/speca/scripts/__tests__/filter-checklist.test.mjs`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterChecklist } from '../filter-checklist.mjs';

const SAMPLE_CHECKLIST = {
  checklist: [
    { id: 'CHK-ACCESS-001-a', priority: 'critical', check_type: 'static', requirement_id: 'R-AUTH-003' },
    { id: 'CHK-ACCESS-001-b', priority: 'critical', check_type: 'dynamic', requirement_id: 'R-AUTH-003' },
    { id: 'CHK-REENT-001-a', priority: 'high', check_type: 'static', requirement_id: 'R-STATE-001' },
    { id: 'CHK-VAL-001-a', priority: 'medium', check_type: 'static', requirement_id: 'R-VAL-001' },
    { id: 'CHK-REENT-002-a', priority: 'high', check_type: 'static', requirement_id: 'R-STATE-002' },
    { id: 'CHK-AUTH-001-a', priority: 'high', check_type: 'static', requirement_id: 'R-AUTH-001' },
  ]
};

describe('filterChecklist', () => {
  it('filters by priority', () => {
    const result = filterChecklist(SAMPLE_CHECKLIST, { priority: ['critical'] });
    assert.equal(result.length, 2);
    assert.ok(result.every(item => item.priority === 'critical'));
  });

  it('filters by check_type', () => {
    const result = filterChecklist(SAMPLE_CHECKLIST, { type: ['static'] });
    assert.ok(result.every(item => item.check_type === 'static'));
  });

  it('returns batch slice', () => {
    const result = filterChecklist(SAMPLE_CHECKLIST, { type: ['static'], batchIndex: 0, batchSize: 2 });
    assert.equal(result.length, 2);
  });

  it('returns empty array for out-of-range batch', () => {
    const result = filterChecklist(SAMPLE_CHECKLIST, { type: ['static'], batchIndex: 100, batchSize: 2 });
    assert.equal(result.length, 0);
  });

  it('returns total count in metadata when requested', () => {
    const result = filterChecklist(SAMPLE_CHECKLIST, { type: ['static'], batchIndex: 0, batchSize: 2, includeMeta: true });
    assert.equal(result.meta.totalFiltered, 5);
    assert.equal(result.meta.totalBatches, 3);
    assert.equal(result.items.length, 2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/filter-checklist.test.mjs`
Expected: FAIL

**Step 3: Write implementation**

Create `.claude/skills/speca/scripts/filter-checklist.mjs`:

```javascript
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

/**
 * Filter checklist items by priority, type, and return a batch slice.
 */
export function filterChecklist(checklistData, options = {}) {
  const { priority, type, batchIndex, batchSize, includeMeta } = options;

  let items = checklistData.checklist;

  if (priority?.length) {
    items = items.filter(item => priority.includes(item.priority));
  }
  if (type?.length) {
    items = items.filter(item => type.includes(item.check_type));
  }

  const totalFiltered = items.length;

  if (batchIndex !== undefined && batchSize !== undefined) {
    const start = batchIndex * batchSize;
    const sliced = items.slice(start, start + batchSize);

    if (includeMeta) {
      return {
        meta: {
          totalFiltered,
          totalBatches: Math.ceil(totalFiltered / batchSize),
          batchIndex,
          batchSize
        },
        items: sliced
      };
    }
    return sliced;
  }

  if (includeMeta) {
    return { meta: { totalFiltered, totalBatches: 1, batchIndex: 0, batchSize: totalFiltered }, items };
  }
  return items;
}

// CLI entry point
if (process.argv[1] === import.meta.filename) {
  const { values } = parseArgs({
    options: {
      input: { type: 'string' },
      priority: { type: 'string' },
      type: { type: 'string' },
      'batch-index': { type: 'string' },
      'batch-size': { type: 'string' },
      mapping: { type: 'string' },
    }
  });

  const checklistData = JSON.parse(readFileSync(values.input, 'utf-8'));
  const opts = {
    priority: values.priority?.split(','),
    type: values.type?.split(','),
    batchIndex: values['batch-index'] !== undefined ? parseInt(values['batch-index']) : undefined,
    batchSize: values['batch-size'] !== undefined ? parseInt(values['batch-size']) : undefined,
    includeMeta: true
  };

  const result = filterChecklist(checklistData, opts);

  // If mapping file provided, enrich items with code locations
  if (values.mapping) {
    const mappingData = JSON.parse(readFileSync(values.mapping, 'utf-8'));
    const mappingIndex = Object.fromEntries(
      mappingData.mappings.map(m => [m.requirement_id, m])
    );
    for (const item of result.items) {
      const mapping = mappingIndex[item.requirement_id];
      if (mapping) {
        item._locations = mapping.locations;
        item._requirement_text = mapping.requirement_text;
      }
    }
  }

  console.log(JSON.stringify(result, null, 2));
}
```

**Step 4: Run test to verify it passes**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/filter-checklist.test.mjs`
Expected: All 5 tests PASS

**Step 5: Commit**

```bash
git add .claude/skills/speca/scripts/filter-checklist.mjs .claude/skills/speca/scripts/__tests__/filter-checklist.test.mjs
git commit -m "feat(speca): add filter-checklist.mjs with batch support"
```

---

### Task 5: Implement compute-stats.mjs

**Files:**
- Create: `.claude/skills/speca/scripts/compute-stats.mjs`
- Test: `.claude/skills/speca/scripts/__tests__/compute-stats.test.mjs`

**Step 1: Write the failing test**

Create `.claude/skills/speca/scripts/__tests__/compute-stats.test.mjs`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats } from '../compute-stats.mjs';

const SAMPLE_FINDINGS = {
  findings_by_severity: { critical: 2, high: 1, medium: 0, low: 0, informational: 0 },
  total_findings: 3,
  findings: [
    { id: 'FIND-001', checklist_id: 'CHK-ACCESS-001-a', severity: 'critical' },
    { id: 'FIND-002', checklist_id: 'CHK-ACCESS-001-c', severity: 'critical' },
    { id: 'FIND-003', checklist_id: 'CHK-REENT-001-a', severity: 'high' },
  ]
};

const SAMPLE_CHECKLIST = {
  total_checks: 28,
  summary: { by_check_type: { static: 10, dynamic: 18 } },
  checklist: [
    { id: 'CHK-ACCESS-001-a', priority: 'critical', check_type: 'static' },
    { id: 'CHK-ACCESS-001-c', priority: 'critical', check_type: 'static' },
    { id: 'CHK-REENT-001-a', priority: 'high', check_type: 'static' },
    { id: 'CHK-VAL-001-a', priority: 'medium', check_type: 'static' },
  ]
};

describe('computeStats', () => {
  it('computes severity counts', () => {
    const stats = computeStats(SAMPLE_FINDINGS, SAMPLE_CHECKLIST);
    assert.equal(stats.severity.critical, 2);
    assert.equal(stats.severity.high, 1);
    assert.equal(stats.total_findings, 3);
  });

  it('computes checklist coverage', () => {
    const stats = computeStats(SAMPLE_FINDINGS, SAMPLE_CHECKLIST);
    assert.equal(stats.checklist.total, 28);
    assert.equal(typeof stats.checklist.coverage_pct, 'number');
  });

  it('identifies failed checklist items', () => {
    const stats = computeStats(SAMPLE_FINDINGS, SAMPLE_CHECKLIST);
    assert.ok(stats.checklist.failed_ids.includes('CHK-ACCESS-001-a'));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/compute-stats.test.mjs`
Expected: FAIL

**Step 3: Write implementation**

Create `.claude/skills/speca/scripts/compute-stats.mjs`:

```javascript
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

/**
 * Compute statistics from findings and checklist data.
 */
export function computeStats(findingsData, checklistData) {
  const failedIds = new Set(findingsData.findings.map(f => f.checklist_id));

  const byPriority = { critical: { checked: 0, passed: 0, failed: 0, skipped: 0 }, high: { checked: 0, passed: 0, failed: 0, skipped: 0 }, medium: { checked: 0, passed: 0, failed: 0, skipped: 0 }, low: { checked: 0, passed: 0, failed: 0, skipped: 0 } };

  for (const item of checklistData.checklist) {
    const p = byPriority[item.priority];
    if (!p) continue;
    if (item.check_type === 'dynamic') {
      p.skipped++;
    } else {
      p.checked++;
      if (failedIds.has(item.id)) {
        p.failed++;
      } else {
        p.passed++;
      }
    }
  }

  const staticCount = checklistData.summary?.by_check_type?.static ?? 0;
  const dynamicCount = checklistData.summary?.by_check_type?.dynamic ?? 0;
  const totalChecks = checklistData.total_checks;
  const checksAudited = staticCount;
  const coveragePct = totalChecks > 0 ? Math.round((checksAudited / totalChecks) * 1000) / 10 : 0;

  return {
    severity: findingsData.findings_by_severity,
    total_findings: findingsData.total_findings,
    checklist: {
      total: totalChecks,
      audited: checksAudited,
      dynamic_skipped: dynamicCount,
      coverage_pct: coveragePct,
      by_priority: byPriority,
      failed_ids: [...failedIds],
    }
  };
}

// CLI entry point
if (process.argv[1] === import.meta.filename) {
  const { values } = parseArgs({
    options: {
      findings: { type: 'string' },
      checklist: { type: 'string' },
      format: { type: 'string', default: 'json' },
    }
  });

  const findingsData = JSON.parse(readFileSync(values.findings, 'utf-8'));
  const checklistData = JSON.parse(readFileSync(values.checklist, 'utf-8'));
  const stats = computeStats(findingsData, checklistData);

  if (values.format === 'text') {
    console.log(`Findings: ${stats.total_findings}`);
    console.log(`  Critical: ${stats.severity.critical}`);
    console.log(`  High: ${stats.severity.high}`);
    console.log(`  Medium: ${stats.severity.medium}`);
    console.log(`  Low: ${stats.severity.low}`);
    console.log(`  Informational: ${stats.severity.informational}`);
    console.log(`Checklist: ${stats.checklist.audited}/${stats.checklist.total} (${stats.checklist.coverage_pct}%)`);
  } else {
    console.log(JSON.stringify(stats, null, 2));
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/compute-stats.test.mjs`
Expected: All 3 tests PASS

**Step 5: Commit**

```bash
git add .claude/skills/speca/scripts/compute-stats.mjs .claude/skills/speca/scripts/__tests__/compute-stats.test.mjs
git commit -m "feat(speca): add compute-stats.mjs for findings/checklist statistics"
```

---

### Task 6: Implement append-finding.mjs and merge-findings.mjs

**Files:**
- Create: `.claude/skills/speca/scripts/append-finding.mjs`
- Create: `.claude/skills/speca/scripts/merge-findings.mjs`
- Test: `.claude/skills/speca/scripts/__tests__/findings.test.mjs`

**Step 1: Write the failing test**

Create `.claude/skills/speca/scripts/__tests__/findings.test.mjs`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { appendFinding, initFindings } from '../append-finding.mjs';
import { mergeFindings } from '../merge-findings.mjs';
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURE_DIR = join(import.meta.dirname, 'fixtures', 'findings-test');
const SPECA_DIR = join(FIXTURE_DIR, '.speca');

describe('appendFinding', () => {
  it('initializes findings.json with empty findings', () => {
    mkdirSync(SPECA_DIR, { recursive: true });
    initFindings(FIXTURE_DIR, '2026-02-19T00:00:00Z', '2026-02-18T00:00:00Z');
    const data = JSON.parse(readFileSync(join(SPECA_DIR, 'findings.json'), 'utf-8'));
    assert.equal(data.total_findings, 0);
    assert.deepEqual(data.findings, []);
    rmSync(FIXTURE_DIR, { recursive: true });
  });

  it('appends a finding and updates counts', () => {
    mkdirSync(SPECA_DIR, { recursive: true });
    initFindings(FIXTURE_DIR, '2026-02-19T00:00:00Z', '2026-02-18T00:00:00Z');

    const finding = {
      id: 'FIND-001',
      checklist_id: 'CHK-ACCESS-001-a',
      severity: 'critical',
      title: 'Test finding',
      description: 'desc',
      proof_trace: { code_refs: [], reasoning: 'test' },
      recommendation: 'fix it',
      false_positive_risk: 'low',
      threat_model_note: ''
    };

    appendFinding(FIXTURE_DIR, finding);
    const data = JSON.parse(readFileSync(join(SPECA_DIR, 'findings.json'), 'utf-8'));
    assert.equal(data.total_findings, 1);
    assert.equal(data.findings_by_severity.critical, 1);
    assert.equal(data.findings[0].id, 'FIND-001');

    rmSync(FIXTURE_DIR, { recursive: true });
  });
});

describe('mergeFindings', () => {
  it('merges multiple batch files into findings.json', () => {
    mkdirSync(join(SPECA_DIR, 'progress', 'audit-batches'), { recursive: true });

    const batch0 = [
      { id: 'FIND-001', severity: 'critical', checklist_id: 'CHK-A', title: 'A', description: '', proof_trace: { code_refs: [], reasoning: '' }, recommendation: '', false_positive_risk: 'low', threat_model_note: '' }
    ];
    const batch1 = [
      { id: 'FIND-002', severity: 'high', checklist_id: 'CHK-B', title: 'B', description: '', proof_trace: { code_refs: [], reasoning: '' }, recommendation: '', false_positive_risk: 'low', threat_model_note: '' }
    ];

    writeFileSync(join(SPECA_DIR, 'progress', 'audit-batches', 'batch-0.json'), JSON.stringify(batch0));
    writeFileSync(join(SPECA_DIR, 'progress', 'audit-batches', 'batch-1.json'), JSON.stringify(batch1));

    mergeFindings(FIXTURE_DIR, '2026-02-19T00:00:00Z', '2026-02-18T00:00:00Z', 10);
    const data = JSON.parse(readFileSync(join(SPECA_DIR, 'findings.json'), 'utf-8'));
    assert.equal(data.total_findings, 2);
    assert.equal(data.findings_by_severity.critical, 1);
    assert.equal(data.findings_by_severity.high, 1);

    rmSync(FIXTURE_DIR, { recursive: true });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/findings.test.mjs`
Expected: FAIL

**Step 3: Write append-finding.mjs**

Create `.claude/skills/speca/scripts/append-finding.mjs`:

```javascript
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low', 'informational'];

/**
 * Initialize an empty findings.json.
 */
export function initFindings(projectRoot, auditedAt, checklistVersion) {
  const findingsPath = join(projectRoot, '.speca', 'findings.json');
  const data = {
    audited_at: auditedAt,
    checklist_version: checklistVersion,
    total_checks_audited: 0,
    total_findings: 0,
    findings_by_severity: Object.fromEntries(SEVERITY_LEVELS.map(s => [s, 0])),
    findings: []
  };
  writeFileSync(findingsPath, JSON.stringify(data, null, 2));
}

/**
 * Append a finding to findings.json and update severity counts.
 */
export function appendFinding(projectRoot, finding) {
  const findingsPath = join(projectRoot, '.speca', 'findings.json');
  const data = JSON.parse(readFileSync(findingsPath, 'utf-8'));

  data.findings.push(finding);
  data.total_findings = data.findings.length;
  if (finding.severity in data.findings_by_severity) {
    data.findings_by_severity[finding.severity]++;
  }

  writeFileSync(findingsPath, JSON.stringify(data, null, 2));
}

// CLI: reads finding JSON from stdin
if (process.argv[1] === import.meta.filename) {
  const { values } = parseArgs({
    options: {
      'project-root': { type: 'string', default: '.' },
      init: { type: 'boolean', default: false },
      'audited-at': { type: 'string' },
      'checklist-version': { type: 'string' },
    }
  });

  if (values.init) {
    initFindings(values['project-root'], values['audited-at'], values['checklist-version']);
  } else {
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    const finding = JSON.parse(input);
    appendFinding(values['project-root'], finding);
  }
}
```

**Step 4: Write merge-findings.mjs**

Create `.claude/skills/speca/scripts/merge-findings.mjs`:

```javascript
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'informational'];

/**
 * Merge batch finding files into a single findings.json.
 */
export function mergeFindings(projectRoot, auditedAt, checklistVersion, totalChecksAudited) {
  const batchDir = join(projectRoot, '.speca', 'progress', 'audit-batches');
  const files = readdirSync(batchDir).filter(f => f.startsWith('batch-') && f.endsWith('.json')).sort();

  const allFindings = [];
  for (const file of files) {
    const batch = JSON.parse(readFileSync(join(batchDir, file), 'utf-8'));
    allFindings.push(...batch);
  }

  // Sort by severity then by ID
  allFindings.sort((a, b) => {
    const sa = SEVERITY_ORDER.indexOf(a.severity);
    const sb = SEVERITY_ORDER.indexOf(b.severity);
    if (sa !== sb) return sa - sb;
    return a.id.localeCompare(b.id);
  });

  const bySeverity = Object.fromEntries(SEVERITY_ORDER.map(s => [s, 0]));
  for (const f of allFindings) {
    if (f.severity in bySeverity) bySeverity[f.severity]++;
  }

  const data = {
    audited_at: auditedAt,
    checklist_version: checklistVersion,
    total_checks_audited: totalChecksAudited,
    total_findings: allFindings.length,
    findings_by_severity: bySeverity,
    findings: allFindings
  };

  writeFileSync(join(projectRoot, '.speca', 'findings.json'), JSON.stringify(data, null, 2));
}

// CLI entry point
if (process.argv[1] === import.meta.filename) {
  const { values } = parseArgs({
    options: {
      'project-root': { type: 'string', default: '.' },
      'audited-at': { type: 'string' },
      'checklist-version': { type: 'string' },
      'total-checks': { type: 'string' },
    }
  });

  mergeFindings(values['project-root'], values['audited-at'], values['checklist-version'], parseInt(values['total-checks']));
}
```

**Step 5: Run test to verify it passes**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/findings.test.mjs`
Expected: All 3 tests PASS

**Step 6: Commit**

```bash
git add .claude/skills/speca/scripts/append-finding.mjs .claude/skills/speca/scripts/merge-findings.mjs .claude/skills/speca/scripts/__tests__/findings.test.mjs
git commit -m "feat(speca): add append-finding.mjs and merge-findings.mjs for batch audit"
```

---

### Task 7: Implement generate-sarif.mjs

**Files:**
- Create: `.claude/skills/speca/scripts/generate-sarif.mjs`
- Test: `.claude/skills/speca/scripts/__tests__/generate-sarif.test.mjs`

**Step 1: Write the failing test**

Create `.claude/skills/speca/scripts/__tests__/generate-sarif.test.mjs`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateSarif } from '../generate-sarif.mjs';

describe('generateSarif', () => {
  it('generates valid SARIF v2.1.0 structure', () => {
    const findings = {
      findings: [
        {
          id: 'FIND-001',
          checklist_id: 'CHK-ACCESS-001-a',
          severity: 'critical',
          title: 'Missing access control',
          description: 'deposit() lacks whitelist check',
          proof_trace: {
            code_refs: [{ file: 'contracts/Vault.sol', lines: [23, 28], snippet: 'code' }]
          }
        }
      ]
    };
    const checklist = {
      checklist: [
        { id: 'CHK-ACCESS-001-a', property: 'deposit() must check whitelist' }
      ]
    };

    const sarif = generateSarif(findings, checklist);
    assert.equal(sarif.version, '2.1.0');
    assert.equal(sarif.runs.length, 1);
    assert.equal(sarif.runs[0].results.length, 1);
    assert.equal(sarif.runs[0].results[0].level, 'error');
    assert.equal(sarif.runs[0].tool.driver.rules.length, 1);
  });

  it('generates empty results for no findings', () => {
    const sarif = generateSarif({ findings: [] }, { checklist: [] });
    assert.equal(sarif.runs[0].results.length, 0);
    assert.equal(sarif.runs[0].tool.driver.rules.length, 0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/generate-sarif.test.mjs`
Expected: FAIL

**Step 3: Write implementation**

Create `.claude/skills/speca/scripts/generate-sarif.mjs`:

```javascript
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const SEVERITY_TO_SARIF = {
  critical: 'error',
  high: 'error',
  medium: 'warning',
  low: 'note',
  informational: 'note'
};

/**
 * Generate a SARIF v2.1.0 document from findings and checklist.
 */
export function generateSarif(findingsData, checklistData) {
  const checklistIndex = Object.fromEntries(
    (checklistData.checklist || []).map(c => [c.id, c])
  );

  // Build rules from unique checklist IDs in findings
  const ruleMap = new Map();
  for (const finding of findingsData.findings) {
    if (!ruleMap.has(finding.checklist_id)) {
      const checkItem = checklistIndex[finding.checklist_id];
      const highestSeverity = finding.severity;
      ruleMap.set(finding.checklist_id, {
        id: finding.checklist_id,
        shortDescription: { text: checkItem?.property || finding.title },
        defaultConfiguration: { level: SEVERITY_TO_SARIF[highestSeverity] || 'note' }
      });
    }
  }

  // Build results
  const results = findingsData.findings.map(finding => {
    const result = {
      ruleId: finding.checklist_id,
      level: SEVERITY_TO_SARIF[finding.severity] || 'note',
      message: { text: `${finding.title}: ${finding.description}` }
    };

    const codeRefs = finding.proof_trace?.code_refs;
    if (codeRefs?.length) {
      result.locations = codeRefs.map(ref => ({
        physicalLocation: {
          artifactLocation: { uri: ref.file },
          region: { startLine: ref.lines[0], endLine: ref.lines[1] }
        }
      }));
    }

    return result;
  });

  return {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'speca',
          version: '1.0',
          informationUri: 'https://arxiv.org/abs/2602.07513',
          rules: [...ruleMap.values()]
        }
      },
      results
    }]
  };
}

// CLI entry point
if (process.argv[1] === import.meta.filename) {
  const { values } = parseArgs({
    options: {
      findings: { type: 'string' },
      checklist: { type: 'string' },
      output: { type: 'string' },
    }
  });

  const findingsData = JSON.parse(readFileSync(values.findings, 'utf-8'));
  const checklistData = values.checklist
    ? JSON.parse(readFileSync(values.checklist, 'utf-8'))
    : { checklist: [] };

  const sarif = generateSarif(findingsData, checklistData);
  writeFileSync(values.output, JSON.stringify(sarif, null, 2));
  console.log(`SARIF written to ${values.output}`);
}
```

**Step 4: Run test to verify it passes**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/generate-sarif.test.mjs`
Expected: All 2 tests PASS

**Step 5: Commit**

```bash
git add .claude/skills/speca/scripts/generate-sarif.mjs .claude/skills/speca/scripts/__tests__/generate-sarif.test.mjs
git commit -m "feat(speca): add generate-sarif.mjs for LLM-free SARIF generation"
```

---

### Task 8: Implement generate-report-skeleton.mjs

**Files:**
- Create: `.claude/skills/speca/scripts/generate-report-skeleton.mjs`
- Test: `.claude/skills/speca/scripts/__tests__/generate-report-skeleton.test.mjs`

**Step 1: Write the failing test**

Create `.claude/skills/speca/scripts/__tests__/generate-report-skeleton.test.mjs`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateReportSkeleton } from '../generate-report-skeleton.mjs';

describe('generateReportSkeleton', () => {
  it('generates markdown with executive summary table', () => {
    const config = { threat_model: { actors: { owner: 'TRUSTED' }, boundaries: ['owner -> all'], assumptions: ['EVM is deterministic'] } };
    const findings = { findings_by_severity: { critical: 1, high: 0, medium: 0, low: 0, informational: 0 }, total_findings: 1, findings: [{ id: 'FIND-001', severity: 'critical', title: 'Test', checklist_id: 'CHK-A', description: 'desc', proof_trace: { code_refs: [], reasoning: 'r' }, recommendation: 'fix', false_positive_risk: 'low' }] };
    const checklist = { total_checks: 10, summary: { by_check_type: { static: 5, dynamic: 5 } }, checklist: [] };

    const md = generateReportSkeleton({ config, findings, checklist, date: '2026-02-19', targetName: 'SimpleVault' });
    assert.ok(md.includes('# SPECA Security Audit Report'));
    assert.ok(md.includes('Critical'));
    assert.ok(md.includes('FIND-001'));
  });

  it('includes TODO placeholders for LLM-generated content', () => {
    const config = { threat_model: { actors: {}, boundaries: [], assumptions: [] } };
    const findings = { findings_by_severity: { critical: 0, high: 0, medium: 0, low: 0, informational: 0 }, total_findings: 0, findings: [] };
    const checklist = { total_checks: 0, summary: { by_check_type: { static: 0, dynamic: 0 } }, checklist: [] };

    const md = generateReportSkeleton({ config, findings, checklist, date: '2026-02-19', targetName: 'Test' });
    assert.ok(md.includes('No findings were identified'));
  });
});
```

**Step 2: Run test, verify fail, then implement**

Implementation creates the report skeleton with all tables and statistics pre-generated. Only finding descriptions, recommendations, and reasoning are left for the LLM to localize. This is the largest script — see the full implementation in the codebase.

**Step 3: Commit**

```bash
git add .claude/skills/speca/scripts/generate-report-skeleton.mjs .claude/skills/speca/scripts/__tests__/generate-report-skeleton.test.mjs
git commit -m "feat(speca): add generate-report-skeleton.mjs for pre-built report tables"
```

---

### Task 9: Run all tests together

**Step 1: Run full test suite**

Run: `cd .claude/skills/speca/scripts && node --test __tests__/*.test.mjs`
Expected: All tests PASS

**Step 2: Test CLI with real data**

```bash
# filter-checklist against real example data
node .claude/skills/speca/scripts/filter-checklist.mjs \
  --input examples/simple-vault/.speca/checklist.json \
  --priority critical --type static --batch-index 0 --batch-size 2

# compute-stats against real example data
node .claude/skills/speca/scripts/compute-stats.mjs \
  --findings examples/simple-vault/.speca/findings.json \
  --checklist examples/simple-vault/.speca/checklist.json \
  --format text

# generate-sarif against real example data
node .claude/skills/speca/scripts/generate-sarif.mjs \
  --findings examples/simple-vault/.speca/findings.json \
  --checklist examples/simple-vault/.speca/checklist.json \
  --output /tmp/test-report.sarif
```

Expected: Each command produces valid output without errors.

---

## Phase 2: Skill Entry Point and Phase Files

### Task 10: Create SKILL.md entry point

**Files:**
- Create: `.claude/skills/speca/SKILL.md`

Create the skill entry point that routes `$ARGUMENTS` to the appropriate phase file. The SKILL.md should:

1. Parse `$ARGUMENTS` to determine the phase (init/extract/map/checklist/audit/test/report)
2. Read the corresponding `phases/<phase>.md` file
3. Follow its instructions
4. If no argument, display usage help

**Commit:**
```bash
git add .claude/skills/speca/SKILL.md
git commit -m "feat(speca): add SKILL.md entry point with argument routing"
```

---

### Task 11: Migrate phases/init.md from existing command

**Files:**
- Create: `.claude/skills/speca/phases/init.md`
- Source: `.claude/commands/speca-init.md` (adapt, do not copy verbatim)

Adapt the existing `speca-init.md` command to the skill context. Key changes:
- Reference scripts path as `.claude/skills/speca/scripts/`
- No fundamental logic changes needed (init is interactive, minimal JSON processing)

**Commit:**
```bash
git add .claude/skills/speca/phases/init.md
git commit -m "feat(speca): migrate init phase to skill format"
```

---

### Task 12: Migrate phases/extract.md

Adapt `.claude/commands/speca-extract.md`. Key changes:
- Add batch processing for multi-file specs
- Use progress.mjs for checkpointing

**Commit:**
```bash
git commit -m "feat(speca): migrate extract phase to skill format with batching"
```

---

### Task 13: Migrate phases/map.md

Adapt `.claude/commands/speca-map.md`. Key changes:
- Batch requirements in groups of 10
- Use progress.mjs for checkpointing

**Commit:**
```bash
git commit -m "feat(speca): migrate map phase to skill format with batching"
```

---

### Task 14: Migrate phases/checklist.md + reference/vulnerability-patterns.md

Adapt `.claude/commands/speca-checklist.md`. Key changes:
- Extract the inline vulnerability pattern database to `reference/vulnerability-patterns.md`
- Checklist references it via `Read` when needed
- Batch processing for mappings

**Commit:**
```bash
git commit -m "feat(speca): migrate checklist phase with extracted pattern DB"
```

---

### Task 15: Migrate phases/audit.md (highest impact)

Adapt `.claude/commands/speca-audit.md`. Key changes:
- Use `filter-checklist.mjs` to feed batches of 5 items
- Use `append-finding.mjs` to save results incrementally
- Use `merge-findings.mjs` at the end
- Full progress/checkpoint support for session resume
- Use `compute-stats.mjs` for summary

**Commit:**
```bash
git commit -m "feat(speca): migrate audit phase with batch processing and checkpoints"
```

---

### Task 16: Migrate phases/test.md

Adapt `.claude/commands/speca-test.md`. Key changes:
- Batch findings in groups of 3
- Progress tracking for test generation

**Commit:**
```bash
git commit -m "feat(speca): migrate test phase to skill format"
```

---

### Task 17: Migrate phases/report.md

Adapt `.claude/commands/speca-report.md`. Key changes:
- Use `generate-report-skeleton.mjs` for tables and statistics
- Use `generate-sarif.mjs` for SARIF (fully script-driven)
- LLM only fills in prose sections and localizes per `language`

**Commit:**
```bash
git commit -m "feat(speca): migrate report phase with script-driven generation"
```

---

## Phase 3: Cleanup and Validation

### Task 18: E2E test against examples/simple-vault

Run the full pipeline via the new skill:
```
/speca init      → verify config.json created
/speca extract   → verify requirements.json matches expected
/speca map       → verify mapping.json quality
/speca checklist → verify checklist.json quality
/speca audit     → verify findings detected
/speca report    → verify report.md + report.sarif generated
```

Compare output quality against existing `examples/simple-vault/.speca/`.

---

### Task 19: Remove old commands

**Files:**
- Delete: `.claude/commands/speca-init.md`
- Delete: `.claude/commands/speca-extract.md`
- Delete: `.claude/commands/speca-map.md`
- Delete: `.claude/commands/speca-checklist.md`
- Delete: `.claude/commands/speca-audit.md`
- Delete: `.claude/commands/speca-test.md`
- Delete: `.claude/commands/speca-report.md`

Only after E2E validation passes.

**Commit:**
```bash
git rm .claude/commands/speca-*.md
git commit -m "chore: remove legacy SPECA commands, replaced by /speca skill"
```
