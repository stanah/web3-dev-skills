#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const { values } = parseArgs({
  options: {
    case: { type: 'string' },
    output: { type: 'string' },
    clean: { type: 'boolean', default: false },
    list: { type: 'boolean', default: false },
  }
});

const TESTS_DIR = resolve(import.meta.dirname, 'cases');

if (values.list) {
  const { readdirSync } = await import('node:fs');
  const cases = readdirSync(TESTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  console.log(JSON.stringify({ cases }, null, 2));
  process.exit(0);
}

if (!values.case || !values.output) {
  console.error('Usage: setup-test.mjs --case <name> --output <dir> [--clean]');
  console.error('       setup-test.mjs --list');
  process.exit(1);
}

const caseDir = join(TESTS_DIR, values.case);
if (!existsSync(caseDir)) {
  console.error(JSON.stringify({ error: `Test case "${values.case}" not found`, available: TESTS_DIR }));
  process.exit(1);
}

const outputDir = resolve(values.output);

if (existsSync(outputDir)) {
  if (!values.clean) {
    console.error(JSON.stringify({ error: `Output directory already exists: ${outputDir}. Use --clean to overwrite.` }));
    process.exit(1);
  }
  rmSync(outputDir, { recursive: true, force: true });
}

// If contracts/ doesn't exist but fetch-contracts.sh does, run it first
const contractsDir = join(caseDir, 'contracts');
const fetchScript = join(caseDir, 'fetch-contracts.sh');
if (!existsSync(contractsDir) && existsSync(fetchScript)) {
  const { execFileSync } = await import('node:child_process');
  console.log(JSON.stringify({ status: 'fetching', script: fetchScript }));
  try {
    execFileSync('bash', [fetchScript], { stdio: 'inherit' });
  } catch (e) {
    console.error(JSON.stringify({ error: `fetch-contracts.sh failed: ${e.message}` }));
    process.exit(1);
  }
  if (!existsSync(contractsDir)) {
    console.error(JSON.stringify({ error: 'fetch-contracts.sh completed but contracts/ directory not found' }));
    process.exit(1);
  }
}

// Copy contracts and docs
cpSync(join(caseDir, 'contracts'), join(outputDir, 'contracts'), { recursive: true });
cpSync(join(caseDir, 'docs'), join(outputDir, 'docs'), { recursive: true });

// Create .speca directory and copy config
mkdirSync(join(outputDir, '.speca', 'reports'), { recursive: true });
cpSync(join(caseDir, 'config.json'), join(outputDir, '.speca', 'config.json'));

console.log(JSON.stringify({
  status: 'ok',
  case: values.case,
  output: outputDir,
  contents: {
    contracts: join(outputDir, 'contracts'),
    docs: join(outputDir, 'docs'),
    config: join(outputDir, '.speca', 'config.json'),
  }
}, null, 2));
