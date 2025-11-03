# Solidity Introduction Cross Reference

Solidity公式ドキュメント「[Introduction to Smart Contracts](https://docs.soliditylang.org/en/latest/introduction-to-smart-contracts.html)」と当リポジトリのルールファイル群 (`rules/*.md`、各エージェント設定) の対応状況を整理した一覧です。ステータスは以下で表現します。

- ✅: 公式ガイドの要点を現ルールでカバーできている
- ⚠️: 一部は触れているが具体性や網羅性が不足
- ❌: 現状のルールでは未カバー

## セクション別対応状況

| 公式セクション | 主なトピック | カバー状況 | 関連ルール/設定 | 追加で必要な観点 |
| --- | --- | --- | --- | --- |
| A Simple Smart Contract | SPDXライセンス、`pragma`, 状態変数、イベント、決定論的関数 | ✅ | `rules/dev-rules.md`, `.github/copilot-instructions.md` | 公式例をベースに最小サンプルや推奨コメントを掲載すると教育効果が高い |
| Storage Example | ストレージの初期化、複合型、`storage`/`memory`の指針 | ✅ | `rules/design-rules.md`, `rules/dev-rules.md`, `rules/test-rules.md` | 代表的なストレージ配置図とゼロ値の表を追加するとさらに親切 |
| Subcurrency Example | `mapping`, `require`, エラー処理、イベント発火 | ✅ | `rules/dev-rules.md`, `rules/security-rules.md` | ERC系標準との比較表を作成すると理解を深められる |
| Blockchain Basics | 取引、ブロック、処理順序の基礎 | ✅ | `rules/base-rules.md` | コンセンサス最終性や再編監視ツールの紹介を追加検討 |
| The EVM: Overview & Accounts | EOA/コントラクト口座、`nonce`, balance | ✅ | `rules/base-rules.md`, `rules/security-rules.md` | L2特有の`nonce`管理差分の事例を収集しておく |
| Transactions & Gas | ガス価格、ガス使用、リバート時の挙動 | ✅ | `rules/base-rules.md`, `rules/optimize-rules.md` | `gasleft`を利用した境界テスト例を追加予定 |
| Storage, Memory and the Stack | データ領域分類、`storage`/`memory`/`calldata`/`stack`制限 | ✅ | `rules/design-rules.md`, `rules/dev-rules.md`, `rules/test-rules.md` | スタック深度限界16のケーススタディを補う余地あり |
| Calldata, Returndata and Code | ABIエンコード、イミュータブルコード領域 | ⚠️ | `rules/dev-rules.md`, `rules/security-rules.md` | `returndata`長の検証、コードサイズ制限、`abi.decode`の失敗時挙動を追加する |
| Instruction Set | EVM命令（`SSTORE`, `CALL`, `DELEGATECALL`など）の概要 | ⚠️ | `rules/security-rules.md`, `rules/optimize-rules.md` | 主要命令のガス表と危険性まとめを別資料化する |
| Message Calls | `call`/`staticcall`/`delegatecall`/`callcode`の違い | ✅ | `rules/dev-rules.md`, `rules/security-rules.md`, `rules/test-rules.md` | 実際の試験コード断片をライブラリ化すると便利 |
| Delegatecall and Libraries | ライブラリリンク、プロキシパターンのリスク | ✅ | `rules/design-rules.md`, `rules/dev-rules.md`, `rules/security-rules.md` | Storage衝突検知スクリプト例を追加検討 |
| Logs and Events | ログ構造、`indexed`パラメータ、トピック | ✅ | `rules/dev-rules.md`, `rules/test-rules.md`, `rules/design-rules.md` | モニタリングダッシュボードの実例を共有したい |
| Create | コントラクトデプロイ、`CREATE2`、初期コード | ✅ | `rules/design-rules.md`, `rules/dev-rules.md` | `CREATE`/`CREATE2`のガス比較と再デプロイ戦略を追記余地あり |
| Deactivate and Self-destruct | `selfdestruct`の非推奨化、状態ロス | ✅ | `rules/dev-rules.md`, `rules/security-rules.md` | Legacy移行SOPのテンプレートを追加すると実務で役立つ |
| Precompiled Contracts | プリコンパイルの一覧とガスコスト | ⚠️ | `rules/base-rules.md`, `rules/security-rules.md` | プリコンパイル別の入出力制約とガス表を別紙化する |

## 優先的に補完したい領域

1. **`Calldata/Returndata and Code`の詳細化**: `abi.encode/decode`の失敗時ハンドリング、ランタイムコードと初期コードの違い、`returndata`長検証をルールへ明文化する。
2. **EVM命令の整理**: 主要命令のガス特性・危険性・利用指針を別資料もしくはルール付録として追加する。
3. **プリコンパイル活用ガイド**: 各プリコンパイルの入力制約と推奨用途を一覧化し、関連ルールから参照できるようにする。
4. **教育用サンプルの整備**: 公式ガイドに沿った短い実装・テスト例を`rules`ディレクトリか付録資料として提供し、学習コストを下げる。
5. **定期レビューの運用**: 既に設定した四半期レビューが実施されたかを記録し、ルール更新履歴に反映させる。

この一覧をもとに、ルールファイルへ具体的な追加・修正を行うことでSolidity公式ガイドとの整合性をさらに高められる。
