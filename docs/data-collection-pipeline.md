# Solidity/Web3 Training Data Collection Pipeline

Kimi K2 thinkingモデルをSolidity/Web3実装に特化させるための学習データ収集パイプライン

## 概要

このパイプラインは、以下のソースから検証済みSolidityコントラクトを収集し、機械学習モデルのトレーニングに使用できる高品質なデータセットを構築します：

1. **Sourcify** (最優先) - 完全一致の検証済みコントラクト
2. **Blockscout** - 各種L2/L3エクスプローラ
3. **Etherscan** - メインネットおよび各種チェーン
4. **BigQuery** (補助) - コントラクト候補の抽出

## 特徴

### データ収集
- ✅ Sourcifyからの完全一致コントラクト取得
- ✅ Blockscout APIを使用した複数チェーン対応
- ✅ Etherscan APIファミリー対応（レート制限対応）
- ✅ BigQuery SQLクエリテンプレート生成

### データ処理
- ✅ バイトコードハッシュによる重複除去
- ✅ ソースコードハッシュによる重複除去
- ✅ 関数シグネチャベースのクラスタリング
- ✅ Proxy契約の識別と分離

### ライセンス管理
- ✅ SPDX識別子の自動抽出
- ✅ ライセンスカテゴリ別フィルタリング
- ✅ 学習用/研究用の自動分類
- ✅ ライセンスレポート生成

### 品質管理
- ✅ 再現性チェック（オプション）
- ✅ 静的解析（ヒューリスティックベース）
- ✅ SWC脆弱性パターン検出
- ✅ テストコード検出

## インストール

```bash
# 依存関係のインストール
pnpm install

# ビルド
pnpm build
```

## 使い方

### 1. 設定ファイルの初期化

```bash
pnpm data-collection init
```

デフォルトの設定ファイル `data-collection-config.json` が作成されます。

### 2. 設定のカスタマイズ

```json
{
  "sourcify": {
    "enabled": true,
    "chains": [1, 137, 42161, 10, 8453]
  },
  "blockscout": {
    "enabled": true,
    "instances": [
      {
        "chainId": 100,
        "baseUrl": "https://gnosis.blockscout.com",
        "name": "Gnosis Chain"
      }
    ]
  },
  "etherscan": {
    "enabled": false,
    "instances": [
      {
        "chainId": 1,
        "baseUrl": "https://api.etherscan.io",
        "name": "Ethereum",
        "apiKey": "YOUR_API_KEY"
      }
    ]
  },
  "output": {
    "directory": "./data/solidity-training-data",
    "splitByLicense": true
  },
  "filters": {
    "allowedLicenses": ["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "Unlicense"]
  }
}
```

### 3. パイプラインの実行

```bash
pnpm data-collection run
```

### 4. 結果の確認

```
data/solidity-training-data/
├── training/
│   ├── mit.jsonl
│   ├── apache-2-0.jsonl
│   ├── bsd-3-clause.jsonl
│   └── ...
├── research-only/
│   └── gpl-3-0.jsonl
└── reports/
    ├── license-report.md
    ├── quality-report.md
    └── pipeline-stats.md
```

## データスキーマ

各コントラクトは以下の形式で保存されます：

```typescript
{
  "chainId": 1,
  "address": "0x...",
  "verifiedBy": "sourcify_full",
  "compilerSettings": {
    "compilerVersion": "0.8.19",
    "evmVersion": "paris",
    "optimizer": {
      "enabled": true,
      "runs": 200
    }
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
  "bytecodeHash": "def456...",
  "labels": {
    "reproducible": true,
    "passesCompilation": true,
    "hasTests": false,
    "staticAnalysis": {
      "tool": "heuristic",
      "findings": [...]
    }
  },
  "timestamps": {
    "verifiedAt": "2024-01-01T00:00:00Z",
    "collectedAt": "2024-01-15T00:00:00Z"
  }
}
```

## コマンドリファレンス

### `init` - 設定ファイルの初期化

```bash
pnpm data-collection init [output] [--overwrite]
```

### `run` - パイプラインの実行

```bash
pnpm data-collection run [config]
```

### `validate` - 設定ファイルの検証

```bash
pnpm data-collection validate [config]
```

### `bigquery:queries` - BigQueryクエリの生成

```bash
pnpm data-collection bigquery:queries [output] [--max-results=10000]
```

## BigQueryの使用

BigQueryを使用してコントラクト候補を抽出する場合：

1. クエリを生成：
   ```bash
   pnpm data-collection bigquery:queries ./bigquery-queries
   ```

2. [BigQuery Console](https://console.cloud.google.com/bigquery)でクエリを実行

3. 結果をCSV/JSONでエクスポート

4. Etherscanフェッチャーでアドレスを取得

## ライセンスカテゴリ

### 学習可能（Permissive）
- MIT
- Apache-2.0
- BSD-2-Clause
- BSD-3-Clause
- Unlicense

### 研究のみ（Copyleft）
- GPL-2.0
- GPL-3.0
- AGPL-3.0
- LGPL-2.1
- LGPL-3.0

## 品質チェック

### ヒューリスティック静的解析

以下のパターンを検出：

- **SWC-107**: リエントランシー脆弱性
- **SWC-104**: 低レベル呼び出しの戻り値未チェック
- **SWC-115**: tx.originの使用
- **SWC-106**: selfdestructの使用
- **SWC-112**: ユーザー供給アドレスへのdelegatecall
- **SWC-105**: アクセス制御の欠如
- **SWC-103**: フローティングプラグマ
- **SWC-102**: 古いコンパイラバージョン

### 再現性チェック（オプション）

solcを使用してバイトコードの再現性を確認（要solcインストール）

## パフォーマンス最適化

### レート制限

- Sourcify: リスペクトフルな遅延（100ms）
- Blockscout: トークンバケットレート制限（5 req/s）
- Etherscan: 設定可能なレート制限 + 指数バックオフ

### 並列処理

- フェッチャーは独立して動作
- 重複除去は最後に一括実行
- ライセンス別の並列出力

### メモリ管理

- ストリーミングJSONL出力
- バッチ処理オプション
- 一時ファイルの自動クリーンアップ

## トラブルシューティング

### Etherscan APIエラー

```
Error: Rate limited
```

→ `rateLimit.requestsPerSecond` を減らす、またはAPIキーをアップグレード

### Sourcify接続エラー

```
Error: Failed to fetch chain 1
```

→ ネットワーク接続を確認、リトライが自動実行されます

### メモリ不足

→ `maxPages` を減らす、または複数回に分けて実行

## アーキテクチャ

```
┌─────────────────┐
│   Data Sources  │
├─────────────────┤
│   Sourcify      │──┐
│   Blockscout    │──┤
│   Etherscan     │──┼──→ ┌──────────────┐
│   BigQuery*     │──┘    │  Fetchers    │
└─────────────────┘       └──────┬───────┘
                                 │
                                 ▼
                          ┌──────────────┐
                          │  Normalizer  │
                          │ (Deduplication)
                          └──────┬───────┘
                                 │
                                 ▼
                          ┌──────────────┐
                          │   License    │
                          │   Detector   │
                          └──────┬───────┘
                                 │
                                 ▼
                          ┌──────────────┐
                          │   Quality    │
                          │   Labeler    │
                          └──────┬───────┘
                                 │
                                 ▼
                          ┌──────────────┐
                          │   Output     │
                          │  (JSONL)     │
                          └──────────────┘
```

## 今後の拡張

- [ ] Parquet形式の出力サポート
- [ ] Slither/Mythril統合（実際の静的解析ツール）
- [ ] solc統合（実際の再現性チェック）
- [ ] @google-cloud/bigquery統合
- [ ] Vyper契約対応
- [ ] Proxyの実装解決
- [ ] 差分更新モード
- [ ] WebSocketベースのリアルタイム収集

## 参考リンク

- [Sourcify Docs](https://docs.sourcify.dev/)
- [Blockscout API](https://docs.blockscout.com/)
- [Etherscan API](https://docs.etherscan.io/)
- [BigQuery Ethereum Dataset](https://cloud.google.com/blog/products/data-analytics/ethereum-bigquery-public-dataset-smart-contract-analytics)
- [SWC Registry](https://swcregistry.io/)

## ライセンス

このパイプラインツール自体はMITライセンスです。
収集されたデータのライセンスは、各コントラクトの元のライセンスに従います。
