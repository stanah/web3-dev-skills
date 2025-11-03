#!/usr/bin/env node
const { readFileSync, writeFileSync, mkdirSync } = require('fs');
const { join, resolve } = require('path');

const projectRoot = resolve(__dirname, '..');
const cursorRulesDir = join(projectRoot, '.cursor', 'rules');

mkdirSync(cursorRulesDir, { recursive: true });

const mapping = [
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

for (const { source, target, name, description } of mapping) {
  const content = readFileSync(join(projectRoot, source), 'utf8');
  const output = `---\nname: ${name}\ndescription: ${description}\n---\n${content}`;
  writeFileSync(join(cursorRulesDir, target), output);
  console.log(`Generated ${target} from ${source}`);
}
