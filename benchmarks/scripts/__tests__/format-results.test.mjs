import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatSummary } from '../format-results.mjs';

describe('formatSummary', () => {
  it('formats evaluation result as readable text', () => {
    const result = {
      evaluation_date: '2026-02-21',
      speca_version: '1.0',
      cases_evaluated: 2,
      aggregate: {
        detection: { recall: 0.75, precision: 0.6, f1: 0.667 },
        pipeline: { mapping_rate: 0.87, pattern_coverage: 0.8, extract_coverage: 0.93 }
      },
      per_case: [
        {
          case_id: 'case-001-reent-example',
          detection: { recall: 1.0, precision: 0.5, f1: 0.667, by_severity: {} },
          details: { true_positives: [{ finding: 'F1', vulnerability: 'V1' }], false_positives: ['F2'], false_negatives: [] }
        }
      ]
    };
    const text = formatSummary(result);
    assert.ok(text.includes('Recall'));
    assert.ok(text.includes('0.75'));
    assert.ok(text.includes('case-001'));
  });

  it('includes header with date and cases evaluated', () => {
    const result = {
      evaluation_date: '2026-02-21',
      speca_version: '1.0',
      cases_evaluated: 3,
      aggregate: {
        detection: { recall: 0.8, precision: 0.9, f1: 0.847 },
        pipeline: null
      },
      per_case: []
    };
    const text = formatSummary(result);
    assert.ok(text.includes('2026-02-21'));
    assert.ok(text.includes('3'));
  });

  it('includes aggregate detection table', () => {
    const result = {
      evaluation_date: '2026-02-21',
      speca_version: '1.0',
      cases_evaluated: 1,
      aggregate: {
        detection: { recall: 0.6, precision: 0.75, f1: 0.667 },
        pipeline: null
      },
      per_case: []
    };
    const text = formatSummary(result);
    assert.ok(text.includes('Recall'));
    assert.ok(text.includes('Precision'));
    assert.ok(text.includes('F1'));
    assert.ok(text.includes('0.6'));
    assert.ok(text.includes('0.75'));
    assert.ok(text.includes('0.667'));
  });

  it('includes pipeline table when pipeline data exists', () => {
    const result = {
      evaluation_date: '2026-02-21',
      speca_version: '1.0',
      cases_evaluated: 1,
      aggregate: {
        detection: { recall: 0.5, precision: 0.5, f1: 0.5 },
        pipeline: { extract_coverage: 1.0, mapping_rate: 0.867, pattern_coverage: 0.667 }
      },
      per_case: []
    };
    const text = formatSummary(result);
    assert.ok(text.includes('extract_coverage'));
    assert.ok(text.includes('mapping_rate'));
    assert.ok(text.includes('pattern_coverage'));
    assert.ok(text.includes('1'));
    assert.ok(text.includes('0.867'));
    assert.ok(text.includes('0.667'));
  });

  it('omits pipeline table when pipeline is null', () => {
    const result = {
      evaluation_date: '2026-02-21',
      speca_version: '1.0',
      cases_evaluated: 1,
      aggregate: {
        detection: { recall: 0.5, precision: 0.5, f1: 0.5 },
        pipeline: null
      },
      per_case: []
    };
    const text = formatSummary(result);
    assert.ok(!text.includes('Pipeline'));
  });

  it('shows per-case TP/FP/FN counts', () => {
    const result = {
      evaluation_date: '2026-02-21',
      speca_version: '1.0',
      cases_evaluated: 1,
      aggregate: {
        detection: { recall: 0.5, precision: 1.0, f1: 0.667 },
        pipeline: null
      },
      per_case: [
        {
          case_id: 'case-002-access-vault',
          detection: { recall: 0.5, precision: 1.0, f1: 0.667, by_severity: {} },
          details: {
            true_positives: [{ finding: 'F1', vulnerability: 'V1' }],
            false_positives: [],
            false_negatives: ['V2']
          }
        }
      ]
    };
    const text = formatSummary(result);
    assert.ok(text.includes('case-002-access-vault'));
    assert.ok(text.includes('TP: 1'));
    assert.ok(text.includes('FP: 0'));
    assert.ok(text.includes('FN: 1'));
  });

  it('lists missed vulnerabilities (false negatives)', () => {
    const result = {
      evaluation_date: '2026-02-21',
      speca_version: '1.0',
      cases_evaluated: 1,
      aggregate: {
        detection: { recall: 0.0, precision: 0.0, f1: 0.0 },
        pipeline: null
      },
      per_case: [
        {
          case_id: 'case-003-logic-bridge',
          detection: { recall: 0.0, precision: 0.0, f1: 0.0, by_severity: {} },
          details: {
            true_positives: [],
            false_positives: [],
            false_negatives: ['VUL-LOGIC-001', 'VUL-LOGIC-002']
          }
        }
      ]
    };
    const text = formatSummary(result);
    assert.ok(text.includes('VUL-LOGIC-001'));
    assert.ok(text.includes('VUL-LOGIC-002'));
  });

  it('lists false alarms (false positives)', () => {
    const result = {
      evaluation_date: '2026-02-21',
      speca_version: '1.0',
      cases_evaluated: 1,
      aggregate: {
        detection: { recall: 1.0, precision: 0.5, f1: 0.667 },
        pipeline: null
      },
      per_case: [
        {
          case_id: 'case-004-reent-dex',
          detection: { recall: 1.0, precision: 0.5, f1: 0.667, by_severity: {} },
          details: {
            true_positives: [{ finding: 'F1', vulnerability: 'V1' }],
            false_positives: ['F2-SPURIOUS'],
            false_negatives: []
          }
        }
      ]
    };
    const text = formatSummary(result);
    assert.ok(text.includes('F2-SPURIOUS'));
  });
});
