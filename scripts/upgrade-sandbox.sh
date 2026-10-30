#!/usr/bin/env bash
# Upgrade test: what a user sees when the extension updates.
#
# In a throw-away VS Code profile (your own profile, extensions and Python
# environment are not touched). Each .vsix is unpacked and loaded as a
# development extension: same extension id, so the same storage folder and
# environment, which is what an update from the Marketplace keeps.
#   1. install the OLD release, open a data file: it creates its own uv
#      environment (scientificDataViewer.python.useExtensionOwnEnvironment on)
#   2. install the NEW build, open the file again: the environment must be
#      deleted and recreated (see ENVIRONMENT_REVISION)
#   3. check the result: state file, nothing left from the old environment,
#      eccodeslib pin, and the backend opening the sample files
#
# Usage: scripts/upgrade-sandbox.sh [options]
#   --old <vsix>       release to upgrade from (default: scientific-data-viewer-0.12.1.vsix)
#   --new <vsix>       build to upgrade to (default: scientific-data-viewer-<version>.vsix,
#                      built with `npm run package` when missing)
#   --scenario <name>  normal       plain upgrade (default)
#                      offline      the rebuild fails (no package index): the old
#                                   environment must be kept; then a normal start
#                                   must rebuild it
#                      interrupted  VS Code is killed during the rebuild: the next
#                                   start must restore the old environment and rebuild
#   --dir <path>       sandbox folder (default: a new temporary folder)
#   --keep-open        leave the new version open at the end, to look around
#   --code <path>      VS Code CLI (default: the newest build downloaded by `npm test`
#                      in .vscode-test/, else `code`; a snap `code` may not load the
#                      sandbox extensions)
#
# Needs: VS Code, uv, a display, and sample-data/ (python python/create_sample_data.py).
# Linux / macOS only. VS Code windows open on your screen: don't close them.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"
OLD_VSIX="$ROOT/scientific-data-viewer-0.12.1.vsix"
NEW_VSIX="$ROOT/scientific-data-viewer-$VERSION.vsix"
SCENARIO=normal
SANDBOX=""
KEEP_OPEN=false
TIMEOUT_S=900
CODE="$(ls -d "$ROOT"/.vscode-test/vscode-*/bin/code 2>/dev/null | sort -V | tail -1)"
CODE="${CODE:-code}"

while [ $# -gt 0 ]; do
    case "$1" in
        --old) OLD_VSIX="$(realpath "$2")"; shift 2 ;;
        --new) NEW_VSIX="$(realpath "$2")"; shift 2 ;;
        --scenario) SCENARIO="$2"; shift 2 ;;
        --dir) SANDBOX="$2"; shift 2 ;;
        --keep-open) KEEP_OPEN=true; shift ;;
        --code) CODE="$2"; shift 2 ;;
        -h|--help) sed -n '2,32p' "$0"; exit 0 ;;
        *) echo "Unknown option: $1" >&2; exit 2 ;;
    esac
done
case "$SCENARIO" in normal|offline|interrupted) ;; *) echo "Unknown scenario: $SCENARIO" >&2; exit 2 ;; esac

# Started from a VS Code terminal, the variables of that VS Code (extension
# host, IPC socket...) would leak into the sandbox instance
for name in $(env | sed -n 's/^\(\(VSCODE\|ELECTRON\)_[A-Za-z0-9_]*\)=.*/\1/p'); do
    unset "$name"
done

SANDBOX="${SANDBOX:-$(mktemp -d -t sdv-upgrade-XXXXXX)}"
USER_DIR="$SANDBOX/user"
EXT_DIR="$SANDBOX/extensions"
ENV_DIR="$USER_DIR/User/globalStorage/eschalk0.scientific-data-viewer/python-environment"
DATA_FILE="$ROOT/sample-data/sample_data.nc"
OLD_MARKER="$ENV_DIR/left-by-old-version.txt"
REVISION="$(sed -n 's/.*ENVIRONMENT_REVISION = \([0-9]*\).*/\1/p' "$ROOT/src/python/ExtensionVirtualEnvironmentManager.ts")"
FAILURES=0

step() { printf '\n\033[1;34m== %s\033[0m\n' "$*"; }
ok() { printf '  \033[32mPASS\033[0m %s\n' "$*"; }
ko() { printf '  \033[31mFAIL\033[0m %s\n' "$*"; FAILURES=$((FAILURES + 1)); }
check() { local label="$1"; shift; if "$@"; then ok "$label"; else ko "$label"; fi; }

# Unpack a .vsix (a zip whose extension/ folder is the extension)
unpack() {
    rm -rf "$2"
    mkdir -p "$2"
    (cd "$2" && unzip -q "$1")
}

# Log of the extension's output channel, for launches after the marker file
extension_logs() {
    find "$USER_DIR/logs" -newer "$SANDBOX/.launch" -name '*Scientific Data Viewer*.log' -print0 2>/dev/null |
        xargs -0 -r cat
}

# launch <extension folder> [VAR=value...]: start the sandbox; the variables
# reach the extension host (scenario offline). The data file is opened once
# the window is up: opened on the command line, it is resolved before the
# development extension is registered and shown as a binary text file, which
# does not activate the extension.
launch() {
    local extension="$1"
    shift
    touch "$SANDBOX/.launch"
    sleep 1
    env "$@" "$CODE" --user-data-dir "$USER_DIR" --extensions-dir "$EXT_DIR" \
        --disable-extensions --extensionDevelopmentPath="$extension" \
        --new-window >/dev/null 2>&1
    for _ in $(seq 12); do
        sleep 5
        "$CODE" --user-data-dir "$USER_DIR" --extensions-dir "$EXT_DIR" \
            --reuse-window "$DATA_FILE" >/dev/null 2>&1 || true
        if [ -n "$(extension_logs)" ]; then
            return 0
        fi
    done
    ko "the extension did not start (no 'Scientific Data Viewer' log)"
}

stop() {
    pkill -f -- "$USER_DIR" 2>/dev/null || true
    for _ in $(seq 30); do
        pgrep -f -- "$USER_DIR" >/dev/null || return 0
        sleep 1
    done
    pkill -9 -f -- "$USER_DIR" 2>/dev/null || true
    sleep 1
}

wait_for_log() {
    local pattern="$1" waited=0
    # Not grep -q: it stops at the first match, cat gets SIGPIPE and, with
    # pipefail, the pipeline fails although the line is there
    while ! extension_logs | grep -E "$pattern" >/dev/null; do
        if [ "$waited" -ge "$TIMEOUT_S" ]; then
            ko "timed out after ${TIMEOUT_S}s waiting for log: $pattern"
            return 1
        fi
        sleep 2
        waited=$((waited + 2))
    done
    extension_logs | grep -E "$pattern" | tail -1 | sed 's/^/  log: /'
}

trap stop EXIT

step "Sandbox: $SANDBOX (scenario: $SCENARIO)"
command -v "$CODE" >/dev/null || { echo "VS Code CLI not found: $CODE (use --code)" >&2; exit 1; }
echo "VS Code: $CODE"
command -v uv >/dev/null || { echo "uv is required" >&2; exit 1; }
command -v unzip >/dev/null || { echo "unzip is required" >&2; exit 1; }
[ -f "$DATA_FILE" ] || { echo "Missing $DATA_FILE: run python python/create_sample_data.py" >&2; exit 1; }
[ -f "$OLD_VSIX" ] || { echo "Missing old release $OLD_VSIX" >&2; exit 1; }
if [ ! -f "$NEW_VSIX" ]; then
    step "Building $NEW_VSIX"
    (cd "$ROOT" && npm run package >/dev/null)
fi

mkdir -p "$USER_DIR/User" "$EXT_DIR"
cat >"$USER_DIR/User/settings.json" <<'EOF'
{
    "scientificDataViewer.python.useExtensionOwnEnvironment": true,
    "extensions.autoUpdate": false,
    "extensions.autoCheckUpdates": false,
    "security.workspace.trust.enabled": false,
    "telemetry.telemetryLevel": "off",
    "workbench.startupEditor": "none",
    "workbench.welcomePage.walkthroughs.openOnInstall": false,
    "workbench.tips.enabled": false,
    "chat.disableAIFeatures": true
}
EOF

OLD_EXT="$SANDBOX/old/extension"
NEW_EXT="$SANDBOX/new/extension"
unpack "$OLD_VSIX" "$SANDBOX/old"
unpack "$NEW_VSIX" "$SANDBOX/new"

step "1. Old release: $(basename "$OLD_VSIX")"
launch "$OLD_EXT"
wait_for_log 'Extension virtual environment created successfully'
stop
touch "$OLD_MARKER"
check "old release created its environment" test -x "$ENV_DIR/bin/python"

step "2. Upgrade to: $(basename "$NEW_VSIX")"

if [ "$SCENARIO" = offline ]; then
    # No cache and an unreachable index: the package install fails
    launch "$NEW_EXT" UV_NO_CACHE=1 UV_DEFAULT_INDEX=http://127.0.0.1:9/simple
    wait_for_log 'recreation failed'
    stop
    check "old environment kept after a failed rebuild" test -f "$OLD_MARKER"
    check "no backup folder left" test ! -e "$ENV_DIR.previous"
    check "rebuild still pending (no state file)" test ! -f "$ENV_DIR/sdv-environment.json"
    step "2b. Next start, back online"
fi

if [ "$SCENARIO" = interrupted ]; then
    # Without the uv cache the install takes long enough to be interrupted
    launch "$NEW_EXT" UV_NO_CACHE=1
    wait_for_log 'Creating extension virtual environment'
    pkill -9 -f -- "$USER_DIR" || true
    sleep 2
    check "previous environment moved aside during the rebuild" test -d "$ENV_DIR.previous"
    step "2b. Next start after the interruption"
    launch "$NEW_EXT"
    wait_for_log 'recreation was interrupted'
else
    launch "$NEW_EXT"
fi
wait_for_log 'Extension virtual environment recreated|recreation failed'
stop

step "3. Checks"
STATE="$ENV_DIR/sdv-environment.json"
check "state file written" test -f "$STATE"
check "state file has revision $REVISION" grep -q "\"revision\": $REVISION" "$STATE"
check "nothing left from the old environment" test ! -e "$OLD_MARKER"
check "no backup folder left" test ! -e "$ENV_DIR.previous"
check "log shows the rebuild" bash -c "find '$USER_DIR/logs' -name '*Scientific Data Viewer*.log' -print0 | xargs -0 grep -q 'Extension virtual environment recreated'"

check "eccodeslib < 2.48 (exit crash with pyproj)" "$ENV_DIR/bin/python" -c "
import sys
from importlib.metadata import version
major, minor = (int(part) for part in version('eccodeslib').split('.')[:2])
print('  eccodeslib', version('eccodeslib'))
sys.exit((major, minor) >= (2, 48))"

BACKEND="$NEW_EXT/python/get_data_info.py"
for sample in sample_data.nc sample_data.grib sample_data_cog.tif sample_data.cdf; do
    file="$ROOT/sample-data/$sample"
    [ -e "$file" ] || continue
    out="$("$ENV_DIR/bin/python" "$BACKEND" info "$file" 2>/dev/null | tail -1)" && status=0 || status=$?
    if [ "$status" -eq 0 ] && ! printf '%s' "$out" | grep -q '^{"error"'; then
        ok "backend opens $sample"
    else
        ko "backend on $sample (exit $status): ${out:0:200}"
    fi
done

if $KEEP_OPEN; then
    trap - EXIT
    launch "$NEW_EXT"
    step "Left open. Close the window, then: rm -rf $SANDBOX"
fi

step "Result"
if [ "$FAILURES" -eq 0 ]; then
    printf '\033[32mAll checks passed\033[0m (sandbox: %s)\n' "$SANDBOX"
else
    printf '\033[31m%d check(s) failed\033[0m; logs in %s/logs\n' "$FAILURES" "$USER_DIR"
    exit 1
fi
