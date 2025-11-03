# Amazon Q Developer CLI カスタムエージェント設定手順

本リポジトリでは `.amazonq/cli-agents/` 配下に、Solidity開発フェーズごとのカスタムエージェントを定義しています。Amazon Q Developer CLI (v0.67.0 以降) のカスタムエージェント機能に対応しており、任意のリポジトリから同じルールを利用できます。

## セットアップ手順

### 方法1: リポジトリ内で直接使用（推奨）

本リポジトリには既に `.amazonq/cli-agents/` 配下にエージェント定義が含まれています。リポジトリをクローン後、そのまま使用できます：

```bash
# リポジトリをクローンまたは更新
git clone <repository-url>
cd web3-dev-agent

# そのまま使用可能（追加のセットアップ不要）
q chat --agent solidity-base
q chat --agent solidity-design
q chat --agent solidity-dev
q chat --agent solidity-security
q chat --agent solidity-test
q chat --agent solidity-optimize
```

**メリット:**
- 追加のセットアップ不要
- リポジトリと設定が一体化して管理される
- チームメンバー間で同じ設定を共有できる
- ローカル定義がグローバル定義より優先される

### 方法2: グローバルにインストール

複数のプロジェクトで同じエージェントを使用したい場合：

1. Amazon Q Developer CLI を最新化します。`q version` でバージョンを確認し、0.67.0 以上であることを確認してください。
2. 本リポジトリをクローン（または更新）します。
3. 依存をセットアップしてカスタムエージェントをホームディレクトリにコピーします。

```bash
pnpm install    # 初回のみ
pnpm amazonq:install
```

4. 任意のプロジェクトで、次のコマンドでエージェントを起動できます。

```bash
q chat --agent solidity-base
q chat --agent solidity-design
q chat --agent solidity-dev
q chat --agent solidity-security
q chat --agent solidity-test
q chat --agent solidity-optimize
```

## エージェント構成の概要

| エージェント名 | 役割 | 主なリソース | 主用途 |
| --- | --- | --- | --- |
| `solidity-base` | 共通原則・公式ガイド照合 | `rules/base-rules.md`, `docs/solidity-intro-crossref.md` | ルール参照・ポリシー確認 |
| `solidity-design` | 設計・脅威モデリング | `rules/design-rules.md` | アーキテクチャ提案、ストレージ設計 |
| `solidity-dev` | 実装・TDD | `rules/dev-rules.md`, `rules/security-rules.md` | 実装方針、テスト駆動 |
| `solidity-security` | セキュリティレビュー | `rules/security-rules.md`, `rules/dev-rules.md` | 脆弱性分析、修正提案 |
| `solidity-test` | Foundryテスト | `rules/test-rules.md`, `rules/dev-rules.md` | テスト設計、カバレッジ改善 |
| `solidity-optimize` | ガス最適化 | `rules/optimize-rules.md`, `rules/dev-rules.md` | ガス測定、最適化評価 |

各エージェントは `task-master` MCPを有効化し、`fs_read` と必要に応じた `shell_readonly` コマンド（Foundry、Slither、Echidna、gas snapshotなど）を許可しています。

## エージェントの優先順位

Amazon Q CLIは以下の順序でカスタムエージェントを探します：

1. **ローカルカスタムエージェント**（プロジェクトディレクトリ内の `.amazonq/cli-agents/`）
2. **グローバルカスタムエージェント**（ホームディレクトリ内の `~/.aws/amazonq/cli-agents/`）
3. **組み込みのデフォルトエージェント**

同じ名前のエージェントがローカルとグローバルの両方に存在する場合、ローカルが優先されます。

## 他リポジトリでの利用

### リポジトリに配置する場合

このリポジトリの `.amazonq/cli-agents/` ディレクトリをそのままコピーして、他のプロジェクトのリポジトリに配置できます：

```bash
cp -r .amazonq <他のプロジェクトのルートディレクトリ>/
```

リポジトリに配置すると：
- プロジェクト固有の設定として管理できる
- チームメンバーと設定を共有できる
- バージョン管理できる

### グローバルにインストールする場合

- `~/.aws/amazonq/cli-agents/` にコピーされたファイルは全プロジェクトで共有されます。必要なエージェント名を指定して呼び出してください。
- ルール更新後は、再度 `pnpm amazonq:install` を実行して共有定義を上書きしてください。

## 注意事項

- スクリプトはホームディレクトリへの書き込みを行います。権限が必要な環境では適宜sudoや手動コピーを検討してください。
- `shell_readonly` に登録されていないコマンドを実行する場合は、対話中に明示的な許可が必要です。
- MCPサーバや追加ツールを使用したい場合は `.amazonq/cli-agents/solidity-rules.json` を編集し、再インストールしてください。
