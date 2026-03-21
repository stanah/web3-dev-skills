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
