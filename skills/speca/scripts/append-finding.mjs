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
