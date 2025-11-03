# Solidity Introduction Cross Reference

Solidity公式ドキュメント「[Introduction to Smart Contracts](https://docs.soliditylang.org/en/latest/introduction-to-smart-contracts.html)」と当リポジトリのルールファイル群 (`rules/*.md`、各エージェント設定) の対応状況を整理した一覧です。ステータスは以下で表現します。

- ✅: 公式ガイドの要点を現ルールでカバーできている
- ⚠️: 一部は触れているが具体性や網羅性が不足
- ❌: 現状のルールでは未カバー

## セクション別対応状況

| 公式セクション | 主なトピック | カバー状況 | 関連ルール/設定 | 追加で必要な観点 |
| --- | --- | --- | --- | --- |
| A Simple Smart Contract | SPDXライセンス、`pragma`, 状態変数、イベント、決定論的関数 | ✅ | `rules/dev-rules.md`, `.github/copilot-instructions.md` | 公式例をベースに最小サンプルや推奨コメントを掲載すると教育効果が高い |
| Storage Example | ストレージの初期化、複合型、`storage`/`memory`の指針 | ⚠️ | `rules/design-rules.md`, `rules/optimize-rules.md` | ストレージとメモリの使い分け、格納順序の具体例、既定値の説明を明文化する |
| Subcurrency Example | `mapping`, `require`, エラー処理、イベント発火 | ⚠️ | `rules/dev-rules.md`, `rules/security-rules.md` | `mapping`のアクセサ生成、イベントインデックスの解説、ERC設計との繋がりを補う |
| Blockchain Basics | 取引、ブロック、処理順序の基礎 | ❌ | - | トランザクションのライフサイクル、ブロック内の順序、コンセンサス由来の注意点をルールに加える |
| The EVM: Overview & Accounts | EOA/コントラクト口座、`nonce`, balance | ⚠️ | `rules/base-rules.md`, `rules/security-rules.md` | アカウント種別ごとのリスク、`nonce`衝突・リプレイ対策、L2差異の補足を追加する |
| Transactions & Gas | ガス価格、ガス使用、リバート時の挙動 | ⚠️ | `rules/base-rules.md`, `rules/optimize-rules.md` | ガス返金、`gasleft`の正確な扱い、EIP-1559ベースの料金説明を追記 |
| Storage, Memory and the Stack | データ領域分類、`storage`/`memory`/`calldata`/`stack`制限 | ⚠️ | `rules/design-rules.md`, `rules/dev-rules.md`, `rules/test-rules.md` | スタック深度制限、メモリ伸長コスト、`calldata`コピーの注意点をチェックリスト化 |
| Calldata, Returndata and Code | ABIエンコード、イミュータブルコード領域 | ❌ | - | `abi.encode`/`decode`の安全な使い方、コードサイズ制限、初期コード vs ランタイムコードの違いをルール化 |
| Instruction Set | EVM命令（`SSTORE`, `CALL`, `DELEGATECALL`など）の概要 | ❌ | - | 重要命令のガス特性と安全性、`CREATE2`使用時の注意をサマリとして追加する |
| Message Calls | `call`/`staticcall`/`delegatecall`/`callcode`の違い | ⚠️ | `rules/security-rules.md` | `delegatecall`によるストレージ汚染、`staticcall`での状態書き換え禁止など具体的な安全ガイドを追記 |
| Delegatecall and Libraries | ライブラリリンク、プロキシパターンのリスク | ❌ | - | `delegatecall`/ライブラリセキュリティ、ストレージレイアウト互換性チェックを設計・実装ルールに追加する |
| Logs and Events | ログ構造、`indexed`パラメータ、トピック | ⚠️ | `rules/dev-rules.md`, `rules/test-rules.md` | イベント設計ベストプラクティス、インデックス数とフィルタリング戦略、監視要件を具体化 |
| Create | コントラクトデプロイ、`CREATE2`、初期コード | ❌ | - | デプロイパターン、`CREATE2`サルト計算、バイトコードサイズ制限をルールに加える |
| Deactivate and Self-destruct | `selfdestruct`の非推奨化、状態ロス | ❌ | - | `selfdestruct`回避方針、既存コントラクトの扱い、破壊後のエイドレス挙動を記述 |
| Precompiled Contracts | プリコンパイルの一覧とガスコスト | ❌ | - | 主要プリコンパイル(call to ecrecover, sha256 等)と利用時の注意を整理 |

## 優先的に補完したい領域

1. **EVM低レイヤの詳細**: `delegatecall`、`selfdestruct`、`CREATE2`など重大リスクに直結する項目が未カバーのため、`rules/security-rules.md`と`rules/design-rules.md`へ安全対策を追加する。
2. **データ領域の明文化**: `storage`/`memory`/`calldata`/`transient storage`の使い分けとコストをチェックリスト化し、`rules/dev-rules.md`と`rules/test-rules.md`に反映する。
3. **イベントとログのベストプラクティス**: 監視・インデックス化・サブグラフ連携を`rules/dev-rules.md`/`.amazon-q/instructions.md`に追記する。
4. **トランザクション・ガスガイド**: EIP-1559料金モデルやガス返金の扱いを`rules/optimize-rules.md`と`.continue/config.json`に補足する。
5. **公式ドキュメントの追跡運用**: SolidityリリースノートとIntroduction更新を定期確認するプロセスをエージェント設定に追加する。

この一覧をもとに、ルールファイルへ具体的な追加・修正を行うことでSolidity公式ガイドとの整合性をさらに高められる。
