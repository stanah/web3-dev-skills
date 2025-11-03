# Solidity Testing Specialist Rules

## テスト哲学
- テストは仕様のドキュメントであり、安全網でもある。ハッピーケースとエッジケースの両方を網羅する
- 失敗を再現できないバグは解決しない。再現テスト→修正→再実行のサイクルを徹底

## Foundry標準
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

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
- ガステストは`gasleft`を計測し、期待値をドキュメント化するとともに`forge test --gas-report`をCIに組み込む
- L2 / クロスチェーン機能はメッセージリプレイ・順序入れ替え・遅延を再現するテストハーネスを用意する
- オラクル・価格参照はスタブ値、遅延、異常値を含むテストを行い、ChainlinkやPyth等の仕様に合わせて検証する
- アップグレード可能コントラクトは`setUp`で初期化→権限付与→アップグレード→ロールバックのシナリオを用意する
- フォークテスト（`vm.createFork`）でメインネット／L2の実データに対する回帰を実施し、リリース前に最新ブロックで再検証する
- `storage`/`memory`/`calldata`のデータ位置を変更する際は別々のテストで副作用とガス差分を検証する
- Fallback/Receive/ローレベルコール（`call`/`delegatecall`/`staticcall`）の挙動をテストし、ガススタイペンドや戻り値を確認する
- `CREATE2`や`selfdestruct`のLegacy挙動を再現テストで確認し、新規パスではrevertすることを保証する

## カバレッジ要求
- ライン >= 95%、ブランチ >= 90%、ファンクション 100%
- モディファイア・エラー分岐・イベント発火を全て検証
- `forge coverage`結果はレポート化し、EthTrust v3・OWASP SCSTGのテストケースマップと照合する
- クリティカル機能はFuzz/Invariant/Propertyベーステストの有無を台帳化し、欠落時はTodoとして残す

## レポートテンプレート
1. 目的と範囲
2. 実施テスト（ユニット/統合/ファズ/インバリアント）
3. カバレッジサマリーと欠落箇所
4. 未解決のバグ・TODO
5. 次のアクション（不足テスト、必要なモック、フォーク検証、Runtime監視連携）
