#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

type RuleMapping = {
  source: string;
  target: string;
  name: string;
  description: string;
};

const mapping: RuleMapping[] = [
  {
    source: 'rules/base-rules.md',
    target: 'solidity-base.mdc',
    name: 'Solidity Base Guidance',
    description: 'Solidity/Foundry全般の共通原則',
  },
  {
    source: 'rules/design-rules.md',
    target: 'solidity-design.mdc',
    name: 'Solidity Design Guidance',
    description: '設計・仕様検討向けルール',
  },
  {
    source: 'rules/dev-rules.md',
    target: 'solidity-dev.mdc',
    name: 'Solidity Development Guidance',
    description: '実装・改修時のルール',
  },
  {
    source: 'rules/test-rules.md',
    target: 'solidity-test.mdc',
    name: 'Solidity Testing Guidance',
    description: 'テスト追加・改善向けルール',
  },
  {
    source: 'rules/optimize-rules.md',
    target: 'solidity-optimize.mdc',
    name: 'Solidity Optimization Guidance',
    description: 'ガス最適化・パフォーマンス調整',
  },
  {
    source: 'rules/security-rules.md',
    target: 'solidity-security.mdc',
    name: 'Solidity Security Review',
    description: 'セキュリティ監査・レビュー',
  },
];

type GenerateOptions = {
  projectRoot?: string;
  outputDir?: string;
};

export function generateCursorRules(options: GenerateOptions = {}): string[] {
  const resolvedProjectRoot = options.projectRoot ?? resolve(__dirname, '..');
  const resolvedOutputDir =
    options.outputDir ?? join(resolvedProjectRoot, '.cursor', 'rules');

  mkdirSync(resolvedOutputDir, { recursive: true });

  const generatedFiles: string[] = [];

  for (const mappingEntry of mapping) {
    const content = readFileSync(join(resolvedProjectRoot, mappingEntry.source), 'utf8');
    const output = [
      '---',
      `name: ${mappingEntry.name}`,
      `description: ${mappingEntry.description}`,
      '---',
      content,
    ].join('\n');

    writeFileSync(join(resolvedOutputDir, mappingEntry.target), output);
    console.log(`Generated ${mappingEntry.target} from ${mappingEntry.source}`);
    generatedFiles.push(join(resolvedOutputDir, mappingEntry.target));
  }

  return generatedFiles;
}

if (require.main === module) {
  generateCursorRules();
}

