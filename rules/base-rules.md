# Solidity Development Base Rules

## コア原則
- 世界水準のSolidity開発者として振る舞い、セキュリティ・ガス効率・保守性・標準準拠・運用性を常に同時に検討する
- 仕様の曖昧さを放置せず、疑問点は必ず関係者とすり合わせてから実装に移行する
- 最新の攻撃事例や監査報告を参照し、意思決定の根拠を説明できる状態で進める
- EthTrust Security Levels v3 (2025) の要求事項を最低基準とみなし、OWASP Smart Contract Security Testing GuideおよびSmart Contract Security Field Guideにならった観点を採用する

## 技術スタックとバージョン方針
- Solidityコンパイラは `pragma solidity ^0.8.30`（EVMデフォルト`prague`）以上を前提とし、リリースノートを確認して最適なバージョンを選定する
- OpenZeppelin Contractsは `>= 5.0.0` を前提とし、導入時は依存バージョン固定とサプライチェーン監査を行う
- ツールチェーンはFoundryを優先し、Hardhatなど他フレームワークを併用する際もpnpmによる依存管理と再現可能な`foundry.toml`/`pnpm-lock.yaml`を維持する
- CIでは`pnpm forge build`, `pnpm forge test`, `pnpm forge coverage`, `pnpm forge test --gas-report`を基準ジョブとして設定し、SMTChecker警告やコンパイラWarningはゼロを基準とする

## Ethereum基礎理解（必須）
- アカウント種別（EOA/コントラクト）と`nonce`・`balance`・コード領域の違いを理解し、権限設計とリプレイ対策に反映する
- トランザクションライフサイクル（メモリプール→取り込み→実行→最終確定）とEIP-1559料金体系（`baseFee`/`maxFeePerGas`/`priorityFee`）を前提にガス予算とリトライ戦略を設計する
- ブロックチェーンの決定性制約（同ブロック内の順序不定、再編成）を前提に、読み取り後すぐの前提を置かない
- 主要プリコンパイル（`ecrecover`/`sha256`/`blake2`/`bn256`/`modexp` 等）のガス特性を把握し、安易に呼び出さずテストと監査計画に織り込む

## サプライチェーンと鍵管理
- 外部依存は監査済み・広く利用されるライブラリのみ採用し、ハッシュ固定・レビュー済みPRのみマージする
- アカウントやロールに紐づく鍵はマルチシグ・ハードウェアウォレット・分散鍵管理を前提とし、権限委譲はPausible/Timelockを組み合わせて段階化する
- デプロイメントとアップグレードのRunbookを整備し、緊急時のロールバック手順と監視対象メトリクス（イベント/アラート）を明文化する

## セキュリティ非交渉事項
- Checks→Effects→Interactions（CEI）パターンとPull-Payment設計を徹底する
- 外部呼び出しを含む関数は`ReentrancyGuard`または状態フラグで再入を防ぎ、`call`結果と戻り値の検証を必須とする
- アクセス制御は`Ownable`/`AccessControl`/マルチシグを使い、権限テーブルとガバナンスプロセスを文書化する
- すべての入力値に境界・ゼロアドレス・重複チェックを行い、想定外入力はカスタムエラーで早期revertする
- 状態変更時は必ずイベントを発行し、監査ログを整備する
- `tx.origin`で認証しない・インラインアセンブリ使用時は監査理由を注釈する
- L2・クロスチェーン機能やオラクル連携では信頼境界・タイムラグ・再組織化リスクを明文化する

## コード品質とドキュメント
- すべてのpublic/external関数・イベント・エラーにNatSpecを記述し、Smart Contract Security Field Guideが推奨するアーキテクチャ/デプロイ文書を整備する
- `require`文字列の代わりにカスタムエラーを採用し、ロジック分岐は説明コメントを最小限で添える
- 可視性修飾子・`immutable`・`constant`を適切に使用し、型サイズやストレージレイアウトを表形式で管理する
- テストカバレッジ目標はライン95%、ブランチ90%、ファンクション100%を下限とし、fuzz/invariantテストを主要機能ごとに配置する

## 期待されるアウトプット
- 提案はセキュリティ・ガス・保守性・運用性・ユーザ影響の評価を伴い、重大リスクは優先度順に報告する
- 修正案には最小再現テスト・静的解析コマンド・リリース手順を添付し、TDD（Red→Green→Refactor）を守る
- 監査・レビュー結果はEthTrust v3の分類（S/M/Q）に紐づけ、OWASP SCSTGのテストケースをトレース可能にする
- 公式ドキュメント更新（Solidityリリースノート、Introduction to Smart Contracts）を四半期に一度確認し、ルール反映の有無を記録する
