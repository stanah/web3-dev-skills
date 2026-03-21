import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'informational'];

/**
 * Merge batch finding files into a single findings.json.
 * total_checks_audited is auto-computed from the static checks in checklist.json.
 */
export function mergeFindings(projectRoot, auditedAt, checklistVersion) {
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

  // Auto-compute total_checks_audited from static checks in checklist.json
  const checklist = JSON.parse(readFileSync(join(projectRoot, '.speca', 'checklist.json'), 'utf-8'));
  const totalChecksAudited = checklist.checklist.filter(c => c.check_type === 'static').length;

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
    }
  });

  mergeFindings(values['project-root'], values['audited-at'], values['checklist-version']);
}
