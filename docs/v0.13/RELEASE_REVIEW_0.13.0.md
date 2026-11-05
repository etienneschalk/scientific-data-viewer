# v0.13.0 — Release review tracker

A last review of the code and docs before publishing 0.13.0 (2026-11-05), done while the manual test plan runs. One commit per issue; this page tracks progress. Status: ☐ to do, ☑ done (commit subject), ✗ not fixed (reason).

## 1. Docs cleanup

| #   | Issue                                                                                                                                                              | Status                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| D1  | 0.13.0 date still the feature-work date (2026-09-15); duplicate §25 / §26 in the release notes; `.vsix` count 70 vs 72; stale size figures; commit list incomplete | ☑ `docs: pre-release cleanup of the 0.13.0 docs` |
| D2  | Docs describing removed code, unreferenced notes and notebooks deleted; historical docs moved to `docs/archive/`                                                   | ☑ same commit                                    |

## 2. Code issues

| #   | Issue                                                                                                                                                                                                                              | Status                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| C1  | Webview requests time out after 60 s: a slow **refresh**, a package install (`executeCommand`), or a **Save As** / **Export** dialog left open showed "Request timeout" while the work then completed (`src/panel/webview/bus.ts`) | ☑ `fix(webview): no request timeout on refresh, installs and save dialogs` |
| C2  | Package installs into the extension's own environment skip the queue of create / update / recreate / delete (`PythonManager.installPackages`)                                                                                      | ☑ `fix(python): queue package installs behind environment rebuilds`        |
| C3  | `deactivate` aborts only plot processes; a running info process is not killed                                                                                                                                                      | ☑ `fix(python): stop info runs too when the extension deactivates`         |
| C4  | `DataViewerPanel.disposePanel` sets `_isDisposed` last, and the `onDidDispose` subscription is not disposed                                                                                                                        | ☑ `fix(panel): mark the panel disposed before tearing it down`             |
| C5  | A settings change touching both `overridePythonInterpreter` and `useExtensionOwnEnvironment` handles only the first (`extension.ts` `if / else if`)                                                                                | ☑ `fix(config): handle both interpreter settings changed in one save`      |
| C6  | A cancelled **Export** answers `success: true` with an error text, unlike **Save As** (`UIController.handleExportWebview`)                                                                                                         | ☑ `fix(panel): report a cancelled save dialog as cancelled`                |
| C7  | Process output decoded chunk by chunk: a multi-byte character split between two chunks is corrupted in the logs (`runProcess`)                                                                                                     | ☐                                                                          |
| C8  | `create_plot`: `file_format_info` unbound in the `except` if format detection raises (`python/sdv_backend/plotting/api.py`)                                                                                                        | ☐                                                                          |
| C9  | A missing or unreadable `.zip` is reported as "not a Zarr store" instead of "file not found" (`python/sdv_backend/info/extract.py`)                                                                                                | ☐                                                                          |
| C10 | Python floors disagree: the runtime gate accepts 3.10, but the required xarray (≥ 2026.4) needs 3.11; `python/pyproject.toml` pins `xarray>=2024.10`                                                                               | ☐                                                                          |
| C11 | Dead code: `scientificDataViewer.defaultView` (declared "currently unused"), `DataViewerPanel.getExtensionUri`, `getPanelsWithErrorsCount`, unused `param` of `isPlotParameterSet`, two leftover TODOs                             | ☐                                                                          |
| C12 | `activationEvents`: `onFileSystem:*` entries do nothing (no file system provider); `onLanguage:*` are implicit since VS Code 1.74                                                                                                  | ☐                                                                          |
| C13 | Unused devDependencies `husky`, `lint-staged`, `@types/glob`                                                                                                                                                                       | ☐                                                                          |
| C14 | CI: `pr-validation.yml` concurrency group is `pr-` on pushes, so pushes to `main` and `develop` cancel each other                                                                                                                  | ☐                                                                          |
| C15 | CI: pull requests never run the Python tests (only paranoia does)                                                                                                                                                                  | ☐                                                                          |
| C16 | `setup.sh` installs with global `pip3` and creates no `.venv`, while `paranoia.sh` and `publish.sh` say the `.venv` comes from it                                                                                                  | ☐                                                                          |

## 3. Overlaps

| #   | Overlap                                                                                                                                                   | Status |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| O1  | `QA_REPORT_0.13.0.md` and `QA_FIXES_0.13.0.md` list the same 14 findings                                                                                  | ☐      |
| O2  | `CODE_REVIEW_TODO.md` is fully checked; its content is in the release notes §16–§19 and the CHANGELOG                                                     | ☐      |
| O3  | The upgrade test is described in four places (`UPGRADE_TEST_PLAN`, manual test plan B20, release notes §15, `GETTING_STARTED` § 2)                        | ☐      |
| O4  | `RELEASE_NOTES_0.13.0.md` (~1,090 lines) mixes user notes with the contributor verification guide (§0–§35), paranoia and architecture diagrams            | ☐      |
| O5  | Tooling: `golden_snapshots.py` (vs last release) and `make_baseline.sh` + `diff_info.py` / `diff_plot.py` compare the backend with the same release twice | ☐      |
| O6  | Tooling: `non_regression_test_plot.py` (images, no comparison) overlaps `diff_scen.py` (scenarios compared to the baseline)                               | ☐      |
| O7  | Tooling: the screenshots script and the webview QA harness each have their own Chrome finder and DevTools client                                          | ☐      |
| O8  | `TO_REMOVE.md` R5: alignment comment next to `SupportedExtensionType` never added                                                                         | ☐      |
