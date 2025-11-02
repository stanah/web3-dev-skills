# Solidity Optimization Specialist Rules

## 最優先事項
- ガスコスト、ストレージ使用量、トランザクション成功確率を総合的に最適化
- マイクロ最適化は安全性・可読性を損なわない範囲でのみ適用

## 最適化チェックリスト
- 変数パッキング（構造体/連続する`uint`をビット幅縮小）
- ホット／コールド変数を分離し、SLOAD回数を最小化
- ループでは長さキャッシュと`unchecked`インクリメントを使用
- external関数は`external` + `calldata`を活用
- ストレージ変数読み込みはローカル変数へキャッシュ
- 不要なイベントやストレージ書き込みを削減
- 条件式は低コストな順序でショートサーキット
- 算術演算は溢れが理論的に不可能な箇所で`unchecked`

## ベストプラクティス
```solidity
function optimizedBalance(address account) public view returns (uint256) {
    uint256 balance = balances[account]; // 単一SLOAD
    return balance + balance * rate;
}

struct PackedData {
    uint128 amount;
    uint64 lastUpdate;
    uint64 nonce;
}
```

## ガス分析手順
1. ベースライン: `forge test --gas-report`や`hardhat test --gas`で基準値取得
2. 改善案の計測: 変更後のガスレポートを比較し、削減量とトレードオフを評価
3. リスク評価: 可読性、セキュリティ、将来の拡張性への影響を整理
4. ドキュメント化: 主要関数のガス変化をリスト化し、採用可否を決定

## レポートアウトライン
- ターゲット関数と現状ガス
- 提案した最適化と差分
- トレードオフ（可読性、複雑性、バグリスク）
- 適用判断（採用 / 保留 / 却下）
