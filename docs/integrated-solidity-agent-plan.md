# 🚀 Solidityスマートコントラクト開発用ルールベースエージェントシステム

## エグゼクティブサマリー

本計画書は、ルールファイル（`.cursorrules`）を活用した特化エージェントと、それを補助するCLIツールによって、セキュアで効率的なSolidityスマートコントラクト開発を実現するための実装計画です。

**核心価値**: ルールファイルによる専門性の分離と、CLIツールによる品質保証の自動化

---

## 第1部: クイックスタートガイド 🎯

### 1.1 最小構成で今すぐ始める

```bash
# Step 1: プロジェクト初期化
mkdir solidity-agent && cd solidity-agent
npm init -y

# Step 2: 基本ツールのインストール
npm install --save-dev @openzeppelin/contracts@5.0.0
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Step 3: ルールファイルとCLIツールの配置
mkdir -p .cursorrules docs/agents tools
```

### 1.2 必須ファイル（最小構成）

#### `.cursorrules` (全体共通ルール)
```markdown
You are a world-class Solidity developer and security auditor.
- Solidity ≥ 0.8.20, OpenZeppelin 5.0+
- ALWAYS: CEI pattern, ReentrancyGuard, Access Control
- ALWAYS: NatSpec, Events for state changes, Custom errors
- Prefer: external over public, calldata over memory
- Run: slither . && forge test
```

#### `tools/solidity-cli.sh` (統合CLIツール)
```bash
#!/bin/bash
# Solidity開発補助CLIツール

case "$1" in
  check)
    echo "=== Compiling ==="
    forge build
    echo "=== Security Analysis ==="
    slither . --print human-summary
    echo "=== Tests ==="
    forge test --gas-report
    ;;
  lint)
    solhint 'contracts/**/*.sol'
    ;;
  coverage)
    forge coverage
    ;;
  *)
    echo "Usage: $0 {check|lint|coverage}"
    exit 1
    ;;
esac
```

---

## 第2部: ルールベース特化エージェント設計 📝

### 2.1 5つの特化エージェント

| エージェント | 専門領域 | ルールファイル | 使用場面 |
|------------|---------|------------|---------|
| **設計エージェント** | 要件分析、アーキテクチャ | `.cursorrules.design` | 新規開発の初期段階 |
| **開発エージェント** | コード生成、実装 | `.cursorrules.dev` | 実装フェーズ |
| **セキュリティエージェント** | 脆弱性検出、修正 | `.cursorrules.security` | コードレビュー |
| **テストエージェント** | テストコード生成 | `.cursorrules.test` | テスト作成 |
| **最適化エージェント** | ガス最適化 | `.cursorrules.optimize` | 最終調整 |

### 2.2 エージェント切り替え方法

```bash
# エージェント切り替えスクリプト
#!/bin/bash
# tools/switch-agent.sh

agent=$1
if [ -f ".cursorrules.$agent" ]; then
  cp ".cursorrules.$agent" .cursorrules
  echo "✅ Switched to $agent agent"
else
  echo "❌ Agent $agent not found"
fi
```

使用例:
```bash
./tools/switch-agent.sh security  # セキュリティエージェントに切り替え
./tools/switch-agent.sh dev      # 開発エージェントに切り替え
```

---

## 第3部: 詳細ルールファイル設計 📋

### 3.1 設計エージェント（`.cursorrules.design`）

```markdown
# Solidity Design Agent

You are a Solidity architect specializing in contract design.

## Primary Focus
- Requirements analysis and translation to technical specs
- Gas-efficient storage layout design
- Inheritance structure and interface definition
- Upgrade patterns (UUPS, Transparent Proxy)

## Design Process
1. Analyze requirements for security implications
2. Define clear contract boundaries and responsibilities
3. Plan storage layout for minimal gas usage
4. Design event structure for complete observability
5. Create comprehensive interface definitions

## Output Format
Always provide:
- Contract structure diagram (text-based)
- Storage layout specification
- Interface definitions with NatSpec
- Security considerations list
- Gas optimization opportunities

## Standards
- ERC compliance when applicable
- OpenZeppelin base contracts preferred
- Minimal external dependencies
- Modular, composable design
```

### 3.2 開発エージェント（`.cursorrules.dev`）

```markdown
# Solidity Development Agent

You are implementing Solidity smart contracts with security-first approach.

## Code Generation Rules
- Solidity ^0.8.20 with explicit version
- Import OpenZeppelin 5.0+ contracts when applicable
- Custom errors over require strings (gas optimization)
- NatSpec for ALL public/external functions

## Security Patterns (Mandatory)
- Checks-Effects-Interactions for state changes
- ReentrancyGuard for external calls
- Access control (Ownable/AccessControl)
- SafeERC20 for token interactions
- Explicit visibility modifiers

## Code Structure
pragma solidity ^0.8.20;
// SPDX-License-Identifier: MIT

// Imports (OpenZeppelin first, then custom)
// Interfaces
// Libraries
// Main contract with clear section comments:
//   - State variables
//   - Events
//   - Errors
//   - Modifiers
//   - Constructor
//   - External functions
//   - Public functions
//   - Internal functions
//   - Private functions

## Gas Optimization
- Pack struct members
- Use calldata for read-only arrays
- Cache storage reads in memory
- Prefer mappings over arrays for lookups
```

### 3.3 セキュリティエージェント（`.cursorrules.security`）

```markdown
# Solidity Security Agent

You are a security auditor identifying and fixing vulnerabilities.

## Critical Checks (Block deployment if found)
- [ ] Reentrancy vulnerabilities
- [ ] Unprotected external calls
- [ ] Missing access controls
- [ ] Integer overflow/underflow risks
- [ ] Unchecked return values

## Analysis Approach
1. Review every external/public function
2. Trace all state changes
3. Identify all external calls
4. Check all mathematical operations
5. Verify access control on sensitive functions

## Fix Templates
For reentrancy:
  Add: modifier nonReentrant from ReentrancyGuard
  Apply: CEI pattern strictly

For access control:
  Add: modifier onlyOwner or role-based
  Document: Who should call this and why

For external calls:
  Check: Return values
  Limit: Gas forwarded

## Output Format
- Severity: Critical/High/Medium/Low
- Location: Contract:Function:Line
- Issue: Clear description
- Impact: What could go wrong
- Fix: Exact code to implement
```

### 3.4 テストエージェント（`.cursorrules.test`）

```markdown
# Solidity Test Agent

You are creating comprehensive test suites using Foundry.

## Test Coverage Requirements
- 100% of public/external functions
- All state transitions
- Edge cases and boundary conditions
- Failure scenarios (expecting reverts)
- Gas consumption benchmarks

## Test Structure (Foundry)
contract ContractTest is Test {
    // Setup
    function setUp() public {
        // Initialize test environment
    }

    // Unit tests: test_FunctionName_Scenario()
    function test_Transfer_ValidAmount() public {
        // Arrange
        // Act
        // Assert
    }

    // Fuzz tests: testFuzz_FunctionName()
    function testFuzz_Transfer(uint256 amount) public {
        vm.assume(amount > 0 && amount <= totalSupply);
        // Test with random valid inputs
    }

    // Invariant tests: invariant_PropertyName()
    function invariant_TotalSupplyConstant() public {
        // Assert system-wide properties
    }

    // Failure tests: testFail_FunctionName_Reason()
    function testFail_Transfer_InsufficientBalance() public {
        // Should revert
    }
}

## Test Helpers
- Use vm.prank() for impersonation
- Use vm.expectRevert() for failure testing
- Use vm.warp() for time manipulation
- Use forge-std/console.sol for debugging
```

### 3.5 最適化エージェント（`.cursorrules.optimize`）

```markdown
# Solidity Gas Optimization Agent

You are optimizing contracts for minimal gas consumption.

## Storage Optimization
- Pack structs (group uint128, uint64, address)
- Use mappings over arrays for single lookups
- Delete unused storage with delete keyword
- Use immutable for constructor-set values
- Use constant for compile-time values

## Computation Optimization
- Cache storage reads in local variables
- Use unchecked blocks for safe math
- Short-circuit conditions (cheapest first)
- Avoid loops over dynamic arrays
- Batch operations when possible

## Function Optimization
- Use external over public (no ABI encoding)
- Use calldata over memory for inputs
- Return memory over storage when possible
- Inline simple functions
- Combine multiple reads into single SLOAD

## Analysis Process
1. Run forge test --gas-report
2. Identify high-cost functions
3. Analyze storage access patterns
4. Propose specific optimizations
5. Measure improvement

## Output Format
Function: functionName()
Current: X gas
Optimized: Y gas
Savings: Z gas (W%)
Changes: [specific changes made]
```

---

## 第4部: CLIツール最適化 🛠️

### 4.1 統合CLIツール（`solidity-cli`）

```bash
#!/bin/bash
# tools/solidity-cli - Solidity開発統合CLIツール

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

function print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

function print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

function print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

case "$1" in
    init)
        print_status "Initializing Solidity project..."
        forge init --force
        npm init -y
        npm install --save-dev @openzeppelin/contracts
        cp -r "$SCRIPT_DIR/templates/." .
        print_status "Project initialized successfully"
        ;;

    check-all)
        print_status "Running comprehensive checks..."

        # Compilation
        echo -e "\n${GREEN}=== Compilation ===${NC}"
        forge build || print_error "Compilation failed"

        # Linting
        echo -e "\n${GREEN}=== Linting ===${NC}"
        solhint 'contracts/**/*.sol' || print_warning "Lint issues found"

        # Security
        echo -e "\n${GREEN}=== Security Analysis ===${NC}"
        slither . --print human-summary || print_warning "Security issues found"

        # Tests
        echo -e "\n${GREEN}=== Tests ===${NC}"
        forge test || print_error "Tests failed"

        # Coverage
        echo -e "\n${GREEN}=== Coverage ===${NC}"
        forge coverage || true
        ;;

    security-deep)
        print_status "Running deep security analysis..."

        # Slither with all detectors
        slither . --print human-summary
        slither . --print contract-summary

        # Generate markdown report
        slither . --print human-summary > security-report.md
        print_status "Report saved to security-report.md"
        ;;

    gas-profile)
        print_status "Generating gas profile..."
        forge test --gas-report > gas-report.txt

        # Extract and format high gas functions
        echo -e "\n${YELLOW}Functions using >50000 gas:${NC}"
        grep -E "[5-9][0-9]{4,}|[0-9]{6,}" gas-report.txt || echo "None found"
        ;;

    agent)
        # エージェント切り替え
        agent_type=$2
        if [ -f ".cursorrules.$agent_type" ]; then
            cp ".cursorrules.$agent_type" .cursorrules
            print_status "Switched to $agent_type agent"
            echo "Current focus: $(grep "Primary Focus" .cursorrules | head -1)"
        else
            print_error "Agent type '$agent_type' not found"
            echo "Available agents: design, dev, security, test, optimize"
        fi
        ;;

    template)
        # テンプレート生成
        template_type=$2
        case "$template_type" in
            erc20)
                cp "$SCRIPT_DIR/templates/ERC20Template.sol" contracts/
                print_status "ERC20 template created"
                ;;
            erc721)
                cp "$SCRIPT_DIR/templates/ERC721Template.sol" contracts/
                print_status "ERC721 template created"
                ;;
            *)
                print_error "Unknown template: $template_type"
                echo "Available: erc20, erc721"
                ;;
        esac
        ;;

    *)
        echo "Solidity Development CLI"
        echo ""
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  init          - Initialize new Solidity project"
        echo "  check-all     - Run all checks (compile, lint, security, test)"
        echo "  security-deep - Deep security analysis with report"
        echo "  gas-profile   - Generate gas consumption profile"
        echo "  agent <type>  - Switch agent (design/dev/security/test/optimize)"
        echo "  template <type> - Generate template (erc20/erc721)"
        ;;
esac
```

### 4.2 セキュリティ特化スクリプト

```python
#!/usr/bin/env python3
# tools/parse-security.py - Slither結果を解析して修正提案を生成

import json
import sys

def parse_slither_output(json_file):
    """Slither JSONを解析して修正提案を生成"""
    with open(json_file, 'r') as f:
        data = json.load(f)

    issues_by_severity = {
        'High': [],
        'Medium': [],
        'Low': [],
        'Informational': []
    }

    for detector in data.get('results', {}).get('detectors', []):
        severity = detector['severity']
        issues_by_severity[severity].append({
            'check': detector['check'],
            'impact': detector['impact'],
            'confidence': detector['confidence'],
            'description': detector['description'],
            'elements': detector.get('elements', [])
        })

    # 修正提案を生成
    print("# Security Analysis Report\n")

    for severity in ['High', 'Medium', 'Low', 'Informational']:
        issues = issues_by_severity[severity]
        if issues:
            print(f"## {severity} Severity Issues ({len(issues)})\n")
            for i, issue in enumerate(issues, 1):
                print(f"### {i}. {issue['check']}")
                print(f"**Impact**: {issue['impact']}")
                print(f"**Confidence**: {issue['confidence']}")
                print(f"\n{issue['description']}\n")
                print(generate_fix_suggestion(issue['check']))
                print("---\n")

def generate_fix_suggestion(check_type):
    """チェックタイプに基づいて修正提案を生成"""
    fixes = {
        'reentrancy': """
**Fix**:
```solidity
// Add ReentrancyGuard
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
contract MyContract is ReentrancyGuard {
    function withdraw() external nonReentrant {
        // Apply CEI pattern
        uint256 amount = balances[msg.sender];
        balances[msg.sender] = 0;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
}
```""",
        'missing-access-control': """
**Fix**:
```solidity
import "@openzeppelin/contracts/access/Ownable.sol";
contract MyContract is Ownable {
    function sensitiveFunction() external onlyOwner {
        // Protected function
    }
}
```""",
        'unchecked-return-value': """
**Fix**:
```solidity
// Always check return values
(bool success, bytes memory data) = target.call(payload);
require(success, "Call failed");
```"""
    }

    for key in fixes:
        if key in check_type.lower():
            return fixes[key]

    return "**Fix**: Review the code and apply appropriate security patterns."

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python parse-security.py <slither-output.json>")
        sys.exit(1)

    parse_slither_output(sys.argv[1])
```

---

## 第5部: 実践的な使用方法 💡

### 5.1 新規プロジェクト開始

```bash
# 1. プロジェクト初期化
./tools/solidity-cli init

# 2. 設計エージェントに切り替え
./tools/solidity-cli agent design

# 3. Cursorで要件を入力して設計
# "Design an ERC-20 token with pause and burn features"

# 4. 開発エージェントに切り替え
./tools/solidity-cli agent dev

# 5. 設計を基に実装
# "Implement the designed token contract"

# 6. セキュリティチェック
./tools/solidity-cli check-all
```

### 5.2 既存コードのセキュリティ監査

```bash
# 1. セキュリティエージェントに切り替え
./tools/solidity-cli agent security

# 2. 深層セキュリティ分析実行
./tools/solidity-cli security-deep

# 3. Cursorで修正依頼
# "Fix the high severity issues in security-report.md"

# 4. 再チェック
./tools/solidity-cli check-all
```

### 5.3 ガス最適化

```bash
# 1. 最適化エージェントに切り替え
./tools/solidity-cli agent optimize

# 2. ガスプロファイル生成
./tools/solidity-cli gas-profile

# 3. Cursorで最適化依頼
# "Optimize the high gas consumption functions"

# 4. 改善確認
./tools/solidity-cli gas-profile
```

---

## 第6部: ルールファイル管理 📚

### 6.1 ディレクトリ構造

```
project-root/
├── .cursorrules              # アクティブなルール
├── .cursorrules.design       # 設計エージェント
├── .cursorrules.dev          # 開発エージェント
├── .cursorrules.security     # セキュリティエージェント
├── .cursorrules.test         # テストエージェント
├── .cursorrules.optimize     # 最適化エージェント
├── contracts/                # Solidityコントラクト
├── test/                     # Foundryテスト
├── tools/
│   ├── solidity-cli         # 統合CLIツール
│   ├── parse-security.py    # セキュリティ解析
│   └── templates/           # コントラクトテンプレート
└── docs/
    ├── agents/              # エージェント詳細ドキュメント
    └── workflows/           # ワークフロー手順書
```

### 6.2 ルールファイルのカスタマイズ

プロジェクト特有の要件を追加:

```markdown
# .cursorrules.projectにプロジェクト固有ルールを追加

## Project Specific Rules
- Use Chainlink VRF for randomness
- Implement EIP-2981 for royalties
- Target Polygon network (lower gas costs)
- Integrate with specific DEX (Uniswap V3)
```

---

## 第7部: 品質保証チェックリスト ✅

### 7.1 開発フローチェックリスト

| フェーズ | チェック項目 | ツール/エージェント |
|---------|------------|------------------|
| **設計** | □ 要件明確化<br>□ セキュリティ考慮<br>□ ガス見積もり | 設計エージェント |
| **実装** | □ コンパイル成功<br>□ Lint通過<br>□ 標準準拠 | 開発エージェント<br>`solidity-cli check-all` |
| **セキュリティ** | □ Slither通過<br>□ 高リスク0件<br>□ アクセス制御確認 | セキュリティエージェント<br>`solidity-cli security-deep` |
| **テスト** | □ カバレッジ90%+<br>□ Fuzzテスト<br>□ インバリアント | テストエージェント<br>`forge coverage` |
| **最適化** | □ ガス削減20%+<br>□ ストレージ最適化 | 最適化エージェント<br>`forge test --gas-report` |

### 7.2 リリース前チェックリスト

```bash
#!/bin/bash
# tools/release-check.sh - リリース前の最終チェック

echo "=== Release Readiness Check ==="

# 1. コンパイル
forge build || exit 1

# 2. 全テスト
forge test || exit 1

# 3. カバレッジ確認
coverage=$(forge coverage | grep "Total" | awk '{print $3}')
if [ "${coverage%\%}" -lt 90 ]; then
    echo "❌ Coverage below 90%"
    exit 1
fi

# 4. セキュリティ
slither . --print human-summary | grep "High" && exit 1

echo "✅ All checks passed - Ready for release!"
```

---

## 第8部: トラブルシューティング 🔧

### 8.1 よくある問題と解決

| 問題 | 解決方法 |
|------|---------|
| ルールが適用されない | `.cursorrules`ファイルの存在確認、Cursor再起動 |
| Slither警告が多い | `.slither.config.json`で偽陽性を除外設定 |
| ガス使用量が高い | 最適化エージェントで分析、ストレージアクセス削減 |
| テストが遅い | `--match-contract`でテスト範囲を限定 |

### 8.2 デバッグ用コマンド

```bash
# コントラクトサイズ確認
forge build --sizes

# 特定テストのデバッグ
forge test -vvv --match-test test_SpecificFunction

# ガス使用量の詳細
forge test --gas-report --match-contract MyContract

# ストレージレイアウト確認
forge inspect MyContract storage
```

---

## まとめ

本システムは以下を実現します：

1. **ルールファイルによる専門性の分離** - 各フェーズに特化したエージェント
2. **CLIツールによる品質保証** - 自動化されたチェックと分析
3. **実践的なワークフロー** - 明確な手順とツールサポート
4. **カスタマイズ可能** - プロジェクト要件に応じた拡張

**成功の鍵**: 適切なエージェント選択と、CLIツールによる継続的な品質チェック

---

*Document Version: 2.0.0*
*Last Updated: 2025-01-02*
*Focus: Rule-based agents and CLI tools only*