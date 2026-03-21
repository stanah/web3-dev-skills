import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const run = promisify(execFile);
const CLI = join(import.meta.dirname, '..', 'speca-cli.mjs');
const TMP = join(import.meta.dirname, '__tmp_cli_test__');

describe('speca-cli', () => {
  before(() => {
    mkdirSync(join(TMP, '.speca'), { recursive: true });
    writeFileSync(join(TMP, '.speca', 'config.json'), JSON.stringify({
      version: '1.0', language: 'en',
      spec_paths: ['./docs/spec.md'], source_paths: ['./contracts/'],
      threat_model: { actors: { owner: 'TRUSTED' }, boundaries: [], assumptions: [] }
    }));
  });
  after(() => rmSync(TMP, { recursive: true, force: true }));

  it('no subcommand exits with INVALID_ARGS', async () => {
    await assert.rejects(
      run('node', [CLI, '--project-root', TMP]),
      (err) => { assert.equal(JSON.parse(err.stderr).code, 'INVALID_ARGS'); return true; }
    );
  });

  it('query --file config --mode summary returns config summary', async () => {
    const { stdout } = await run('node', [CLI, 'query', '--file', 'config', '--mode', 'summary', '--project-root', TMP]);
    const result = JSON.parse(stdout);
    assert.equal(result.version, '1.0');
  });

  it('query --file config --mode batch exits with UNSUPPORTED_MODE', async () => {
    await assert.rejects(
      run('node', [CLI, 'query', '--file', 'config', '--mode', 'batch', '--project-root', TMP]),
      (err) => { assert.equal(JSON.parse(err.stderr).code, 'UNSUPPORTED_MODE'); return true; }
    );
  });

  it('config --action hash returns 12-char hex', async () => {
    const { stdout } = await run('node', [CLI, 'config', '--action', 'hash', '--project-root', TMP]);
    assert.match(stdout.trim(), /^[a-f0-9]{12}$/);
  });

  it('progress --phase test --action should-resume returns fresh', async () => {
    const { stdout } = await run('node', [CLI, 'progress', '--phase', 'test', '--action', 'should-resume', '--project-root', TMP]);
    const result = JSON.parse(stdout);
    assert.equal(result.action, 'fresh');
  });

  // record: mutual exclusivity
  it('record with no action flag exits with INVALID_ARGS', async () => {
    await assert.rejects(
      run('node', [CLI, 'record', '--project-root', TMP]),
      (err) => { assert.equal(JSON.parse(err.stderr).code, 'INVALID_ARGS'); return true; }
    );
  });

  // report: --output vs --output-dir mutual exclusivity
  it('report --format md,sarif with --output exits with INVALID_ARGS', async () => {
    await assert.rejects(
      run('node', [CLI, 'report', '--format', 'md,sarif', '--output', 'x.md', '--project-root', TMP]),
      (err) => { assert.equal(JSON.parse(err.stderr).code, 'INVALID_ARGS'); return true; }
    );
  });

  // Additional coverage tests

  it('config --action validate passes for valid config', async () => {
    const { stdout } = await run('node', [CLI, 'config', '--action', 'validate', '--project-root', TMP]);
    const result = JSON.parse(stdout);
    assert.equal(result.valid, true);
  });

  it('config --action summary returns config summary object', async () => {
    const { stdout } = await run('node', [CLI, 'config', '--action', 'summary', '--project-root', TMP]);
    const result = JSON.parse(stdout);
    assert.equal(result.version, '1.0');
    assert.equal(result.file, 'config');
    assert.deepEqual(result.actor_names, ['owner']);
  });

  it('query --file config --mode get exits with UNSUPPORTED_MODE', async () => {
    await assert.rejects(
      run('node', [CLI, 'query', '--file', 'config', '--mode', 'get', '--project-root', TMP]),
      (err) => { assert.equal(JSON.parse(err.stderr).code, 'UNSUPPORTED_MODE'); return true; }
    );
  });

  it('unknown subcommand exits with INVALID_ARGS', async () => {
    await assert.rejects(
      run('node', [CLI, 'nonexistent', '--project-root', TMP]),
      (err) => { assert.equal(JSON.parse(err.stderr).code, 'INVALID_ARGS'); return true; }
    );
  });

  it('record --init --append exits with INVALID_ARGS (mutually exclusive)', async () => {
    await assert.rejects(
      run('node', [CLI, 'record', '--init', '--append', '--project-root', TMP]),
      (err) => { assert.equal(JSON.parse(err.stderr).code, 'INVALID_ARGS'); return true; }
    );
  });

  it('record --init creates findings.json', async () => {
    const { stdout } = await run('node', [CLI, 'record', '--init',
      '--audited-at', '2026-01-01T00:00:00Z',
      '--checklist-version', '2026-01-01T00:00:00Z',
      '--project-root', TMP
    ]);
    const result = JSON.parse(stdout);
    assert.equal(result.initialized, true);
  });

  it('progress --phase test --action load returns null for missing progress', async () => {
    const { stdout } = await run('node', [CLI, 'progress', '--phase', 'test', '--action', 'load', '--project-root', TMP]);
    const result = JSON.parse(stdout);
    assert.equal(result, null);
  });

  it('query --file nonexistent exits with INVALID_ARGS', async () => {
    await assert.rejects(
      run('node', [CLI, 'query', '--file', 'nonexistent', '--mode', 'summary', '--project-root', TMP]),
      (err) => { assert.equal(JSON.parse(err.stderr).code, 'INVALID_ARGS'); return true; }
    );
  });
});
