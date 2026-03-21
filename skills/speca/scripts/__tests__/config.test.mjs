import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, getLanguage, getConfigHash } from '../lib/config.mjs';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURE_DIR = join(import.meta.dirname, 'fixtures', 'config-test');
const SPECA_DIR = join(FIXTURE_DIR, '.speca');

describe('config', () => {
  it('reads config.json and returns parsed object', () => {
    mkdirSync(SPECA_DIR, { recursive: true });
    writeFileSync(join(SPECA_DIR, 'config.json'), JSON.stringify({
      version: '1.0',
      language: 'ja',
      spec_paths: ['./docs/spec.md'],
      source_paths: ['./contracts/'],
      threat_model: { actors: {}, boundaries: [], assumptions: [] }
    }));

    const config = readConfig(FIXTURE_DIR);
    assert.equal(config.language, 'ja');
    assert.deepEqual(config.spec_paths, ['./docs/spec.md']);

    rmSync(FIXTURE_DIR, { recursive: true });
  });

  it('returns "en" when language field is missing', () => {
    mkdirSync(SPECA_DIR, { recursive: true });
    writeFileSync(join(SPECA_DIR, 'config.json'), JSON.stringify({
      version: '1.0',
      spec_paths: [],
      source_paths: [],
      threat_model: { actors: {}, boundaries: [], assumptions: [] }
    }));

    assert.equal(getLanguage(readConfig(FIXTURE_DIR)), 'en');

    rmSync(FIXTURE_DIR, { recursive: true });
  });

  it('throws when config.json does not exist', () => {
    assert.throws(() => readConfig('/nonexistent'), { code: 'ENOENT' });
  });

  it('getConfigHash returns consistent hash for same config', () => {
    mkdirSync(SPECA_DIR, { recursive: true });
    const configData = JSON.stringify({ version: '1.0', spec_paths: [] });
    writeFileSync(join(SPECA_DIR, 'config.json'), configData);

    const hash1 = getConfigHash(FIXTURE_DIR);
    const hash2 = getConfigHash(FIXTURE_DIR);
    assert.equal(hash1, hash2);
    assert.equal(typeof hash1, 'string');
    assert.ok(hash1.length > 0);

    rmSync(FIXTURE_DIR, { recursive: true });
  });
});
