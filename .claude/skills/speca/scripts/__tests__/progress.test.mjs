import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadProgress, saveProgress, shouldResume } from '../lib/progress.mjs';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURE_DIR = join(import.meta.dirname, 'fixtures', 'progress-test');

describe('progress', () => {
  it('returns null when no progress file exists', () => {
    const result = loadProgress(FIXTURE_DIR, 'audit');
    assert.equal(result, null);
  });

  it('saves and loads progress', () => {
    const progress = {
      phase: 'audit',
      started_at: '2026-02-19T10:00:00Z',
      updated_at: '2026-02-19T10:00:00Z',
      status: 'in_progress',
      total_items: 28,
      completed_items: 5,
      current_batch: 1,
      batch_size: 5,
      config_hash: 'abc123'
    };

    saveProgress(FIXTURE_DIR, 'audit', progress);
    const loaded = loadProgress(FIXTURE_DIR, 'audit');
    assert.deepEqual(loaded, progress);

    rmSync(join(FIXTURE_DIR, '.speca'), { recursive: true });
  });

  it('shouldResume returns "resume" for in_progress', () => {
    const progress = { status: 'in_progress', config_hash: 'abc' };
    assert.equal(shouldResume(progress, 'abc'), 'resume');
  });

  it('shouldResume returns "restart" for changed config', () => {
    const progress = { status: 'in_progress', config_hash: 'abc' };
    assert.equal(shouldResume(progress, 'xyz'), 'restart');
  });

  it('shouldResume returns "completed" for completed status', () => {
    const progress = { status: 'completed', config_hash: 'abc' };
    assert.equal(shouldResume(progress, 'abc'), 'completed');
  });
});
