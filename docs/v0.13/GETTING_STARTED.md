# v0.13 — Getting started

v0.13.0 is the largest release of the extension: about 50 commits and roughly 24,000 lines added / 20,000 removed over 170 files. This page is the entry point. It says what to read, what to review closely, what to test, and how to release without leaving users stuck.

Most of the line count is **moved or generated** code, checked by tests rather than by reading:

- the Python backend split into a package;
- the sample-data generators split into modules;
- the webview script rewritten as TypeScript modules;
- new tests.

The parts where a mistake reaches users directly are much smaller; [§ Review](#review-by-risk-not-by-commit) lists them.

---

## Where to start

| Time you have | Do this                                                                                                                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **15 min**    | Read the TL;DR and **Upgrade notes** of the [release notes](../RELEASE_NOTES_0.13.0.md), and [§ What could break users](#what-could-break-users) below. Run the [automated checks](#1-automated-checks-10-min). |
| **2 h**       | Add the [upgrade test](#2-upgrade-test-15-min-mostly-waiting) (3 scenarios, mostly waiting), then Part B of the [manual test plan](./MANUAL_TEST_PLAN_0.13.0.md).                                               |
| **A day**     | Add a [review of the high-risk areas](#review-by-risk-not-by-commit), the full manual test plan, and B20 (real upgrade) on a Windows machine.                                                                   |

---

## Map of the v0.13 documents

| Document                                                                                       | What it is for                                                                                                      | Read it when                                      |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **GETTING_STARTED.md** (this page)                                                             | Hub: reading order, risks, review and release plan                                                                  | First                                             |
| [RELEASE_NOTES_0.13.0.md](../RELEASE_NOTES_0.13.0.md)                                          | For users and reviewers: what changed, why, upgrade notes, a technical verification guide per feature (§0–§27)      | Before testing; published with the release        |
| [CHANGELOG.md](../../CHANGELOG.md) (0.13.0 section)                                            | Every change with its files and tests                                                                               | To find where something was changed               |
| [PR_SUMMARY_0.13.0.md](./PR_SUMMARY_0.13.0.md)                                                 | Merge request description: tables, test commands, commit list                                                       | When opening / reviewing the PR                   |
| [MANUAL_TEST_PLAN_0.13.0.md](./MANUAL_TEST_PLAN_0.13.0.md)                                     | Click-by-click test plan for testers who don't know the formats, with a results sheet (about 2 h)                   | Before merging                                    |
| [UPGRADE_TEST_PLAN.md](./UPGRADE_TEST_PLAN.md)                                                 | Users updating from v0.12: who is affected, the `upgrade-sandbox.sh` script, compatibility checks, support playbook | Before releasing; again if users report problems  |
| [CODE_REVIEW_TODO.md](./CODE_REVIEW_TODO.md)                                                   | The 63 items of the October 2026 code review, all done                                                              | To check why a piece of code changed              |
| [QA_REPORT_0.13.0.md](./QA_REPORT_0.13.0.md), [QA_FIXES_0.13.0.md](./QA_FIXES_0.13.0.md)       | QA pass before the release: method, findings with proof, what was verified; the fix of each finding (checklist)     | Before releasing; to rerun the QA (`scripts/qa/`) |
| [README.md](./README.md), TO_IMPLEMENT, TO_REMOVE, OUT_OF_SCOPE, PHASES                        | Planning of v0.13 (September 2026). Historical: what was planned, shipped or deferred                               | To know why a format is **not** supported         |
| [TECHNICAL_ARCHITECTURE.md](../TECHNICAL_ARCHITECTURE.md), [DEVELOPMENT.md](../DEVELOPMENT.md) | How the code fits together now; commands, backend modules                                                           | Before reviewing code                             |

The release notes stay in `docs/`: `publish.sh` and the README generator read them there.

---

## What could break users

Ranked by how many users a bug would reach and how bad it would be.

| #   | Risk                                                                                                                                                        | Who                                    | Safety net                                                                                                                                                                                                                                                                        | Left to check by hand                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | **uv environment rebuilt at the first start** fails or loops, and the extension cannot open anything                                                        | Users of `useExtensionOwnEnvironment`  | The old environment is kept aside and restored on failure, including after VS Code was closed mid-rebuild. The rebuild is retried next start. **Recreate** action. Startup error instead of a silent fallback. Unit tests and `upgrade-sandbox.sh` (normal, offline, interrupted) | Manual B19 / B20, ideally on Windows (locked files)                                                            |
| 2   | **Blank viewer**: the new Content-Security-Policy or the bundled webview script fails to load                                                               | Everyone                               | Webview tests in jsdom; `npm run compile` must produce `out/webview/webview.js`; the `.vsix` includes it                                                                                                                                                                          | Open any file from the **installed `.vsix`** (A5), not only with F5; Developer Tools console has no CSP errors |
| 3   | **Python selection at startup** (single-flight init, fallback order) picks no interpreter or the wrong one                                                  | Everyone                               | Unit tests; status bar shows the interpreter                                                                                                                                                                                                                                      | Start once each with: Python extension only, `overridePythonInterpreter`, own environment                      |
| 4   | **Backend restructuring** changes an output                                                                                                                 | Everyone                               | Golden snapshots: 83 `info` / `plot` cases identical before and after; 165 pytest tests                                                                                                                                                                                           | Part C of the manual test plan                                                                                 |
| 5   | **Old Python stacks** of Python-extension users                                                                                                             | Users who never upgrade their packages | Compared with v0.12.1: nothing that worked stops working; xarray < 2024.10 now gets a clear message ([details](./UPGRADE_TEST_PLAN.md#compatibility-of-the-backend-with-older-python-stacks))                                                                                     | B23 (optional)                                                                                                 |
| 6   | **Plot / save / export flows** after the message-bus rewrite                                                                                                | Everyone who plots                     | `UIController` and webview tests                                                                                                                                                                                                                                                  | Manual B15–B17, B22, Part C                                                                                    |
| 7   | **Removed things** someone relied on: `.safe` menus, healthcheck sections, internal webview requests                                                        | Few                                    | Listed under _Removed_ in the CHANGELOG                                                                                                                                                                                                                                           | —                                                                                                              |
| 8   | **Plots look different** when a slice, facet or axis is set: the rest of the layout is now chosen automatically (no more histogram of a sliced 3D variable) | Everyone who sets plot controls        | `test_plot_layout.py`; sweep of 1,750 option combinations; webview QA scenarios with the real backend; [`PLOTTING.md`](../PLOTTING.md) explains each choice, and the line under each plot shows it                                                                                | Manual B28                                                                                                     |

If something goes wrong after the release anyway, the [support playbook](./UPGRADE_TEST_PLAN.md#if-users-get-stuck-after-the-release) has a ready reply, the log lines to look for, and the hotfix steps. Users can also find the self-help steps in the README (**Troubleshooting → The extension stopped working after an update**).

---

## Review by risk, not by commit

Reading 20,000 changed lines is not realistic. Read the small parts where a mistake reaches users. Skim the large parts that tests already pin down.

| Area                                                                                                                                          | Size (+/−)     | Nature                                                        | Review depth                                                                                                                                                                                                                                                                           | Safety net                            |
| --------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **uv environment** (`src/python/ExtensionVirtualEnvironmentManager*.ts`)                                                                      | ~800 / 700     | Behaviour change: rebuild, restore, constraints               | **Read fully.** Start with `prepareExisting`, `recreateEnvironment`, `restoreInterruptedRecreation`.                                                                                                                                                                                   | Unit tests, upgrade script            |
| **Interpreter selection** (`src/python/PythonManager.ts`, `src/extension.ts` startup)                                                         | ~600 / 950     | Behaviour change: single-flight init, `runProcess`, fallbacks | **Read the diff** of `selectInterpreter`, `prepareOwnEnvironment`, `forceInitialize`, and `activate` in `extension.ts`.                                                                                                                                                                | Unit tests                            |
| **Security** (`src/panel/HTMLGenerator.ts` CSP, `src/panel/webview/render/*` escaping, `UIController` allowlist and `resolveWebviewFileName`) | ~600           | Behaviour change                                              | **Read**: every `innerHTML` takes escaped data, the CSP has no `unsafe-inline` script, file names cannot leave the data folder.                                                                                                                                                        | `UIController.test.ts`, webview tests |
| **Message bus / panel** (`src/panel/communication/`, `UIController.ts`, `DataViewerPanel.ts`)                                                 | ~700 / 1,400   | Simplification (mostly deletions)                             | Skim: the protocol is the `Requests` / `Events` maps in `MessageTypes.ts`.                                                                                                                                                                                                             | `MessageBus` / `UIController` tests   |
| **Webview** (`src/panel/webview/`)                                                                                                            | ~3,000 / 4,100 | Rewrite of a JS file into TS modules                          | Skim `main.ts`, `bus.ts`, `plotParams.ts` (one table for all plot controls). Rely on the manual test plan.                                                                                                                                                                             | jsdom tests, manual Part B            |
| **Python backend** (`python/sdv_backend/`)                                                                                                    | ~3,600 / 2,900 | Verbatim move, then decomposition, then bug fixes             | Skim the [module table](../DEVELOPMENT.md). Read only the fix commits: _fix(backend): always return JSON errors…_, _fix: return a JSON error instead of crashing on unsupported plot types_, _fix: explain empty plot selections…_, _fix: resolve relative Kerchunk reference paths…_. | Golden snapshots (83), pytest (165)   |
| **Sample data** (`python/sample_data/`)                                                                                                       | ~6,200 / 5,700 | Dev-only generators, split by format                          | Skip.                                                                                                                                                                                                                                                                                  | Generated files are the golden inputs |
| **Tests** (`test/`, `python/tests/`, `python/tools/`)                                                                                         | ~5,000 / 1,300 | New and moved tests                                           | Skim the test names: they document the expected behaviour.                                                                                                                                                                                                                             | —                                     |

Useful commands:

```bash
git log --reverse --oneline main..HEAD                 # the commits, oldest first
git show --stat <sha>                                  # what one commit touched
git diff main...HEAD -- src/python/                    # one area, whole branch
git diff -M main...HEAD --stat -- python/              # -M shows moves as renames
```

Commits are grouped by area and listed with a one-line description in the [PR summary](./PR_SUMMARY_0.13.0.md#commits-oldest--newest).

---

## Testing

### 1. Automated checks (10 min)

```bash
nvm use                                         # Node 22
npm install && npm run compile && npm run typecheck
env -u ELECTRON_RUN_AS_NODE npm test            # 290 passing (env -u only needed from a VS Code terminal)
source .venv/bin/activate
pytest python/tests -q                          # 165 passed
python python/tools/golden_snapshots.py check   # 83 identical (needs a previous `record`: see DEVELOPMENT.md)
pre-commit run --all-files
```

### 2. Upgrade test (15 min, mostly waiting)

```bash
npm run package
scripts/upgrade-sandbox.sh
scripts/upgrade-sandbox.sh --scenario offline
scripts/upgrade-sandbox.sh --scenario interrupted
```

The script runs a real v0.12.1 → v0.13.0 update in a throw-away VS Code profile; details and results are in [UPGRADE_TEST_PLAN.md](./UPGRADE_TEST_PLAN.md).

### 3. Manual test plan (about 2 h)

[MANUAL_TEST_PLAN_0.13.0.md](./MANUAL_TEST_PLAN_0.13.0.md): Part A prepares the machine, Part B tests each feature and fix (B19–B21 for the environment, B22 for the review fixes), and Part C checks the old formats. Paste the results sheet into the PR.

---

## Releasing safely

1. **All green**: automated checks, the three upgrade scenarios, the manual results sheet. Run B20 on Windows if you can.
2. **Set the release date**:
   - in the CHANGELOG heading `## [0.13.0] - …`, which still says 2026-09-15, the date of the feature work;
   - in the CHANGELOG link at the bottom of the release notes;
   - in the README (`python scripts/generate_readme.py`; its changelog anchor follows the heading).
3. **Update the commit list** of the [PR summary](./PR_SUMMARY_0.13.0.md#commits-oldest--newest).
4. **Consider a pre-release first**: `vsce publish --pre-release` (and `--pre-release` for Open VSX). Only users who opted into pre-releases get it, so a broken rebuild reaches a few people first. A version number can be published only once, so the following stable release must be **0.13.1**, not 0.13.0. Check the `vsce` / `ovsx` docs before relying on this.
5. **Publish** with `publish.sh` ([PUBLISHING.md](../PUBLISHING.md)).
6. **First week**: watch GitHub issues and Marketplace reviews; reply with the [support playbook](./UPGRADE_TEST_PLAN.md#if-users-get-stuck-after-the-release).

---

## Known loose ends (not blocking)

- **Release date**: see step 2 above.
- **Commit message** `6687748 chmoding ensure.sh` does not follow the `type(scope): …` style of the others. Reword it before merging if the history matters; it is not pushed anywhere shared yet, as far as this page knows.
- **`scientificDataViewer.defaultView`** is declared and documented, but never read. It predates v0.13.
- **`python/pyproject.toml`** says `requires-python >= 3.13` (the development package), while the backend still runs on Python 3.10+ interpreters of users.
- **Old TODOs**: `src/DataViewerPanel.ts` (tab counter) and `src/panel/webview/styles.css` (`XXX`). Both predate v0.13.
- The upgrade script runs on Linux / macOS only. Windows is covered by hand (B20).
