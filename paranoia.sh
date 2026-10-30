#!/usr/bin/env bash
# =============================================================================
# Scientific Data Viewer - paranoia.sh
# =============================================================================
# Every automated check that stands between a commit and the users, in one
# run, then a publication readiness report. Nothing is published, tagged or
# committed: run ./publish.sh afterwards.
#
#   release docs  version, CHANGELOG, release notes, PR summary, links, README
#                 and architecture diagrams in sync (and regenerated identically), Marketplace / Open VSX versions
#   code          pre-commit on all files (prettier, eslint, tsc, ruff, secrets...)
#   build         clean compile, .vsix package
#   package       .vsix contents (nothing missing, nothing leaked) and the
#                 packaged Python backend run on sample files
#   tests         sample data regenerated, pytest, npm test (VS Code), golden
#                 snapshots, non-regression plot gallery
#   regression    backend info / plots / ~80 plot scenarios vs the last release,
#                 real webview in headless Chromium, e2e suites in a real VS Code
#                 on the packaged extension
#   users         uv environment change; migration from every older release
#                 to this one, played as a user (environment rebuilt or kept as
#                 ENVIRONMENT_REVISION says, settings kept, file shown); failed
#                 and interrupted rebuilds; screenshots, npm audit, CI status
#
# Usage: ./paranoia.sh [options]
#   --quick            static checks, build, package, unit tests (~5 min)
#   --standard         (default) + golden snapshots, backend vs last release, webview
#                      harness, npm audit, CI status (~20 min)
#   --full             + e2e suites, migration from every release, upgrade
#                      failure modes, screenshots (~45 min). Only
#                      a full run can conclude READY.
#   --only a,b         run only these steps (ids: --list)
#   --skip a,b         skip these steps
#   --baseline <ref>   last release to compare with (default: newest v* tag
#                      other than the current version)
#   --out <dir>        run folder (default: artefacts/paranoia/<date-time>)
#   --list             list the steps and exit
#   -v, --verbose      show the output of each step (always in logs/<step>.log)
#   -h, --help         this help
#
# Writes <run>/REPORT.md (verdict, table of checks, failures with the end of
# their logs, what is left to do by hand) and <run>/logs/; artefacts/paranoia/latest
# points at the last run. Exit code 1 when a check failed, else 0.
#
# Needs: Node 22 (nvm), the repository .venv (Python 3.13, see setup.sh),
# pre-commit. Default profile: Chromium (Playwright). --full: uv, a display
# (or xvfb-run). Every output goes to artefacts/ (git-ignored): sample data,
# golden snapshots, screenshots, the .vsix of older releases, rebuilt from their
# tags (scripts/release-vsix.sh) into artefacts/vsix-releases/ when missing.
# Fixes of the pre-commit hooks are saved to <run>/pre-commit.patch, not applied.
# Env: PARANOIA_PYTHON (tooling, pytest: .venv/bin/python), SDV_PYTHON
# (backend interpreter of the QA harnesses, see scripts/qa/README.md),
# PARANOIA_MIGRATION_FROM (releases to migrate from, e.g. "0.12.1"; default:
# the last patch of each minor release from PARANOIA_MIGRATION_MIN=0.12.1 on).
# =============================================================================

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT" || exit 2

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
DIM='\033[2m'
NC='\033[0m'
[ -t 1 ] || { RED=''; GREEN=''; YELLOW=''; BLUE=''; DIM=''; NC=''; }

# id|profile|area|title — run in this order; a profile includes the ones before it
STEPS=(
    "env|quick|Setup|Tools and versions"
    "git|quick|Setup|Repository state"
    "release|quick|Release|Version and release documents"
    "readme|quick|Release|README.md matches its generator"
    "architecture|quick|Release|Architecture diagrams match the code"
    "uv-env|quick|Users|uv environment change since the last release"
    "pre-commit|quick|Code|pre-commit on all files"
    "compile|quick|Build|Clean compile"
    "package|quick|Build|Package the .vsix"
    "vsix|quick|Package|.vsix contents"
    "sample-data|quick|Tests|Sample data regenerated"
    "vsix-backend|quick|Package|Packaged backend on sample files"
    "pytest|quick|Tests|Python tests (pytest)"
    "npm-test|quick|Tests|Extension tests in VS Code (npm test)"
    "golden|standard|Regression|Golden snapshots of the backend"
    "non-regression|standard|Regression|Non-regression plot gallery (issue #117 cases)"
    "qa-fixtures|standard|Regression|Hostile QA fixtures"
    "qa-baseline|standard|Regression|Checkout of the last release"
    "qa-info|standard|Regression|Backend info vs last release"
    "qa-plot|standard|Regression|Every variable plotted vs last release"
    "qa-scen|standard|Regression|Plot-option scenarios vs last release"
    "qa-webview|standard|Regression|Real webview in headless Chromium"
    "npm-audit|standard|Dependencies|npm audit"
    "ci|standard|Release|CI status of this commit"
    "qa-e2e|full|Regression|End-to-end suites in VS Code (packaged extension)"
    "migration|full|Users|Migration from every release (uv environment, settings, viewer)"
    "upgrade|full|Users|Failed and interrupted environment rebuilds"
    "screenshots|full|Users|Viewer screenshots"
)

PROFILE=standard
ONLY=""
SKIP_LIST=""
BASELINE=""
OUT=""
VERBOSE=false

usage() { awk 'NR > 1 && /^set -uo pipefail/ { exit } NR > 1' "$0" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
    case "$1" in
        --quick) PROFILE=quick; shift ;;
        --standard) PROFILE=standard; shift ;;
        --full) PROFILE=full; shift ;;
        --only) ONLY="$2"; shift 2 ;;
        --skip) SKIP_LIST="$2"; shift 2 ;;
        --baseline) BASELINE="$2"; shift 2 ;;
        --out) OUT="$2"; shift 2 ;;
        -v|--verbose) VERBOSE=true; shift ;;
        --list)
            printf '%-14s %-9s %-13s %s\n' ID PROFILE AREA TITLE
            for s in "${STEPS[@]}"; do IFS='|' read -r id prof area title <<<"$s"; printf '%-14s %-9s %-13s %s\n' "$id" "$prof" "$area" "$title"; done
            exit 0 ;;
        -h|--help) usage; exit 0 ;;
        *) echo "Unknown option: $1 (see --help)" >&2; exit 2 ;;
    esac
done

# =============================================================================
# Environment shared by every step
# =============================================================================

# Node 22 from .nvmrc: the system Node can be too old for prettier / esbuild
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck disable=SC1091
    source "$HOME/.nvm/nvm.sh" >/dev/null && nvm use >/dev/null 2>&1
fi
# Set in a VS Code terminal; the VS Code started by the tests would run as Node
unset ELECTRON_RUN_AS_NODE

PY="${PARANOIA_PYTHON:-$ROOT/.venv/bin/python}"
EXTENSION_ENV_PY="$HOME/.config/Code/User/globalStorage/eschalk0.scientific-data-viewer/python-environment/bin/python"
if [ -z "${SDV_PYTHON:-}" ]; then
    if [ -x "$EXTENSION_ENV_PY" ]; then SDV_PYTHON="$EXTENSION_ENV_PY"; else SDV_PYTHON="$ROOT/.venv/bin/python"; fi
fi
export SDV_PYTHON

VERSION="$(node -p "require('./package.json').version")"
MAJOR_MINOR="${VERSION%.*}"
if [ -z "$BASELINE" ]; then
    BASELINE="$(git tag --list 'v*' --sort=-v:refname | grep -vx "v$VERSION" | head -1)"
fi
ARTEFACTS="$ROOT/artefacts"
RELEASES="$ARTEFACTS/vsix-releases"
SAMPLES="$ARTEFACTS/sample-data"
PREVIOUS_VSIX="$RELEASES/scientific-data-viewer-${BASELINE#v}.vsix"

RUN_ID="$(date +%Y%m%d-%H%M%S)"
OUT="$(mkdir -p "${OUT:-$ARTEFACTS/paranoia/$RUN_ID}" && cd "${OUT:-$ARTEFACTS/paranoia/$RUN_ID}" && pwd)"
LOGS="$OUT/logs"
RESULTS="$OUT/results.tsv"
mkdir -p "$LOGS"
: >"$RESULTS"
[ "$OUT" = "$ARTEFACTS/paranoia/$RUN_ID" ] && ln -sfn "$RUN_ID" "$ARTEFACTS/paranoia/latest"

# QA harness outputs stay inside the run folder
export SDV_QA_OUT="$OUT/qa"
export SDV_QA_BASELINE="$OUT/baseline"
VSIX=""
EXT_DIR="$OUT/vsix/extension"
ARTIFACTS=()

# =============================================================================
# Step helpers: a step sets STATUS / SUMMARY; its output goes to its log
# =============================================================================

STATUS=PASS
SUMMARY=""
fail() { STATUS=FAIL; SUMMARY="$*"; }
warn() { [ "$STATUS" = FAIL ] || { STATUS=WARN; SUMMARY="$*"; }; }
skip() { STATUS=SKIP; SUMMARY="$*"; }
note() { [ "$STATUS" = PASS ] && SUMMARY="$*"; }

# Echo then run a command
run() { echo "\$ $*"; "$@"; }

# Run a command that opens windows: on $DISPLAY, else in xvfb-run; 125 if neither
with_display() {
    if [ -n "${DISPLAY:-}" ]; then
        run "$@"
    elif command -v xvfb-run >/dev/null; then
        run xvfb-run -a "$@"
    else
        echo "no display and no xvfb-run"
        return 125
    fi
}

# Run checks.py <command>: exit 0 / 1 / 3 and a last line SUMMARY: ...
checks() {
    local rc out
    out="$(mktemp)"
    run "$PY" scripts/paranoia/checks.py "$@" | tee "$out"
    rc=${PIPESTATUS[0]}
    local line
    line="$(sed -n 's/^SUMMARY: //p' "$out" | tail -1)"
    rm -f "$out"
    case $rc in
        0) note "$line" ;;
        3) warn "$line" ;;
        *) fail "${line:-checks.py $1 crashed (exit $rc)}" ;;
    esac
}

# Count lines of a log starting with a tag
count() { grep -c "^$1" "$2" 2>/dev/null || true; }

# =============================================================================
# Steps
# =============================================================================

step_env() {
    local node_major
    node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
    echo "node $(node -v 2>/dev/null), npm $(npm -v 2>/dev/null)"
    [ "$node_major" -ge 22 ] || { fail "Node 22+ required (found $(node -v 2>/dev/null || echo none)): nvm install 22"; return; }
    [ -x "$PY" ] || { fail "$PY missing: create the .venv (setup.sh) or set PARANOIA_PYTHON"; return; }
    "$PY" -c 'import sys; assert sys.version_info >= (3, 13), sys.version' || { fail "$PY is older than Python 3.13"; return; }
    echo "tooling python: $PY ($("$PY" --version))"
    echo "backend python: $SDV_PYTHON"
    "$SDV_PYTHON" -c 'import xarray, zarr, matplotlib; print("xarray", xarray.__version__, "zarr", zarr.__version__, "matplotlib", matplotlib.__version__)' \
        || { fail "backend interpreter $SDV_PYTHON cannot import xarray / zarr / matplotlib"; return; }
    command -v pre-commit >/dev/null || "$PY" -m pre_commit --version >/dev/null 2>&1 || warn "pre-commit not found: pip install pre-commit"
    local t missing=()
    for t in uv unzip git; do command -v $t >/dev/null || missing+=("$t"); done
    [ -n "${DISPLAY:-}" ] || command -v xvfb-run >/dev/null || missing+=("display/xvfb-run")
    [ -n "$BASELINE" ] || missing+=("baseline tag")
    echo "baseline: ${BASELINE:-none}, previous package: $PREVIOUS_VSIX$([ -f "$PREVIOUS_VSIX" ] || echo ' (rebuilt from its tag when needed)')"
    [ ${#missing[@]} -eq 0 ] || warn "missing for some steps: ${missing[*]}"
    note "Node $(node -v), $("$PY" --version), backend: $("$SDV_PYTHON" -c 'import xarray; print("xarray", xarray.__version__)')"
}

step_git() {
    local branch dirty behind
    branch="$(git branch --show-current)"
    dirty="$(git status --porcelain)"
    run git status --short --branch
    behind="$(git rev-list --count HEAD..main 2>/dev/null || echo 0)"
    [ -z "$dirty" ] || warn "uncommitted changes: the results do not belong to a commit"
    [ "$behind" -eq 0 ] || warn "main has $behind commit(s) that $branch does not: rebase or merge before releasing"
    note "$branch at $(git rev-parse --short HEAD), $(git rev-list --count main..HEAD) commit(s) ahead of main, clean"
}

step_release() {
    local market openvsx
    market="$(timeout 60 npx --no-install vsce show eschalk0.scientific-data-viewer --json 2>/dev/null | "$PY" -c 'import json,sys; print(json.load(sys.stdin)["versions"][0]["version"])' 2>/dev/null)"
    openvsx="$(timeout 30 curl -fsS https://open-vsx.org/api/eschalk0/scientific-data-viewer 2>/dev/null | "$PY" -c 'import json,sys; print(json.load(sys.stdin)["version"])' 2>/dev/null)"
    checks release "$VERSION" --base main --published "Marketplace=$market" --published "Open VSX=$openvsx"
}

step_readme() {
    local generated
    generated="$(mktemp --suffix=.md)"
    run "$PY" scripts/generate_readme.py --no-timestamp --output "$generated" || { fail "generate_readme.py failed"; rm -f "$generated"; return; }
    if cmp -s "$generated" README.md; then
        note "README.md is up to date"
    else
        diff -u README.md "$generated" | head -80
        fail "README.md differs from package.json + docs/documentation.json: run scripts/generate_readme.py --no-timestamp"
    fi
    rm -f "$generated"
}

step_architecture() {
    if ! run "$PY" scripts/architecture/generate.py --check; then
        fail "docs/architecture/ is stale: fix scripts/architecture/, then generate.py"
        return
    fi
    # Regenerated (Graphviz) into the run folder: must give the committed files
    if ! command -v dot >/dev/null; then
        note "every module placed, every named symbol exists (Graphviz missing: not regenerated)"
        return
    fi
    run "$PY" scripts/architecture/generate.py --out "$OUT/architecture" || { fail "generate.py failed"; return; }
    if diff -rq "$OUT/architecture" docs/architecture; then
        note "every module placed, every named symbol exists; regenerated identically"
    elif dot -V 2>&1 | grep -q ' 2\.43\.'; then
        fail "regenerated diagrams differ from docs/architecture/ (same Graphviz 2.43): run generate.py and commit"
    else
        warn "regenerated diagrams differ, Graphviz $(dot -V 2>&1 | grep -o '[0-9][0-9.]*' | head -1) (committed with 2.43): layouts may differ between versions"
    fi
}

UV_ENV_CHANGED=false
step_uv_env() {
    [ -n "$BASELINE" ] || { skip "no baseline tag"; return; }
    checks env-change "$BASELINE"
    [ "$STATUS" = WARN ] || return
    UV_ENV_CHANGED=true
    # The upgrade step answers the question: no warning when it runs
    if selected migration; then
        STATUS=PASS
        SUMMARY="changed since $BASELINE: users' uv environments are rebuilt at first start (checked by the migration step)"
    fi
}

step_pre_commit() {
    local before changed=() patch="$OUT/pre-commit.patch"
    local cmd=(pre-commit)
    command -v pre-commit >/dev/null || cmd=("$PY" -m pre_commit)
    before="$(git diff --name-only)"
    run "${cmd[@]}" run --all-files --color never
    local rc=$?
    # Files without changes before that the hooks rewrote: keep the fix as a
    # patch and restore them, so the run leaves the working tree as it was
    mapfile -t changed < <(comm -13 <(sort <<<"$before") <(git diff --name-only | sort) | grep .)
    if [ ${#changed[@]} -gt 0 ]; then
        git diff -- "${changed[@]}" >"$patch"
        git checkout -- "${changed[@]}"
        echo "restored ${changed[*]}; the hooks' fix is in $patch"
        ARTIFACTS+=("Fix of the pre-commit hooks (not applied): \`git apply $patch\`")
    fi
    if [ $rc -eq 0 ]; then
        note "every hook passed"
    elif [ ${#changed[@]} -gt 0 ]; then
        fail "hooks would reformat ${changed[*]} (the CI fails on it): git apply pre-commit.patch, commit"
    else
        fail "hook failures (lint, types, secrets...): see log"
    fi
}

step_compile() {
    # As vscode:prepublish: no stale compiled files of deleted sources
    run rm -rf out
    if run npm run --silent compile; then
        note "out/src and out/webview/webview.js built from scratch"
    else
        fail "npm run compile failed"
    fi
}

step_package() {
    local target="$OUT/scientific-data-viewer-$VERSION.vsix"
    if ! run npx --no-install vsce package --out "$target" </dev/null; then
        fail "vsce package failed"
        return
    fi
    VSIX="$target"
    rm -rf "$OUT/vsix"
    run unzip -q "$VSIX" -d "$OUT/vsix" || { fail "cannot unzip $VSIX"; return; }
    note "$(basename "$VSIX"), $(du -k "$VSIX" | cut -f1) KiB"
}

step_vsix() {
    [ -n "$VSIX" ] || { skip "no package (package step failed or not run)"; return; }
    local previous=()
    [ -f "$PREVIOUS_VSIX" ] && previous=(--previous "$PREVIOUS_VSIX")
    checks vsix "$VSIX" "${previous[@]}"
}

step_sample_data() {
    # Every run regenerates the files (seconds): the generators are tested too,
    # and the files match the code of this commit. The disposable files are
    # opened by the e2e suite S8 ("open 20 files quickly")
    if run "$PY" python/create_sample_data.py --overwrite --disposable; then
        note "artefacts/sample-data/ regenerated ($(find "$SAMPLES" -mindepth 1 -maxdepth 1 | wc -l) entries)"
    else
        fail "python/create_sample_data.py failed"
    fi
}

step_vsix_backend() {
    [ -d "$EXT_DIR" ] || { skip "no unpacked package (package step failed or not run)"; return; }
    checks smoke "$EXT_DIR" --python "$SDV_PYTHON" --samples "$SAMPLES"
}

step_pytest() {
    run "$PY" -m pytest python/tests -q -p no:cacheprovider
    local rc=$? last
    last="$(grep -E '(passed|failed|error)' "$LOGS/pytest.log" | tail -1 | tr -d '=' | xargs)"
    if [ $rc -eq 0 ]; then note "$last"; else fail "${last:-pytest exit $rc}"; fi
}

step_npm_test() {
    with_display npm test
    local rc=$? passing failing
    [ $rc -eq 125 ] && { skip "no display and no xvfb-run"; return; }
    passing="$(grep -Eo '[0-9]+ passing' "$LOGS/npm-test.log" | tail -1)"
    failing="$(grep -Eo '[0-9]+ failing' "$LOGS/npm-test.log" | tail -1)"
    if [ $rc -eq 0 ]; then note "${passing:-passed}"; else fail "${failing:-npm test exit $rc}${passing:+, $passing}"; fi
}

step_golden() {
    if [ -z "$(ls -A "$ARTEFACTS/golden" 2>/dev/null)" ]; then
        skip "no snapshots recorded (python python/tools/golden_snapshots.py record, on a known-good commit)"
        return
    fi
    run "$PY" python/tools/golden_snapshots.py check
    local rc=$? last
    last="$(tail -1 "$LOGS/golden.log")"
    if [ $rc -eq 0 ]; then
        note "$last"
    else
        warn "$last: output changed since the snapshots were recorded; re-record if intended"
    fi
}

step_non_regression() {
    run "$SDV_PYTHON" python/non_regression_test_plot.py --out-dir "$OUT/non-regression-plots"
    local rc=$? cases failed
    cases="$(grep -c ': ok -> ' "$LOGS/non-regression.log" || true)"
    failed="$(grep -c ': FAILED: ' "$LOGS/non-regression.log" || true)"
    if [ $rc -eq 0 ]; then
        note "$cases plots drawn (look at summary.md)"
    else
        fail "$failed of $((cases + failed)) plot cases fail: see log"
    fi
    ARTIFACTS+=("Non-regression plot gallery: \`$OUT/non-regression-plots/summary.md\`")
}

step_qa_fixtures() {
    if run "$PY" scripts/qa/fixtures/make_fixtures.py; then
        note "$(find "$SDV_QA_OUT/fixtures" -mindepth 1 -maxdepth 1 | wc -l) fixtures in qa/fixtures"
    else
        fail "make_fixtures.py failed"
    fi
}

BASELINE_CREATED=false
step_qa_baseline() {
    [ -n "$BASELINE" ] || { skip "no baseline tag (--baseline <ref>)"; return; }
    if run scripts/qa/backend/make_baseline.sh "$BASELINE"; then
        BASELINE_CREATED=true
        note "$BASELINE checked out in baseline/"
    else
        fail "cannot check out $BASELINE"
    fi
}

need_baseline() {
    [ -f "$SDV_QA_BASELINE/python/get_data_info.py" ] && return 0
    skip "no baseline checkout (qa-baseline step failed or not run)"
    return 1
}

step_qa_info() {
    need_baseline || return
    run "$PY" scripts/qa/backend/diff_info.py --out "$OUT/backend" || { fail "diff_info.py crashed"; return; }
    checks info-diff "$OUT/backend" "$LOGS/qa-info.log"
}

# Status of diff_plot.py / diff_scen.py from their exit code and tags
plot_tags() {
    local rc=$1 log=$2 what=$3 same diff regress errchg fixed
    same="$(count SAME "$log")"; diff="$(count DIFF "$log")"; regress="$(count 'REGRESSION?' "$log")"
    errchg="$(count ERR-CHANGED "$log")"; fixed="$(count 'FIXED?' "$log")"
    local counts="$same same, $diff differ, $fixed fixed, $regress regressed"
    if [ "$regress" -gt 0 ] || [ "$rc" -ne 0 ]; then
        fail "$regress $what worked in $BASELINE and fail now ($counts)"
    elif [ "$diff" -gt 0 ] || [ "$errchg" -gt 0 ]; then
        [ "$errchg" -eq 0 ] || counts="$counts, $errchg error message(s) changed"
        warn "$diff $what look different from $BASELINE: check that it is intended ($counts)"
    else
        note "$counts"
    fi
}

step_qa_plot() {
    need_baseline || return
    [ -d "$OUT/backend/info" ] || { skip "needs the info of qa-info"; return; }
    run "$PY" scripts/qa/backend/diff_plot.py --out "$OUT/backend"
    plot_tags $? "$LOGS/qa-plot.log" "plots"
    ARTIFACTS+=("Plot differences vs $BASELINE: \`$OUT/backend/plots.json\`")
}

step_qa_scen() {
    need_baseline || return
    run "$PY" scripts/qa/backend/diff_scen.py --out "$OUT/backend"
    plot_tags $? "$LOGS/qa-scen.log" "scenarios"
    ARTIFACTS+=("Scenario images (old / new side by side): \`$OUT/backend/scenarios/\`")
}

step_qa_webview() {
    [ -f out/webview/webview.js ] || { skip "out/ not compiled"; return; }
    run node scripts/qa/webview/run-all.mjs
    local rc=$? passed failed
    passed="$(grep -c 'PASS' "$LOGS/qa-webview.log" || true)"
    failed="$(grep -c 'FAIL' "$LOGS/qa-webview.log" || true)"
    if [ $rc -eq 0 ]; then note "$passed checks passed (render, controls, cancel)"; else fail "$failed failing check(s): see log"; fi
    ARTIFACTS+=("Webview screenshots and exported pages: \`$SDV_QA_OUT/webview/\`")
}

step_npm_audit() {
    run npm audit --audit-level=moderate
    local rc=$?
    if [ $rc -eq 0 ]; then
        note "no moderate or worse vulnerability"
    else
        local summary
        summary="$(grep -E 'vulnerabilit' "$LOGS/npm-audit.log" | tail -1)"
        warn "${summary:-npm audit failed (offline?)}: dev dependencies only (no node_modules in the .vsix), but the CI fails on it"
    fi
}

step_ci() {
    local sha
    sha="$(git rev-parse HEAD)"
    if ! git branch -r --contains "$sha" 2>/dev/null | grep -q .; then
        warn "HEAD is not pushed: the CI (Linux and Windows) has not run on it"
        return
    fi
    if ! command -v gh >/dev/null || ! gh auth status >/dev/null 2>&1; then
        warn "cannot read the CI status (gh missing or not logged in): check the PR checks, Windows included"
        return
    fi
    run gh run list --commit "$sha" --json workflowName,status,conclusion,url \
        --template '{{range .}}{{.workflowName}}	{{.status}}	{{.conclusion}}	{{.url}}{{"\n"}}{{end}}' >"$OUT/ci.tsv"
    cat "$OUT/ci.tsv"
    if [ ! -s "$OUT/ci.tsv" ]; then
        warn "no CI run for $(git rev-parse --short HEAD)"
    elif grep -qvP '\tcompleted\tsuccess\t' "$OUT/ci.tsv"; then
        if grep -qP '\t(failure|cancelled|timed_out)\t' "$OUT/ci.tsv"; then fail "a CI run failed for this commit"; else warn "CI still running for this commit"; fi
    else
        note "every CI run of this commit succeeded (Linux and Windows)"
    fi
}

step_qa_e2e() {
    local root="$EXT_DIR" what="packaged extension"
    [ -d "$root" ] || { root="$ROOT"; what="working tree (no package)"; }
    EXT_ROOT="$root" with_display node scripts/qa/e2e/runner.cjs paranoia
    local rc=$?
    [ $rc -eq 125 ] && { skip "no display and no xvfb-run"; return; }
    if [ $rc -eq 0 ]; then note "every suite passed on the $what"; else fail "e2e suites failed on the $what"; fi
    ARTIFACTS+=("End-to-end observations: \`$SDV_QA_OUT/e2e/runs/paranoia/results.json\` (most suites record rather than assert: read it when a behaviour changes)")
}

# Releases to migrate from: the last patch of each minor release tagged from
# PARANOIA_MIGRATION_MIN (0.12.1) up to this version, excluded
# (PARANOIA_MIGRATION_FROM="0.12.1" to choose)
migration_sources() {
    if [ -n "${PARANOIA_MIGRATION_FROM:-}" ]; then
        tr ' ' '\n' <<<"$PARANOIA_MIGRATION_FROM"
        return
    fi
    local v min="${PARANOIA_MIGRATION_MIN:-0.12.1}"
    for v in $(git tag --list 'v*' | sed -n 's/^v\([0-9]*\.[0-9]*\.[0-9]*\)$/\1/p' | sort -V); do
        [ "$(printf '%s\n' "$min" "$v" | sort -V | head -1)" = "$min" ] || continue
        [ "$v" != "$VERSION" ] && [ "$(printf '%s\n' "$v" "$VERSION" | sort -V | head -1)" = "$v" ] && echo "$v"
    done | awk -F. '{ last[$1 "." $2] = $0; if (!seen[$1 "." $2]++) order[++n] = $1 "." $2 } END { for (i = 1; i <= n; i++) print last[order[i]] }'
}

# The .vsix of a release, rebuilt from its tag when missing (scripts/release-vsix.sh)
release_vsix() {
    local file="$RELEASES/scientific-data-viewer-$1.vsix"
    [ -f "$file" ] || run scripts/release-vsix.sh "$1" >&2 || return 1
    echo "$file"
}

# One run of the migration test (scripts/upgrade-sandbox.sh) per case; the
# expectation (rebuild or keep) follows from each release, except for the two
# synthetic cases that pin the rule of ENVIRONMENT_REVISION down
step_migration() {
    [ -n "$VSIX" ] || { skip "no package (package step failed or not run)"; return; }
    local cases=() case name old expect extra outcome passed=() failed=() untested=()
    for v in $(migration_sources); do
        local old_vsix
        if ! old_vsix="$(release_vsix "$v")"; then
            failed+=("v$v (cannot rebuild its .vsix)")
            continue
        fi
        cases+=("v$v|$old_vsix||")
    done
    cases+=("same release|$VSIX|keep|" "next revision|$VSIX|rebuild|--bump-new")
    for case in "${cases[@]}"; do
        IFS='|' read -r name old expect extra <<<"$case"
        local dir="$OUT/migration/${name// /-}"
        echo "===== $name -> $VERSION ====="
        mkdir -p "$dir"
        # shellcheck disable=SC2086
        with_display scripts/upgrade-sandbox.sh --old "$old" --new "$VSIX" ${expect:+--expect "$expect"} $extra --dir "$dir" 2>&1 |
            tee "$dir.log"
        local rc=${PIPESTATUS[0]}
        outcome="$(sed -n 's/.*== Result: .*(\(rebuild\|keep\)).*/\1/p' "$dir.log" | tail -1)"
        case $rc in
            0) passed+=("$name: ${outcome:-?}") ;;
            3) untested+=("$name") ;;
            125) skip "no display and no xvfb-run"; return ;;
            *) failed+=("$name") ;;
        esac
    done
    echo
    printf 'passed: %s\n' "${passed[@]}"
    if [ ${#failed[@]} -gt 0 ]; then
        fail "migration to $VERSION fails from: ${failed[*]} (see migration/<case>.log)"
    elif [ ${#untested[@]} -gt 0 ]; then
        warn "${untested[*]} could not create their environment on this machine: not tested; ${#passed[@]} migration(s) passed"
    else
        note "${#passed[@]} migrations keep users working ($(IFS=';'; echo "${passed[*]}" | sed 's/;/, /g'))"
    fi
}

# What happens when the rebuild goes wrong. The rebuild code is the new
# release's: from the last release when it rebuilds, else from this release
# with its revision raised (as the next release that needs a rebuild)
step_upgrade() {
    [ -n "$VSIX" ] || { skip "no package (package step failed or not run)"; return; }
    local from=(--old "$VSIX" --bump-new) label="$VERSION with a raised revision"
    if $UV_ENV_CHANGED && [ -n "$BASELINE" ] && PREVIOUS_VSIX="$(release_vsix "${BASELINE#v}")"; then
        from=(--old "$PREVIOUS_VSIX")
        label="$BASELINE"
    fi
    local scenario failed=()
    for scenario in offline interrupted; do
        echo "===== scenario: $scenario ====="
        mkdir -p "$OUT/upgrade/$scenario"
        with_display scripts/upgrade-sandbox.sh "${from[@]}" --new "$VSIX" --scenario "$scenario" --dir "$OUT/upgrade/$scenario"
        case $? in
            0) ;;
            125) skip "no display and no xvfb-run"; return ;;
            *) failed+=("$scenario") ;;
        esac
    done
    if [ ${#failed[@]} -eq 0 ]; then
        note "from $label: a failed (offline) or interrupted rebuild keeps the previous environment, the next start rebuilds it"
    else
        fail "rebuild from $label fails when: ${failed[*]}"
    fi
}

step_screenshots() {
    if run npm run --silent screenshots -- --skip-compile; then
        local gallery="$ARTEFACTS/screenshots/v$MAJOR_MINOR/index.html"
        note "gallery: artefacts/screenshots/v$MAJOR_MINOR/index.html"
        ARTIFACTS+=("Viewer screenshots in every theme: \`$gallery\`")
    else
        fail "npm run screenshots failed"
    fi
}

# =============================================================================
# Runner
# =============================================================================

profile_rank() { case "$1" in quick) echo 1 ;; standard) echo 2 ;; full) echo 3 ;; esac; }
in_list() { [[ ",$2," == *",$1,"* ]]; }
step_profile() {
    local s
    for s in "${STEPS[@]}"; do [ "${s%%|*}" = "$1" ] && { s="${s#*|}"; echo "${s%%|*}"; return; }; done
}
# Whether step <id> runs in this invocation
selected() {
    if [ -n "$ONLY" ]; then in_list "$1" "$ONLY"; return; fi
    ! in_list "$1" "$SKIP_LIST" && [ "$(profile_rank "$(step_profile "$1")")" -le "$(profile_rank "$PROFILE")" ]
}

INTERRUPTED=false
trap 'INTERRUPTED=true' INT
cleanup() {
    if $BASELINE_CREATED; then
        scripts/qa/backend/make_baseline.sh --remove >/dev/null 2>&1 || true
    fi
}
trap cleanup EXIT

echo -e "${BLUE}Paranoia: v$VERSION vs $BASELINE, profile ${ONLY:+--only }${ONLY:-$PROFILE}${NC}"
echo -e "${DIM}$OUT${NC}"
for s in "${STEPS[@]}"; do
    IFS='|' read -r id prof area title <<<"$s"
    STATUS=PASS
    SUMMARY=""
    start=$SECONDS
    if [ -n "$ONLY" ] && ! in_list "$id" "$ONLY"; then
        continue
    elif in_list "$id" "$SKIP_LIST"; then
        skip "skipped with --skip"
    elif [ -z "$ONLY" ] && [ "$(profile_rank "$prof")" -gt "$(profile_rank "$PROFILE")" ]; then
        skip "not in the $PROFILE profile (--$prof)"
    elif $INTERRUPTED; then
        skip "run interrupted before this step"
    else
        printf "${BLUE}▶${NC} %-14s %s ... " "$id" "$title"
        # The log is written directly (steps read it back); --verbose follows it
        : >"$LOGS/$id.log"
        if $VERBOSE; then
            echo
            tail -n +1 -f "$LOGS/$id.log" &
            tail_pid=$!
        fi
        "step_${id//-/_}" >>"$LOGS/$id.log" 2>&1
        if $VERBOSE; then
            sleep 0.5
            kill "$tail_pid" 2>/dev/null
            wait "$tail_pid" 2>/dev/null
        fi
        if $INTERRUPTED && [ "$STATUS" != SKIP ]; then fail "interrupted (Ctrl+C)"; fi
        case $STATUS in
            PASS) color=$GREEN ;; FAIL) color=$RED ;; WARN) color=$YELLOW ;; *) color=$DIM ;;
        esac
        printf "${color}%s${NC} ${DIM}(%ss)${NC} %s\n" "$STATUS" "$((SECONDS - start))" "$SUMMARY"
    fi
    printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$id" "$area" "$title" "$STATUS" "$((SECONDS - start))" "${SUMMARY//$'\t'/ }" >>"$RESULTS"
done

{
    echo "VERSION=$VERSION"
    echo "BASELINE=$BASELINE"
    echo "PROFILE=$([ -n "$ONLY" ] && echo custom || echo "$PROFILE")"
    echo "SELECTION=${ONLY:+only $ONLY}${SKIP_LIST:+ skip $SKIP_LIST}"
    echo "BRANCH=$(git branch --show-current)"
    echo "COMMIT=$(git rev-parse --short HEAD) $(git log -1 --format=%s)"
    echo "DIRTY=$([ -n "$(git status --porcelain)" ] && echo yes || echo no)"
    echo "STARTED=$(date -d "@$(( $(date +%s) - SECONDS ))" '+%Y-%m-%d %H:%M')"
    echo "MACHINE=$(uname -sr), DISPLAY=${DISPLAY:-none}"
    echo "NODE=$(node -v 2>/dev/null)"
    echo "PYTHON=$("$PY" --version 2>&1)"
    echo "BACKEND_PYTHON=$SDV_PYTHON"
    echo "BACKEND_VERSIONS=$("$SDV_PYTHON" -c 'import xarray, zarr; print(f"xarray {xarray.__version__}, zarr {zarr.__version__}")' 2>/dev/null)"
    echo "VSIX=${VSIX:-<not built>}"
    echo "ARTIFACTS=$(IFS=';'; echo "${ARTIFACTS[*]}")"
} >"$OUT/meta.env"

echo
"$PY" scripts/paranoia/checks.py report "$OUT"
echo -e "Report: ${BLUE}$OUT/REPORT.md${NC}"
grep -q $'\tFAIL\t' "$RESULTS" && exit 1
exit 0
