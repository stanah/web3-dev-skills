import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateSarif } from '../generate-sarif.mjs';

describe('generateSarif', () => {
  it('generates valid SARIF v2.1.0 structure', () => {
    const findings = {
      findings: [
        {
          id: 'FIND-001',
          checklist_id: 'CHK-ACCESS-001-a',
          severity: 'critical',
          title: 'Missing access control',
          description: 'deposit() lacks whitelist check',
          proof_trace: {
            code_refs: [{ file: 'contracts/Vault.sol', lines: [23, 28], snippet: 'code' }]
          }
        }
      ]
    };
    const checklist = {
      checklist: [
        { id: 'CHK-ACCESS-001-a', property: 'deposit() must check whitelist' }
      ]
    };

    const sarif = generateSarif(findings, checklist);
    assert.equal(sarif.version, '2.1.0');
    assert.equal(sarif.runs.length, 1);
    assert.equal(sarif.runs[0].results.length, 1);
    assert.equal(sarif.runs[0].results[0].level, 'error');
    assert.equal(sarif.runs[0].tool.driver.rules.length, 1);
  });

  it('generates empty results for no findings', () => {
    const sarif = generateSarif({ findings: [] }, { checklist: [] });
    assert.equal(sarif.runs[0].results.length, 0);
    assert.equal(sarif.runs[0].tool.driver.rules.length, 0);
  });
});
