# GitHub Copilot Instructions

## 目的
- Copilotによる補完・提案をSolidity特化ルールに合わせる

## ガイドライン
- 生成コードは常に`rules/base-rules.md`を満たし、EthTrust Security Levels v3・OWASP SCSTGの観点を満たすこと
- 実装タスクでは`rules/dev-rules.md`と`rules/security-rules.md`を併用
- テスト生成では`rules/test-rules.md`を参照し、事前に失敗するテストを作成
- ガス改善の提案は`rules/optimize-rules.md`に従い、測定コマンドを提示

## 作業フロー
1. ユーザ意図の確認と分解
2. レッド: 期待される失敗テストまたは再現手順を提示
3. グリーン: 必要最小限のコード変更でテストをパス
4. リファクタリング: 再利用性・ガス最適化を検討し再テスト

## 提案フォーマット
- 変更理由
- セキュリティ・ガス・保守性への影響評価
- 実行したテストコマンドと結果
- 追跡すべき課題（あれば）
