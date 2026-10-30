"""Checks and report of paranoia.sh (see docs/DEVELOPMENT.md § Paranoia).

Standard library only. Each check prints its evidence, then a last line
``SUMMARY: <one line>``, and exits with 0 (pass), 1 (fail) or 3 (warn: to
review by a human). ``report`` writes REPORT.md from the results of a run.

    python scripts/paranoia/checks.py release <version> --base main [--published marketplace=0.12.1]
    python scripts/paranoia/checks.py env-change <baseline-ref>
    python scripts/paranoia/checks.py vsix <file.vsix> [--previous <old.vsix>]
    python scripts/paranoia/checks.py smoke <extension-dir> --python <py> --samples <dir>
    python scripts/paranoia/checks.py info-diff <backend-out-dir> <diff_info.log>
    python scripts/paranoia/checks.py report <run-dir>
"""

from __future__ import annotations

import argparse
import json
import os
import posixpath
import re
import subprocess
import sys
import zipfile
from datetime import datetime
from pathlib import Path, PurePosixPath

REPO = Path(__file__).resolve().parents[2]
PASS, FAIL, WARN = 0, 1, 3


class Findings:
    """Collects FAIL / WARN lines and turns them into the exit code."""

    def __init__(self) -> None:
        self.fails: list[str] = []
        self.warns: list[str] = []

    def ok(self, msg: str) -> None:
        print(f"OK   {msg}")

    def fail(self, msg: str) -> None:
        print(f"FAIL {msg}")
        self.fails.append(msg)

    def warn(self, msg: str) -> None:
        print(f"WARN {msg}")
        self.warns.append(msg)

    def finish(self, passed: str) -> int:
        if self.fails:
            extra = f" (+{len(self.fails) - 1} more)" if len(self.fails) > 1 else ""
            print(f"SUMMARY: {self.fails[0]}{extra}")
            return FAIL
        if self.warns:
            extra = f" (+{len(self.warns) - 1} more)" if len(self.warns) > 1 else ""
            print(f"SUMMARY: {self.warns[0]}{extra}")
            return WARN
        print(f"SUMMARY: {passed}")
        return PASS


def git(*args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(REPO), *args], capture_output=True, text=True, check=True
    ).stdout


def version_tuple(v: str) -> tuple[int, ...]:
    return tuple(int(x) for x in re.findall(r"\d+", v)[:3])


# --------------------------------------------------------------------------- #
# release: version, release documents, links
# --------------------------------------------------------------------------- #

LINK = re.compile(r"\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")


def broken_links(md: Path) -> list[str]:
    """Relative links of `md` whose target file does not exist."""
    broken = []
    text = re.sub(r"```.*?```", "", md.read_text(encoding="utf-8"), flags=re.S)
    for target in LINK.findall(text):
        if re.match(r"^[a-z][a-z0-9+.-]*:", target, re.I) or target.startswith("#"):
            continue
        path = target.split("#", 1)[0]
        if path and not (md.parent / path).exists():
            broken.append(f"{md.relative_to(REPO)} -> {target}")
    return broken


def check_documents(f: Findings, ver: str, major_minor: str) -> list[Path]:
    """package-lock, CHANGELOG section, release notes and PR summary of `ver`."""
    lock = json.loads((REPO / "package-lock.json").read_text(encoding="utf-8"))
    lock_versions = {
        lock.get("version"),
        lock.get("packages", {}).get("", {}).get("version"),
    }
    if lock_versions == {ver}:
        f.ok(f"package-lock.json is at {ver}")
    else:
        f.fail(
            f"package-lock.json version {sorted(map(str, lock_versions))} != package.json {ver} (run npm install)"
        )

    changelog = (REPO / "CHANGELOG.md").read_text(encoding="utf-8")
    heading = re.search(rf"^## \[?{re.escape(ver)}\]?(.*)$", changelog, re.M)
    if heading:
        f.ok(f"CHANGELOG.md has a {ver} section{heading.group(1)}")
    else:
        f.fail(f"CHANGELOG.md has no '## [{ver}]' section")

    docs = [
        REPO / "docs" / f"RELEASE_NOTES_{ver}.md",
        REPO / "docs" / f"v{major_minor}" / f"PR_SUMMARY_{ver}.md",
    ]
    for doc in docs:
        if doc.exists():
            f.ok(f"{doc.relative_to(REPO)} exists")
        else:
            f.fail(f"{doc.relative_to(REPO)} is missing")
    return docs


def check_commit_list(pr_summary: Path, base: str) -> None:
    """Commits of the branch missing from the PR summary list (informational:
    the list always lags behind the commit that updates it)."""
    if not (pr_summary.exists() and base):
        return
    listed = pr_summary.read_text(encoding="utf-8")
    subjects = [s for s in git("log", "--format=%s", f"{base}..HEAD").splitlines() if s]
    missing = [s for s in subjects if s not in listed]
    for s in missing:
        print(f"INFO not in the commit list of {pr_summary.name}: {s}")
    print(
        f"INFO {len(subjects) - len(missing)} of {len(subjects)} commits since {base} listed in {pr_summary.name}"
    )


def check_not_released(f: Findings, ver: str, published: list[str]) -> None:
    """No tag of `ver` on another commit; `ver` above the versions on the stores."""
    tag = f"v{ver}"
    if tag not in git("tag", "--list", tag).split():
        f.ok(f"tag {tag} does not exist yet")
    elif (tagged := git("rev-list", "-n", "1", tag).strip()) != git(
        "rev-parse", "HEAD"
    ).strip():
        f.fail(
            f"tag {tag} already exists on another commit ({tagged[:8]}): bump the version"
        )
    else:
        f.ok(f"tag {tag} points at HEAD")
    for item in published:
        store, _, version = item.partition("=")
        if not version:
            f.warn(f"{store}: published version unknown (offline?)")
        elif version_tuple(ver) <= version_tuple(version):
            f.fail(f"{store} already has {version}: {ver} must be greater")
        else:
            f.ok(f"{store} has {version}, below {ver}")


def check_links(f: Findings, pages: list[Path]) -> None:
    broken = [b for p in pages if p.exists() for b in broken_links(p)]
    for b in broken:
        print(f"     broken link: {b}")
    if broken:
        f.warn(
            f"{len(broken)} broken relative links in README / CHANGELOG / release docs"
        )
    else:
        f.ok(f"relative links of {len(pages)} documents resolve")


def cmd_release(args: argparse.Namespace) -> int:
    f = Findings()
    ver = args.version
    major_minor = ".".join(ver.split(".")[:2])
    release_notes, pr_summary = check_documents(f, ver, major_minor)
    check_commit_list(pr_summary, args.base)
    check_not_released(f, ver, args.published)
    # Relative links of the documents users and reviewers read
    pages = [REPO / "README.md", REPO / "CHANGELOG.md", release_notes]
    check_links(f, pages + sorted((REPO / "docs" / f"v{major_minor}").glob("*.md")))
    return f.finish(
        f"{ver}: version, changelog, release notes, PR summary and links consistent"
    )


# --------------------------------------------------------------------------- #
# env-change: does the release rebuild the users' uv environments?
# --------------------------------------------------------------------------- #

ENV_FILE = "src/python/ExtensionVirtualEnvironmentManager.ts"


def env_spec(source: str) -> dict:
    spec = {}
    for name in ("ALL_REQUIREMENTS", "ENVIRONMENT_CONSTRAINTS"):
        m = re.search(rf"{name}[^=\n]*=\s*\[(.*?)\]", source, re.S)
        spec[name] = re.findall(r"'([^']+)'", m.group(1)) if m else None
    m = re.search(r"ENVIRONMENT_REVISION\s*=\s*(\d+)", source)
    spec["ENVIRONMENT_REVISION"] = int(m.group(1)) if m else None
    return spec


def cmd_env_change(args: argparse.Namespace) -> int:
    f = Findings()
    current = env_spec((REPO / ENV_FILE).read_text(encoding="utf-8"))
    try:
        old = env_spec(git("show", f"{args.baseline}:{ENV_FILE}"))
    except subprocess.CalledProcessError:
        old = {}
    changed = [k for k in current if current[k] != old.get(k)]
    for k in changed:
        print(f"     {k}: {old.get(k)} -> {current[k]}")
    if changed:
        f.warn(
            f"uv environment changed since {args.baseline} ({', '.join(changed)}): "
            "users of useExtensionOwnEnvironment get it rebuilt at first start; the upgrade sandbox must pass"
        )
    return f.finish(f"uv environment unchanged since {args.baseline}")


# --------------------------------------------------------------------------- #
# vsix: what users install
# --------------------------------------------------------------------------- #

FORBIDDEN = re.compile(
    r"(\.map|\.ts|\.pyc|\.vsix|\.env)$|(^|/)(node_modules|test|tests|scripts|docs|sample-data|"
    r"\.qa|\.venv|__pycache__|notebooks|screenshots|\.vscode-test)/"
)
REQUIRE = re.compile(r"require\(\"(\.{1,2}/[^\"]+)\"\)")


def vsix_files(path: Path) -> set[str]:
    with zipfile.ZipFile(path) as z:
        return {
            n.removeprefix("extension/")
            for n in z.namelist()
            if n.startswith("extension/") and not n.endswith("/")
        }


def unresolved_requires(sources: dict[str, str], files: set[str]) -> list[str]:
    """`require("./x")` calls of the compiled modules whose target is not packaged."""
    unresolved = []
    for name, code in sorted(sources.items()):
        for target in REQUIRE.findall(code):
            resolved = posixpath.normpath(
                posixpath.join(posixpath.dirname(name), target)
            )
            if not {resolved, f"{resolved}.js", f"{resolved}/index.js"} & files:
                unresolved.append(f"{name} requires {target}")
    return unresolved


def cmd_vsix(args: argparse.Namespace) -> int:
    f = Findings()
    files = vsix_files(args.vsix)
    with zipfile.ZipFile(args.vsix) as z:
        manifest = json.loads(z.read("extension/package.json"))
        sources = {
            n: z.read(f"extension/{n}").decode("utf-8", "replace")
            for n in files
            if n.startswith("out/src/") and n.endswith(".js")
        }
    print(
        f"{args.vsix.name}: {len(files)} files, {args.vsix.stat().st_size // 1024} KiB"
    )

    required = {
        str(PurePosixPath(manifest["main"])),
        manifest["icon"],
        "out/webview/webview.js",
        "src/panel/webview/styles.css",
        "python/get_data_info.py",
        "python/check_package_availability.py",
    }
    # Icons named anywhere in contributes (editors, commands, languages...)
    required |= set(
        re.findall(r"\"(media/[^\"]+)\"", json.dumps(manifest.get("contributes", {})))
    )
    backend = {
        p
        for p in git("ls-files", "python/sdv_backend").splitlines()
        if p.endswith(".py") and (REPO / p).exists()
    }
    required |= backend
    for name in sorted(required - files):
        f.fail(f"missing from the package: {name}")
    for name in sorted(
        n for n in files if n.startswith("python/sdv_backend/") and n not in backend
    ):
        f.warn(f"packaged backend file not in git: {name}")

    # Every relative require() of the compiled extension resolves in the package
    unresolved = unresolved_requires(sources, files)
    for u in unresolved:
        f.fail(f"unresolved require: {u}")
    if not unresolved:
        f.ok(
            f"every relative require() of the {len(sources)} compiled modules resolves"
        )

    leaked = sorted(n for n in files if FORBIDDEN.search(n))
    for n in leaked:
        f.fail(f"should not be packaged: {n}")
    if not leaked:
        f.ok(
            "no source maps, TypeScript sources, tests, scripts, docs or data in the package"
        )

    if args.previous and args.previous.exists():
        old = vsix_files(args.previous)
        added, removed = sorted(files - old), sorted(old - files)
        print(f"\nCompared with {args.previous.name} ({len(old)} files):")
        for n in added:
            print(f"  + {n}")
        for n in removed:
            print(f"  - {n}")
        ratio = args.vsix.stat().st_size / max(args.previous.stat().st_size, 1)
        print(f"  size x{ratio:.2f}")
    return f.finish(f"{len(files)} files, nothing missing, nothing leaked")


# --------------------------------------------------------------------------- #
# smoke: the backend exactly as packaged, outside the repository
# --------------------------------------------------------------------------- #

SMOKE_CASES = [
    ("info", "sample_data.nc"),
    ("info", "sample_data.grib"),
    ("info", "sample_data_cog.tif"),
    ("info", "sample_data.cdf"),
    ("info", "sample_data.h5"),
    # Sliced as users do: the whole (365, 180, 360) variable takes minutes
    ("plot", "sample_data.nc", "temperature", "--dimension-slices", '{"time": 0}'),
]


def cmd_smoke(args: argparse.Namespace) -> int:
    f = Findings()
    script = args.extension / "python" / "get_data_info.py"
    for mode, name, *extra in SMOKE_CASES:
        sample = args.samples / name
        if not sample.exists():
            f.warn(f"{name}: sample missing (python python/create_sample_data.py)")
            continue
        # cwd outside the repository: only the packaged sdv_backend can be imported
        p = subprocess.run(
            [args.python, str(script), mode, str(sample), *extra],
            capture_output=True,
            text=True,
            timeout=300,
            cwd=args.extension,
        )
        lines = [ln for ln in p.stdout.splitlines() if ln.startswith("{")]
        try:
            result = json.loads(lines[-1]) if lines else {}
        except json.JSONDecodeError:
            result = {}
        label = f"{mode} {name} {' '.join(extra)}".strip()
        if "result" in result:
            f.ok(label)
        else:
            print(p.stderr[-1500:])
            f.fail(f"{label}: {str(result.get('error', 'no JSON result'))[:200]}")
    return f.finish(f"packaged backend answers {len(SMOKE_CASES)} info / plot requests")


# --------------------------------------------------------------------------- #
# info-diff: triage of scripts/qa/backend/diff_info.py
# --------------------------------------------------------------------------- #


def opened(path: Path) -> bool:
    data = json.loads(path.read_text(encoding="utf-8")).get("json") or {}
    return "result" in data


def cmd_info_diff(args: argparse.Namespace) -> int:
    f = Findings()
    info = args.out / "info"
    regressions, fixed = [], []
    for old_path in sorted(info.glob("*.old.json")):
        new_path = old_path.with_name(old_path.name.replace(".old.json", ".new.json"))
        if not new_path.exists():
            continue
        name = old_path.name.removesuffix(".old.json")
        before, after = opened(old_path), opened(new_path)
        if before and not after:
            regressions.append(name)
        elif after and not before:
            fixed.append(name)
    log = args.log.read_text(encoding="utf-8") if args.log.exists() else ""
    # Lines "=== <file>: old rc=0 1.2s new rc=0 1.1s -> SAME | <n> DIFFS"
    results = [
        line[4:].rpartition(" -> ")
        for line in log.splitlines()
        if line.startswith("=== ")
    ]
    total = len(results)
    changed = [
        (head.split(": old rc=")[0], status.split()[0])
        for head, _, status in results
        if status.endswith(" DIFFS")
    ]
    for name in regressions:
        f.fail(f"{name}: opened by the baseline, fails now")
    if fixed:
        print(f"Opens now, failed in the baseline: {', '.join(fixed)}")
    if changed:
        print(
            "Changed what the viewer shows: "
            + ", ".join(f"{n} ({c})" for n, c in changed)
        )
        f.warn(
            f"{len(changed)} of {total} files show different info than the baseline (see log)"
        )
    return f.finish(f"{total} files: same info as the baseline")


# --------------------------------------------------------------------------- #
# report
# --------------------------------------------------------------------------- #

ICON = {"PASS": "✅ PASS", "FAIL": "❌ FAIL", "WARN": "⚠️ WARN", "SKIP": "⏭️ SKIP"}


def read_results(run: Path) -> list[dict]:
    rows = []
    for line in (run / "results.tsv").read_text(encoding="utf-8").splitlines():
        sid, area, title, status, secs, summary = line.split("\t")
        rows.append(
            {
                "id": sid,
                "area": area,
                "title": title,
                "status": status,
                "secs": int(secs),
                "summary": summary,
            }
        )
    return rows


def log_tail(path: Path, n: int = 25) -> str:
    if not path.exists():
        return ""
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    return "\n".join(line[:300] for line in lines[-n:])


def verdict(rows: list[dict], profile: str) -> tuple[str, str]:
    count = {s: sum(r["status"] == s for r in rows) for s in ICON}
    if count["FAIL"]:
        return (
            "NOT READY",
            f"{count['FAIL']} check(s) failed. Fix them before publishing.",
        )
    if profile != "full" or count["SKIP"]:
        why = (
            f"profile `{profile}`"
            if profile != "full"
            else f"{count['SKIP']} check(s) skipped"
        )
        return "NOT FULLY VERIFIED", (
            f"Nothing failed, but not everything ran ({why}). Run `./paranoia.sh --full` before publishing."
        )
    if count["WARN"]:
        return (
            "READY AFTER REVIEW",
            f"Nothing failed. Review the {count['WARN']} warning(s) below.",
        )
    return "READY", "Every check passed."


def cmd_report(args: argparse.Namespace) -> int:
    run = args.run
    lines = (run / "meta.env").read_text(encoding="utf-8").splitlines()
    meta = {
        key: value for key, sep, value in (line.partition("=") for line in lines) if sep
    }
    rows = read_results(run)
    title, explanation = verdict(rows, meta.get("PROFILE", "?"))
    total = sum(r["secs"] for r in rows)
    ver = meta.get("VERSION", "?")
    major_minor = ".".join(ver.split(".")[:2])

    out = [
        f"# Publication readiness — v{ver}",
        "",
        f"## Verdict: **{title}**",
        "",
        explanation,
        "",
        "| | |",
        "| --- | --- |",
        f"| Version | `{ver}` (last release: `{meta.get('BASELINE', '?')}`) |",
        f"| Commit | `{meta.get('COMMIT', '?')}` on `{meta.get('BRANCH', '?')}`{' — **uncommitted changes**' if meta.get('DIRTY') == 'yes' else ''} |",
        f"| Profile | `{meta.get('PROFILE')}` — {meta.get('SELECTION') or 'every step of the profile'} |",
        f"| Started | {meta.get('STARTED', '?')}, {total // 60} min {total % 60} s of checks |",
        f"| Machine | {meta.get('MACHINE', '?')} |",
        f"| Node / Python | {meta.get('NODE', '?')} / {meta.get('PYTHON', '?')} |",
        f"| Backend interpreter | `{meta.get('BACKEND_PYTHON', '?')}` ({meta.get('BACKEND_VERSIONS', '?')}) |",
        "",
        "## Checks",
        "",
        "| Area | Check | Result | Time | Summary |",
        "| --- | --- | --- | --- | --- |",
    ]
    for r in rows:
        summary = r["summary"].replace("|", "\\|")
        has_log = (run / "logs" / f"{r['id']}.log").exists()
        check = f"[{r['title']}](logs/{r['id']}.log)" if has_log else r["title"]
        out.append(
            f"| {r['area']} | {check} `{r['id']}` | {ICON.get(r['status'], r['status'])} "
            f"| {r['secs']} s | {summary} |"
        )

    attention = [r for r in rows if r["status"] in ("FAIL", "WARN")]
    if attention:
        out += ["", "## Failures and warnings", ""]
        for r in sorted(attention, key=lambda r: r["status"] != "FAIL"):
            out += [
                f"### {ICON[r['status']]} — {r['title']} (`{r['id']}`)",
                "",
                r["summary"],
                "",
                f"Last lines of [logs/{r['id']}.log](logs/{r['id']}.log):",
                "",
                "```text",
                log_tail(run / "logs" / f"{r['id']}.log"),
                "```",
                "",
            ]
    skipped = [r for r in rows if r["status"] == "SKIP"]
    if skipped:
        out += ["", "## Not run", ""]
        out += [f"- **{r['title']}** (`{r['id']}`): {r['summary']}" for r in skipped]

    artifacts = [line for line in meta.get("ARTIFACTS", "").split(";") if line]
    if artifacts:
        out += ["", "## To look at", ""]
        out += [f"- {a}" for a in artifacts]

    plan = f"docs/v{major_minor}/MANUAL_TEST_PLAN_{ver}.md"
    hub = f"docs/v{major_minor}/GETTING_STARTED.md"

    def rel(path: str) -> str:
        return os.path.relpath(REPO / path, run)

    out += [
        "",
        "## Not covered by this script",
        "",
        "- **Windows and macOS**: the checks run on this machine only. The CI runs `npm test` on Windows; "
        "the upgrade of the uv environment on Windows (locked files) is manual.",
        "- **Your own VS Code**: install the package (`code --install-extension "
        f"{meta.get('VSIX', '<vsix>')}`), open a few files, check the Developer Tools console has no CSP errors.",
        f"- **Manual test plan**: [`{plan}`]({rel(plan)})"
        + ("" if (REPO / plan).exists() else " (none for this version)")
        + f"; the risk table of [`{hub}`]({rel(hub)}) "
        "says what is left to check by hand.",
        "- **Publishing** itself: `./publish.sh` (tag, both marketplaces).",
        "",
        f"_Written by `paranoia.sh` on {datetime.now():%Y-%m-%d %H:%M}._",
        "",
    ]
    (run / "REPORT.md").write_text("\n".join(out), encoding="utf-8")
    print(f"VERDICT: {title}")
    print(explanation)
    return PASS


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("release")
    p.add_argument("version")
    p.add_argument("--base", default="main", help="branch the release is merged into")
    p.add_argument("--published", action="append", default=[], help="store=version")
    p.set_defaults(func=cmd_release)
    p = sub.add_parser("env-change")
    p.add_argument("baseline")
    p.set_defaults(func=cmd_env_change)
    p = sub.add_parser("vsix")
    p.add_argument("vsix", type=Path)
    p.add_argument("--previous", type=Path)
    p.set_defaults(func=cmd_vsix)
    p = sub.add_parser("smoke")
    p.add_argument("extension", type=Path)
    p.add_argument("--python", required=True)
    p.add_argument("--samples", type=Path, default=REPO / "sample-data")
    p.set_defaults(func=cmd_smoke)
    p = sub.add_parser("info-diff")
    p.add_argument("out", type=Path)
    p.add_argument("log", type=Path)
    p.set_defaults(func=cmd_info_diff)
    p = sub.add_parser("report")
    p.add_argument("run", type=Path)
    p.set_defaults(func=cmd_report)
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
