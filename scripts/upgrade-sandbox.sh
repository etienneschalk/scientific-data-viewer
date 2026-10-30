#!/usr/bin/env bash
# Migration test: what a user sees when the extension updates from one release
# to another, played like a user would, in a real VS Code.
#
# In a throw-away VS Code profile (your own profile, extensions and Python
# environment are not touched). Each .vsix is unpacked and loaded as a
# development extension: same extension id, so the same storage folder and
# environment, which is what an update from the Marketplace keeps.
#   1. The user runs the OLD release with "Use Extension Own Environment" on
#      and a few settings of their own, and opens a data file: the release
#      creates its uv environment.
#   2. VS Code updates the extension to the NEW release; the user opens the
#      file again. Whether the environment must be rebuilt follows from what
#      is on disk and from the new release, as the extension decides it: no
#      state file (releases before 0.13), a lower ENVIRONMENT_REVISION or other
#      requirements -> deleted and recreated; same revision and requirements,
#      or a higher revision (downgrade) -> kept as it is.
#   3. Checks. Rebuild: the old environment is gone (a file left in it by the
#      test), a new one has the new revision, no backup folder is left. Keep:
#      the environment and its state file are untouched, nothing is rebuilt.
#      Always: the viewer shows the file, with the extension's environment;
#      every requirement of the new release is installed; the user's
#      settings.json is unchanged; the backend opens the sample files.
#
# Usage: scripts/upgrade-sandbox.sh [options]
#   --old <vsix>       release to upgrade from (default: scientific-data-viewer-0.12.1.vsix)
#   --new <vsix>       release to upgrade to (default: scientific-data-viewer-<version>.vsix,
#                      built with `npm run package` when missing); may be the same as --old
#   --bump-new         raise ENVIRONMENT_REVISION of the new release by one, as the next
#                      release that needs a rebuild would (with --old = --new: the
#                      revision counter itself is tested)
#   --expect <outcome> fail unless the expected outcome is `rebuild` or `keep`
#   --scenario <name>  normal       plain upgrade (default)
#                      offline      the rebuild fails (no package index): the old
#                                   environment must be kept; then a normal start
#                                   must rebuild it
#                      interrupted  VS Code is killed during the rebuild: the next
#                                   start must restore the old environment and rebuild
#                      (offline and interrupted need an upgrade that rebuilds)
#   --dir <path>       sandbox folder (default: a new temporary folder)
#   --keep-open        leave the new version open at the end, to look around
#   --code <path>      VS Code CLI (default: the newest build downloaded by `npm test`
#                      in .vscode-test/, else `code`; a snap `code` may not load the
#                      sandbox extensions)
#
# Exit code: 0 all checks passed, 1 a check failed, 3 the old release could not
# create its environment on this machine (nothing to migrate: not tested).
# Needs: VS Code, uv, Node, a display, and sample-data/ (python python/create_sample_data.py).
# Linux / macOS only. VS Code windows open on your screen: don't close them.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"
OLD_VSIX="$ROOT/scientific-data-viewer-0.12.1.vsix"
NEW_VSIX="$ROOT/scientific-data-viewer-$VERSION.vsix"
SCENARIO=normal
SANDBOX=""
KEEP_OPEN=false
BUMP_NEW=false
REQUIRED_OUTCOME=""
TIMEOUT_S=900
CODE="$(ls -d "$ROOT"/.vscode-test/vscode-*/bin/code 2>/dev/null | sort -V | tail -1)"
CODE="${CODE:-code}"

while [ $# -gt 0 ]; do
    case "$1" in
        --old) OLD_VSIX="$(realpath "$2")"; shift 2 ;;
        --new) NEW_VSIX="$(realpath "$2")"; shift 2 ;;
        --bump-new) BUMP_NEW=true; shift ;;
        --expect) REQUIRED_OUTCOME="$2"; shift 2 ;;
        --scenario) SCENARIO="$2"; shift 2 ;;
        --dir) SANDBOX="$2"; shift 2 ;;
        --keep-open) KEEP_OPEN=true; shift ;;
        --code) CODE="$2"; shift 2 ;;
        -h|--help) sed -n '2,51p' "$0"; exit 0 ;;
        *) echo "Unknown option: $1" >&2; exit 2 ;;
    esac
done
case "$SCENARIO" in normal|offline|interrupted) ;; *) echo "Unknown scenario: $SCENARIO" >&2; exit 2 ;; esac
case "$REQUIRED_OUTCOME" in ""|rebuild|keep) ;; *) echo "Unknown outcome: $REQUIRED_OUTCOME" >&2; exit 2 ;; esac

# Started from a VS Code terminal, the variables of that VS Code (extension
# host, IPC socket...) would leak into the sandbox instance
for name in $(env | sed -n 's/^\(\(VSCODE\|ELECTRON\)_[A-Za-z0-9_]*\)=.*/\1/p'); do
    unset "$name"
done

SANDBOX="${SANDBOX:-$(mktemp -d -t sdv-upgrade-XXXXXX)}"
USER_DIR="$SANDBOX/user"
EXT_DIR="$SANDBOX/extensions"
ENV_DIR="$USER_DIR/User/globalStorage/eschalk0.scientific-data-viewer/python-environment"
STATE="$ENV_DIR/sdv-environment.json"
SETTINGS="$USER_DIR/User/settings.json"
DATA_FILE="$ROOT/sample-data/sample_data.nc"
OLD_MARKER="$ENV_DIR/left-by-old-version.txt"
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

# Whether the logs of the last launch contain a text (grep reads them all:
# see wait_for_log)
last_logs_have() { extension_logs | grep -F -- "$1" >/dev/null; }
last_logs_lack() { ! last_logs_have "$1"; }

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

# wait_for_log <regex> [timeout in s]
wait_for_log() {
    local pattern="$1" timeout="${2:-$TIMEOUT_S}" waited=0
    # Not grep -q: it stops at the first match, cat gets SIGPIPE and, with
    # pipefail, the pipeline fails although the line is there
    while ! extension_logs | grep -E "$pattern" >/dev/null; do
        if [ "$waited" -ge "$timeout" ]; then
            ko "timed out after ${timeout}s waiting for log: $pattern"
            return 1
        fi
        sleep 2
        waited=$((waited + 2))
    done
    extension_logs | grep -E "$pattern" | tail -1 | sed 's/^/  log: /'
}

# Compiled environment manager of an unpacked release
manager_js() { echo "$1/out/src/python/ExtensionVirtualEnvironmentManager.js"; }

# ENVIRONMENT_REVISION of an unpacked release (0 before revisions existed)
revision_of() {
    local js
    js="$(manager_js "$1")"
    sed -n 's/.*ENVIRONMENT_REVISION = \([0-9]*\).*/\1/p' "$js" 2>/dev/null | head -1 | grep . || echo 0
}

# Requirements installed by an unpacked release (requirements + constraints)
requirements_of() {
    node - "$(manager_js "$1")" <<'EOF'
const source = require('fs').readFileSync(process.argv[2], 'utf8');
const list = (name) => {
    const match = source.match(new RegExp(`exports\\.${name} = \\[([^\\]]*)\\]`));
    return match ? [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
};
console.log([...list('ALL_REQUIREMENTS'), ...list('ENVIRONMENT_CONSTRAINTS')].join('\n'));
EOF
}

# What the new release must do with the environment on disk: "rebuild <why>"
# or "keep <why>" (the rule of getUpdateReason, ExtensionVirtualEnvironmentManager.ts)
expected_outcome() {
    STATE_FILE="$STATE" REVISION="$REVISION" REQUIREMENTS="$(requirements_of "$NEW_EXT")" node <<'EOF'
const fs = require('fs');
const revision = Number(process.env.REVISION);
const required = process.env.REQUIREMENTS.split('\n').filter(Boolean).sort().join(', ');
if (!fs.existsSync(process.env.STATE_FILE)) {
    console.log('rebuild: no state file, the environment comes from a release without revision tracking');
    process.exit(0);
}
const state = JSON.parse(fs.readFileSync(process.env.STATE_FILE, 'utf8'));
const recorded = [...state.requirements].sort().join(', ');
if (state.revision < revision) {
    console.log(`rebuild: environment revision ${state.revision} < ${revision} required by the new release`);
} else if (state.revision > revision) {
    console.log(`keep: environment revision ${state.revision} > ${revision}, made by a newer release`);
} else if (recorded !== required) {
    console.log(`rebuild: same revision ${revision}, requirements changed (${recorded} -> ${required})`);
} else {
    console.log(`keep: same revision ${revision} and same requirements`);
}
EOF
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

# The user's settings: the own environment, a few display choices, and a
# setting that later releases removed (globalTimeControls, gone in 0.13)
mkdir -p "$USER_DIR/User" "$EXT_DIR"
cat >"$SETTINGS" <<'EOF'
{
    "scientificDataViewer.python.useExtensionOwnEnvironment": true,
    "scientificDataViewer.matplotlibStyle": "dark_background",
    "scientificDataViewer.convertBandsToVariables": false,
    "scientificDataViewer.maxFileSize": 5000,
    "scientificDataViewer.globalTimeControls": true,
    "extensions.autoUpdate": "off",
    "extensions.autoCheckUpdates": false,
    "security.workspace.trust.enabled": false,
    "telemetry.telemetryLevel": "off",
    "workbench.startupEditor": "none",
    "workbench.welcomePage.walkthroughs.openOnInstall": false,
    "workbench.tips.enabled": false,
    "chat.disableAIFeatures": true
}
EOF
# VS Code rewrites some of its own settings in their current form (autoUpdate
# false -> "off"): they are written that way, so any change is the extension's
cp "$SETTINGS" "$SANDBOX/settings.user.json"

OLD_EXT="$SANDBOX/old/extension"
NEW_EXT="$SANDBOX/new/extension"
unpack "$OLD_VSIX" "$SANDBOX/old"
unpack "$NEW_VSIX" "$SANDBOX/new"
OLD_NAME="$(basename "$OLD_VSIX" .vsix)"
NEW_NAME="$(basename "$NEW_VSIX" .vsix)"
if $BUMP_NEW; then
    bumped=$(($(revision_of "$NEW_EXT") + 1))
    sed -i "s/ENVIRONMENT_REVISION = [0-9]*/ENVIRONMENT_REVISION = $bumped/" "$(manager_js "$NEW_EXT")"
    NEW_NAME="$NEW_NAME (ENVIRONMENT_REVISION raised to $bumped)"
fi
REVISION="$(revision_of "$NEW_EXT")"

step "1. The user runs $OLD_NAME with its own environment and opens $(basename "$DATA_FILE")"
launch "$OLD_EXT"
# Every release logs "Python environment ready" once its interpreter has the
# packages (0.5 / 0.6 have no "Extension virtual environment created" line);
# the interpreter must be the one of the own environment
if ! wait_for_log 'Extension virtual environment created successfully|Python environment ready' 300 ||
    [ ! -x "$ENV_DIR/bin/python" ]; then
    printf '\033[33mNOT TESTED\033[0m %s could not create its environment on this machine (nothing to migrate); logs in %s/logs\n' \
        "$OLD_NAME" "$USER_DIR"
    exit 3
fi
stop
ok "$OLD_NAME created its environment"
touch "$OLD_MARKER"
[ -f "$STATE" ] && cp "$STATE" "$SANDBOX/state.before.json"

step "2. VS Code updates the extension to $NEW_NAME; the user opens the file again"
EXPECTATION="$(expected_outcome)"
OUTCOME="${EXPECTATION%%:*}"
echo "  Expected: $EXPECTATION"
if [ -n "$REQUIRED_OUTCOME" ] && [ "$OUTCOME" != "$REQUIRED_OUTCOME" ]; then
    ko "this upgrade must $REQUIRED_OUTCOME the environment (--expect), the rule says $OUTCOME"
fi
if [ "$SCENARIO" != normal ] && [ "$OUTCOME" != rebuild ]; then
    echo "Scenario $SCENARIO needs an upgrade that rebuilds the environment" >&2
    exit 2
fi

if [ "$SCENARIO" = offline ]; then
    # No cache and an unreachable index: the package install fails
    launch "$NEW_EXT" UV_NO_CACHE=1 UV_DEFAULT_INDEX=http://127.0.0.1:9/simple
    wait_for_log 'recreation failed'
    stop
    check "old environment kept after a failed rebuild" test -f "$OLD_MARKER"
    check "no backup folder left" test ! -e "$ENV_DIR.previous"
    check "rebuild still pending (no state file)" test ! -f "$STATE"
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
# The extension's decision, whichever it is: the checks below say whether it
# is the expected one (a wrong decision fails at once, not at the timeout)
wait_for_log 'Extension virtual environment (recreated|recreation failed|is up to date)'
# What the user sees: the file in the viewer
wait_for_log "\[load:$(basename "$DATA_FILE")\] load complete" || true
stop

step "3. What the user gets"
if [ "$OUTCOME" = rebuild ]; then
    check "the old environment was deleted (the file left in it is gone)" test ! -e "$OLD_MARKER"
    check "a new environment was created for revision $REVISION (state file)" grep -q "\"revision\": $REVISION" "$STATE"
    check "no backup folder left" test ! -e "$ENV_DIR.previous"
    check "the log shows the rebuild" last_logs_have 'Extension virtual environment recreated'
else
    check "the environment was kept (the file left in it is still there)" test -f "$OLD_MARKER"
    if [ -f "$SANDBOX/state.before.json" ]; then
        check "its state file is unchanged" cmp -s "$SANDBOX/state.before.json" "$STATE"
    fi
    check "nothing was rebuilt (no 'Recreating' in the log)" last_logs_lack 'Recreating extension virtual environment'
    check "the extension found it up to date" last_logs_have 'Extension virtual environment is up to date'
fi
check "the viewer shows $(basename "$DATA_FILE")" last_logs_have "[load:$(basename "$DATA_FILE")] load complete"
check "with the extension's own environment" last_logs_have "Python environment ready: $ENV_DIR"
check "the user's settings.json is unchanged" cmp -s "$SANDBOX/settings.user.json" "$SETTINGS"

# Every requirement and constraint of the new release is satisfied
# (packaging is a dependency of xarray, so it is in the environment)
requirements_of "$NEW_EXT" >"$SANDBOX/requirements.txt"
check "every requirement of the new release is installed ($(paste -sd' ' "$SANDBOX/requirements.txt"))" \
    "$ENV_DIR/bin/python" - "$SANDBOX/requirements.txt" <<'EOF'
import sys
from importlib.metadata import PackageNotFoundError, version

from packaging.requirements import Requirement

failed = False
for line in open(sys.argv[1]).read().split():
    requirement = Requirement(line)
    try:
        installed = version(requirement.name)
    except PackageNotFoundError:
        installed = None
    if installed is None or not requirement.specifier.contains(installed, prereleases=True):
        print(f"  {requirement}: installed {installed}")
        failed = True
sys.exit(failed)
EOF

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

step "Result: $OLD_NAME -> $NEW_NAME ($OUTCOME)"
if [ "$FAILURES" -eq 0 ]; then
    printf '\033[32mAll checks passed\033[0m (sandbox: %s)\n' "$SANDBOX"
else
    printf '\033[31m%d check(s) failed\033[0m; logs in %s/logs\n' "$FAILURES" "$USER_DIR"
    exit 1
fi
