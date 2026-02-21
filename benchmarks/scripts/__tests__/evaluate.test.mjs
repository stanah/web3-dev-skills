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
    assert.equal(m.extract_coverage, 1.0);
    assert.equal(m.findings_count, 3);
    // mapping_rate = 13/15 = 0.867
    assert.equal(m.mapping_rate, 0.867);
    // pattern_coverage: REENT and ACCESS covered out of 3 categories = 2/3 = 0.667
    assert.equal(m.pattern_coverage, 0.667);
  });
});
