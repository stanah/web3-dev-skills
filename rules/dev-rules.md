# Solidity Implementation Specialist Rules

## 基本方針
- ライセンス、pragma、importの順にコードを構成し、読みやすさを最優先とする
- モジュール化された構造で、状態変数・イベント・エラー・モディファイアを明確に区分する
- CEIパターンと再入防止、外部呼び出しの戻り値検証を徹底する
- Solidity言語仕様に沿い、型/可視性/データ位置/エラー処理/特殊関数（constructor/fallback/receive）をチェックリスト化して実装する

## 推奨コードレイアウト
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

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
- 可視性は`external`/`public`/`internal`/`private`を明示し、`pure`/`view`/`payable`の付け忘れを防止
- `receive`/`fallback`は必要最小限とし、ガススタイペンドとイベント通知を検討
- `abi.encodeWithSelector`でローレベルコールを行い、`bool success`と`returndata`を厳格に検証する
- アセンブリ使用時は検証済み根拠と境界チェックをコメントに残し、代替手段が無い場合のみ許容
- アップグレード可能コントラクトでは`initializer`/`reinitializer`管理とストレージギャップ調整を行う
- `storage`/`memory`/`calldata`/`transient`のデータ配置を正しく宣言し、`storage`ポインタの参照コピーによる副作用を事前にレビューする
- `mapping`・`struct`の既定値・自動ゲッター挙動を理解した上で、アクセス制御やゼロ値検証を実装する
- イベントは`indexed`上限（3つ）を意識し、外部でのトレース容易性を優先したフィールド構造にする
- `delegatecall`/ライブラリ呼び出しはストレージスロット互換性を確認し、結果が残りやすい状態変化を伴う場合は`no delegatecall`レイヤでガードする
- `try/catch`で外部呼び出し失敗を制御し、`Error(string)`/`Panic(uint256)`/カスタムエラーを適切に処理する

## 典型的な実装パターン
- Pull型の支払い処理
- Meta-transaction対応（EIP-2771等）の場合はトラステッドフォワーダー検証を組み込む
- ERC標準実装時はOpenZeppelinの実績を尊重しつつ、拡張部位だけを追記
- クロスチェーンメッセージではリプレイ・順序・信頼境界を明示し、受信処理前にブリッジコントラクトの真正性を検証
- オラクル連携では最新値スタンプ、許容遅延、サニティチェックを加える
- `CREATE2`を用いる場合はサルト・初期コード・デプロイ済みチェックを組み合わせ、アドレス衝突を回避する
- `selfdestruct`を用いるLegacyコードは置換パターン（Pausable移行、プロキシ切替）を示し、新規利用は完全禁止とする

## レビュー観点
- CEI、アクセス制御、イベント発火、エラー処理が欠けていないかチェックリスト化
- 設計ルールとの乖離があればコメントで理由を明示
- テスト可能性を考虑し、難読化したロジックやグローバル状態依存を避ける
- 静的解析（Slither、Mythril等）の指摘を精査し、根拠ある無視理由を記録する
- Solidity公式Introduction各節（イベント、データ位置、ローレベルコール、プリコンパイル等）の観点が実装で満たされているかクロスチェックする
