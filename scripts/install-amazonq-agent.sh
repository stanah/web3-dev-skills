#!/usr/bin/env bash
set -euo pipefail

# このスクリプトはリポジトリ内のAmazon Qカスタムエージェント定義を
# ホームディレクトリの共有配置にコピーする。

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
SRC_DIR="$ROOT_DIR/.amazon-q/cli-agents"
DEST_DIR="$HOME/.aws/amazonq/cli-agents"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "エージェント定義ディレクトリが見つかりません: $SRC_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

copied=()
backed_up=()
timestamp=$(date +"%Y%m%d%H%M%S")
while IFS= read -r -d '' file; do
  base_name=$(basename "$file")
  dest_path="$DEST_DIR/$base_name"

  if [[ -f "$dest_path" ]]; then
    backup_path="${dest_path}.backup-${timestamp}"
    cp "$dest_path" "$backup_path"
    backed_up+=("$(basename "$backup_path")")
  fi

  cp "$file" "$dest_path"
  copied+=("$base_name")
done < <(find "$SRC_DIR" -maxdepth 1 -type f -name "solidity-*.json" -print0)

if [[ ${#copied[@]} -eq 0 ]]; then
  echo "コピー対象のエージェント定義が見つかりませんでした。" >&2
  exit 1
fi

printf "[OK] Amazon Qカスタムエージェントをコピーしました。\n  ソース: %s\n  ターゲット: %s\n\n" "$SRC_DIR" "$DEST_DIR"
printf "コピーされたファイル:\n"
for name in "${copied[@]}"; do
  printf "  - %s\n" "$name"
done

if [[ ${#backed_up[@]} -gt 0 ]]; then
  printf "\n上書き前にバックアップした既存ファイル:\n"
  for name in "${backed_up[@]}"; do
    printf "  - %s\n" "$name"
  done
fi

cat <<'MSG'

利用例:
  q chat --agent solidity-base
  q chat --agent solidity-design
  q chat --agent solidity-dev
  q chat --agent solidity-security
  q chat --agent solidity-test
  q chat --agent solidity-optimize
MSG
