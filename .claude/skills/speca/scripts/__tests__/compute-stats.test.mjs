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
