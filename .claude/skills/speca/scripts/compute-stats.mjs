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
