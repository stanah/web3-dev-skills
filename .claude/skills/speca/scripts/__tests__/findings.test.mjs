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
