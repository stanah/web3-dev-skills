# SPECA Development Guide

## Versioning Policy

SPECA には3つの独立したバージョンがある。それぞれ異なるスコープと更新基準を持つ。

| Version | Current | Location | Scope | When to bump |
|---|---|---|---|---|
| Config Schema | `1.0` | `config.json` → `version` field, `phases/init.md` | `config.json` のフィールド構造 | フィールドの追加・削除・型変更時 |
| Pattern DB | `2.0` | `reference/vulnerability-patterns.md` title, `phases/checklist.md` → `pattern_db_version` | 脆弱性パターンの内容（カテゴリ・パターン数） | パターンの追加・変更・削除時 |
| Framework | `1.0` | `phases/report.md`, `scripts/generate-report-skeleton.mjs` | SPECA 手法論全体（フェーズ構成・監査手法） | フェーズの追加・削除、監査手法の根本的変更時 |

### 更新時の同期箇所

**Config Schema version を変更する場合:**
- `phases/init.md` の config schema 例
- `scripts/__tests__/speca-cli.test.mjs` のテストデータ
- `scripts/__tests__/config.test.mjs` のテストデータ
- `scripts/__tests__/query.test.mjs` のテストデータ
- `scripts/speca-cli.mjs` の validate ロジック（互換性チェックがある場合）

**Pattern DB version を変更する場合:**
- `reference/vulnerability-patterns.md` のタイトル行
- `phases/checklist.md` の pattern count 記述と `pattern_db_version` 出力例
- `phases/checklist.md` の Categories リスト（カテゴリ追加時）

**Framework version を変更する場合:**
- `phases/report.md` の `Tool driver` 行
- `scripts/generate-report-skeleton.mjs` 内の2箇所（ヘッダーとフッター）
- `scripts/generate-sarif.mjs` の tool version

### 原則

- 3つのバージョンは独立してバンプする。Pattern DB を更新しても Framework version は変えない。
- Semver は採用しない。`major.minor` の2桁で、破壊的変更は major、追加は minor。
- バージョンを変更する PR では、上記の同期箇所をすべて更新すること。

## Pattern DB 先送り判断基準

パターンを次バージョンに先送りする場合、以下の3基準で判断し根拠を記録すること：

| 基準 | 閾値 | 説明 |
|---|---|---|
| **対象プロトコルでの発生頻度** | 年間インシデント < 3件 | 過去2年間の主要インシデントDB（rekt.news, DeFiLlama hacks）で確認 |
| **影響度** | 平均被害額 < $1M | 同一パターンによるインシデントの平均被害額 |
| **パターンの成熟度** | 標準化された検出手法なし | Slither/Mythril 等のツールサポート、または確立された手動検出手法の有無 |

3基準中2つ以上が閾値以下の場合、先送りを許容する。1つ以下の場合は現バージョンに含めること。
