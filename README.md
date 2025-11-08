# Web3 Dev Agent

Solidity/Web3開発に特化したAIエージェントとトレーニングデータ収集ツール

## プロジェクト概要

このプロジェクトは、Kimi K2 thinkingモデルをSolidity/Web3の実装に特化させるためのツール群を提供します：

1. **Solidityエージェント設定** - Claude Code, Cursor, Amazon Q用のカスタムエージェント
2. **トレーニングデータ収集パイプライン** - 検証済みSolidityコントラクトの自動収集

## 主な機能

### 1. Solidityエージェント設定

各種AIツール向けのSolidity専門エージェント設定を提供：

- ✅ Claude Code用カスタムエージェント
- ✅ Cursor Rules
- ✅ Amazon Q Developer カスタマイゼーション

```bash
# Cursor Rulesの生成とインストール
pnpm cursor:generate
pnpm cursor:install

# Amazon Qカスタマイゼーションのインストール
pnpm amazonq:install
```

### 2. トレーニングデータ収集パイプライン

検証済みSolidityコントラクトを複数のソースから自動収集：

- ✅ **Sourcify** - 完全一致の検証済みコントラクト
- ✅ **Blockscout** - 各種L2/L3チェーン対応
- ✅ **Etherscan** - メインネット・各種チェーン対応
- ✅ **BigQuery** - コントラクト候補の大規模抽出

詳細は [データ収集パイプラインのドキュメント](docs/data-collection-pipeline.md) を参照してください。

## クイックスタート

### インストール

```bash
# 依存関係のインストール
pnpm install

# ビルド
pnpm build
```

### データ収集パイプラインの使用

```bash
# 1. 設定ファイルの初期化
pnpm data-collection:init

# 2. 設定のカスタマイズ（必要に応じて）
# data-collection-config.json を編集

# 3. パイプラインの実行
pnpm data-collection:run

# 4. 結果の確認
ls -la data/solidity-training-data/
```

## ディレクトリ構造

```
.
├── scripts/
│   ├── data-collection/        # データ収集パイプライン
│   │   ├── types.ts            # 型定義
│   │   ├── utils.ts            # ユーティリティ
│   │   ├── sourcify-fetcher.ts # Sourcifyフェッチャー
│   │   ├── blockscout-fetcher.ts
│   │   ├── etherscan-fetcher.ts
│   │   ├── bigquery-extractor.ts
│   │   ├── normalizer.ts       # 正規化・重複除去
│   │   ├── license-detector.ts # ライセンス検出
│   │   ├── quality-labeler.ts  # 品質ラベリング
│   │   └── pipeline.ts         # メインパイプライン
│   ├── data-collection-cli.ts  # CLIエントリポイント
│   ├── generate-cursor-rules.ts
│   └── solidity-tools.ts
├── docs/
│   ├── data-collection-pipeline.md  # パイプライン詳細ドキュメント
│   ├── cursor-rules.md
│   └── ...
├── rules/
│   ├── base-rules.md
│   ├── dev-rules.md
│   ├── security-rules.md
│   └── ...
├── data-collection-config.example.json  # サンプル設定
└── package.json
```

## データスキーマ

収集されたコントラクトは以下のJSON形式で保存されます：

```json
{
  "chainId": 1,
  "address": "0x...",
  "verifiedBy": "sourcify_full",
  "compilerSettings": {
    "compilerVersion": "0.8.19",
    "optimizer": { "enabled": true, "runs": 200 }
  },
  "license": "MIT",
  "sources": [
    {
      "path": "Contract.sol",
      "content": "// SPDX-License-Identifier: MIT\n...",
      "sha256": "abc123..."
    }
  ],
  "abi": [...],
  "labels": {
    "reproducible": true,
    "hasTests": false,
    "staticAnalysis": {...}
  },
  "timestamps": {
    "collectedAt": "2024-01-15T00:00:00Z"
  }
}
```

## パイプラインの特徴

### データ収集
- 優先順位付き収集（Sourcify → Blockscout → Etherscan）
- レート制限対応（指数バックオフリトライ）
- 複数チェーン対応

### データ処理
- バイトコードハッシュによる重複除去
- ソースコードハッシュによる類似契約検出
- 関数シグネチャベースのクラスタリング
- Proxy契約の自動識別

### ライセンス管理
- SPDX識別子の自動抽出
- 学習用/研究用の自動分類
- ライセンスレポート生成

### 品質管理
- ヒューリスティック静的解析
- SWC脆弱性パターン検出
- テストコード検出
- 再現性チェック（オプション）

## コマンドリファレンス

### データ収集

```bash
# 設定ファイルの初期化
pnpm data-collection:init

# パイプラインの実行
pnpm data-collection:run [config-file]

# 設定の検証
pnpm data-collection:validate [config-file]

# BigQueryクエリの生成
pnpm data-collection:bigquery [output-dir]
```

### Cursor/Amazon Q

```bash
# Cursor Rulesの生成
pnpm cursor:generate

# Cursor Rulesのインストール
pnpm cursor:install [target-dir]

# Amazon Qカスタマイゼーションのインストール
pnpm amazonq:install
```

## ライセンスカテゴリ

### 学習可能（Training-Friendly）
- MIT
- Apache-2.0
- BSD-2-Clause / BSD-3-Clause
- Unlicense

### 研究のみ（Research-Only）
- GPL-2.0 / GPL-3.0
- AGPL-3.0
- LGPL-2.1 / LGPL-3.0

## 出力形式

### 基本出力
```
data/solidity-training-data/
├── training/
│   ├── mit.jsonl              # MITライセンス
│   ├── apache-2-0.jsonl       # Apache 2.0
│   └── ...
├── research-only/
│   └── gpl-3-0.jsonl          # GPL 3.0 (研究用)
└── reports/
    ├── license-report.md      # ライセンス分布
    ├── quality-report.md      # 品質レポート
    └── pipeline-stats.md      # パイプライン統計
```

## トラブルシューティング

### よくある問題

#### Etherscan APIエラー
```
Error: Rate limited
```
→ `rateLimit.requestsPerSecond` を減らす、またはAPIキーをアップグレード

#### メモリ不足
→ `maxPages` を減らす、または複数回に分けて実行

#### ネットワークエラー
→ 自動リトライが実行されます（最大4回）

## 参考リンク

- [Sourcify Documentation](https://docs.sourcify.dev/)
- [Blockscout API](https://docs.blockscout.com/)
- [Etherscan API](https://docs.etherscan.io/)
- [BigQuery Ethereum Dataset](https://cloud.google.com/blog/products/data-analytics/ethereum-bigquery-public-dataset-smart-contract-analytics)
- [SWC Registry](https://swcregistry.io/)

## 今後の拡張

- [ ] Parquet形式の出力
- [ ] Slither/Mythril統合
- [ ] solc統合（実際の再現性チェック）
- [ ] @google-cloud/bigquery統合
- [ ] Vyper契約対応
- [ ] Proxy実装の自動解決
- [ ] 差分更新モード
- [ ] リアルタイム収集

## 貢献

プルリクエストを歓迎します！

## ライセンス

このツール自体はMITライセンスです。
収集されたデータのライセンスは、各コントラクトの元のライセンスに従います。
