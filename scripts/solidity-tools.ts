#!/usr/bin/env node
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { homedir } from 'node:os';

import { generateCursorRules } from './generate-cursor-rules';

const projectRoot = resolve(__dirname, '..');

function installCursorRules(targetDir?: string): void {
  const cursorRulesDir = join(projectRoot, '.cursor', 'rules');
  // ディレクトリが指定されていない場合は、プロジェクトルートを使用
  const destinationDir = targetDir
    ? join(resolve(targetDir), '.cursor', 'rules')
    : join(projectRoot, '.cursor', 'rules');

  console.log('Generating Cursor rule files...');
  const generatedFiles = generateCursorRules({ projectRoot, outputDir: cursorRulesDir });

  mkdirSync(destinationDir, { recursive: true });

  const installed: string[] = [];
  const overwritten: string[] = [];

  for (const filePath of generatedFiles) {
    const destPath = join(destinationDir, basename(filePath));

    if (existsSync(destPath)) {
      overwritten.push(basename(filePath));
    }

    copyFileSync(filePath, destPath);
    installed.push(basename(filePath));
    console.log(`Installed ${basename(filePath)} -> ${destPath}`);
  }

  console.log(`\nCursor rule pack installed under ${destinationDir}`);
  console.log(`Installed ${installed.length} rule file(s):`);
  installed.forEach((name) => console.log(`  - ${name}`));

  if (overwritten.length > 0) {
    console.log(`\nOverwritten existing file(s):`);
    overwritten.forEach((name) => console.log(`  - ${name}`));
  }
}

function installAmazonQAgents(targetDir?: string): void {
  const sourceDir = join(projectRoot, '.amazonq', 'cli-agents');
  // ディレクトリが指定されていない場合は、ホームディレクトリを使用（従来の動作）
  // リポジトリに配置する場合は公式仕様に従い .amazonq/cli-agents/ を使用
  const destinationDir = targetDir
    ? join(resolve(targetDir), '.amazonq', 'cli-agents')
    : join(homedir(), '.aws', 'amazonq', 'cli-agents');
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').replace(/\..+/, '');

  mkdirSync(destinationDir, { recursive: true });

  const installed: string[] = [];
  const backups: string[] = [];

  // エージェント定義ファイルをコピー
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

  // ディレクトリ指定でインストールする場合、ルールファイルとドキュメントもコピー
  // エージェント定義ファイルから ../rules/ を参照しているため、.amazonq/rules/ に配置
  if (targetDir) {
    const targetRoot = resolve(targetDir);
    const amazonqDir = join(targetRoot, '.amazonq');
    const rulesSource = join(projectRoot, 'rules');
    const docsSource = join(projectRoot, 'docs');
    const rulesDest = join(amazonqDir, 'rules');
    const docsDest = join(amazonqDir, 'docs');

    if (existsSync(rulesSource)) {
      console.log(`Copying rules directory to ${rulesDest}...`);
      cpSync(rulesSource, rulesDest, { recursive: true });
      console.log(`  ✓ Copied rules directory`);
    }

    if (existsSync(docsSource)) {
      console.log(`Copying docs directory to ${docsDest}...`);
      cpSync(docsSource, docsDest, { recursive: true });
      console.log(`  ✓ Copied docs directory`);
    }
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
    'cursor',
    'Manage Cursor rule pack',
    (cursorYargs) =>
      cursorYargs
        .command(
          'generate',
          'Generate Cursor rule files inside the repository',
          () => {},
          () => {
            const generated = generateCursorRules({ projectRoot });
            console.log(`Generated ${generated.length} Cursor rule file(s).`);
          },
        )
        .command(
          'install',
          'Generate and copy Cursor rule files to specified directory (default: project root)',
          (installYargs) =>
            installYargs.option('dir', {
              alias: 'd',
              type: 'string',
              description: 'Target directory to install .cursor/rules/ (default: project root)',
              demandOption: false,
            }),
          (argv) => {
            installCursorRules(argv.dir);
          },
        )
        .demandCommand(),
  )
  .command(
    'amazonq',
    'Manage Amazon Q CLI agents',
    (amazonQYargs) =>
      amazonQYargs.command(
        'install',
        'Copy Amazon Q CLI agent definitions to specified directory (default: ~/.aws/amazonq/cli-agents)',
        (installYargs) =>
          installYargs.option('dir', {
            alias: 'd',
            type: 'string',
            description: 'Target directory to install .amazonq/cli-agents/ (default: ~/.aws/amazonq/cli-agents)',
            demandOption: false,
          }),
        (argv) => {
          installAmazonQAgents(argv.dir);
        },
      ),
  )
  .demandCommand()
  .strict()
  .help()
  .parse();

