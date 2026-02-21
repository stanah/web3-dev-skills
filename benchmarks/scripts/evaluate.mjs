import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

/**
 * Extract category from checklist_id (e.g., "CHK-REENT-001-a" -> "REENT")
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
    if (!finding.checklist_id) {
      fp.push({ finding });
      continue;
    }
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

  const dateStr = new Date().toISOString().slice(0, 10);
  const result = {
    evaluation_date: dateStr,
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
  mkdirSync(join(benchmarkRoot, 'results'), { recursive: true });
  const outPath = join(benchmarkRoot, 'results', `${dateStr}-evaluation.json`);
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  return result;
}

// CLI entrypoint
if (process.argv[1] === import.meta.filename) {
  const root = process.argv[2] || process.cwd();
  const result = evaluateAll(join(root, 'benchmarks'));
  console.log(`Evaluated ${result.cases_evaluated} cases`);
  console.log(`Aggregate — Recall: ${result.aggregate.detection.recall}, Precision: ${result.aggregate.detection.precision}, F1: ${result.aggregate.detection.f1}`);
}
