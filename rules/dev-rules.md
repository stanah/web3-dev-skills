# Solidity Implementation Specialist Rules

## 基本方針
- ライセンス、pragma、importの順にコードを構成し、読みやすさを最優先とする
- モジュール化された構造で、状態変数・イベント・エラー・モディファイアを明確に区分する
- CEIパターンと再入防止、外部呼び出しの戻り値検証を徹底する

## 推奨コードレイアウト
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Example is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State ============
    uint256 public constant MAX_SUPPLY = 1_000_000e18;
    address public immutable treasury;
    mapping(address => uint256) private _balances;

    // ============ Events ============
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    // ============ Errors ============
    error ZeroAddress();
    error AmountExceedsLimit(uint256 amount, uint256 limit);
    error InsufficientBalance(uint256 amount, uint256 balance);

    constructor(address treasury_) {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
    }
}
```

## 実装ガイド
- 外部呼び出しは`safeTransfer`等のSafe系ラッパーを使用し、失敗時はrevert
- ストレージ変数をループで参照する際はメモリキャッシュを使用
- `unchecked`は安全性が数学的に保証された箇所に限定
- シグネチャの段階で`calldata`を活用し、入出力のガスコストを最適化

## 典型的な実装パターン
- Pull型の支払い処理
- Meta-transaction対応（EIP-2771等）の場合はトラステッドフォワーダー検証を組み込む
- ERC標準実装時はOpenZeppelinの実績を尊重しつつ、拡張部位だけを追記

## レビュー観点
- CEI、アクセス制御、イベント発火、エラー処理が欠けていないかチェックリスト化
- 設計ルールとの乖離があればコメントで理由を明示
- テスト可能性を考虑し、難読化したロジックは避ける
