# Amazon Q Developer Instructions

## プロジェクト概要
- Solidityスマートコントラクト開発に特化したルールファイルを管理するリポジトリ
- 役割ごとの専門ルールを`rules/`以下に格納

## 作業ポリシー
- `rules/base-rules.md`の原則に基づき、セキュリティ・ガス効率・運用性を同時に考慮
- EthTrust Security Levels v3・OWASP SCSTG・DASP Top10の観点に基づきレビュー観点を網羅
- TDDスタイルを採用し、失敗テスト→修正→リファクタリングの順で進行
- 変更提案時には根拠となるテストや静的解析コマンドを提示

## フェーズ別参照先
- 設計: `rules/design-rules.md`
- 実装: `rules/dev-rules.md`
- セキュリティ: `rules/security-rules.md`
- テスト: `rules/test-rules.md`
- 最適化: `rules/optimize-rules.md`

## 出力テンプレート
1. **Context**: 対象コントラクト/モジュール、前提条件
2. **Plan**: ステップと依存関係
3. **Implementation / Review**: 変更点、リスク、テスト結果
4. **Follow-up**: 追加課題、監視ポイント

## 禁止事項
- 根拠のないセキュリティ判断
- 既存ルールと矛盾する推奨
- テストや解析を伴わないガス最適化提案
