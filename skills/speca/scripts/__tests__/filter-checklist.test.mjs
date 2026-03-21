import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterChecklist } from '../filter-checklist.mjs';

const SAMPLE_CHECKLIST = {
  checklist: [
    { id: 'CHK-ACCESS-001-a', priority: 'critical', check_type: 'static', requirement_id: 'R-AUTH-003' },
    { id: 'CHK-ACCESS-001-b', priority: 'critical', check_type: 'dynamic', requirement_id: 'R-AUTH-003' },
    { id: 'CHK-REENT-001-a', priority: 'high', check_type: 'static', requirement_id: 'R-STATE-001' },
    { id: 'CHK-VAL-001-a', priority: 'medium', check_type: 'static', requirement_id: 'R-VAL-001' },
    { id: 'CHK-REENT-002-a', priority: 'high', check_type: 'static', requirement_id: 'R-STATE-002' },
    { id: 'CHK-AUTH-001-a', priority: 'high', check_type: 'static', requirement_id: 'R-AUTH-001' },
  ]
};

describe('filterChecklist', () => {
  it('filters by priority', () => {
    const result = filterChecklist(SAMPLE_CHECKLIST, { priority: ['critical'] });
    assert.equal(result.length, 2);
    assert.ok(result.every(item => item.priority === 'critical'));
  });

  it('filters by check_type', () => {
    const result = filterChecklist(SAMPLE_CHECKLIST, { type: ['static'] });
    assert.ok(result.every(item => item.check_type === 'static'));
  });

  it('returns batch slice', () => {
    const result = filterChecklist(SAMPLE_CHECKLIST, { type: ['static'], batchIndex: 0, batchSize: 2 });
    assert.equal(result.length, 2);
  });

  it('returns empty array for out-of-range batch', () => {
    const result = filterChecklist(SAMPLE_CHECKLIST, { type: ['static'], batchIndex: 100, batchSize: 2 });
    assert.equal(result.length, 0);
  });

  it('returns total count in metadata when requested', () => {
    const result = filterChecklist(SAMPLE_CHECKLIST, { type: ['static'], batchIndex: 0, batchSize: 2, includeMeta: true });
    assert.equal(result.meta.totalFiltered, 5);
    assert.equal(result.meta.totalBatches, 3);
    assert.equal(result.items.length, 2);
  });

  it('enriches items with locations when mappingData provided', () => {
    const checklistData = {
      checklist: [
        { id: 'CHK-AUTH-001-a', requirement_id: 'SPEC-AUTH-001', check_type: 'static', priority: 'critical', property: 'test' }
      ]
    };
    const mappingData = {
      mappings: [
        { requirement_id: 'SPEC-AUTH-001', requirement_text: 'Must check owner', locations: [{ file: 'Vault.sol', line_range: [10, 20] }] }
      ]
    };
    const result = filterChecklist(checklistData, { includeMeta: true, mappingData });
    assert.deepStrictEqual(result.items[0]._locations, [{ file: 'Vault.sol', line_range: [10, 20] }]);
    assert.equal(result.items[0]._requirement_text, 'Must check owner');
  });
});
