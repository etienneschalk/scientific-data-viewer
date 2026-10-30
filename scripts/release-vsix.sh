#!/usr/bin/env bash
# Rebuild the .vsix of a released version from its git tag, into
# artefacts/vsix-releases/ (.vsix files are not versioned). Used by the
# migration and upgrade tests (scripts/upgrade-sandbox.sh, paranoia.sh).
#
#   scripts/release-vsix.sh 0.12.1           # -> artefacts/vsix-releases/scientific-data-viewer-0.12.1.vsix
#   scripts/release-vsix.sh 0.12.1 --force   # rebuild even if the file exists
#
# The tag v<version> is checked out in a temporary git worktree
# (artefacts/build/v<version>), with the Node version of its .nvmrc; its
# dependencies are installed from its lockfile (npm ci) and it is packaged by
# its own vsce, as when it was released. If that fails (a dependency no longer
# installable...), the package published on Open VSX is downloaded instead.
# Needs: git, Node (nvm), network.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:?usage: scripts/release-vsix.sh <version> [--force]}"
VERSION="${VERSION#v}"
FORCE=false
[ "${2:-}" = --force ] && FORCE=true
NAME="$(node -p "require('$ROOT/package.json').name")"
PUBLISHER="$(node -p "require('$ROOT/package.json').publisher")"
OUT_DIR="$ROOT/artefacts/vsix-releases"
TARGET="$OUT_DIR/$NAME-$VERSION.vsix"
BUILD="$ROOT/artefacts/build/v$VERSION"

if [ -f "$TARGET" ] && ! $FORCE; then
    echo "$TARGET (already there)"
    exit 0
fi
git -C "$ROOT" rev-parse -q --verify "refs/tags/v$VERSION" >/dev/null || {
    echo "No tag v$VERSION" >&2
    exit 1
}

remove_worktree() {
    git -C "$ROOT" worktree remove --force "$BUILD" 2>/dev/null || rm -rf "$BUILD"
    git -C "$ROOT" worktree prune
    rmdir "$(dirname "$BUILD")" 2>/dev/null || true
}
trap remove_worktree EXIT
remove_worktree
mkdir -p "$OUT_DIR" "$(dirname "$BUILD")"
git -C "$ROOT" worktree add --detach "$BUILD" "v$VERSION"

build() {
    cd "$BUILD"
    if [ -s "$HOME/.nvm/nvm.sh" ] && [ -f .nvmrc ]; then
        # shellcheck disable=SC1091
        source "$HOME/.nvm/nvm.sh" >/dev/null
        nvm use >/dev/null
    fi
    echo "Node $(node -v), npm ci in $BUILD"
    npm ci --no-audit --no-fund
    npx --no-install vsce package --out "$TARGET" </dev/null
}

if (build); then
    echo "Built $TARGET from tag v$VERSION"
else
    echo "Building v$VERSION failed: downloading the package published on Open VSX" >&2
    curl -fSL -o "$TARGET.part" \
        "https://open-vsx.org/api/$PUBLISHER/$NAME/$VERSION/file/$PUBLISHER.$NAME-$VERSION.vsix"
    mv "$TARGET.part" "$TARGET"
    echo "Downloaded $TARGET"
fi
