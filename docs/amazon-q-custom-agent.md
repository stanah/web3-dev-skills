# Amazon Q Developer CLI カスタムエージェント設定手順

本リポジトリでは `.amazon-q/cli-agents/` 配下に、Solidity開発フェーズごとのカスタムエージェントを定義しています。Amazon Q Developer CLI (v0.67.0 以降) のカスタムエージェント機能に対応しており、任意のリポジトリから同じルールを利用できます。

## セットアップ手順

1. Amazon Q Developer CLI を最新化します。`q version` でバージョンを確認し、0.67.0 以上であることを確認してください。
2. 本リポジトリをクローン（または更新）します。
3. 以下のスクリプトを実行すると、ホームディレクトリの共有パス `~/.aws/amazonq/cli-agents/` にエージェント定義がまとめてコピーされます。

```bash
./scripts/install-amazonq-agent.sh
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

## 他リポジトリでの利用

- `~/.aws/amazonq/cli-agents/` にコピーされたファイルは全プロジェクトで共有されます。必要なエージェント名を指定して呼び出してください。
- ルール更新後は、再度 `./scripts/install-amazonq-agent.sh` を実行して共有定義を上書きしてください（既存ファイルは `*.backup-yyyymmddHHMMSS` 形式で自動バックアップされます）。
- プロジェクト固有のパスを参照させたい場合は、コピー後に各リポジトリの `.amazon-q/cli-agents/` ディレクトリにオーバーライド用JSONを作成できます（Amazon Q CLIはローカル定義を優先します）。

## 注意事項

- スクリプトはホームディレクトリへの書き込みを行います。権限が必要な環境では適宜sudoや手動コピーを検討してください。
- `shell_readonly` に登録されていないコマンドを実行する場合は、対話中に明示的な許可が必要です。
- MCPサーバや追加ツールを使用したい場合は `.amazon-q/cli-agents/solidity-rules.json` を編集し、再インストールしてください。
