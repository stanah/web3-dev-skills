# SPECA Benchmark System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a benchmark system that evaluates SPECA's detection accuracy and pipeline quality using Code4rena contest cases, with fully automated scoring.

**Architecture:** Three standalone Node.js scripts (zero external deps, matching existing SPECA scripts) — `evaluate.mjs` for scoring, `collect.mjs` for fetching contest data, and `format-results.mjs` for human-readable output. SPECA execution itself is manual (LLM-based skill). Directory structure under `benchmarks/` with per-case isolation.

**Tech Stack:** Node.js (ESM, node:test), shell scripts, GitHub CLI (`gh`)

---

### Task 1: Scaffold benchmarks directory and metadata

**Files:**
- Create: `benchmarks/benchmark.json`
- Create: `benchmarks/.gitignore`
- Create: `benchmarks/cases/.gitkeep`
- Create: `benchmarks/results/.gitkeep`

**Step 1: Create directory structure**

```bash
mkdir -p benchmarks/cases benchmarks/results
```

**Step 2: Write benchmark.json**

```json
{
  "version": "1.0",
  "description": "SPECA detection accuracy benchmark using Code4rena contest cases",
  "created_at": "2026-02-21",
  "selection_criteria": {
    "max_files": 3,
    "max_lines": 500,
    "solidity_version": "^0.8.x",
    "min_confirmed_findings": 1,
    "source": "code4rena"
  },
  "evaluation": {
    "runs_per_case": 3,
    "aggregation": "median",
    "line_tolerance": 5
  },
  "cases": []
}
```

**Step 3: Write .gitignore**

```
# SPECA execution outputs (regenerated each run)
cases/*/.speca/
# Keep ground truth and specs
!cases/*/ground-truth.json
!cases/*/docs/
```

**Step 4: Commit**

```bash
git add benchmarks/
git commit -m "feat(bench): scaffold benchmarks directory structure"
```

---

### Task 2: Write evaluate.mjs — matching logic and scoring

**Files:**
- Create: `benchmarks/scripts/evaluate.mjs`
- Test: `benchmarks/scripts/__tests__/evaluate.test.mjs`

**Step 1: Write the failing test**

Create `benchmarks/scripts/__tests__/evaluate.test.mjs`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchFindings, computeMetrics, computePipelineMetrics } from '../evaluate.mjs';

describe('matchFindings', () => {
  const groundTruth = {
    known_vulnerabilities: [
      {
        id: 'VUL-001',
        category: 'REENT',
        severity: 'critical',
        affected_files: ['contracts/Vault.sol'],
        affected_lines: [31, 38]
      },
      {
        id: 'VUL-002',
        category: 'ACCESS',
        severity: 'high',
        affected_files: ['contracts/Vault.sol'],
        affected_lines: [23, 28]
      }
    ]
  };

  it('matches a finding with correct category and overlapping lines', () => {
    const findings = [
      {
        id: 'FIND-001',
        checklist_id: 'CHK-REENT-001-a',
        severity: 'critical',
        proof_trace: {
          code_refs: [{ file: 'contracts/Vault.sol', lines: [31, 38] }]
        }
      }
    ];
    const result = matchFindings(findings, groundTruth, 5);
    assert.equal(result.tp.length, 1);
    assert.equal(result.fn.length, 1); // VUL-002 not matched
    assert.equal(result.fp.length, 0);
  });

  it('counts unmatched findings as false positives', () => {
    const findings = [
      {
        id: 'FIND-099',
        checklist_id: 'CHK-GAS-001-a',
        severity: 'medium',
        proof_trace: {
          code_refs: [{ file: 'contracts/Vault.sol', lines: [10, 12] }]
        }
      }
    ];
    const result = matchFindings(findings, groundTruth, 5);
    assert.equal(result.tp.length, 0);
    assert.equal(result.fp.length, 1);
    assert.equal(result.fn.length, 2);
  });

  it('tolerates line offset within margin', () => {
    const findings = [
      {
        id: 'FIND-001',
        checklist_id: 'CHK-REENT-001-a',
        severity: 'high',
        proof_trace: {
          code_refs: [{ file: 'contracts/Vault.sol', lines: [29, 40] }]
        }
      }
    ];
    const result = matchFindings(findings, groundTruth, 5);
    assert.equal(result.tp.length, 1); // lines 29-40 overlaps 31-38
  });

  it('does not match when category differs despite line overlap', () => {
    const findings = [
      {
        id: 'FIND-001',
        checklist_id: 'CHK-LOGIC-001-a',
        severity: 'high',
        proof_trace: {
          code_refs: [{ file: 'contracts/Vault.sol', lines: [31, 38] }]
        }
      }
    ];
    const result = matchFindings(findings, groundTruth, 5);
    assert.equal(result.tp.length, 0);
    assert.equal(result.fp.length, 1);
  });
});

describe('computeMetrics', () => {
  it('computes recall, precision, f1 correctly', () => {
    const m = computeMetrics(3, 1, 2);
    assert.equal(m.recall, 0.6);  // 3/(3+2)
    assert.equal(m.precision, 0.75); // 3/(3+1)
    // f1 = 2 * 0.75 * 0.6 / (0.75 + 0.6) = 0.667
    assert.ok(Math.abs(m.f1 - 0.667) < 0.001);
  });

  it('handles zero findings gracefully', () => {
    const m = computeMetrics(0, 0, 3);
    assert.equal(m.recall, 0);
    assert.equal(m.precision, 0);
    assert.equal(m.f1, 0);
  });
});

describe('computePipelineMetrics', () => {
  it('computes pipeline quality metrics from SPECA artifacts', () => {
    const specaDir = {
      requirements: { total_requirements: 15 },
      mapping: { total_requirements: 15, mapped: 13 },
      checklist: { total_checks: 28, checklist: [
        { pattern_refs: ['REENT-001'] },
        { pattern_refs: ['ACCESS-001'] },
        { pattern_refs: ['REENT-002'] }
      ]},
      findings: { total_findings: 3 }
    };
    const groundTruth = {
      known_vulnerabilities: [
        { category: 'REENT' },
        { category: 'ACCESS' },
        { category: 'LOGIC' }
      ]
    };
    const m = computePipelineMetrics(specaDir, groundTruth);
    assert.ok(m.mapping_rate > 0);
    assert.ok(m.pattern_coverage > 0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test benchmarks/scripts/__tests__/evaluate.test.mjs`
Expected: FAIL — module not found

**Step 3: Write evaluate.mjs**

Create `benchmarks/scripts/evaluate.mjs`:

```javascript
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

/**
 * Extract category from checklist_id (e.g., "CHK-REENT-001-a" → "REENT")
 */
function extractCategory(checklistId) {
  const match = checklistId.match(/^CHK-([A-Z]+)-/);
  return match ? match[1] : null;
}

/**
 * Check if two line ranges overlap within tolerance.
 * Range format: [startLine, endLine]
 */
function linesOverlap(range1, range2, tolerance) {
  return range1[0] <= range2[1] + tolerance && range2[0] <= range1[1] + tolerance;
}

/**
 * Normalize file path for comparison (strip leading ./ and trailing slashes).
 */
function normalizePath(p) {
  return p.replace(/^\.\//, '').replace(/\/$/, '');
}

/**
 * Match SPECA findings against ground truth vulnerabilities.
 * Returns { tp, fp, fn } arrays with matched items.
 */
export function matchFindings(findings, groundTruth, lineTolerance = 5) {
  const matched = new Set();
  const tp = [];
  const fp = [];

  for (const finding of findings) {
    const category = extractCategory(finding.checklist_id);
    const refs = finding.proof_trace?.code_refs || [];
    let isTP = false;

    for (let i = 0; i < groundTruth.known_vulnerabilities.length; i++) {
      if (matched.has(i)) continue;
      const vuln = groundTruth.known_vulnerabilities[i];

      if (category !== vuln.category) continue;

      for (const ref of refs) {
        const refFile = normalizePath(ref.file);
        const matchesFile = vuln.affected_files.some(f => {
          const normF = normalizePath(f);
          return refFile === normF || refFile.endsWith('/' + normF) || normF.endsWith('/' + refFile);
        });

        if (matchesFile && linesOverlap(ref.lines, vuln.affected_lines, lineTolerance)) {
          tp.push({ finding, vulnerability: vuln });
          matched.add(i);
          isTP = true;
          break;
        }
      }
      if (isTP) break;
    }

    if (!isTP) {
      fp.push({ finding });
    }
  }

  const fn = groundTruth.known_vulnerabilities
    .filter((_, i) => !matched.has(i))
    .map(v => ({ vulnerability: v }));

  return { tp, fp, fn };
}

/**
 * Compute Recall, Precision, F1 from counts.
 */
export function computeMetrics(tpCount, fpCount, fnCount) {
  const recall = (tpCount + fnCount) > 0 ? tpCount / (tpCount + fnCount) : 0;
  const precision = (tpCount + fpCount) > 0 ? tpCount / (tpCount + fpCount) : 0;
  const f1 = (precision + recall) > 0
    ? 2 * precision * recall / (precision + recall)
    : 0;
  return {
    recall: Math.round(recall * 1000) / 1000,
    precision: Math.round(precision * 1000) / 1000,
    f1: Math.round(f1 * 1000) / 1000
  };
}

/**
 * Compute pipeline quality metrics from SPECA artifacts.
 */
export function computePipelineMetrics(specaDir, groundTruth) {
  const mappingRate = specaDir.mapping.total_requirements > 0
    ? specaDir.mapping.mapped / specaDir.mapping.total_requirements
    : 0;

  const checklistCategories = new Set();
  for (const check of (specaDir.checklist.checklist || [])) {
    for (const ref of (check.pattern_refs || [])) {
      const cat = ref.replace(/-\d+$/, '');
      checklistCategories.add(cat);
    }
  }
  const gtCategories = new Set(groundTruth.known_vulnerabilities.map(v => v.category));
  const coveredCategories = [...gtCategories].filter(c => checklistCategories.has(c));
  const patternCoverage = gtCategories.size > 0
    ? coveredCategories.length / gtCategories.size
    : 0;

  return {
    extract_coverage: specaDir.requirements.total_requirements > 0 ? 1.0 : 0,
    mapping_rate: Math.round(mappingRate * 1000) / 1000,
    pattern_coverage: Math.round(patternCoverage * 1000) / 1000,
    findings_count: specaDir.findings.total_findings
  };
}

/**
 * Evaluate a single benchmark case.
 */
export function evaluateCase(caseDir, lineTolerance = 5) {
  const groundTruth = JSON.parse(readFileSync(join(caseDir, 'ground-truth.json'), 'utf-8'));
  const specaBase = join(caseDir, '.speca');

  const findings = JSON.parse(readFileSync(join(specaBase, 'findings.json'), 'utf-8'));
  const { tp, fp, fn } = matchFindings(findings.findings, groundTruth, lineTolerance);

  const metrics = computeMetrics(tp.length, fp.length, fn.length);

  // Severity breakdown
  const bySeverity = {};
  for (const sev of ['critical', 'high', 'medium']) {
    const sevTP = tp.filter(m => m.vulnerability.severity === sev).length;
    const sevFP = fp.filter(m => m.finding.severity === sev).length;
    const sevFN = fn.filter(m => m.vulnerability.severity === sev).length;
    if (sevTP + sevFP + sevFN > 0) {
      bySeverity[sev] = computeMetrics(sevTP, sevFP, sevFN);
    }
  }

  // Pipeline metrics
  let pipeline = null;
  const reqPath = join(specaBase, 'requirements.json');
  const mapPath = join(specaBase, 'mapping.json');
  const clPath = join(specaBase, 'checklist.json');
  if (existsSync(reqPath) && existsSync(mapPath) && existsSync(clPath)) {
    pipeline = computePipelineMetrics({
      requirements: JSON.parse(readFileSync(reqPath, 'utf-8')),
      mapping: JSON.parse(readFileSync(mapPath, 'utf-8')),
      checklist: JSON.parse(readFileSync(clPath, 'utf-8')),
      findings
    }, groundTruth);
  }

  return {
    case_id: groundTruth.case_id || basename(caseDir),
    detection: { ...metrics, by_severity: bySeverity },
    pipeline,
    details: {
      true_positives: tp.map(m => ({ finding: m.finding.id, vulnerability: m.vulnerability.id })),
      false_positives: fp.map(m => m.finding.id),
      false_negatives: fn.map(m => m.vulnerability.id)
    }
  };
}

/**
 * Evaluate all benchmark cases and write results.
 */
export function evaluateAll(benchmarkRoot) {
  const config = JSON.parse(readFileSync(join(benchmarkRoot, 'benchmark.json'), 'utf-8'));
  const casesDir = join(benchmarkRoot, 'cases');
  const tolerance = config.evaluation?.line_tolerance ?? 5;

  const caseDirs = readdirSync(casesDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('case-'))
    .map(d => join(casesDir, d.name))
    .filter(d => existsSync(join(d, 'ground-truth.json')) && existsSync(join(d, '.speca', 'findings.json')));

  const perCase = caseDirs.map(d => evaluateCase(d, tolerance));

  // Aggregate
  let totalTP = 0, totalFP = 0, totalFN = 0;
  const pipelineAcc = { extract_coverage: 0, mapping_rate: 0, pattern_coverage: 0 };
  let pipelineCount = 0;

  for (const c of perCase) {
    totalTP += c.details.true_positives.length;
    totalFP += c.details.false_positives.length;
    totalFN += c.details.false_negatives.length;
    if (c.pipeline) {
      pipelineAcc.extract_coverage += c.pipeline.extract_coverage;
      pipelineAcc.mapping_rate += c.pipeline.mapping_rate;
      pipelineAcc.pattern_coverage += c.pipeline.pattern_coverage;
      pipelineCount++;
    }
  }

  const result = {
    evaluation_date: new Date().toISOString().slice(0, 10),
    speca_version: '1.0',
    cases_evaluated: perCase.length,
    aggregate: {
      detection: computeMetrics(totalTP, totalFP, totalFN),
      pipeline: pipelineCount > 0 ? {
        extract_coverage: Math.round(pipelineAcc.extract_coverage / pipelineCount * 1000) / 1000,
        mapping_rate: Math.round(pipelineAcc.mapping_rate / pipelineCount * 1000) / 1000,
        pattern_coverage: Math.round(pipelineAcc.pattern_coverage / pipelineCount * 1000) / 1000
      } : null
    },
    per_case: perCase
  };

  const dateStr = new Date().toISOString().slice(0, 10);
  const outPath = join(benchmarkRoot, 'results', `${dateStr}-evaluation.json`);
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  return result;
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] || process.cwd();
  const result = evaluateAll(join(root, 'benchmarks'));
  console.log(`Evaluated ${result.cases_evaluated} cases`);
  console.log(`Aggregate — Recall: ${result.aggregate.detection.recall}, Precision: ${result.aggregate.detection.precision}, F1: ${result.aggregate.detection.f1}`);
}
```

**Step 4: Run test to verify it passes**

Run: `node --test benchmarks/scripts/__tests__/evaluate.test.mjs`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add benchmarks/scripts/
git commit -m "feat(bench): add evaluate.mjs with matching logic and scoring"
```

---

### Task 3: Write collect.mjs — Code4rena contest data fetcher

**Files:**
- Create: `benchmarks/scripts/collect.mjs`
- Test: `benchmarks/scripts/__tests__/collect.test.mjs`

**Step 1: Write the failing test**

Create `benchmarks/scripts/__tests__/collect.test.mjs`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseContestUrl, buildCaseDir, generateGroundTruthTemplate } from '../collect.mjs';

describe('parseContestUrl', () => {
  it('extracts org and repo from GitHub URL', () => {
    const result = parseContestUrl('https://github.com/code-423n4/2023-01-example');
    assert.equal(result.org, 'code-423n4');
    assert.equal(result.repo, '2023-01-example');
  });

  it('extracts from findings repo URL', () => {
    const result = parseContestUrl('https://github.com/code-423n4/2023-01-example-findings');
    assert.equal(result.org, 'code-423n4');
    assert.equal(result.repo, '2023-01-example-findings');
  });

  it('throws on invalid URL', () => {
    assert.throws(() => parseContestUrl('not-a-url'), /Invalid GitHub URL/);
  });
});

describe('buildCaseDir', () => {
  it('generates correct case directory name', () => {
    const name = buildCaseDir(1, 'REENT', 'beanstalk');
    assert.equal(name, 'case-001-reent-beanstalk');
  });

  it('pads case number', () => {
    const name = buildCaseDir(12, 'ACCESS', 'ronin');
    assert.equal(name, 'case-012-access-ronin');
  });
});

describe('generateGroundTruthTemplate', () => {
  it('generates template with empty vulnerabilities', () => {
    const tmpl = generateGroundTruthTemplate('case-001-reent-example');
    assert.equal(tmpl.case_id, 'case-001-reent-example');
    assert.ok(Array.isArray(tmpl.known_vulnerabilities));
    assert.equal(tmpl.known_vulnerabilities.length, 0);
    assert.ok(Array.isArray(tmpl.false_positive_notes));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test benchmarks/scripts/__tests__/collect.test.mjs`
Expected: FAIL — module not found

**Step 3: Write collect.mjs**

Create `benchmarks/scripts/collect.mjs`:

```javascript
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

/**
 * Parse a Code4rena GitHub URL into org and repo.
 */
export function parseContestUrl(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/\s]+)/);
  if (!match) throw new Error(`Invalid GitHub URL: ${url}`);
  return { org: match[1], repo: match[2] };
}

/**
 * Build a case directory name from number, category, and name.
 */
export function buildCaseDir(num, category, name) {
  const padded = String(num).padStart(3, '0');
  return `case-${padded}-${category.toLowerCase()}-${name.toLowerCase()}`;
}

/**
 * Generate a ground-truth.json template for manual filling.
 */
export function generateGroundTruthTemplate(caseId) {
  return {
    case_id: caseId,
    known_vulnerabilities: [],
    false_positive_notes: []
  };
}

/**
 * Scaffold a benchmark case directory from a Code4rena contest.
 * Requires `gh` CLI to be installed and authenticated.
 *
 * Usage: node collect.mjs <contest-repo-url> <case-number> <category> <short-name>
 * Example: node collect.mjs https://github.com/code-423n4/2023-07-basin 1 REENT basin
 */
export function scaffoldCase(benchmarkRoot, contestUrl, caseNum, category, shortName) {
  const { org, repo } = parseContestUrl(contestUrl);
  const caseDirName = buildCaseDir(caseNum, category, shortName);
  const caseDir = join(benchmarkRoot, 'cases', caseDirName);

  if (existsSync(caseDir)) {
    throw new Error(`Case directory already exists: ${caseDir}`);
  }

  mkdirSync(join(caseDir, 'contracts'), { recursive: true });
  mkdirSync(join(caseDir, 'docs'), { recursive: true });

  // Write metadata
  const metadata = {
    case_id: caseDirName,
    source: {
      contest_url: contestUrl,
      org,
      repo,
      findings_repo: `${org}/${repo}-findings`
    },
    category,
    created_at: new Date().toISOString().slice(0, 10),
    notes: 'TODO: Add contract files, spec.md, and ground-truth.json'
  };
  writeFileSync(join(caseDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

  // Write ground-truth template
  const gt = generateGroundTruthTemplate(caseDirName);
  writeFileSync(join(caseDir, 'ground-truth.json'), JSON.stringify(gt, null, 2));

  // Write spec template
  const specTemplate = `# ${shortName} Specification

> Extracted from Code4rena contest: ${repo}

## Overview

TODO: Describe the contract's purpose and architecture.

## Requirements

### Access Control
- R-AUTH-001: TODO: Add requirements using RFC 2119 modals (MUST/SHOULD/MAY)

### Core Logic
- R-CORE-001: TODO

### Error Handling
- R-ERR-001: TODO
`;
  writeFileSync(join(caseDir, 'docs', 'spec.md'), specTemplate);

  // Try to clone contract files using gh
  console.log(`Scaffolded: ${caseDir}`);
  console.log(`Next steps:`);
  console.log(`  1. Copy Solidity files to ${join(caseDir, 'contracts/')}`);
  console.log(`  2. Write spec from audit report: ${join(caseDir, 'docs/spec.md')}`);
  console.log(`  3. Fill ground truth: ${join(caseDir, 'ground-truth.json')}`);

  return caseDir;
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  const [,, contestUrl, caseNum, category, shortName] = process.argv;
  if (!contestUrl || !caseNum || !category || !shortName) {
    console.error('Usage: node collect.mjs <contest-repo-url> <case-number> <category> <short-name>');
    process.exit(1);
  }
  const root = join(process.cwd(), 'benchmarks');
  scaffoldCase(root, contestUrl, parseInt(caseNum, 10), category, shortName);
}
```

**Step 4: Run test to verify it passes**

Run: `node --test benchmarks/scripts/__tests__/collect.test.mjs`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add benchmarks/scripts/collect.mjs benchmarks/scripts/__tests__/collect.test.mjs
git commit -m "feat(bench): add collect.mjs for Code4rena contest data scaffolding"
```

---

### Task 4: Write format-results.mjs — human-readable output

**Files:**
- Create: `benchmarks/scripts/format-results.mjs`
- Test: `benchmarks/scripts/__tests__/format-results.test.mjs`

**Step 1: Write the failing test**

Create `benchmarks/scripts/__tests__/format-results.test.mjs`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatSummary } from '../format-results.mjs';

describe('formatSummary', () => {
  it('formats evaluation result as readable text', () => {
    const result = {
      evaluation_date: '2026-02-21',
      speca_version: '1.0',
      cases_evaluated: 2,
      aggregate: {
        detection: { recall: 0.75, precision: 0.6, f1: 0.667 },
        pipeline: { mapping_rate: 0.87, pattern_coverage: 0.8, extract_coverage: 0.93 }
      },
      per_case: [
        {
          case_id: 'case-001-reent-example',
          detection: { recall: 1.0, precision: 0.5, f1: 0.667, by_severity: {} },
          details: { true_positives: [{ finding: 'F1', vulnerability: 'V1' }], false_positives: ['F2'], false_negatives: [] }
        }
      ]
    };
    const text = formatSummary(result);
    assert.ok(text.includes('Recall'));
    assert.ok(text.includes('0.75'));
    assert.ok(text.includes('case-001'));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test benchmarks/scripts/__tests__/format-results.test.mjs`
Expected: FAIL

**Step 3: Write format-results.mjs**

Create `benchmarks/scripts/format-results.mjs`:

```javascript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Format evaluation results as a human-readable summary string.
 */
export function formatSummary(result) {
  const lines = [];
  lines.push(`# SPECA Benchmark Results — ${result.evaluation_date}`);
  lines.push('');
  lines.push(`**Cases evaluated:** ${result.cases_evaluated}`);
  lines.push(`**SPECA version:** ${result.speca_version}`);
  lines.push('');

  // Aggregate detection
  const d = result.aggregate.detection;
  lines.push('## Aggregate Detection Accuracy');
  lines.push('');
  lines.push(`| Metric    | Value |`);
  lines.push(`|-----------|-------|`);
  lines.push(`| Recall    | ${d.recall} |`);
  lines.push(`| Precision | ${d.precision} |`);
  lines.push(`| F1 Score  | ${d.f1} |`);
  lines.push('');

  // Pipeline
  if (result.aggregate.pipeline) {
    const p = result.aggregate.pipeline;
    lines.push('## Pipeline Quality');
    lines.push('');
    lines.push(`| Phase     | Metric           | Value |`);
    lines.push(`|-----------|------------------|-------|`);
    lines.push(`| extract   | Coverage         | ${p.extract_coverage} |`);
    lines.push(`| map       | Mapping rate     | ${p.mapping_rate} |`);
    lines.push(`| checklist | Pattern coverage | ${p.pattern_coverage} |`);
    lines.push('');
  }

  // Per case
  lines.push('## Per-Case Results');
  lines.push('');
  for (const c of result.per_case) {
    lines.push(`### ${c.case_id}`);
    lines.push(`- Recall: ${c.detection.recall}, Precision: ${c.detection.precision}, F1: ${c.detection.f1}`);
    lines.push(`- TP: ${c.details.true_positives.length}, FP: ${c.details.false_positives.length}, FN: ${c.details.false_negatives.length}`);
    if (c.details.false_negatives.length > 0) {
      lines.push(`- Missed: ${c.details.false_negatives.join(', ')}`);
    }
    if (c.details.false_positives.length > 0) {
      lines.push(`- False alarms: ${c.details.false_positives.join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  const resultPath = process.argv[2];
  if (!resultPath) {
    console.error('Usage: node format-results.mjs <evaluation.json>');
    process.exit(1);
  }
  const result = JSON.parse(readFileSync(resultPath, 'utf-8'));
  console.log(formatSummary(result));
}
```

**Step 4: Run test to verify it passes**

Run: `node --test benchmarks/scripts/__tests__/format-results.test.mjs`
Expected: PASS

**Step 5: Commit**

```bash
git add benchmarks/scripts/format-results.mjs benchmarks/scripts/__tests__/format-results.test.mjs
git commit -m "feat(bench): add format-results.mjs for human-readable output"
```

---

### Task 5: Migrate existing simple-vault as benchmark case-000

**Files:**
- Create: `benchmarks/cases/case-000-mixed-simple-vault/`
- Reuse: `examples/simple-vault/` artifacts

This task validates the evaluate.mjs pipeline end-to-end using the existing simple-vault example that already has SPECA output.

**Step 1: Create case directory and copy files**

```bash
mkdir -p benchmarks/cases/case-000-mixed-simple-vault/contracts
mkdir -p benchmarks/cases/case-000-mixed-simple-vault/docs
cp examples/simple-vault/contracts/Vault.sol benchmarks/cases/case-000-mixed-simple-vault/contracts/
cp examples/simple-vault/docs/spec.md benchmarks/cases/case-000-mixed-simple-vault/docs/
cp -r examples/simple-vault/.speca benchmarks/cases/case-000-mixed-simple-vault/
```

**Step 2: Create metadata.json**

Write `benchmarks/cases/case-000-mixed-simple-vault/metadata.json`:
```json
{
  "case_id": "case-000-mixed-simple-vault",
  "source": {
    "type": "synthetic",
    "description": "Intentionally vulnerable vault contract from SPECA examples"
  },
  "category": "mixed",
  "created_at": "2026-02-21",
  "notes": "3 intentional bugs: missing whitelist check, missing onlyOwner, reentrancy"
}
```

**Step 3: Create ground-truth.json**

Write `benchmarks/cases/case-000-mixed-simple-vault/ground-truth.json`:
```json
{
  "case_id": "case-000-mixed-simple-vault",
  "known_vulnerabilities": [
    {
      "id": "VUL-001",
      "title": "Missing whitelist/owner check in deposit()",
      "severity": "critical",
      "category": "ACCESS",
      "swc_id": "SWC-105",
      "affected_files": ["contracts/Vault.sol"],
      "affected_functions": ["deposit()"],
      "affected_lines": [23, 28],
      "description": "deposit() lacks whitelist or owner check, allowing any address to deposit",
      "source": "intentional-bug-1"
    },
    {
      "id": "VUL-002",
      "title": "Missing onlyOwner on emergencyUnpause()",
      "severity": "critical",
      "category": "ACCESS",
      "swc_id": "SWC-105",
      "affected_files": ["contracts/Vault.sol"],
      "affected_functions": ["emergencyUnpause()"],
      "affected_lines": [45, 47],
      "description": "emergencyUnpause() has no access control, allowing anyone to unpause",
      "source": "intentional-bug-2"
    },
    {
      "id": "VUL-003",
      "title": "Reentrancy in withdraw()",
      "severity": "high",
      "category": "REENT",
      "swc_id": "SWC-107",
      "affected_files": ["contracts/Vault.sol"],
      "affected_functions": ["withdraw(uint256)"],
      "affected_lines": [31, 38],
      "description": "withdraw() violates CEI pattern with external call before state update",
      "source": "intentional-bug-3"
    }
  ],
  "false_positive_notes": []
}
```

**Step 4: Run evaluate.mjs against case-000**

Run: `node benchmarks/scripts/evaluate.mjs .`
Expected: Output showing Recall, Precision, F1. Since simple-vault found all 3 bugs: expect Recall=1.0.

Note: The `.speca/findings.json` file paths use `./examples/simple-vault/contracts/Vault.sol` while ground-truth uses `contracts/Vault.sol`. The normalizePath + endsWith logic in evaluate.mjs handles this.

**Step 5: Commit**

```bash
git add benchmarks/cases/case-000-mixed-simple-vault/
git commit -m "feat(bench): add case-000 simple-vault as baseline benchmark"
```

---

### Task 6: Research and select 3 Code4rena contests for prototype

**Files:**
- No code changes — research task

This is a manual research task. Search Code4rena GitHub repos for contests matching criteria:
- Solidity ^0.8.x
- 1-3 contract files, ≤500 lines
- 1-3 confirmed High/Critical findings
- Clear audit report with actionable descriptions

Suggested search approach:
1. Browse `https://github.com/code-423n4?q=findings&type=repositories`
2. Look at recent contests (2023-2024) with published reports
3. Check the contest repo for contract complexity
4. Check the findings repo for confirmed H/M findings

Target:
- 1 contest with REENT finding
- 1 contest with ACCESS finding
- 1 contest with LOGIC or EXTCALL finding

For each selected contest, run:
```bash
node benchmarks/scripts/collect.mjs <contest-url> <num> <category> <name>
```

Then manually:
1. Copy relevant .sol files into `contracts/`
2. Write `docs/spec.md` from audit report
3. Fill `ground-truth.json` from confirmed findings

---

### Task 7: End-to-end validation with all cases

**Files:**
- No new files

**Step 1: Run SPECA on each benchmark case**

For each case in `benchmarks/cases/case-NNN-*/`:
```
cd benchmarks/cases/case-NNN-xxx
/speca init
/speca extract
/speca map
/speca checklist
/speca audit
```

**Step 2: Run evaluation**

```bash
node benchmarks/scripts/evaluate.mjs .
```

**Step 3: Format and review results**

```bash
node benchmarks/scripts/format-results.mjs benchmarks/results/2026-02-21-evaluation.json
```

**Step 4: Commit results**

```bash
git add benchmarks/results/
git commit -m "feat(bench): add initial benchmark evaluation results"
```
