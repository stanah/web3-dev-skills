#!/usr/bin/env bash
# Fetch Compound V2 cToken-related contracts from a pinned commit.
# License: BSD-3-Clause (see https://github.com/compound-finance/compound-protocol/blob/master/LICENSE)
set -euo pipefail

REPO="compound-finance/compound-protocol"
COMMIT="a3214f67b73310d547e00fc578e8355911c9d376"
BASE_URL="https://raw.githubusercontent.com/${REPO}/${COMMIT}/contracts"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="${SCRIPT_DIR}/contracts"

FILES=(
  "CToken.sol"
  "CErc20.sol"
  "CEther.sol"
  "CTokenInterfaces.sol"
  "ComptrollerInterface.sol"
  "ComptrollerStorage.sol"
  "Comptroller.sol"
  "InterestRateModel.sol"
  "WhitePaperInterestRateModel.sol"
  "JumpRateModel.sol"
  "EIP20Interface.sol"
  "EIP20NonStandardInterface.sol"
  "ErrorReporter.sol"
  "ExponentialNoError.sol"
  "SafeMath.sol"
  "Unitroller.sol"
)

echo "Fetching Compound V2 contracts (commit: ${COMMIT:0:8}...)..."
mkdir -p "$OUT_DIR"

FAILED=0
for f in "${FILES[@]}"; do
  printf "  %-40s" "$f"
  if curl -sSfL "${BASE_URL}/${f}" -o "${OUT_DIR}/${f}" 2>/dev/null; then
    echo "OK"
  else
    echo "FAILED"
    FAILED=$((FAILED + 1))
  fi
done

if [ "$FAILED" -gt 0 ]; then
  echo ""
  echo "ERROR: ${FAILED} file(s) failed to download."
  exit 1
fi

COUNT=$(find "$OUT_DIR" -name '*.sol' -size +0 | wc -l | tr -d ' ')
echo ""
echo "Done. ${COUNT} contracts saved to ${OUT_DIR}"
