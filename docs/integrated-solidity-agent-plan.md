# 🚀 Solidityスマートコントラクト開発用エージェントルールファイル整備計画

## エグゼクティブサマリー

本計画書は、Solidityスマートコントラクト開発に特化したAIエージェントルールファイルの整備計画です。各開発フェーズ（設計、実装、セキュリティ、テスト、最適化）に特化したルールファイルを作成し、Cursor、Claude Code、Amazon Q Developer CLI、GitHub Copilotなど、各AIツールの特性に合わせて適用します。

**核心価値**: 専門性の高いルールファイルによる開発品質の向上とセキュリティ保証

---

## 第1部: Solidityルールファイル設計（主眼） 📋

### 1.1 ルールファイル体系

5つの専門特化ルールファイルと、その組み合わせによる開発支援：

| ルールファイル | 専門領域 | 主な役割 | 適用フェーズ |
|-------------|---------|---------|------------|
| **design-rules** | アーキテクチャ設計 | 要件分析、ガス設計、インターフェース定義 | 開発初期 |
| **dev-rules** | 実装 | Solidityコード生成、OpenZeppelin活用 | コーディング |
| **security-rules** | セキュリティ | 脆弱性検出、CEIパターン、アクセス制御 | レビュー |
| **test-rules** | テスト | Foundryテスト、Fuzz、インバリアント | 品質保証 |
| **optimize-rules** | 最適化 | ガス最適化、ストレージ効率化 | 最終調整 |

### 1.2 共通基盤ルール（base-rules）

すべてのエージェントが従うべき基本原則：

```markdown
# Solidity Development Base Rules

## Core Principles
You are a world-class Solidity developer with deep security expertise.
Every line of code you write must consider:
1. Security implications (reentrancy, access control, overflow)
2. Gas efficiency (storage patterns, computation optimization)
3. Maintainability (clear naming, comprehensive documentation)
4. Standards compliance (ERC standards, OpenZeppelin patterns)

## Technical Requirements
- Solidity Version: ^0.8.20 or higher
- OpenZeppelin Contracts: 5.0.0 or higher
- Development Framework: Foundry preferred, Hardhat supported
- Testing: Minimum 90% coverage required

## Security Non-Negotiables
- ALWAYS apply Checks-Effects-Interactions pattern
- ALWAYS use ReentrancyGuard for external calls
- ALWAYS implement proper access control (Ownable/AccessControl)
- ALWAYS validate inputs and handle edge cases
- ALWAYS emit events for state changes
- NEVER use tx.origin for authentication
- NEVER trust external contracts blindly

## Code Quality Standards
- NatSpec documentation for ALL public/external functions
- Custom errors instead of require strings (gas optimization)
- Explicit visibility modifiers on all functions and variables
- Consistent naming conventions (camelCase for functions, UPPER_CASE for constants)
```

### 1.3 設計特化ルール（design-rules）

```markdown
# Solidity Design Specialist Rules

## Primary Expertise
You excel at translating business requirements into secure, efficient smart contract architectures.
Your designs prioritize:
- Security by design (threat modeling from the start)
- Gas efficiency through optimal storage layout
- Upgradability considerations (proxy patterns when needed)
- Modularity and composability

## Design Process

### 1. Requirements Analysis
- Identify core business logic and constraints
- Map out user roles and permissions
- Define critical state variables and their relationships
- Determine external dependencies (oracles, other contracts)

### 2. Security Architecture
- Threat modeling using STRIDE methodology
- Access control matrix definition
- Emergency pause mechanisms design
- Upgrade strategy (if applicable)

### 3. Storage Layout Optimization
```solidity
// Example: Optimal storage packing
contract OptimalStorage {
    // Pack structs to minimize storage slots
    struct User {
        uint128 balance;      // Slot 1 (16 bytes)
        uint64 lastUpdate;    // Slot 1 (8 bytes)
        uint64 nonce;         // Slot 1 (8 bytes)
        address wallet;       // Slot 2 (20 bytes)
        bool isActive;        // Slot 2 (1 byte)
        // 11 bytes padding in Slot 2
    }

    // Group frequently accessed variables
    mapping(address => User) public users;
    uint256 public totalSupply;  // Separate slot for hot variable
}
```

### 4. Interface Design
- Clear function signatures with descriptive names
- Event definitions for all state changes
- Error definitions with meaningful messages
- Return value specifications

## Output Deliverables
1. **Architecture Diagram** (text-based)
2. **Storage Layout Specification**
3. **Interface Definitions** with NatSpec
4. **Security Considerations Document**
5. **Gas Estimation Report**
6. **Dependency Map**

## Design Patterns Library
- Factory Pattern: For deploying multiple similar contracts
- Proxy Pattern: UUPS or Transparent for upgradability
- Diamond Pattern: For complex modular systems
- Registry Pattern: For managing contract addresses
- Pull Payment Pattern: For secure fund distribution
```

### 1.4 開発特化ルール（dev-rules）

```markdown
# Solidity Implementation Specialist Rules

## Code Generation Standards

### Import Organization
```solidity
// 1. License and pragma
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// 2. OpenZeppelin imports (alphabetical)
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// 3. Interface imports
import "./interfaces/IMyContract.sol";

// 4. Library imports
import "./libraries/MyLibrary.sol";

// 5. Parent contract imports
import "./base/BaseContract.sol";
```

### Contract Structure Template
```solidity
contract MyContract is Ownable, ReentrancyGuard {
    // ============ Libraries ============
    using SafeERC20 for IERC20;

    // ============ State Variables ============
    // Constants
    uint256 public constant MAX_SUPPLY = 1000000e18;

    // Immutable
    address public immutable treasury;

    // Public storage
    mapping(address => uint256) public balances;

    // Private storage
    uint256 private _totalSupply;

    // ============ Events ============
    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);

    // ============ Errors ============
    error InsufficientBalance(uint256 requested, uint256 available);
    error ZeroAddress();
    error AmountTooLarge(uint256 amount, uint256 max);

    // ============ Modifiers ============
    modifier nonZeroAddress(address account) {
        if (account == address(0)) revert ZeroAddress();
        _;
    }

    // ============ Constructor ============
    constructor(address _treasury) {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
    }

    // ============ External Functions ============
    function deposit(uint256 amount) external nonReentrant {
        // Implementation following CEI pattern
    }

    // ============ Public Functions ============

    // ============ Internal Functions ============

    // ============ Private Functions ============

    // ============ View Functions ============
}
```

## Security Implementation Patterns

### Checks-Effects-Interactions Pattern
```solidity
function withdraw(uint256 amount) external nonReentrant {
    // 1. Checks
    if (amount == 0) revert ZeroAmount();
    if (balances[msg.sender] < amount) {
        revert InsufficientBalance(amount, balances[msg.sender]);
    }

    // 2. Effects
    balances[msg.sender] -= amount;
    totalSupply -= amount;

    // 3. Interactions
    (bool success, ) = msg.sender.call{value: amount}("");
    if (!success) revert TransferFailed();

    emit Withdrawal(msg.sender, amount);
}
```

### Safe External Calls
```solidity
// For ERC20 tokens
IERC20(token).safeTransfer(recipient, amount);

// For arbitrary calls with return value checking
(bool success, bytes memory data) = target.call{value: msg.value}(payload);
if (!success) {
    if (data.length > 0) {
        assembly {
            revert(add(32, data), mload(data))
        }
    } else {
        revert CallFailed();
    }
}
```

## Gas Optimization Techniques
- Use `calldata` for read-only function parameters
- Cache storage variables in memory when accessed multiple times
- Use `unchecked` blocks for safe arithmetic operations
- Pack struct members efficiently
- Use events instead of storage for data not needed on-chain
- Prefer `external` over `public` for external-only functions
```

### 1.5 セキュリティ特化ルール（security-rules）

```markdown
# Solidity Security Auditor Rules

## Security Analysis Framework

### Critical Vulnerability Checklist
- [ ] Reentrancy attacks (all variants)
- [ ] Integer overflow/underflow
- [ ] Access control vulnerabilities
- [ ] Front-running vulnerabilities
- [ ] Time manipulation risks
- [ ] Denial of Service vectors
- [ ] Gas griefing opportunities
- [ ] Oracle manipulation risks
- [ ] Flash loan attack vectors
- [ ] Signature replay attacks

### Analysis Methodology

1. **Entry Point Analysis**
   - Map all external/public functions
   - Identify state-changing operations
   - Track fund flows

2. **State Transition Analysis**
   - Document all state changes
   - Verify state consistency
   - Check for race conditions

3. **Dependency Analysis**
   - External contract calls
   - Oracle dependencies
   - Library functions

### Security Patterns and Fixes

#### Reentrancy Prevention
```solidity
// Pattern 1: ReentrancyGuard
modifier nonReentrant() {
    require(!locked, "Reentrant call");
    locked = true;
    _;
    locked = false;
}

// Pattern 2: Checks-Effects-Interactions
// Always update state before external calls

// Pattern 3: Pull over Push
// Let users withdraw rather than sending
```

#### Access Control Implementation
```solidity
// Role-based access control
bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

function mint(address to, uint256 amount)
    external
    onlyRole(MINTER_ROLE)
{
    _mint(to, amount);
}
```

#### Input Validation
```solidity
function transfer(address to, uint256 amount) external {
    // Comprehensive input validation
    require(to != address(0), "Invalid recipient");
    require(to != address(this), "Cannot transfer to self");
    require(amount > 0, "Amount must be positive");
    require(amount <= balanceOf(msg.sender), "Insufficient balance");

    // Safe transfer logic
}
```

## Automated Security Tools Integration

### Static Analysis with Slither
Key detectors to focus on:
- reentrancy-eth, reentrancy-no-eth
- unchecked-transfer
- incorrect-equality
- uninitialized-state
- locked-ether

### Formal Verification Considerations
- Define invariants for critical properties
- Write properties for fuzzing
- Specify pre/post conditions

## Security Report Format
1. **Executive Summary**
2. **Severity Classification** (Critical/High/Medium/Low/Info)
3. **Detailed Findings** with code locations
4. **Proof of Concept** (if applicable)
5. **Recommended Fixes** with code examples
6. **Gas Impact** of security measures
```

### 1.6 テスト特化ルール（test-rules）

```markdown
# Solidity Testing Specialist Rules

## Testing Philosophy
Every line of code must be tested. Every edge case must be considered.
Tests are documentation. Tests are the safety net.

## Foundry Testing Standards

### Test File Organization
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MyContract.sol";

contract MyContractTest is Test {
    // ============ Test Storage ============
    MyContract public myContract;
    address public owner = address(0x1);
    address public user = address(0x2);
    address public attacker = address(0x3);

    // ============ Setup ============
    function setUp() public {
        vm.startPrank(owner);
        myContract = new MyContract();
        vm.stopPrank();

        // Fund test accounts
        vm.deal(user, 100 ether);
        vm.deal(attacker, 100 ether);
    }

    // ============ Unit Tests ============
    function test_ConstructorSetsOwner() public {
        assertEq(myContract.owner(), owner);
    }

    function test_RevertWhen_CallerNotOwner() public {
        vm.prank(user);
        vm.expectRevert("Ownable: caller is not the owner");
        myContract.onlyOwnerFunction();
    }

    // ============ Fuzz Tests ============
    function testFuzz_Deposit(uint256 amount) public {
        vm.assume(amount > 0 && amount <= 100 ether);
        vm.prank(user);
        myContract.deposit{value: amount}();
        assertEq(myContract.balanceOf(user), amount);
    }

    // ============ Invariant Tests ============
    function invariant_TotalSupplyEqualsSum() public {
        // Total supply always equals sum of all balances
    }

    // ============ Integration Tests ============
    function test_Integration_FullUserFlow() public {
        // Complete user journey test
    }

    // ============ Security Tests ============
    function test_Security_ReentrancyAttack() public {
        // Deploy attacker contract
        // Attempt reentrancy
        // Assert attack failed
    }
}
```

### Testing Patterns

#### State Transition Tests
```solidity
function test_StateTransition_Deposit() public {
    uint256 initialBalance = myContract.balanceOf(user);
    uint256 depositAmount = 1 ether;

    vm.prank(user);
    myContract.deposit{value: depositAmount}();

    // Verify all state changes
    assertEq(myContract.balanceOf(user), initialBalance + depositAmount);
    assertEq(myContract.totalSupply(), depositAmount);
    assertEq(address(myContract).balance, depositAmount);
}
```

#### Edge Case Testing
```solidity
function test_EdgeCase_MaxUint256() public {
    uint256 maxAmount = type(uint256).max;
    // Test behavior at maximum values
}

function test_EdgeCase_ZeroAmount() public {
    vm.expectRevert("Amount must be greater than 0");
    myContract.transfer(user, 0);
}
```

#### Gas Testing
```solidity
function test_GasConsumption_CriticalFunctions() public {
    uint256 gasStart = gasleft();
    myContract.criticalFunction();
    uint256 gasUsed = gasStart - gasleft();

    // Assert gas is within acceptable range
    assertLt(gasUsed, 100000, "Gas consumption too high");
}
```

## Test Coverage Requirements
- Line Coverage: >= 95%
- Branch Coverage: >= 90%
- Function Coverage: 100%
- All modifiers must be tested
- All error conditions must be tested
- All events must be verified
```

### 1.7 最適化特化ルール（optimize-rules）

```markdown
# Solidity Optimization Specialist Rules

## Gas Optimization Priority Matrix

| Optimization Type | Impact | Difficulty | Priority |
|------------------|--------|------------|----------|
| Storage Layout | High | Medium | Critical |
| Storage vs Memory | High | Low | Critical |
| Loop Optimization | High | Medium | High |
| Function Visibility | Medium | Low | High |
| Arithmetic Optimization | Low | Low | Medium |

## Storage Optimization Patterns

### Variable Packing
```solidity
// Before: 3 storage slots (96 bytes)
contract Inefficient {
    uint256 amount;     // Slot 0
    address owner;      // Slot 1 (20 bytes wasted)
    uint256 timestamp;  // Slot 2
}

// After: 2 storage slots (64 bytes)
contract Optimized {
    uint256 amount;     // Slot 0
    address owner;      // Slot 1 (20 bytes)
    uint96 timestamp;   // Slot 1 (12 bytes)
}
```

### Storage Reading Optimization
```solidity
// Before: Multiple SLOAD operations
function inefficient() public view returns (uint256) {
    return balances[msg.sender] + balances[msg.sender] * rate;
}

// After: Single SLOAD operation
function optimized() public view returns (uint256) {
    uint256 balance = balances[msg.sender];
    return balance + balance * rate;
}
```

### Mapping vs Array
```solidity
// Use mappings for single lookups
mapping(address => uint256) public balances;

// Use arrays only when iteration is required
address[] public holders;
```

## Computation Optimization

### Unchecked Blocks
```solidity
// When overflow is impossible
function increment(uint256 x) public pure returns (uint256) {
    unchecked {
        return x + 1; // Save gas when x < max - 1
    }
}
```

### Short-Circuit Evaluation
```solidity
// Order conditions by likelihood and cost
function optimizedCheck(uint256 x, uint256 y) public view {
    // Check cheap local variable first
    if (x == 0 || expensive_storage_check()) {
        // ...
    }
}
```

### Loop Optimization
```solidity
// Cache array length
uint256 length = array.length;
for (uint256 i; i < length;) {
    // Process array[i]
    unchecked { ++i; }
}
```

## Function Optimization

### Visibility Optimization
- `external` over `public` (no ABI encoding for external)
- `private` over `internal` when inheritance not needed
- `pure` over `view` when no state reading
- `view` over regular when no state changes

### Parameter Optimization
```solidity
// Use calldata for read-only arrays/strings
function process(uint256[] calldata data) external {
    // More efficient than memory for read-only
}

// Return storage references when possible
function getUser(address addr) external view returns (User storage) {
    return users[addr];
}
```

## Optimization Checklist
- [ ] Storage variables packed efficiently
- [ ] Hot variables separated from cold
- [ ] Loops optimized (cached length, unchecked increment)
- [ ] External functions use calldata
- [ ] Storage reads cached in local variables
- [ ] Unnecessary SLOADs eliminated
- [ ] Events used instead of storage for logs
- [ ] Short-circuit evaluation ordered correctly
- [ ] Unchecked arithmetic where safe
- [ ] Function visibility optimized
```

---

## 第2部: 各AIツール固有の適用方法 🔧

### 2.1 AIツール別設定マトリックス

| AIツール | 設定ファイル | 設定方法 | 特有の機能 |
|---------|------------|---------|-----------|
| **Cursor** | `.cursorrules` | プロジェクトルートに配置 | ファイル単位のルール適用 |
| **Claude Code** | Project Instructions | UI経由で設定 | MCPツール連携 |
| **Amazon Q** | `.amazonq/` | CLIコマンドで設定 | AWS統合 |
| **GitHub Copilot** | `.github/copilot/` | リポジトリ設定 | GitHub統合 |
| **Continue** | `.continue/config.json` | JSON設定 | カスタムプロバイダー |

### 2.2 Cursor向け設定

```markdown
# .cursorrules 配置と構成

プロジェクトルート/
├── .cursorrules              # メインルール
├── .cursorrules.folder/      # フォルダ別ルール
│   ├── contracts/
│   │   └── .cursorrules     # コントラクト専用
│   └── test/
│       └── .cursorrules     # テスト専用
```

### 2.3 Claude Code向け設定

Claude Codeは Project Instructions 機能を使用：
1. プロジェクトを開く
2. Project Instructions に設定
3. MCPサーバーと連携して動的にルール適用

### 2.4 Amazon Q Developer向け設定

```bash
# Amazon Q は workspace 設定を使用
.amazonq/
├── instructions.md    # ルールファイル
├── context.json      # コンテキスト設定
└── tools.json        # ツール統合設定
```

### 2.5 GitHub Copilot向け設定

```markdown
# .github/copilot-instructions.md

GitHub Copilot 専用の設定。
リポジトリレベルで適用され、
すべてのコントリビューターに共有される。
```

---

## 第3部: CLIツール計画（将来の実装） 💻

### 3.1 アーキテクチャ概要

TypeScript/Node.jsベースの拡張可能なCLIツール：

```typescript
// CLI アーキテクチャ（概念）
interface SolidityAgentCLI {
  // コア機能
  init(): Promise<void>;           // プロジェクト初期化
  applyRules(): Promise<void>;     // ルール適用
  switchAgent(): Promise<void>;    // エージェント切り替え

  // 分析機能
  analyze(): Promise<AnalysisResult>;
  security(): Promise<SecurityReport>;
  optimize(): Promise<OptimizationReport>;

  // 統合機能
  integrate(): Promise<void>;      // ツール統合
  generate(): Promise<void>;       // テンプレート生成
}
```

### 3.2 技術スタック（計画）

```json
{
  "dependencies": {
    "yargs": "^17.0.0",           // CLI フレームワーク
    "commander": "^11.0.0",       // 代替CLI フレームワーク
    "chalk": "^5.0.0",            // カラー出力
    "inquirer": "^9.0.0",         // 対話式プロンプト
    "ora": "^6.0.0",              // スピナー/プログレス
    "cosmiconfig": "^8.0.0",      // 設定ファイル管理
    "zod": "^3.0.0"               // スキーマ検証
  }
}
```

### 3.3 コマンド体系（抽象設計）

```bash
# 初期化
solidity-agent init [options]
  --framework <foundry|hardhat>
  --ai-tool <cursor|claude|amazonq|copilot>

# ルール管理
solidity-agent rules
  apply <agent-type>      # ルール適用
  create <name>          # カスタムルール作成
  merge <rules...>       # ルール統合
  validate              # ルール検証

# 分析
solidity-agent analyze
  security [contract]    # セキュリティ分析
  gas [contract]        # ガス分析
  coverage             # カバレッジ分析

# 生成
solidity-agent generate
  template <type>      # テンプレート生成
  test <contract>     # テスト生成
  interface <contract> # インターフェース生成
```

### 3.4 拡張性の考慮

```typescript
// プラグインシステム（概念）
interface SolidityAgentPlugin {
  name: string;
  version: string;

  // ライフサイクルフック
  onInit?(): Promise<void>;
  onAnalyze?(): Promise<void>;
  onGenerate?(): Promise<void>;

  // カスタムコマンド
  commands?: CommandDefinition[];

  // ルール拡張
  rules?: RuleDefinition[];
}
```

---

## 第4部: 実装ロードマップ 📅

### Phase 1: ルールファイル整備（即実施可能）

**期間**: 1-2週間

- [ ] 5つの特化ルールファイル作成
- [ ] 各AIツール向けのサンプル設定
- [ ] ルール適用ガイドライン作成
- [ ] テストプロジェクトでの検証

### Phase 2: 基本ツール実装（1ヶ月）

**期間**: 3-4週間

- [ ] TypeScript プロジェクトセットアップ
- [ ] 基本CLIコマンド実装（init, apply）
- [ ] 各AIツール向けアダプター作成
- [ ] 基本的なテストスイート

### Phase 3: 高度な機能（2-3ヶ月）

**期間**: 8-12週間

- [ ] セキュリティ分析統合
- [ ] ガス最適化分析
- [ ] テンプレート生成システム
- [ ] プラグインシステム

### Phase 4: エコシステム統合（継続的）

- [ ] Foundry/Hardhat 深層統合
- [ ] CI/CD パイプライン統合
- [ ] VS Code Extension
- [ ] Web UI Dashboard

---

## 第5部: 品質保証とベストプラクティス ✅

### 5.1 ルールファイル品質チェックリスト

| カテゴリ | チェック項目 | 重要度 |
|---------|------------|--------|
| **完全性** | すべての開発フェーズをカバー | Critical |
| **具体性** | 具体的なコード例を含む | High |
| **一貫性** | 命名規則、スタイルの統一 | Medium |
| **保守性** | 定期的な更新、バージョン管理 | High |
| **互換性** | 各AIツールでの動作確認 | Critical |

### 5.2 導入時の推奨プロセス

1. **評価フェーズ**
   - 現在の開発プロセスの分析
   - 適用するルールセットの選定
   - パイロットプロジェクトの選定

2. **導入フェーズ**
   - ルールファイルのカスタマイズ
   - チームメンバーへのトレーニング
   - 段階的な適用（まず設計、次に開発...）

3. **最適化フェーズ**
   - フィードバックの収集
   - ルールの調整
   - ベストプラクティスの文書化

### 5.3 成功指標

| 指標 | 目標値 | 測定方法 |
|------|--------|---------|
| セキュリティ脆弱性削減 | 80%減 | Slither/Mythril検出数 |
| 開発速度向上 | 30%向上 | PRマージまでの時間 |
| コードカバレッジ | 90%以上 | Foundry coverage |
| ガス効率改善 | 20%削減 | Gas reporter |

---

## まとめ

本計画は、Solidityスマートコントラクト開発における品質とセキュリティを向上させるための包括的なルールファイル整備計画です。

**重要なポイント**：
1. **ルールファイル優先** - まず高品質なルールファイルを整備
2. **段階的実装** - CLIツールは後から段階的に実装
3. **AIツール非依存** - 各ツールの特性を活かしつつ、共通ルールを維持
4. **拡張性重視** - 将来の機能追加を考慮した設計

**次のアクション**：
1. 5つの特化ルールファイルの作成開始
2. パイロットプロジェクトでの検証
3. チームフィードバックの収集
4. TypeScript CLIの基本実装開始

---

*Document Version: 3.0.0*
*Last Updated: 2025-01-03*
*Focus: Solidity rule files with extensible CLI planning*