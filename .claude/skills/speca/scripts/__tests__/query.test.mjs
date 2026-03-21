import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { querySummary, queryBatch, queryGet } from '../lib/query.mjs';

const mockRequirements = {
  extracted_at: '2026-03-20T00:00:00Z',
  spec_sources: ['./docs/spec.md'],
  total_requirements: 3,
  requirements: [
    { id: 'SPEC-AUTH-001', text: 'Must check owner', type: 'access_control', severity_hint: 'high', modal: 'MUST', source: { file: './docs/spec.md', line: 10, section: 'Auth' } },
    { id: 'SPEC-VAL-001', text: 'Must validate input', type: 'validation', severity_hint: 'high', modal: 'MUST', source: { file: './docs/spec.md', line: 20, section: 'Validation' } },
    { id: 'SPEC-VAL-002', text: 'Should check bounds', type: 'validation', severity_hint: 'medium', modal: 'SHOULD', source: { file: './docs/spec.md', line: 30, section: 'Validation' } },
  ]
};

describe('querySummary', () => {
  it('returns metadata and counts for requirements', () => {
    const result = querySummary('requirements', mockRequirements);
    assert.equal(result.file, 'requirements');
    assert.equal(result.total, 3);
    assert.deepStrictEqual(result.by_type, { access_control: 1, validation: 2 });
    assert.deepStrictEqual(result.by_severity, { high: 2, medium: 1 });
    assert.deepStrictEqual(result.spec_sources, ['./docs/spec.md']);
  });

  it('returns config summary with actor names', () => {
    const mockConfig = {
      version: '1.0', language: 'en',
      spec_paths: ['./docs/spec.md'], source_paths: ['./contracts/'],
      threat_model: {
        actors: { owner: 'TRUSTED', attacker: 'UNTRUSTED' },
        boundaries: ['owner -> admin functions'],
        assumptions: ['Solidity ^0.8.x']
      }
    };
    const result = querySummary('config', mockConfig);
    assert.equal(result.version, '1.0');
    assert.deepStrictEqual(result.actor_names, ['owner', 'attacker']);
    assert.equal(result.boundary_count, 1);
    assert.equal(result.assumption_count, 1);
  });

  it('returns mapping summary', () => {
    const mockMapping = {
      mapped_at: '2026-03-20T00:00:00Z',
      source_files: ['./contracts/Vault.sol'],
      mappings: [
        { requirement_id: 'SPEC-AUTH-001', status: 'mapped', locations: [{ confidence: 0.95 }] },
        { requirement_id: 'SPEC-VAL-001', status: 'mapped', locations: [{ confidence: 0.80 }] },
        { requirement_id: 'SPEC-VAL-002', status: 'unmapped', locations: [{ confidence: 0.55 }] },
      ]
    };
    const result = querySummary('mapping', mockMapping);
    assert.equal(result.file, 'mapping');
    assert.equal(result.total, 3);
    assert.equal(result.mapped, 2);
    assert.equal(result.unmapped, 1);
    assert.deepStrictEqual(result.source_files, ['./contracts/Vault.sol']);
    assert.deepStrictEqual(result.confidence_distribution, {
      high_0_9_1_0: 1,
      medium_0_7_0_89: 1,
      low_0_5_0_69: 1,
    });
  });

  it('returns checklist summary', () => {
    const mockChecklist = {
      generated_at: '2026-03-20T00:00:00Z',
      summary: {
        total_checks: 5,
        by_priority: { high: 2, medium: 3 },
        by_check_type: { unit: 3, integration: 2 },
        unmapped_checks: 1,
        threat_model_exclusions: 0,
      },
      checklist: []
    };
    const result = querySummary('checklist', mockChecklist);
    assert.equal(result.file, 'checklist');
    assert.equal(result.total_checks, 5);
    assert.deepStrictEqual(result.by_priority, { high: 2, medium: 3 });
    assert.deepStrictEqual(result.by_check_type, { unit: 3, integration: 2 });
    assert.equal(result.unmapped_checks, 1);
    assert.equal(result.threat_model_exclusions, 0);
  });

  it('returns findings summary', () => {
    const mockFindings = {
      audited_at: '2026-03-20T00:00:00Z',
      checklist_version: 'v1',
      findings_by_severity: { high: 2, medium: 1, low: 0 },
      findings: [
        { id: 'FIND-001', severity: 'high' },
        { id: 'FIND-002', severity: 'high' },
        { id: 'FIND-003', severity: 'medium' },
      ]
    };
    const result = querySummary('findings', mockFindings);
    assert.equal(result.file, 'findings');
    assert.equal(result.total_findings, 3);
    assert.deepStrictEqual(result.by_severity, { high: 2, medium: 1, low: 0 });
    assert.equal(result.checklist_version, 'v1');
  });

  it('returns test-results summary', () => {
    const mockTestResults = {
      generated_at: '2026-03-20T00:00:00Z',
      summary: {
        total_test_functions: 10,
        property_tests: 4,
        poc_tests: 6,
        compilation_errors: 0,
      },
      test_files: [
        { checklist_id: 'CHECK-001', file: 'test1.t.sol' },
        { checklist_id: 'CHECK-002', file: 'test2.t.sol' },
      ]
    };
    const result = querySummary('test-results', mockTestResults);
    assert.equal(result.file, 'test-results');
    assert.equal(result.total_test_files, 2);
    assert.equal(result.total_test_functions, 10);
    assert.equal(result.property_tests, 4);
    assert.equal(result.poc_tests, 6);
    assert.equal(result.compilation_errors, 0);
  });
});

describe('queryBatch', () => {
  it('returns sliced items with meta', () => {
    const result = queryBatch('requirements', mockRequirements, 0, 2);
    assert.equal(result.meta.totalItems, 3);
    assert.equal(result.meta.totalBatches, 2);
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].id, 'SPEC-AUTH-001');
  });

  it('throws for unsupported file type', () => {
    assert.throws(() => queryBatch('config', {}, 0, 10), /unsupported/i);
  });
});

describe('queryGet', () => {
  it('returns single item by id', () => {
    const result = queryGet('requirements', mockRequirements, 'SPEC-VAL-001');
    assert.equal(result.id, 'SPEC-VAL-001');
    assert.equal(result.text, 'Must validate input');
  });

  it('returns null for missing id', () => {
    const result = queryGet('requirements', mockRequirements, 'NONEXISTENT');
    assert.equal(result, null);
  });

  it('throws for unsupported file type', () => {
    assert.throws(() => queryGet('config', {}, 'x'), /unsupported/i);
  });
});
