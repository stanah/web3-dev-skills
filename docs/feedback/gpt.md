レポート3本を読み込んで要点を抽出し、Solidity開発エージェント計画に反映します。

[3 tools called]

gptレポートの読み取りがタイムアウトしたため、再取得します。

[1 tool called]

3件のレポート内容を読み込み、要点を統合しました。以下に「良いところの抽出」と「Solidity開発エージェント整備計画」を示します。

### 良いところ抽出（要約）
- 【共通】マルチエージェント分業が有効
  - 設計・開発・テスト・レビュー・セキュリティ・ガス最適化を役割分担（Claude）
  - SOP/ルール駆動＋自己反省/自己修正ループ（Manus/GPT）
- 【共通】ツール統合が品質と速度の鍵
  - solc/Foundry/Hardhat、Slither/Mythril、Echidna、Solhint 等の自動ループ（Claude、Manus/GPT）
  - 失敗時にログを要約してLLMへリフィード（Claude）
- 【Claude】生産運用の型
  - 研究→計画→実装の三相で40%を上流（研究/計画）に投資
  - RAG（関数粒度・依存グラフ考慮）＋長文脈（128K）＋コンテキスト圧縮
  - セキュリティ・ガス最適化の具体知（CEI/事件率、変数パッキング、イベント活用）
  - MCP/ACP/LSPなど標準に沿った拡張
- 【Manus/GPT】運用の実務
  - ドキュメンテーション駆動（要件/設計/構成/実装計画を先置き）
  - リンター/静的解析/型検査の自動フィードバック
  - MetaGPT 的な役割エージェントと反復改善

### 設計方針（前提）
- まずは既存AIエージェント（Cursor、Claude Code、Amazon Q Developer CLI、Copilot/Codex等）を活用
- カスタムは「ルールファイル＋プロンプトパック＋ツール実行レシピ」で実現
- 役割別に独立したプロファイルを用意し、必要時に切替（人間インザループでゲート）

### 役割別カスタムエージェント（初期スコープ）
- 設計エージェント: 要件→設計指針→インターフェイス/NatSpec→ストレージ設計→アップグレード方針
- 開発エージェント: 実装（CEI/イベント/アクセス制御/ガス方針を順守）
- テストエージェント: Foundry中心（unit/fuzz/invariant/gasreport）＋カバレッジ基準
- レビューエージェント: 変更差分レビュー、設計/要件整合、テスト妥当性、リグレッション観点
- セキュリティエージェント: Slither→Mythril→Echidnaの段階分析、誤検知フィルタと修正案
- ガス最適化エージェント: ストレージ/定数/packing/API設計見直し、差分のgas snapshot評価
- （任意）デプロイ/検証エージェント: テストネット検証、Etherscan verify、ロールアウト計画

### 成果物（リポジトリ構成案）
- docs/agents/
  - roles/{design,dev,test,review,security,gas}.rules.md（役割ルール）
  - prompts/common.md（共通規約・禁止事項・用語）
  - runbooks/{cursor,claude,amazon-q}.md（使い方手順）
- .cursorrules（共通）／.cursorrules.security 等の役割別バリアント
- tools/
  - summarize/{slither,mythril,foundry}_to_llm.sh（結果要約→LLM入力）
  - ci/{slither,foundry,echidna}.yml（CIジョブ雛形）
- configs/{foundry.toml, .solhint.json, slither.config.json, echidna.yaml}
- docs/knowledge/{openzeppelin.md, solidity-gas.md, swc-checklist.md}（RAG前の軽量知識）

例：セキュリティ用 `.cursorrules.security`（抜粋）
```markdown
You are a Solidity security auditor.
- Enforce CEI, RBAC, reentrancy guards, checks on external calls.
- Require NatSpec, events for state changes, custom errors.
- Prefer OZ 4.9+; Solidity ≥ 0.8.19; fail on deprecated patterns.
- Consume summarized outputs: Slither(YAML), Mythril(summary), Echidna(fail cases).
- For each finding: explain impact, minimal fix, test to prove fix.
```

### ツール統合（最小実装）
- コンパイル/テスト: Foundry（高速・fuzz/invariant/gasreport）を標準、必要に応じHardhat
- セキュリティ: Slither→Mythril→Echidna→Solhint の順で自動化
- ラッパー: 各ツールの生ログを「短い要約（失敗のみ/提案含む）」に整形し、LLMへ返す
- CI: PRで自動実行、重大検知でFail、所見はPRコメント化

### 使い方（既存AI別）
- Cursor: 役割別 `.cursorrules.*` を読み替え、対象ファイル＋要約ログを渡して指示
- Claude Code: Project Instructions に `prompts/common.md`＋役割ルールを貼付、同様にログ要約を提示
- Amazon Q Developer CLI: 役割ルールとログ要約を先頭に与えて対話（固定テンプレで運用）
- Copilot/Codex: チャットにテンプレ貼付→差分/ログを逐次投下（補完は従）

### 作業手順（フェーズ）
- フェーズ1: 共通規約・役割ルール・Runbook整備（docs/agents、.cursorrules群）
- フェーズ2: ツール要約ラッパーとサンプルCI（ERC-20/721で動作確認）
- フェーズ3: 役割別シナリオ実証（設計→実装→テスト→レビュー→セキュリティ→最適化）
- フェーズ4: PRゲート/メトリクス（所要時間、検知率、gas差分、テスト合格率）
- フェーズ5（任意）: 軽量RAG（OZ/公式Docs/SWCの抜粋を関数粒度で埋め込み）
- フェーズ6（任意）: モデルカスケード（安価モデル→高度モデルエスカレーション）

### ガードレール
- メインネット鍵・秘密情報はLLMへ渡さない（隔離・マスキング）
- 重大変更は必ず人間ゲート（デプロイ前レビュー/テストネット熟成）
- 最低品質基準: 90%+ カバレッジ、重大アラート0、gas回帰±X%以内

### KPI（初期）
- pass@1 テスト合格率、セキュリティ検知の再現率/誤検知率、gas差分、PR往復回数、所要時間

### 直近のNext Actions
- 役割ルール雛形の作成（design/dev/test/review/security/gas）
- Foundry＋Slither＋Echidna の要約ラッパー3本
- ERC-20/721 サンプルプロジェクトで役割別Runbook検証

提案コミット（例・英語/Conventional）:
- chore(agents): scaffold role rule packs and runbooks for Solidity
- feat(ci): add Foundry/Slither/Echidna minimal pipelines
- docs(knowledge): add OZ/solidity-gas/SWC checklists

- 3つのレポートを統合し、役割別ルール＋ツール要約＋PRゲートを中核に据えた実装計画を提示しました。必要なら、雛形ファイルの自動生成まで進めます。