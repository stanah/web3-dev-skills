import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseContestUrl, buildCaseDir, generateGroundTruthTemplate } from '../collect.mjs';

describe('parseContestUrl', () => {
  it('extracts org and repo from GitHub URL', () => {
    const result = parseContestUrl('https://github.com/code-423n4/2023-01-example');
    assert.equal(result.org, 'code-423n4');
    assert.equal(result.repo, '2023-01-example');
  });

  it('extracts from findings repo URL', () => {
    const result = parseContestUrl('https://github.com/code-423n4/2023-01-example-findings');
    assert.equal(result.org, 'code-423n4');
    assert.equal(result.repo, '2023-01-example-findings');
  });

  it('throws on invalid URL', () => {
    assert.throws(
      () => parseContestUrl('not-a-url'),
      /Invalid GitHub URL/
    );
  });
});

describe('buildCaseDir', () => {
  it('generates correct case directory name', () => {
    assert.equal(buildCaseDir(1, 'REENT', 'beanstalk'), 'case-001-reent-beanstalk');
  });

  it('pads case number', () => {
    assert.equal(buildCaseDir(12, 'ACCESS', 'ronin'), 'case-012-access-ronin');
  });
});

describe('generateGroundTruthTemplate', () => {
  it('generates template with case_id, empty known_vulnerabilities and false_positive_notes', () => {
    const result = generateGroundTruthTemplate('case-001-reent-beanstalk');
    assert.equal(result.case_id, 'case-001-reent-beanstalk');
    assert.deepEqual(result.known_vulnerabilities, []);
    assert.deepEqual(result.false_positive_notes, []);
  });
});
