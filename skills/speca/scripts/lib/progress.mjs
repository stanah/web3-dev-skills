import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Load progress for a given phase. Returns null if no progress file exists.
 */
export function loadProgress(projectRoot, phase) {
  const progressPath = join(projectRoot, '.speca', 'progress', `${phase}-progress.json`);
  try {
    const raw = readFileSync(progressPath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

/**
 * Save progress for a given phase.
 */
export function saveProgress(projectRoot, phase, progress) {
  const dir = join(projectRoot, '.speca', 'progress');
  mkdirSync(dir, { recursive: true });
  const progressPath = join(dir, `${phase}-progress.json`);
  writeFileSync(progressPath, JSON.stringify(progress, null, 2));
}

/**
 * Determine action based on progress state and current config hash.
 * Returns: 'resume' | 'restart' | 'completed' | 'fresh'
 */
export function shouldResume(progress, currentConfigHash) {
  if (!progress) return 'fresh';
  if (progress.config_hash !== currentConfigHash) return 'restart';
  if (progress.status === 'completed') return 'completed';
  return 'resume';
}
