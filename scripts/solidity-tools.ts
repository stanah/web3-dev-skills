#!/usr/bin/env node
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

import { generateCursorRules } from './generate-cursor-rules.ts';

const currentDir = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(currentDir, '..');

function installCursorRules(): void {
  const cursorRulesDir = join(projectRoot, '.cursor', 'rules');
  const destinationDir = join(homedir(), '.cursor', 'rules');

  console.log('Generating Cursor rule files...');
  const generatedFiles = generateCursorRules({ projectRoot, outputDir: cursorRulesDir });

  mkdirSync(destinationDir, { recursive: true });

  for (const filePath of generatedFiles) {
    const destPath = join(destinationDir, basename(filePath));
    copyFileSync(filePath, destPath);
    console.log(`Installed ${filePath} -> ${destPath}`);
  }

  console.log(`Cursor rule pack installed under ${destinationDir}`);
}

function installAmazonQAgents(): void {
  const sourceDir = join(projectRoot, '.amazon-q', 'cli-agents');
  const destinationDir = join(homedir(), '.aws', 'amazonq', 'cli-agents');
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').replace(/\..+/, '');

  mkdirSync(destinationDir, { recursive: true });

  const installed: string[] = [];
  const backups: string[] = [];

  for (const file of readdirSync(sourceDir)) {
    if (!file.startsWith('solidity-') || !file.endsWith('.json')) {
      continue;
    }

    const sourcePath = join(sourceDir, file);
    const destinationPath = join(destinationDir, file);

    if (existsSync(destinationPath)) {
      const backupPath = `${destinationPath}.backup-${timestamp}`;
      copyFileSync(destinationPath, backupPath);
      backups.push(backupPath);
    }

    copyFileSync(sourcePath, destinationPath);
    installed.push(destinationPath);
    console.log(`Installed ${sourcePath} -> ${destinationPath}`);
  }

  if (installed.length === 0) {
    console.warn('No Amazon Q agent definitions matched the solidity-* pattern.');
  } else {
    console.log(`Amazon Q agent definitions installed under ${destinationDir}`);
  }

  if (backups.length > 0) {
    console.log('Backed up existing files:');
    backups.forEach((path) => console.log(`  - ${path}`));
  }
}

yargs(hideBin(process.argv))
  .scriptName('solidity-tools')
  .usage('$0 <command> [options]')
  .command(
    'cursor generate',
    'Generate Cursor rule files inside the repository',
    () => {},
    () => {
      const generated = generateCursorRules({ projectRoot });
      console.log(`Generated ${generated.length} Cursor rule file(s).`);
    },
  )
  .command(
    'cursor install',
    'Generate and copy Cursor rule files to ~/.cursor/rules',
    () => {},
    () => {
      installCursorRules();
    },
  )
  .command(
    'amazonq install',
    'Copy Amazon Q CLI agent definitions to ~/.aws/amazonq/cli-agents',
    () => {},
    () => {
      installAmazonQAgents();
    },
  )
  .demandCommand()
  .strict()
  .help()
  .parse();
