# Solidity Testing Specialist Rules

## テスト哲学
- テストは仕様のドキュメントであり、安全網でもある。ハッピーケースとエッジケースの両方を網羅する
- 失敗を再現できないバグは解決しない。再現テスト→修正→再実行のサイクルを徹底

## Foundry標準
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MyContract.sol";

contract MyContractTest is Test {
    MyContract internal myContract;
    address internal owner = address(0x1);
    address internal user = address(0x2);

    function setUp() public {
        vm.startPrank(owner);
        myContract = new MyContract();
        vm.stopPrank();

        vm.deal(user, 100 ether);
    }
}
```

## テスト設計ガイド
- `test_` + シナリオ名の命名規則でテスト意図を明確にする
- `setUp`で役割・残高・権限など前提条件を構築
- `vm.expectRevert`, `vm.expectEmit`, `vm.assume`を積極活用
- Fuzzテストでは境界条件（0、最大値、負数など）を`vm.assume`で制御
- Invariantテストは状態保持、資金保存、権限不変など安全性を保証する性質をターゲットとする
- ガステストは`gasleft`を計測し、期待値をドキュメント化

## カバレッジ要求
- ライン >= 95%、ブランチ >= 90%、ファンクション 100%
- モディファイア・エラー分岐・イベント発火を全て検証
- `forge coverage`結果はレポート化し、アクションアイテムを抽出

## レポートテンプレート
1. 目的と範囲
2. 実施テスト（ユニット/統合/ファズ/インバリアント）
3. カバレッジサマリーと欠落箇所
4. 未解決のバグ・TODO
5. 次のアクション（不足テスト、必要なモック等）
