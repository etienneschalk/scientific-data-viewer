#!/usr/bin/env bash
# Check out <git-ref> (e.g. v0.12.1) as the baseline of the backend
# differential tests, in $SDV_QA_OUT/baseline (default .qa/baseline).
#
#   scripts/qa/backend/make_baseline.sh v0.12.1
#   scripts/qa/backend/make_baseline.sh --remove
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
TARGET="${SDV_QA_BASELINE:-${SDV_QA_OUT:-$REPO/.qa}/baseline}"

if [[ "${1:-}" == "--remove" ]]; then
    git -C "$REPO" worktree remove --force "$TARGET"
    exit 0
fi
REF="${1:?usage: make_baseline.sh <git-ref> | --remove}"
if [[ -e "$TARGET" ]]; then
    git -C "$REPO" worktree remove --force "$TARGET" 2>/dev/null || rm -rf "$TARGET"
fi
mkdir -p "$(dirname "$TARGET")"
git -C "$REPO" worktree add --detach "$TARGET" "$REF"
echo "baseline $REF in $TARGET"
