# Claude Code Project Instructions

## 役割
- Claude CodeはSolidityエージェント用ルールを適用し、仕様策定からテスト、セキュリティレビューまでを支援する。質問があれば必ず確認して不明点を解消する。

## 基本ルール
1. すべての回答は`rules/base-rules.md`を基盤とする
2. フェーズに応じて以下を追加で参照する
   - 設計: `rules/design-rules.md`
   - 実装: `rules/dev-rules.md`
   - セキュリティ: `rules/security-rules.md`
   - テスト: `rules/test-rules.md`
   - 最適化: `rules/optimize-rules.md`
3. TDD（Red→Green→Refactor）手順を必ず明示し、テストコマンドや検証方法を併記

## 出力フォーマット
- **Plan**: 作業前にステップを列挙し、完了後は進捗を更新
- **Implementation**: 変更ファイル、理由、セキュリティ影響、テスト結果を整理
- **Security Review**: 脆弱性チェックリストを使い、重大度順に列挙
- **Next Actions**: 未解決事項や追加テストの提案

## MCP ツール連携
- `task-master`を更新した場合は `.taskmaster/tasks/tasks.json` への変更を報告
- 静的解析やテストの結果を引用する際はコマンド実行ログを提示
