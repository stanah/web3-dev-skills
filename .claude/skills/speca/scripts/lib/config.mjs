import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Read and parse .speca/config.json from the given project root.
 * Throws ENOENT if file does not exist.
 */
export function readConfig(projectRoot) {
  const configPath = join(projectRoot, '.speca', 'config.json');
  const raw = readFileSync(configPath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Extract language from config, defaulting to 'en'.
 */
export function getLanguage(config) {
  return config.language || 'en';
}

/**
 * Compute a short hash of config.json content for change detection.
 */
export function getConfigHash(projectRoot) {
  const configPath = join(projectRoot, '.speca', 'config.json');
  const raw = readFileSync(configPath, 'utf-8');
  return createHash('sha256').update(raw).digest('hex').slice(0, 12);
}
