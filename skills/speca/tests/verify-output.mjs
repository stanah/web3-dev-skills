#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const { values } = parseArgs({
  options: {
    'project-root': { type: 'string', default: '.' },
  }
});

const root = resolve(values['project-root']);
const specaDir = join(root, '.speca');
const results = { passed: 0, failed: 0, checks: [] };

function check(name, fn) {
  try {
    const result = fn();
    if (result === true || result === undefined) {
      results.checks.push({ name, status: 'pass' });
      results.passed++;
    } else {
      results.checks.push({ name, status: 'fail', detail: String(result) });
      results.failed++;
    }
  } catch (e) {
    results.checks.push({ name, status: 'fail', detail: e.message });
    results.failed++;
  }
}

function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function hasFields(obj, fields) {
  const missing = fields.filter(f => !(f in obj));
  if (missing.length > 0) return `missing fields: ${missing.join(', ')}`;
  return true;
}

// 1. File existence checks
const FILES = [
  'config.json',
  'requirements.json',
  'mapping.json',
  'checklist.json',
  'findings.json',
];

for (const file of FILES) {
  check(`${file} exists`, () => {
    if (!existsSync(join(specaDir, file))) return `file not found: .speca/${file}`;
  });
}

check('reports directory exists', () => {
  if (!existsSync(join(specaDir, 'reports'))) return 'reports directory not found';
});

// 2. JSON parse checks
for (const file of FILES) {
  check(`${file} is valid JSON`, () => {
    const path = join(specaDir, file);
    if (!existsSync(path)) return 'file missing (skipped)';
    readJSON(path);
  });
}

// 3. Schema checks
check('requirements.json schema', () => {
  const path = join(specaDir, 'requirements.json');
  if (!existsSync(path)) return 'file missing (skipped)';
  const data = readJSON(path);
  const fieldCheck = hasFields(data, ['extracted_at', 'spec_sources', 'total_requirements', 'requirements']);
  if (fieldCheck !== true) return fieldCheck;
  if (!Array.isArray(data.requirements)) return 'requirements is not an array';
  if (data.requirements.length === 0) return 'requirements array is empty';
  const req = data.requirements[0];
  return hasFields(req, ['id', 'text', 'type', 'severity_hint', 'source', 'modal']);
});

check('mapping.json schema', () => {
  const path = join(specaDir, 'mapping.json');
  if (!existsSync(path)) return 'file missing (skipped)';
  const data = readJSON(path);
  const fieldCheck = hasFields(data, ['mapped_at', 'source_files', 'total_requirements', 'mappings']);
  if (fieldCheck !== true) return fieldCheck;
  if (!Array.isArray(data.mappings)) return 'mappings is not an array';
  if (data.mappings.length === 0) return 'mappings array is empty';
  const m = data.mappings[0];
  return hasFields(m, ['requirement_id', 'status']);
});

check('checklist.json schema', () => {
  const path = join(specaDir, 'checklist.json');
  if (!existsSync(path)) return 'file missing (skipped)';
  const data = readJSON(path);
  const fieldCheck = hasFields(data, ['generated_at', 'total_checks', 'checklist']);
  if (fieldCheck !== true) return fieldCheck;
  if (!Array.isArray(data.checklist)) return 'checklist is not an array';
  if (data.checklist.length === 0) return 'checklist array is empty';
  const item = data.checklist[0];
  return hasFields(item, ['id', 'requirement_id', 'property', 'check_type', 'priority']);
});

check('findings.json schema', () => {
  const path = join(specaDir, 'findings.json');
  if (!existsSync(path)) return 'file missing (skipped)';
  const data = readJSON(path);
  const fieldCheck = hasFields(data, ['audited_at', 'total_findings', 'findings_by_severity', 'findings']);
  if (fieldCheck !== true) return fieldCheck;
  if (!Array.isArray(data.findings)) return 'findings is not an array';
  const sev = data.findings_by_severity;
  return hasFields(sev, ['critical', 'high', 'medium', 'low', 'informational']);
});

// 4. Report file checks
check('Markdown report exists', () => {
  const reports = join(specaDir, 'reports');
  if (!existsSync(reports)) return 'reports dir missing';
  const mdFiles = readdirSync(reports).filter(f => f.endsWith('.md'));
  if (mdFiles.length === 0) return 'no .md report found';
});

check('SARIF report exists', () => {
  const reports = join(specaDir, 'reports');
  if (!existsSync(reports)) return 'reports dir missing';
  const sarifFiles = readdirSync(reports).filter(f => f.endsWith('.sarif'));
  if (sarifFiles.length === 0) return 'no .sarif report found';
});

check('SARIF is valid JSON', () => {
  const reports = join(specaDir, 'reports');
  if (!existsSync(reports)) return 'reports dir missing';
  const sarifFiles = readdirSync(reports).filter(f => f.endsWith('.sarif'));
  if (sarifFiles.length === 0) return 'no .sarif report (skipped)';
  const data = readJSON(join(reports, sarifFiles[0]));
  return hasFields(data, ['$schema', 'version', 'runs']);
});

// 5. Data quality checks
check('requirements count > 0', () => {
  const path = join(specaDir, 'requirements.json');
  if (!existsSync(path)) return 'file missing (skipped)';
  const data = readJSON(path);
  if (data.total_requirements === 0) return 'total_requirements is 0';
});

check('mapped requirements > 0', () => {
  const path = join(specaDir, 'mapping.json');
  if (!existsSync(path)) return 'file missing (skipped)';
  const data = readJSON(path);
  const mapped = data.mappings.filter(m => m.status === 'mapped').length;
  if (mapped === 0) return 'no mapped requirements';
});

check('checklist items > 0', () => {
  const path = join(specaDir, 'checklist.json');
  if (!existsSync(path)) return 'file missing (skipped)';
  const data = readJSON(path);
  if (data.total_checks === 0) return 'total_checks is 0';
});

// Output results
const status = results.failed === 0 ? 'PASS' : 'FAIL';
console.log(JSON.stringify({ status, ...results }, null, 2));
process.exit(results.failed === 0 ? 0 : 1);
