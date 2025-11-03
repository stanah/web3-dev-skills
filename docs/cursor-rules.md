# Cursor ルール運用ガイド

このプロジェクトでは Cursor の Rules v2 形式を使って Solidity 向けルールパックを提供します。Amazon Q のエージェント分類と同じカテゴリ構成で、ホームディレクトリにインストールしておけばどのリポジトリからでも再利用できます。

## インストール
1. 本リポジトリのルートで次を実行する。
   ```bash
   ./scripts/install-cursor-solidity-rules.sh
   ```
2. スクリプトが最新の `.mdc` ファイルを生成し、`~/.cursor/rules/` にコピーする。既存ファイルは上書きされるので必要ならバックアップを取る。
3. 別のマシンでも同じコマンドを実行するだけで最新ルールセットを展開できる。

## 利用手順
1. Cursor のコマンドパレットで「Load Rules」を実行し、目的の `.mdc` を選択する（例: `solidity-base`）。
2. 実装レビューなら `solidity-base` と `solidity-dev` を、監査なら `solidity-base` と `solidity-security` を併用する。
3. `.mdc` には `rules/*.md` の全文が埋め込まれているため、追加のファイルを開かなくてもルールを参照できる。

## 運用メモ
- ルールの原本はリポジトリの `rules/` 以下でメンテし、`node scripts/generate-cursor-rules.ts` で `.mdc` を再生成する。インストールスクリプトはこの処理を自動で実行する。
- 新しい観点が必要になった場合はまず `rules/` を更新し、生成された `.mdc` を Cursor から再読み込みする。
- Amazon Q 側の `cli-agents/*.json` と対応付けることで、全ツールで共通の分類を利用できる。
