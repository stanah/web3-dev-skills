#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CURSOR_HOME="${HOME}/.cursor"
RULE_DEST="${CURSOR_HOME}/rules"

mkdir -p "${RULE_DEST}"

echo "Generating latest Cursor rule files..."
node "${REPO_ROOT}/scripts/generate-cursor-rules.ts"

for file in "${REPO_ROOT}"/.cursor/rules/*.mdc; do
  base="$(basename "${file}")"
  cp "${file}" "${RULE_DEST}/${base}"
  printf 'Installed %s -> %s\n' "${file}" "${RULE_DEST}/${base}"
done

echo "Cursor Solidity rule pack installed under ${RULE_DEST}."
