# Changelog

All notable changes to the Scientific Data Viewer VSCode extension will be documented in this file.

<!-- The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), -->

<!-- and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). -->

## [0.13.0] - 2026-09-15

### Added

- **xarray 2026 / zarr 3 stack (P0.1)**: Extension uv environment and install hints pin **`xarray>=2026.4.0`** and **`zarr>=3`** together. `check_package_is_usable()` rejects importable but too-old **zarr 2.x**; missing-package strings use `zarr>=3`. **`h5netcdf>=1.8`** pinned in the isolated env for filter metadata support.
  - **Files**: `src/python/ExtensionVirtualEnvironmentManager.ts`, `src/python/PythonManager.ts`, `python/sdv_backend/`, `python/tests/test_package_requirements.py`
- **Zarr stores without `.zarr` suffix (P0.2)**: Detect v2/v3 stores via `zarr.json`, `.zgroup`, `.zarray`, `.zmetadata` regardless of directory name. **`resolve_store_path`** opens the parent store when a metadata file is clicked. Explorer **Open (Folder)** remains on all folders (Zarr cannot be sniffed in `when` clauses).
  - **Files**: `python/sdv_backend/`, `package.json`, `python/tests/test_zarr_store_detection.py`
- **Zarr v3 encoding metadata (P0.4)**: When **`showXarrayEncodingAttributes`** is on, Zarr v3 **codecs**, **shards**, and related encoding appear in the variable's **Xarray Encoding** section (see _Xarray encoding in its own section_ under Changed). Format label distinguishes **Zarr v2** vs **Zarr v3** (and **(ZIP)** when applicable). Codec dataclasses serialized via `_describe_codec()` at collection time (`asdict()` would otherwise turn them into bare config dicts before encoding).
  - **Files**: `python/sdv_backend/`, `python/tests/test_zarr_store_detection.py`
- **Zarr ZipStore (P0.3)**: Open `.zip` archives whose contents include a Zarr store (root or nested prefix) via `zarr.storage.ZipStore`. Non-Zarr ZIP → clear **ValueError**, not a missing-package error. Prefix detection uses `removeprefix("./")` (not `lstrip`, which broke `.zgroup`).
  - **Files**: `python/sdv_backend/`, `package.json`, `python/tests/test_zarr_store_detection.py`
- **Plot `col_wrap='auto'` (P0.5)**: xarray 2026.04+ **`col_wrap='auto'`** in plot controls (Global and Group): **auto** checkbox disables the numeric input; Python omits the kwarg with a warning on older xarray.
  - **Files**: `python/sdv_backend/`, `python/tests/test_col_wrap.py`, `src/panel/webview/plotParams.ts`, `src/python/DataProcessor.ts`, `docs/documentation.json`
- **NetCDF engine order (P1.1)**: Setting **`scientificDataViewer.netcdfEngineOrder`** (default `netcdf4`, `h5netcdf`, `scipy`) controls try-order for **`.nc` / `.nc4` / `.netcdf` only**; NASA **`.cdf`** unchanged (`cdflib`).
  - **Files**: `python/sdv_backend/`, `python/tests/test_netcdf_datatree_quality.py`, `src/common/config.ts`, `src/python/DataProcessor.ts`, `package.json`
- **HDF5 filter metadata (P1.2)**: For NetCDF4/HDF5 variables, the compression keys of the xarray encoding (`zlib`, `complevel`, `shuffle`, `fletcher32`…) are shown with both the netcdf4 and h5netcdf engines when **`showXarrayEncodingAttributes`** is on. They first appeared a second time as `__xarray_encoding.filters.*`; that copy was dropped when the encoding got its own section.
  - **Files**: `python/sdv_backend/`, `python/tests/test_netcdf_datatree_quality.py`
- **Inherited DataTree coordinates (P1.3)**: Setting **`scientificDataViewer.showInheritedCoordinates`** (default **on**). Flattening uses **`DataTree.to_dataset(inherit='all_coords')`**; inherited coords tagged with **`inherited_from`** attribute. Plotting uses the same inherit mode for DataTree nodes.
  - **Files**: `python/sdv_backend/`, `python/tests/test_netcdf_datatree_quality.py`, `python/sample_data/` (`sample_zarr_inherited_coords.zarr`), `src/common/config.ts`, `src/python/DataProcessor.ts`, `package.json`, `docs/documentation.json`
- **Kerchunk / virtual Zarr (P1.5, experimental)**: Custom editor for **`*.kerchunk.json`** and **`*.ref.json`**. Command and context menu **Open as Kerchunk / virtual Zarr** on `.json` / `.parquet` / `.parq` (query flag `openAs=kerchunk`). **`kerchunk`** xarray engine; JSON validated for a **`refs`** object before open. **Not** in default uv **`ALL_REQUIREMENTS`** — user installs `pip install kerchunk`.
  - **Files**: `python/sdv_backend/`, `python/tests/test_kerchunk_references.py`, `src/extension.ts`, `src/common/config.ts`, `src/python/DataProcessor.ts`, `package.json`, `docs/documentation.json`, `test/suite/extension.test.ts`
- **Cloud Optimized GeoTIFF label (P2.3)**: After successful **rasterio** open, File Information shows **Cloud Optimized GeoTIFF (COG)** when GDAL reports **`LAYOUT=COG`** (profile or `IMAGE_STRUCTURE` tags) or tiled GeoTIFF with overviews; otherwise **GeoTIFF**.
  - **Files**: `python/sdv_backend/`, `python/tests/test_cog_detection.py`, `docs/documentation.json`
- **FacetGrid panel size (P2.7)**: Setting **`scientificDataViewer.facetgridFigsize`** (`[width, height]` inches) passed to plot subprocess as **`xr.set_options(facetgrid_figsize=...)`** for faceted plots.
  - **Files**: `python/sdv_backend/`, `python/tests/test_facetgrid_figsize.py`, `src/common/config.ts`, `src/python/DataProcessor.ts`, `package.json`, `docs/documentation.json`
- **Cancel button for a single plot**: while a variable's plot is being created, a **Cancel** button (stop icon, error style like **Cancel All**) appears next to **Create Plot**, which is disabled until the plot ends. Clicking it aborts that variable's Python process only (`abortPlot` with its operation id) and shows **Plot cancelled.** at once in a neutral callout, instead of waiting for the "Process was aborted…" error. The response of a cancelled operation is ignored, so a plot that finishes just before the abort reaches the process does not appear afterwards. **Cancel All** goes through the same path: every running variable shows **Plot cancelled.** instead of the abort error. In **Plot All**, a plot cancelled on its own counts as cancelled in the summary notification, not as failed. The `.cancel-button` style now applies to both buttons.
  - **Files**: `src/panel/webview/plotActions.ts` (`cancelVariablePlot`, `createVariablePlot` returns `'success' | 'error' | 'cancelled'`), `src/panel/webview/render/variables.ts`, `src/panel/webview/main.ts` (`cancel-plot` action), `src/panel/webview/styles.css`, `scripts/architecture/content.py`, `docs/architecture/` (regenerated)
  - **Tests**: `test/suite/ui/webviewScript.test.ts` (Cancel shown while running, sends `abortPlot` with the plot's operation id, shows **Plot cancelled.**, ignores the late response; Cancel All marks running plots as cancelled)
- **Load time in local time**: the **Loaded:** timestamp at the top right of the viewer used to be always in UTC (`2026-10-29T13:03:12.345Z`). New setting **`scientificDataViewer.showLoadTimeInLocalTime`** (default **on**) shows it in the local time zone of the viewer, still ISO 8601 with the UTC offset (`2026-10-29T14:03:12.345+01:00`); turn it off to get UTC back. Read at each load, so a change applies at the next **Refresh**. The webview formats the time itself, so with a remote host (SSH, WSL, containers) it is the time zone of the machine running VS Code, not of the remote. Formatting is shared by the webview and `HTMLGenerator` (`formatLoadTime` in `src/shared/time.ts`).
  - **Files**: `src/shared/time.ts`, `src/common/config.ts` (`getShowLoadTimeInLocalTime`, in `getExtensionConfigForWebview`), `src/panel/webview/render/representations.ts` (`displayTimestamp`), `src/panel/webview/render/dataInfo.ts`, `src/panel/HTMLGenerator.ts`, `src/panel/UIController.ts`, `package.json`, `docs/documentation.json`, `README.md` (regenerated), `scripts/architecture/graphs.py`, `docs/architecture/` (regenerated)
  - **Tests**: `test/suite/shared/time.test.ts`, `test/suite/ui/webviewScript.test.ts` (local by default, UTC when disabled), `test/suite/ui/HTMLGenerator.test.ts`, `test/suite/config.test.ts` (getter, webview config, `package.json` default)
- **v0.13 planning documentation**: `docs/v0.13/` (README, TO_IMPLEMENT, TO_REMOVE, OUT_OF_SCOPE, PHASES).
  - **Release notes**: `docs/RELEASE_NOTES_0.13.0.md`
  - **Pull request summary**: `docs/v0.13/PR_SUMMARY_0.13.0.md`
  - **Manual test plan**: `docs/v0.13/MANUAL_TEST_PLAN_0.13.0.md` (step-by-step validation of every v0.13 feature for non-expert testers, with a results sheet)
- **Viewer screenshots (`npm run screenshots`)**: saves full-page screenshots of the viewer to `screenshots/v<major.minor>/<theme>/NN-<scenario>.png` (git-ignored) with an `index.html` gallery. Four built-in VS Code themes (Dark Modern, Light Modern, High Contrast, High Contrast Light) and six scenarios (overview, every section expanded, plots, plot error, error page, 420 px width). The page is the real one: `HTMLGenerator` markup, compiled webview bundle and stylesheet. It is fed by the real Python backend with the extension's CLI arguments and default settings, on a small seeded NetCDF fixture so versions can be compared. Theme variables are recorded from a real VS Code by `capture-themes.mjs` (through `@vscode/test-electron`) and committed. No npm dependency: headless Chrome / Chromium / Edge is driven over the DevTools protocol with Node 22's WebSocket. Options: `--theme`, `--scenario`, `--setting key=value`, `--file`, `--python`, `--chrome`, `--width`, `--scale`, `--out`, `--skip-compile`.
  - **Files**: `scripts/screenshots/` (`take-screenshots.mjs`, `capture-themes.mjs`, `themes.mjs`, `themes/*.json`, `theme-capture-extension/`, `make_fixture.py`), `package.json` (`screenshots` script), `.gitignore`, `.vscodeignore`, `docs/SCREENSHOTS.md` (technical note), `docs/DEVELOPMENT.md`, `CLAUDE.md`
- **Architecture diagrams generated from the code (`docs/architecture/`)**: for contributors, 11 figures (processes and their boundaries, extension host modules, webview bundle, opening a file, creating and cancelling a plot, plot parameters, plot layout decision, interpreter choice, extension-owned uv environment, backend packages, backend pipelines) and the webview protocol tables. They come as a `README.md` rendered by GitHub, with standalone SVG files that follow the light or dark color scheme, and as one page, `architecture.html`. `python scripts/architecture/generate.py` writes them: Graphviz lays out the module graphs from the import statements; the protocol tables are read from `MessageTypes.ts`; the version, counts and timeouts shown come from `package.json` and the code's constants; the flows are drawn by `figures.py`. The output is deterministic. `--check` (no Graphviz needed) fails when a module is not placed in the diagrams, when a symbol named by a figure or the text no longer exists, or when the protocol notes no longer match `MessageTypes.ts`. Excluded from the `.vsix`.
  - **Files**: `scripts/architecture/` (`generate.py`, `codebase.py`, `graphs.py`, `figures.py`, `content.py`, `diagram.css`, `page.css`), `docs/architecture/` (generated), `.vscodeignore`, `docs/DEVELOPMENT.md`, `docs/TECHNICAL_ARCHITECTURE.md`, `CLAUDE.md`
  - **Tests**: `generate.py --check` passes and reports injected drift (unplaced module, missing module, renamed symbol, missing protocol note); byte-identical output on a second run; SVG files parse as XML and render in light and dark; pre-commit leaves the generated `README.md` unchanged
- **v0.13 sample data generators** (now in `python/sample_data/`): unsuffixed Zarr v3 directory, sharded Zarr v3, Zarr v3 ZIP, gzip NetCDF (filters), COG GeoTIFF, Kerchunk reference JSON (`sample_data.kerchunk.json`).
- **Automatic rebuild of the extension's own uv environment**: when **`useExtensionOwnEnvironment`** is on, a new extension version that requires different packages **deletes the environment and creates it again from scratch** once at startup (progress notification), instead of asking users to run **Manage Extension Virtual Environment → Update**. A rebuild rather than an in-place upgrade, because packages left over by older versions can break the environment (an in-place `--upgrade` keeps them). The need is declared by `ENVIRONMENT_REVISION` in `ExtensionVirtualEnvironmentManager` (**2** in v0.13: the new pins, then the `eccodeslib` pin below); a change of the requirement or constraint list also triggers it. The installed revision and requirements are recorded in `sdv-environment.json` inside the environment folder; environments without it (created by ≤ v0.12) are rebuilt. The previous environment is moved to `python-environment.previous` while the new one is created: if the rebuild fails (offline, uv missing…), it is moved back and used, and the rebuild is retried at the next start; if VS Code is closed during the rebuild, the next start restores it first. The same rebuild is available as **Manage Extension Virtual Environment → Recreate**. At startup, when the extension's own environment cannot be used, an error now says why (it used to fall back to another interpreter silently). Python-extension and override interpreters are not touched: updating them stays the user's responsibility.
  - **Files**: `src/python/ExtensionVirtualEnvironmentManager.ts`, `src/python/ExtensionVirtualEnvironmentManagerUI.ts`, `src/python/PythonManager.ts`, `src/extension.ts`, `docs/documentation.json`, `docs/PUBLISHING.md`
  - **Tests**: `test/suite/python/extensionEnvironmentUpdate.test.ts` (rebuild, restore after failure, missing uv, interrupted rebuild); end-to-end upgrade from v0.12.1 in a throw-away VS Code profile with `scripts/upgrade-sandbox.sh`
- **Upgrade test script** `scripts/upgrade-sandbox.sh`: installs an old release in a throw-away VS Code profile, lets it create its environment, then starts the new build and checks the rebuilt environment (state file, nothing left from the old one, `eccodeslib` pin, backend on sample files). Scenarios `normal`, `offline` (failed rebuild keeps the old environment) and `interrupted` (VS Code killed during the rebuild).
  - **Files**: `scripts/upgrade-sandbox.sh`, `docs/v0.13/UPGRADE_TEST_PLAN.md`
- **v0.13 getting-started hub** `docs/v0.13/GETTING_STARTED.md`: where to start reviewing, testing and releasing v0.13; the v0.13 working documents (PR summary, manual test plan, code review list) moved to `docs/v0.13/`.
- **Golden snapshot harness**: `python/tools/golden_snapshots.py record|check` runs the backend CLI on local `sample-data/` files (info and plot cases, incl. v0.13 formats) and compares normalized JSON output, plot PNGs by hash with a frozen clock. Snapshots live in git-ignored `python/.golden/`.
  - **Files**: `python/tools/golden_snapshots.py`, `python/tools/_frozen_clock_entry.py`, `.gitignore`
- **Sample data `--overwrite` / `--disposable` flags**: `python python/create_sample_data.py --overwrite` regenerates existing files through an empty staging directory, leaving files no generator produces untouched; `--disposable` creates the deletion-test files.
  - **Files**: `python/sample_data/main.py`, `python/create_sample_data.py`, `docs/DEVELOPMENT.md`
- **Dimension slices: start / stop / step boxes and a two-handle slider**: each dimension's slice was one text box. It is now three boxes joined into one control, **start : stop : step** (rounded outer corners, colons in the gutters), with a slider below whose two handles set start and stop; the step is never touched by the slider. Boxes and slider stay in sync both ways. Start with an empty stop selects a single index, also when a step is typed (the step is then struck through: ignored); otherwise the boxes form `start:stop[:step]`, stop excluded. Dragging one handle rewrites only its own box: a box keeps its text (negative, empty) while the index it stands for does not change; both boxes change when the handles cross, or when an index becomes a range. Handles on top of each other give an index (stop emptied); handles at both ends with an empty start clear the selection. Typing or pasting a whole slice (`0:24:2`) in a box spreads it over the boxes and moves the focus, so `1:5` can be typed in one go; an open slice after a start (`5:`, `5::2`) gets the dimension size as stop, keeping its Python meaning ("to the end"), selected so that typing replaces it. Negative start / stop count from the end: the handles show their positive position, the text is kept until its own handle moves; values beyond the dimension are clamped on the slider only. A negative step disables the slider (a reversed slice cannot be shown); a stop at or before start (empty selection) outlines the stop box in red; non-integer input too. Dimensions of size 1 have no slider. The value sent to the backend is unchanged (an index or a `start:stop:step` string); the start box keeps the historical element id (`dim-slice-<dim>`, `group-dim-<group>-<dim>`); stop / step / handles get `-stop`, `-step`, `-from`, `-to`.
  - **Files**: `src/panel/webview/dimensionSlices.ts` (new: render, read, reset, two-way sync), `src/panel/webview/plotParams.ts`, `src/panel/webview/main.ts`, `src/panel/webview/render/dataInfo.ts`, `src/panel/HTMLGenerator.ts`, `src/panel/webview/styles.css`, `docs/documentation.json`, `README.md`, `docs/architecture/` (regenerated)
  - **Tests**: `test/suite/ui/webviewScript.test.ts` (slice spread over the boxes, index vs slice, boxes → slider, one handle rewrites one box, crossing handles, index with an ignored step, open slice after a start, negative values, reversed step, empty selection, whole dimension, Reset); real mouse drags in headless Chromium (one handle keeps a negative start; overlapped handles pulled apart and brought back with a step)

- **QA harnesses (`scripts/qa/`)**: the tools of the v0.13.0 QA campaign, kept to run again before a release (nothing ships in the `.vsix`). `fixtures/make_fixtures.py` writes ~60 hostile or degenerate files (HTML / script payloads in every name and value, unicode and `-`-leading names, `inf` / `nan` / huge attributes, odd dtypes, cftime, broken files, Zarr in every packaging, Kerchunk references, a slow dataset). `backend/` runs a baseline checkout (`make_baseline.sh v0.12.1`) and the working tree with the same interpreter: `diff_info.py` (structural diff of `info`), `diff_plot.py` (every variable, pixel comparison), `diff_scen.py` (~80 plot-option scenarios). `webview/` drives the real page (real CSP, compiled bundle, VS Code theme variables) in headless Chromium with real keyboard and mouse input, the backend running through the extension's compiled `buildCreatePlotCliArgs` / `runProcess` / `parseScriptResult`. `e2e/` runs mocha suites inside a real VS Code against the live `DataViewerPanel` / `UIController` / `MessageBus`. Outputs go to the git-ignored `.qa/`.
  - **Files**: `scripts/qa/` (`README.md`, `fixtures/`, `backend/`, `webview/`, `e2e/`), `.gitignore`, `docs/DEVELOPMENT.md`, `CLAUDE.md`
- **`paranoia.sh`: every automated check before a release, and a readiness report**: one command runs the checks that were spread over `publish.sh`, `pre-commit`, `npm test`, `pytest`, the golden snapshots, `generate.py --check`, the QA harnesses and the upgrade sandbox, in three profiles (`--quick` ~5 min, default ~20 min, `--full` ~30 min with the e2e suites, the three upgrade scenarios and the screenshots). It writes `.qa/paranoia/<date-time>/REPORT.md`: a verdict (`NOT READY`, `NOT FULLY VERIFIED`, `READY AFTER REVIEW`, `READY`, only a full run can be ready), a table of the 26 checks with links to their logs, the end of the log of each failure or warning, the files to look at (plot differences, screenshots, e2e observations) and what is left to check by hand. It adds checks of what users install rather than of the working tree: the `.vsix` is built in the run folder and audited (runtime files present, every relative `require()` resolves, nothing leaked, diff with the previous release), its Python backend answers `info` / `plot` from outside the repository, and the e2e suites and the upgrade sandbox run on it. Also new: the version is above the Marketplace and Open VSX ones and not tagged elsewhere, the relative links of README / CHANGELOG / release documents resolve, a change of the uv environment since the last release requires the upgrade sandbox, a plot that worked in the last release and fails now fails the run. Nothing is published, tagged or committed, and the working tree is left as it was: fixes of the pre-commit hooks go to a patch. It also lists the commits missing from the commit list of the PR summary, for information only (that list always lags one commit behind the commit that updates it). Its first runs found two committed planning documents that `pre-commit --all-files` (so the CI) reformats, 9 `npm audit` findings that fail the CI, and `publish.sh` crashing on an old system `python3`; all fixed (see below).
  - **Files**: `paranoia.sh` (new), `scripts/paranoia/checks.py` (new: release documents, uv environment change, `.vsix` audit, packaged backend smoke test, triage of `diff_info.py`, report), `docs/DEVELOPMENT.md`, `CLAUDE.md`, `docs/v0.13/GETTING_STARTED.md`
  - **Tests**: `./paranoia.sh --quick`, the default profile and `--full` on this branch (verdicts and findings as expected); `--only`, `--skip`, `--list`, interrupted run; a check failing on purpose is reported with its log
- **Findings of the first `paranoia.sh` runs fixed**: `publish.sh` ran `scripts/generate_readme.py` with the system `python3`, which crashes on Python 3.8 (`zip(strict=True)`); it now uses the repository `.venv` (`PYTHON=<path>` to override, `python3` when there is no `.venv`) for the README check and the Python version check. `npm audit fix` updates the lockfile only (undici, markdown-it, qs, serialize-javascript: 9 findings, 5 high; development dependencies, not in the `.vsix`) so the `npm audit` step of the CI passes. `docs/v0.13/OUT_OF_SCOPE.md` and `TO_REMOVE.md` formatted by prettier (tables and emphasis only, no wording change), so `pre-commit --all-files` passes. The commit list of the PR summary rebuilt from `git log` (4 missing commits, duplicated numbers). `scripts/upgrade-sandbox.sh --scenario interrupted` always timed out: `wait_for_log` used `grep -q`, which stops at the first match, so `cat` got SIGPIPE and, with `pipefail`, the line counted as missing; that scenario waits for a line early in the long verbose uv log. `grep` now reads the whole log. The test _only the latest load updates the panel_ (`UIController.test.ts`) timed out now and then: both loads await `fs.stat` before reaching the stubbed processor, the two stats can resolve in either order, and the test then resolved the wrong load and waited forever; the second load now starts once the first one is pending.
  - **Files**: `publish.sh`, `scripts/upgrade-sandbox.sh`, `test/suite/ui/UIController.test.ts`, `package-lock.json`, `docs/v0.13/OUT_OF_SCOPE.md`, `docs/v0.13/TO_REMOVE.md`, `docs/v0.13/PR_SUMMARY_0.13.0.md`
  - **Tests**: `./paranoia.sh --full` (`pre-commit`, `npm-audit`, `npm-test`, e2e suites with the updated lockfile)
- **QA report and fix tracker**: `docs/v0.13/QA_REPORT_0.13.0.md` (method, findings with proof, what was verified) and `docs/v0.13/QA_FIXES_0.13.0.md` (one checkbox per finding).
- **The `.vsix` holds the strict minimum**: `.vscodeignore` was a deny-list with allow-lists inside `src/` and `python/` only, so any new top-level file or folder was packaged by default (the git-ignored `.qa/` of the QA harnesses was, and its dangling-symlink fixture broke `vsce package`). It now excludes everything and names each runtime file: `package.json`, README, LICENSE, the two icons, `out/src/**/*.js`, `out/webview/webview.js`, `src/panel/webview/styles.css` and the Python backend. Source maps are no longer shipped (they point to TypeScript sources that are not packaged), and `vscode:prepublish` deletes `out/` before compiling, so the compiled files of deleted sources cannot ship. 100 → 70 files, 1.09 → 1.05 MB.
  - **Files**: `.vscodeignore`, `package.json` (`vscode:prepublish`), `CLAUDE.md`
  - **Tests**: `npx vsce ls` before / after: only the 30 `.js.map` files removed; a file planted in `out/src/` is not packaged; the unpacked `.vsix` passes the VS Code suites `s1`, `s3`, `s10` (119 tests, backend run from the package)

### Changed

- **Plots keep the automatic layout when one control is set**: the automatic plot was all or nothing. Setting any dimension slice or layout control (row, col, col_wrap, x, y, hue, size, aspect) switched to a "user layout" built from the user's values only, so slicing `lat` of `root_data(time, lat, lon)` in `sample_data_multiple_groups.nc` gave a histogram instead of one map per time step. Now `resolve_layout` keeps every role the user set and fills the others from the free dimensions (hue → lines, two dimensions or more → image, one → line; empty axes take the last free dimensions; the rest become col, or row and col; col_wrap and figure size get defaults). Dimension slices and the time range only select data. Size-1 dimensions not chosen are taken at index 0. User choices that cannot be used (absent dimension, same dimension in two roles, col_wrap without column facets, too many dimensions) are dropped with a note instead of silently. With no control set, plots are unchanged. Each choice is reported as `user` or `auto` in the new `plot_layout` field of the plot result; `applied_isel_kwargs` reports slices as `5:15`; the `createPlot` request answers `{plotData, layout, appliedSlices}`. Images of a user layout use `imshow` like the automatic ones (`pcolormesh` for non-dimension coordinate axes).
  - **Files**: `python/sdv_backend/plotting/layout.py` (new: `resolve_layout`, `PlotLayout`), `python/sdv_backend/plotting/draw.py` (one call per kind), `python/sdv_backend/plotting/kwargs.py` (`PlotKwargsBundle.for_kind`; `draws_color_mesh` removed), `python/sdv_backend/plotting/options.py` (`has_user_layout` removed), `python/sdv_backend/plotting/api.py`, `python/sdv_backend/results.py`, `src/shared/plotLayout.ts` (new), `src/types.ts`, `src/panel/communication/MessageTypes.ts`, `src/panel/UIController.ts`, `src/panel/webview/bus.ts`, `scripts/qa/` (harness and e2e read the new response)
  - **Tests**: `python/tests/test_plot_layout.py` (new), `python/tests/test_plot_drawing.py`, `python/tests/test_col_wrap.py`, `test/suite/ui/UIController.test.ts`, `test/suite/communication/MessageBus.test.ts`; sampled sweep of 1,750 option combinations over 7 shapes
- **Changed plot controls are outlined, and each plot shows its layout**: a time-range, dimension-slice or plot-parameter field that differs from its default is outlined, with a dot after its name (a group checkbox showing the dash and time bounds prefilled with the full range count as defaults); Reset clears the outlines and exported HTML keeps them. Under each plot, a line shows the plot kind, then every slice and role with its value: the items set by the user are outlined the same way, the others were chosen automatically; notes list the choices that could not be used. The plot parameters hint says empty fields are chosen automatically.
  - **Files**: `src/panel/webview/changedFields.ts` (new), `src/panel/webview/render/plotLayout.ts` (new), `src/panel/webview/plotActions.ts`, `src/panel/webview/timeControls.ts` (`data-baseline` of prefilled bounds), `src/panel/webview/main.ts`, `src/panel/webview/render/dataInfo.ts`, `src/panel/webview/render/variables.ts`, `src/panel/webview/styles.css`, `src/panel/HTMLGenerator.ts`
  - **Tests**: `test/suite/ui/webviewScript.test.ts` (outlines set, cleared, Reset, group checkbox, prefilled time range; layout line with user and automatic items, escaped notes, cleared by Reset); `node scripts/qa/webview/run-all.mjs` passes
- **How a plot is made (`docs/PLOTTING.md`, new)**: explains the whole plotting mechanism: what the webview sends, the changed outline, the backend layout decision step by step with examples, the xarray call and style options per plot kind, the result JSON, known limitations. Two new generated diagrams: _Plot parameters, from the controls to the request_ and _Plot layout decision in the backend_.
  - **Files**: `docs/PLOTTING.md`, `scripts/architecture/graphs.py` (`plot_parameters_dot`, `plot_layout_dot`), `scripts/architecture/content.py`, `scripts/architecture/generate.py`, `scripts/architecture/figures.py`, `docs/architecture/` (generated), `docs/documentation.json` and generated `README.md`, `docs/DEVELOPMENT.md`, `docs/TECHNICAL_ARCHITECTURE.md`, `CLAUDE.md`

- **DataTree flattening documentation**: README / exploring-data prose now describes **`DataTree.to_dataset(inherit='all_coords')`** instead of bare **`to_dict()`** for per-group views.
  - **Files**: `docs/documentation.json`, generated `README.md`
- **Supported formats table**: Adds **Kerchunk** row (`*.kerchunk.json`, `*.ref.json`); GeoTIFF row unchanged (COG is a runtime label).
  - **Files**: `package.json`, `docs/documentation.json`, `README.md`

- **Python backend split into the `sdv_backend` package**: the 3,700-line `python/get_data_info.py` becomes `python/sdv_backend/` (`cli`, `results`, `serialization`, `environment/`, `formats/`, `opening`, `info/`, `plotting/`), with one-way imports `cli → info/plotting → opening → formats → environment`. Code was moved verbatim, then `create_plot` (~540 → ~110 lines) and `get_file_info` were decomposed; they take `PlotOptions` / `InfoOptions` dataclasses. `OpenedData` (in `opening.py`) wraps the DataTree / dict-of-Datasets duality for both modes. `python/get_data_info.py` remains a thin entry point, so the TypeScript side is unchanged; `python -m sdv_backend` also works. Golden snapshots were identical before and after.
  - **Files**: `python/sdv_backend/**`, `python/get_data_info.py`, `python/non_regression_test_plot.py`, `docs/DEVELOPMENT.md`, `CLAUDE.md`
- **Python tests moved** to `python/tests/` with `python/pyproject.toml` (package metadata, pytest config); run `pytest python/tests`.
  - **Files**: `python/tests/**`, `python/pyproject.toml`, `setup.sh`
- **Sample generators split into the `sample_data` package**: the 6,000-line `python/create_sample_data.py` becomes one module per format family under `python/sample_data/`; `main.py` is table-driven and a failing generator no longer stops the others. Generation is reproducible (numpy seeded per generator, fixed creation timestamps and ZIP entry dates). The package is now linted by ruff.
  - **Files**: `python/sample_data/**`, `python/create_sample_data.py`, `.pre-commit-config.yaml`, `python/tests/test_compound_dtype_sample.py`
- **GitHub issue templates: every field optional**: bug report, feature request and question forms no longer require any field or checkbox, and their intros say so, so that filing an issue does not feel like paperwork.
  - **Files**: `.github/ISSUE_TEMPLATE/bug_report.yml`, `.github/ISSUE_TEMPLATE/feature_request.yml`, `.github/ISSUE_TEMPLATE/question.yml`
- **VSIX contents**: nested `__pycache__`, `python/tests/`, `python/tools/`, `python/.golden/` and pytest caches are excluded.
  - **Files**: `.vscodeignore`
- **Webview channel simplified (code review)**: `MessageBus` is now a ~100-line host-side channel (`handle(command, fn)` for webview requests, `emit(event, payload)` for events) typed by one `Requests` and one `Events` map in `MessageTypes.ts`. The unused host→webview request path, event listeners, convenience methods, 17 unused payload interfaces and the `getDataInfo` / `getCurrentFilePath` / `updateHeaders` handlers are gone, as are the `uiStateChanged` / `pythonEnvironmentChanged` events. The Redux-like `StateManager` (undo history, validation, 7 never-dispatched actions) is replaced by three fields on `UIController`; a file load now posts one `dataLoaded` message instead of ~9 full-state broadcasts (each carrying the HTML representations). Load errors take one path (ErrorBoundary → `error` event) and keep the backend's suggestion and error type.
  - **Files**: `src/panel/communication/MessageBus.ts`, `src/panel/communication/MessageTypes.ts`, `src/panel/UIController.ts`, `src/panel/state/AppState.ts` (deleted), `src/DataViewerPanel.ts`
  - **Tests**: `test/suite/communication/MessageBus.test.ts`, `test/suite/ui/UIController.test.ts` (rewritten to drive the controller through the channel); `test/suite/state/AppState.test.ts` and 10 placeholder `assert.ok(true)` tests in `dataViewerPanel.test.ts` removed
- **Plot options passed as one object**: the 24 positional plot parameters (webview → `UIController` → `DataProcessor`) are one `PlotOptions` object; CLI arguments are built by `buildCreatePlotCliArgs` (mirrors `buildGetDataInfoCliArgs`). `DataProcessor` is no longer a singleton: `extension.ts` creates it and hands it to `DataViewerPanel` / `UIController`. `getDataInfo` now rejects on subprocess failure (with the real message) instead of returning `null`, and has a 5-minute timeout.
  - **Files**: `src/types.ts`, `src/python/DataProcessor.ts`, `src/panel/UIController.ts`, `src/DataViewerPanel.ts`, `src/extension.ts`
  - **Tests**: `test/suite/dataProcessor.test.ts` (`buildCreatePlotCliArgs`), `test/suite/integration.test.ts`, `test/suite/datetimeEdgeCases.test.ts`
- **Webview rewritten as TypeScript modules**: the 4,000-line `webview-script.js` is split into `src/panel/webview/` (`main`, `bus`, `state`, `util`, `plotParams`, `timeControls`, `plotActions`, `export`, `errors`, `render/*`) with its own `tsconfig.json` (DOM, strict), bundled by **esbuild** into `out/webview/webview.js` (`npm run compile` / `watch`; new `npm run typecheck`). One `PLOT_PARAMETERS` table drives render / read / reset / merge for both global and group plot controls (~600 duplicated lines removed); one `resolvePlotOptions` serves single and "Plot All"; the `globalTimeControlsState` DOM mirror is gone. The supported-extensions list in error pages is generated from `package.json` (now includes Kerchunk). `CSSGenerator` / `JavaScriptGenerator` merged into `WebviewAssets`. `joinId` shared with the outline through `src/shared/ids.ts`.
  - **Files**: `src/panel/webview/**`, `scripts/build-webview.mjs`, `src/panel/WebviewAssets.ts`, `src/panel/HTMLGenerator.ts`, `src/shared/ids.ts`, `src/outline/HeaderExtractor.ts`, `package.json` (esbuild devDependency), `tsconfig.json`, `tsconfig.pre-commit.json`, `.pre-commit-config.yaml`, `.vscodeignore`
  - **Tests**: `test/suite/ui/webviewScript.test.ts` (real bundle in jsdom), `test/suite/ui/WebviewAssets.test.ts`, `test/suite/ui/webviewExport.test.ts`
- **Group plot overrides apply field by field**: an empty group field or a group checkbox left at its default now falls back to the global value; previously any non-default group setting made all group checkboxes win. Group dimension slices still replace the global ones when set.
  - **Files**: `src/panel/webview/plotParams.ts`, `src/panel/webview/plotActions.ts`
- **Subprocesses without a shell**: every `uv` / Python spawn goes through `src/common/runProcess.ts` (no shell, timeout and abort with SIGTERM → SIGKILL), replacing ~9 copy-pasted wrappers; `quoteIfNeeded` is gone.
  - **Files**: `src/common/runProcess.ts`, `src/python/PythonManager.ts`, `src/python/ExtensionVirtualEnvironmentManager.ts`
  - **Tests**: `test/suite/common/runProcess.test.ts`
- **Healthcheck simplified** (1,184 → ~700 lines, plain functions instead of a singleton): one Python package check feeds both Dependencies and Supported Formats; package lists derive from `ALL_REQUIREMENTS`; uv detection reuses the environment manager. The always-passing **Logging System** section and the duplicate **Performance** section are removed.
  - **Files**: `src/common/HealthcheckManager.ts`, `src/extension.ts`
  - **Tests**: `test/suite/common/HealthcheckManager.test.ts`
- **Python plot drawing as plain functions**: the strategy classes, registries and dispatcher (`plotting/strategies/`, `dispatcher.py`, ~580 lines) are replaced by `plotting/draw.py`; identical `*_imshow_merged_kw` helpers collapsed into `imshow_kwargs()`; engine tables in `opening.py` / `engines.py` simplified; ZIP member listing cached (one open per run instead of three). Plot PNGs are byte-identical (non-regression gallery).
  - **Files**: `python/sdv_backend/plotting/draw.py`, `python/sdv_backend/plotting/kwargs.py`, `python/sdv_backend/plotting/api.py`, `python/sdv_backend/opening.py`, `python/sdv_backend/environment/engines.py`, `python/sdv_backend/formats/zarr.py`
  - **Tests**: `python/tests/test_plot_drawing.py`, `python/tests/test_opening.py`
- **Numeric attributes are JSON numbers**: numpy scalars and arrays in attributes (e.g. `_FillValue`, `valid_range`, `flag_values`) are now sent as numbers / arrays instead of strings such as `"[0. 2.]"`; `inf` / `nan` stay text.
  - **Files**: `python/sdv_backend/serialization.py`
  - **Tests**: `python/tests/test_serialization.py`
- **Datetime variables detected by dtype only**: the time selector lists `datetime64` and cftime variables; the name heuristic (`t`, `time`, `date`… with any `units`) is gone, so e.g. ERA5/GRIB temperature `t` (K) no longer appears with nonsense ranges.
  - **Files**: `python/sdv_backend/info/variables.py`, `python/sdv_backend/info/extract.py`
  - **Tests**: `python/tests/test_datetime_edge_cases.py`
- **Developer docs**: `docs/TECHNICAL_ARCHITECTURE.md` rewritten to describe the actual architecture (it described components that never existed); `docs/DEVELOPMENT.md`, `CLAUDE.md` updated; code review tracking list in `docs/v0.13/CODE_REVIEW_TODO.md`.
- **Dependencies**: unused runtime dependency `axios` removed; `jsdom` (tests only) moved to `devDependencies`; build scripts excluded from the VSIX.
  - **Files**: `package.json`, `package-lock.json`, `.vscodeignore`
- **Modernised viewer styling**: the stylesheet is rewritten to look like current VS Code (Settings editor, sidebar panes) instead of a plain web page. Rounded cards for variables, plot panels and code blocks; wider gutters and a centred 960 px column; a sticky header toolbar with icon buttons (SVG line icons in the theme's icon color, replacing the 🖼️ 📁 📂 🔄 emoji); VS Code-style twisties on every collapsible section; sub-sections (Dimensions, Variables…) as uppercase pane headers; one consistent style for every input, select and checkbox (some plot inputs were white in dark themes); secondary buttons for plot actions; error and plot-error callouts; keybinding-style `<kbd>`; a loading spinner. Colors still come only from the active theme (`--vscode-*` variables; derived surfaces use `color-mix()` with flat fallbacks for VS Code < 1.77, explicit contrast borders in high-contrast themes). Copy buttons read **Copy** / **Copied** instead of `📋 Copy`. Element ids, classes and the outline are unchanged.
  - **Files**: `src/panel/webview/styles.css`, `src/panel/HTMLGenerator.ts`, `src/panel/webview/main.ts`, `src/panel/webview/plotActions.ts`, `src/panel/webview/render/representations.ts`, `docs/documentation.json`, generated `README.md`
  - **Tests**: existing suite (290 passing); visual check of dark, light, narrow, scrolled, plot and error states in headless Chromium
- **Line icons instead of emoji everywhere in the viewer**: ⚠️ Plot All, 🛑 Cancel All, 🎮 install / settings / logs links, 🔗 external links (now an external-link mark after the text), ❌ Error, 💡 troubleshooting and 🌐 Browser Mode use the same inline SVG line icons as the toolbar, drawn in the text color of their container. The icon set moves to `src/shared/icons.ts`, shared by `HTMLGenerator` and the webview bundle. The error page rules are scoped to `#error`: they also matched plot errors (class `error`) and added a 16 px margin under them.
  - **Files**: `src/shared/icons.ts`, `src/panel/HTMLGenerator.ts`, `src/panel/webview/errors.ts`, `src/panel/webview/plotActions.ts`, `src/panel/webview/main.ts`, `src/panel/webview/styles.css`
  - **Tests**: existing suite (290 passing); every theme checked with `npm run screenshots`

- **Xarray encoding in its own section; variable cards with collapsible sections**: the xarray encoding no longer shows up among the attributes as `__xarray_encoding.*` entries. Groups, coordinates and variables get an **Xarray Encoding** section, collapsed by default, with the plain keys (`dtype`, `_FillValue`, `chunks`, `zlib`, `compressors`…). A variable is now one card made of its summary row (name, dims, dtype, shape, size) and up to three sections: **Attributes** (open by default), **Xarray Encoding** (collapsed) and, for data variables, **Plot** (open). Each section has a pane-style header with an entry count and collapses on its own; clicking the summary row shows or hides the whole card (the Plot section included, which used to stay visible), and each section keeps its own state when the card is opened again. Cards start collapsed, so a group reads as a one-line-per-variable list. Creating a plot (one variable or **Plot All**) opens the card and its Plot section so the result is seen; groups keep the state the user chose. Group sections (Dimensions, Coordinates, Variables, Attributes, Xarray Encoding) show their entry count as a badge. Empty sections are not shown for variables. The Outline lists **Xarray Encoding (n)** under groups, coordinates and variables, with the webview's ids. Backend JSON: `VariableInfo` / `CoordinateInfo` get `encoding`, `FileInfoResult` gets `encoding_flattened`; `attributes` / `attributes_flattened` now hold only the attributes. The duplicated `__xarray_encoding.filters.*` entries are gone (the same keys are in the encoding). The setting `showXarrayEncodingAttributes` keeps its name and now shows or hides the encoding sections.
  - **Files**: `python/sdv_backend/info/encoding.py` (`collect_attributes`, `collect_encoding`), `python/sdv_backend/info/variables.py`, `python/sdv_backend/info/extract.py`, `python/sdv_backend/results.py`, `python/sdv_backend/info/options.py`, `python/sdv_backend/cli.py`, `src/panel/webview/render/variables.ts`, `src/panel/webview/render/dataInfo.ts`, `src/panel/webview/plotActions.ts`, `src/panel/webview/styles.css`, `src/outline/HeaderExtractor.ts`, `src/types.ts`, `package.json` (setting description), `docs/documentation.json`, `README.md`
  - **Tests**: `test/suite/ui/webviewScript.test.ts` (card sections and default states, encoding ids, group encoding section, plot opens the card), `test/suite/outline/HeaderExtractor.test.ts` (encoding headers and ids), `python/tests/test_display_feature_flags.py`, `python/tests/test_zarr_store_detection.py`, `python/tests/test_netcdf_datatree_quality.py` (compression keys with netcdf4 and h5netcdf), `python/tests/test_compound_dtype_sample.py`; checked with `npm run screenshots`

- **Groups as cards, like the variables**: each group is one bordered card instead of a title followed by detached sections. Its header row (group name, then "3 dimensions · 3 coordinates · 3 variables") stays pinned under the toolbar while scrolling the group, tinted but opaque, with a divider under it; below it, **Group Plot Controls**, **Dimensions**, **Coordinates**, **Variables**, **Attributes** and **Xarray Encoding** are sections separated by hairlines, with the same pane headers, hover and indentation as the sections of a variable card. Inside the card, the dimensions and the group plot control panels lose their own box (no box in a box). The counts in the header tell what a collapsed group holds. Section ids are unchanged (now on the section `<details>`), so the outline and plotting work as before. `overflow: clip` rounds the card without breaking the sticky header.
  - **Files**: `src/panel/webview/render/dataInfo.ts` (`renderGroupSection`), `src/panel/webview/styles.css`
  - **Tests**: `test/suite/ui/webviewScript.test.ts` (group card header counts, section order, ids and default states); checked with `npm run screenshots` (dark, light, 420 px) and a one-off scrolled capture (sticky header)

- **Plot controls laid out as aligned fields**: the Global and Group Plot Controls were a flow of `label: input` pairs of different widths, headings in three styles, checkboxes after their label and a box per panel. Now every block (**Time range**, **Dimension slices** `isel`, **Plot parameters** `plot`) has the same heading, a one-line hint and its own **Reset** button, and blocks are divided by hairlines. Each parameter is a field (xarray name in the editor font, a short hint, the control below it at full width) in a grid whose columns line up across blocks. Plot parameters are sorted in four fieldsets: **Facets** (row, col, col_wrap), **Axes** (x, y, hue, xincrease, yincrease), **Color** (vmin, vmax, cmap, robust, add_colorbar), **Figure** (size, aspect, bins, add_legend). The global controls are one card; in a group card, the controls draw no box of their own. **Reset** next to Dimension slices now clears only the slices (it used to clear the plot parameters too); the new **Reset** next to Plot parameters clears them. Placeholders say `auto` for vmin / vmax. Element ids, `data-param` / `data-time` attributes and the plot request are unchanged. The `row` / `width` fields of the plot-parameter table become `group` / `hint`.
  - **Files**: `src/panel/webview/plotParams.ts` (`PLOT_PARAMETERS`, `renderPlotParameters`, `renderDimensionSliceInputs`), `src/panel/webview/render/dataInfo.ts`, `src/panel/HTMLGenerator.ts`, `src/panel/webview/main.ts` (`clear-plot-controls` resets its block), `src/panel/webview/styles.css`
  - **Tests**: `test/suite/ui/webviewScript.test.ts` (each Reset clears its own block); checked with screenshots of the plot controls (dark, light, 420 px)

- **Group checkboxes can override the global ones both ways**: a group checkbox (xincrease, yincrease, robust, add_colorbar, add_legend) starts at "use the global value", shown as a dash (indeterminate). Clicking it gives the group its own value; **Reset** goes back to the global value. Before, a group checkbox left at its default always deferred to the global one, so a group could not turn add_colorbar back on when it was off globally, while the box showed it checked. The state survives the HTML export (`data-inherit`). The group hint now says that checkboxes showing a dash use the global values.
  - **Files**: `src/panel/webview/plotParams.ts` (`setInherited`, `showInheritedCheckboxes`, `handleInheritedCheckboxChange`, `mergePlotControls`), `src/panel/webview/render/dataInfo.ts`, `src/panel/webview/main.ts`
  - **Tests**: `test/suite/ui/webviewScript.test.ts` (global value until clicked, override, back to global after Reset; kept by the export); `scripts/qa/webview/controls.mjs`
- **Numbers typed wrong in the plot parameters are reported**: `vmin = 1,5`, `size = -3` or `bins = 0` used to be dropped silently and the plot made without them. The field is now outlined in red as you type (with the reason in its tooltip, e.g. "use a dot as decimal separator"), and **Create Plot** shows "Invalid plot parameters, nothing was plotted" with each field instead of plotting. A wrong global value only counts when the group does not override it.
  - **Files**: `src/panel/webview/plotParams.ts` (`validatePlotParameterInput`, `invalidPlotParameters`), `src/panel/webview/plotActions.ts` (`invalidPlotOptions`), `src/panel/webview/main.ts`, `src/panel/webview/styles.css`
  - **Tests**: `test/suite/ui/webviewScript.test.ts`; `scripts/qa/webview/controls.mjs`
- **Numeric array attributes read like numpy**: `[0.1, nan, inf]` and `[0, 2]` instead of the JSON text `[0.1,"nan","inf"]` / `[0,2]` (attributes and Xarray Encoding).
  - **Files**: `src/panel/webview/util.ts` (`attributeValueStrings`)
  - **Tests**: `test/suite/ui/webviewScript.test.ts`
- **`maxFileSize` of 0 or less means no limit**, instead of refusing every file ("Maximum allowed: 0MB"); the schema now rejects it (`exclusiveMinimum: 0`). The limit is documented as applying to files only: a Zarr directory is not size-checked (its reported size was that of the directory entry, so the check was meaningless).
  - **Files**: `src/common/config.ts` (`getMaxSize`), `src/panel/UIController.ts`, `package.json`, `README.md` (regenerated)
  - **Tests**: `test/suite/config.test.ts`, `test/suite/ui/UIController.test.ts`

### Removed

- **Stale Sentinel-1 SAFE support claims (Phase 0)**: **`.safe`** removed from explorer context menu filters, `package.json` keywords, Python **`SupportedExtensionType`**, sample generator hooks, and webview comments. Historical CHANGELOG entries for v0.5 SAFE removal are unchanged.
  - **Files**: `package.json`, `python/sdv_backend/`, `python/sample_data/`, `test/suite/extension.test.ts`
- **Dead code found in the code review**: `isPlotOperationActive`, `getActiveOperations`, `ATTEMPT_CREATING_EXTENSION_OWN_UV_ENVIRONMENT`, duplicate `DataInfoResult` / `DataInfoError` declarations and fields Python never sends (`format`, `format_info.is_supported`), unused `package-types.ts` types, `HeaderExtractor.extractHeaders` (needed `DOMParser`, absent in the extension host), `ErrorBoundary.wrapSync` / `getErrorCount` / `clearErrorHistory`, `PerformanceTimer.getMarks`, non-existent Python-extension API fallbacks, unreachable UI cases; webview dead handlers and listeners; unused CSS (`.variable-item`, `.dimension-item`, `.variable-row`, `.plot-progress`); Python pre-DataTree branches, `ComplexEncoder` dead branches, unreachable colormap branches, duplicate `XR_OPTIONS`. `h5py` is no longer listed as an xarray engine (it is not one).
  - **Files**: see `docs/v0.13/CODE_REVIEW_TODO.md` items D1–D9
- **Plot type selector ("Auto (Recommended)")**: the drop-down next to each variable's **Create Plot** button had a single option, `auto`, and the backend rejected any other value, so it is removed end to end: the `<select>` in the webview, the `plotType` field of the plot request, the `plot_type` positional argument of `get_data_info.py plot` (now `plot <file> <variable> [flags]`) and `PlotOptions.plot_type`. Plots are unchanged: xarray still picks the plot from the variable's shape. Plot error messages no longer end with `plot_type='auto'`. The golden snapshot case `plot__histogram` (unsupported plot type) is dropped.
  - **Files**: `src/panel/webview/render/variables.ts`, `src/panel/webview/plotActions.ts`, `src/types.ts`, `src/python/DataProcessor.ts`, `python/sdv_backend/cli.py`, `python/sdv_backend/plotting/options.py`, `python/sdv_backend/plotting/api.py`, `python/tools/golden_snapshots.py`, `python/non_regression_test_plot.py`
  - **Tests**: `test/suite/dataProcessor.test.ts` (argv without plot type), `test/suite/datetimeEdgeCases.test.ts`, `test/suite/integration.test.ts`, `test/suite/ui/webviewScript.test.ts`, `python/tests/test_dimension_slices_and_small_value.py`; 290 TS / 165 Python passing, golden snapshots 82 / 0 failing

- **Time Controls (Global and Group)**: the **Time range** block of the Global and Group Plot Controls (datetime variable, start / end) is removed, with its settings **`scientificDataViewer.globalTimeControls`** and **`scientificDataViewer.groupTimeControls`**. It has been off by default since v0.9, was little tested, and overlaps with **Dimension Slices**, which subset any dimension, time included (`0:24:2`); the plot controls now focus on the generic ones. A label-based selection (`sel`) for every coordinate can come later, once defined. Removing the settings is safe: VS Code does not fail on unknown keys, a value left in `settings.json` is only greyed out as _Unknown Configuration Setting_ and ignored (no `deprecationMessage` kept, since the setting no longer does anything). The Python backend is unchanged: `--datetime-variable` / `--start-datetime` / `--end-datetime` and the `datetime_variables` field of the info JSON stay available from the command line, so the feature can come back without backend work.
  - **Files**: `package.json`, `src/common/config.ts`, `src/panel/HTMLGenerator.ts`, `src/panel/webview/timeControls.ts` (deleted), `src/panel/webview/main.ts`, `src/panel/webview/plotActions.ts`, `src/panel/webview/render/dataInfo.ts`, `src/panel/webview/state.ts`, `src/panel/webview/changedFields.ts` (`data-baseline` gone), `src/panel/webview/styles.css`, `src/types.ts` / `src/python/DataProcessor.ts` (datetime fields of `PlotOptions`), `scripts/qa/` (`webview/time.mjs` deleted), `scripts/architecture/`, `docs/documentation.json`, `docs/PLOTTING.md`, README
  - **Tests**: `test/suite/datetimeEdgeCases.test.ts` (deleted), `test/suite/config.test.ts`, `test/suite/dataProcessor.test.ts`, `test/suite/ui/webviewScript.test.ts` (no time controls even when the file has datetime variables); 310 passing

### Fixed

- **Exported HTML: slice sliders still moved, empty selection lost its outline, Reset still active**: the export freezes the controls (values copied into attributes, inputs read-only, checkboxes and selects disabled), but `readonly` does not apply to sliders, so their handles could still be dragged in the exported page and rewrite the frozen boxes; they are now disabled (same look, no grab cursor). The red outline of an empty selection (stop at or before start) came from the custom validity, which is not part of the HTML: it now also sets `aria-invalid="true"`, kept by the export (and read by screen readers). The **Reset** buttons of the plot controls are hidden in the exported page, which they could otherwise clear. Checked: cards and sections open / closed, slice boxes, slider positions and highlight, struck-through ignored step, `col_wrap` disabled by **auto** all survive the export.
  - **Files**: `src/panel/webview/export.ts`, `src/panel/webview/dimensionSlices.ts`, `src/panel/webview/main.ts` (degraded mode), `src/panel/webview/styles.css`
  - **Tests**: `test/suite/ui/webviewScript.test.ts` (export reopened in degraded mode: section states, slice values, handles and highlight, ignored step, col_wrap auto, read-only boxes, disabled sliders, no Reset; empty-selection outline kept)
- **vmin / vmax ignored on most user plots; robust crashed 1D plots**: as soon as a dimension slice, a facet or x / y / hue was set without a `cmap`, the plot went through xarray's generic `DataArray.plot()`, and the plot options stripped `vmin`, `vmax`, `cmap` and `add_colorbar` from that call (they are rejected by line and histogram artists), so the image did not change. They are now kept whenever xarray draws a 2D color mesh: two dimensions left once size-1 dimensions are squeezed and row / col / hue set aside, without hue (`draws_color_mesh`, same rule as xarray). Unchecking **add_colorbar** now works there too. `robust` joins these color options: it was passed to line plots, where it raised `Line2D.set() got an unexpected keyword argument 'robust'`; on lines and histograms the ignored options are now logged instead.
  - **Files**: `python/sdv_backend/plotting/kwargs.py` (`COLOR_MESH_KEYS`, `draws_color_mesh`, `generic_kwargs(color_mesh=...)`), `python/sdv_backend/plotting/draw.py`
  - **Tests**: `python/tests/test_plot_drawing.py` (vmin / vmax on a user-layout mesh and on facets, add_colorbar off, color options ignored on lines without error, `draws_color_mesh` cases incl. squeezed size-1 dimension and hue); frozen-clock PNG comparison through the CLI (slice, facets, `0:1` slice, 1D + robust, hue lines); golden plot snapshots unchanged
- **Content jumped left when the data loaded**: the loading page is shorter than the panel, so it has no scrollbar. Once the file information appears, the page almost always becomes taller than the panel and a vertical scrollbar appears. The scrollbar made the page narrower, so the centred column (new in the styling refresh) moved left by half the scrollbar's width. `scrollbar-gutter: stable` on `html` now always keeps that space free: it stays empty while the page is short, and no empty scrollbar track is drawn the way `overflow-y: scroll` would draw one.
  - **Files**: `src/panel/webview/styles.css`
  - **Tests**: manual (release notes step 21.12)

- **Colon of group attributes placed next to the value**: with the nested attributes view, the group **Attributes** section drew the `:` after the 180 px name column, so it sat next to the value, while variable attributes and every Xarray Encoding section put it right after the name. The tree now renders the colon inside the name, like the flat rows.
  - **Files**: `src/panel/webview/render/variables.ts`
  - **Tests**: `test/suite/ui/webviewScript.test.ts` (renders nested attributes as a tree)

- **xarray older than 2024.10 ended in an `AttributeError`**: with an old xarray in the selected interpreter (Python extension or override), the backend crashed while importing (`module 'xarray' has no attribute 'DataTree'`; v0.12 crashed the same way). It now prints a JSON error the extension shows: the xarray version found, the minimum (2024.10, 2026.4+ recommended) and the `pip install -U "xarray>=2026.4.0" "zarr>=3"` command. Checked against v0.12.1 with xarray 2024.6 (both crash before, message now) and xarray 2025.1 / zarr 2 (NetCDF, HDF5 and plots work in both; Zarr v3 stores now say `zarr>=3` is missing instead of a `FileNotFoundError`).
  - **Files**: `python/sdv_backend/_bootstrap.py`
  - **Tests**: `python/tests/test_cli_errors.py`

- **Extension uv environment rebuilt at every start**: an existing environment was never marked as initialized, so each VS Code session ran `uv venv --clear` and reinstalled every package — slow, and when offline the old environment was already deleted before the reinstall failed. Existing environments are now reused (and upgraded only when required, see above). Manual **Update Packages** now also reports a failure when uv is missing instead of silently succeeding.
  - **Files**: `src/python/ExtensionVirtualEnvironmentManager.ts`, `src/python/PythonManager.ts`
- **Unsupported plot type crashed the backend**: `create_plot` validated `plot_type` before detecting the file format, so the error handler hit `UnboundLocalError` and printed no JSON. It now returns a JSON error; CLI help no longer advertises `line` / `histogram`.
  - **Files**: `python/sdv_backend/plotting/api.py`, `python/sdv_backend/cli.py`
- **Empty plot selections**: a datetime range or dimension slice selecting no values failed in xarray (`ZeroDivisionError` on an empty facet grid). The error now names the empty dimensions and the time range / slices.
  - **Files**: `python/sdv_backend/plotting/selection.py`, `python/sdv_backend/plotting/api.py`
  - **Tests**: `python/tests/test_empty_selection.py`
- **Files left open on plot errors**: opened datasets are now closed on every path (`contextlib.closing(OpenedData)`).
  - **Files**: `python/sdv_backend/opening.py`, `python/sdv_backend/plotting/api.py`, `python/sdv_backend/info/extract.py`
- **Kerchunk plots failed with relative references**: chunk targets such as `"sample_data.nc"` were resolved against the Python process working directory instead of the reference file's folder, so reading data (plots) failed with `ReferenceNotReachable` while File Information still worked. JSON references are now loaded with relative targets resolved against their folder.
  - **Files**: `python/sdv_backend/formats/kerchunk.py`, `python/sdv_backend/opening.py`, `python/tools/golden_snapshots.py`
  - **Tests**: `python/tests/test_kerchunk_references.py`
- **Sample generation aborted at `sample_data.geotiff`**: GDAL cannot infer a driver from the `.geotiff` extension, and the abort skipped every later generator (all v0.13 fixtures). The file is written with `driver="GTiff"`.
  - **Files**: `python/sample_data/geotiff.py`

- **GRIB / GeoTIFF files crashed the Python backend (`free(): invalid pointer`, `double free or corruption`)**: the extension's uv environment installs the latest `eccodeslib` (the binary wheel of the ECMWF eccodes library, pulled in by `cfgrib`). Releases **2.48 and later** abort the Python process at exit when `pyproj` (pulled in by `rioxarray`) is imported after eccodes, which xarray does when it loads its backends: `import eccodes, pyproj` alone reproduces it (`import pyproj, eccodes` does not). The backend printed its JSON, then died with exit code 134, so the extension reported a failure for every file once both libraries were loaded — visibly on GRIB and TIFF files. Recreating the environment did not help, since it installs the same latest release. The environment now pins **`eccodeslib<2.48`** (2.47.3.23, verified with eccodes 2.50, cfgrib 0.9.15, pyproj 3.8, rioxarray 0.23) through a separate `ENVIRONMENT_CONSTRAINTS` list — applied to every uv install into the extension's own environment (including **Install packages**), not to the package checks, and never to Python-extension or override interpreters. `ENVIRONMENT_REVISION` is bumped to **2**, so environments that already got the bad release are rebuilt once at the next start. Users of their own interpreter can run `pip install "eccodeslib<2.48"`.
  - **Files**: `src/python/ExtensionVirtualEnvironmentManager.ts`
  - **Tests**: `test/suite/python/extensionEnvironmentUpdate.test.ts`
- **uv received no version pins (shell redirection)**: `uv pip install` was spawned with `shell: true` and unquoted requirements, so the shell read `xarray>=2026.4.0` as a redirection: uv got `pip install xarray zarr …` and files named `=2026.4.0`, `=3`, `=1.8` were created in the working directory.
  - **Files**: `src/common/runProcess.ts`, `src/python/ExtensionVirtualEnvironmentManager.ts`, `src/python/PythonManager.ts`
  - **Tests**: `test/suite/common/runProcess.test.ts`, `test/suite/python/extensionEnvironmentUpdate.test.ts`
- **"Open as Kerchunk / virtual Zarr" opened the file as plain JSON**: the `openAs=kerchunk` query was dropped when the panel rebuilt the URI from its path, so `--open-as-kerchunk` was never passed; the panel de-duplication also re-focused the plain view. The panel now keeps the URI, and a Kerchunk view is distinct from the plain one.
  - **Files**: `src/DataViewerPanel.ts`, `src/panel/UIController.ts`
  - **Tests**: `test/suite/ui/UIController.test.ts`, `test/suite/dataViewerPanel.test.ts`
- **Other extensions' crashes reported as ours**: `ErrorBoundary` hooked `process.on('uncaughtException')` in the shared extension host, so errors of other extensions popped up as "Scientific Data Viewer Error" and counted in the healthcheck. Removed. Panel error handlers are also unregistered when a panel closes (they kept closed panels in memory).
  - **Files**: `src/common/ErrorBoundary.ts`, `src/panel/UIController.ts`
  - **Tests**: `test/suite/error/ErrorBoundary.test.ts`, `test/suite/ui/UIController.test.ts`
- **"File too large" message** printed the limit in bytes with an `MB` suffix (e.g. "Maximum allowed: 524288000MB").
  - **Files**: `src/panel/UIController.ts`
- **Saving / exporting on Windows**: plot save, Save As and webview export split paths on `/`, so on Windows plots were written at the drive root and default names were wrong; Save As defaulted to `/sdv-plots/…` (filesystem root) on every OS. Paths now use `path` and default next to the data file.
  - **Files**: `src/panel/UIController.ts`, `src/panel/webview/plotActions.ts`
- **False "Request timeout" after saving a plot**: Save / Save As waited for the "Plot saved" notification to be dismissed, so after 60 s the webview reported a failure although the file was written, and **Save All Plots** stopped at the first one.
  - **Files**: `src/panel/UIController.ts`
- **Concurrent Python (re)initialisation**: refreshes overlapping during startup could run two initialisations, two `uv pip install` or `uv venv --clear` at once, and leave `ready` reflecting a half-validated state. Initialisation is single-flight (a request during a run queues one more run); environment create / upgrade / delete are serialised; the `onDidEnvironmentsChanged` listener (wrong event name, never fired) is removed.
  - **Files**: `src/python/PythonManager.ts`, `src/python/ExtensionVirtualEnvironmentManager.ts`, `src/python/officialPythonExtensionApiUtils.ts`
  - **Tests**: `test/suite/pythonManager.test.ts`
- **"Install packages" failed in the extension's uv environment** (no pip in uv venvs): it now uses `uv pip install --python <env>` there, and falls back to uv when another interpreter has no pip.
  - **Files**: `src/python/PythonManager.ts`
- **Misleading environment messages**: enabling `useExtensionOwnEnvironment` showed "uv is not installed" whenever the environment was not used, including when `overridePythonInterpreter` takes precedence or the install failed for another reason. The Manage UI wrote the setting at Workspace level (failing with no folder open and then reporting a successful creation as failed).
  - **Files**: `src/extension.ts`, `src/common/config.ts`, `src/python/ExtensionVirtualEnvironmentManagerUI.ts`
- **Stale interpreter state**: when no interpreter is found, the previous path and source were kept (status bar could say "ready"); a failed upgrade marked an unusable environment as initialised. Package checks have a 60 s timeout; a backend printing non-JSON output is now an error instead of a raw string.
  - **Files**: `src/python/PythonManager.ts`, `src/python/ExtensionVirtualEnvironmentManager.ts`
- **Outline**: links to group attributes did nothing in the default nested attributes view (id mismatch with the webview); the outline stayed visible after closing its panel; `reveal()` rejections were unhandled; the tree view was never disposed. The healthcheck report no longer opens twice.
  - **Files**: `src/outline/HeaderExtractor.ts`, `src/outline/OutlineProvider.ts`, `src/extension.ts`, `src/common/HealthcheckManager.ts`
  - **Tests**: `test/suite/outline/HeaderExtractor.test.ts`, `test/suite/outline/OutlineProvider.test.ts`
- **Webview bugs**: a file without groups crashed the display (undefined `contentContainer`); group time-range text inputs were ignored and the group datetime select did not prefill its range; after Refresh a stale datetime variable stayed applied; HTML strings appeared as literal text in empty sections; timed-out plot requests stayed in the pending map.
  - **Files**: `src/panel/webview/**`
  - **Tests**: `test/suite/ui/webviewScript.test.ts`
- **Backend printed no JSON for corrupt or missing files**: only `ImportError` was caught while opening; any other exception ended in a traceback with empty stdout, shown as a generic "file might be corrupted". Errors are now returned with type and suggestion, and `cli.main` has a last-resort JSON error.
  - **Files**: `python/sdv_backend/info/extract.py`, `python/sdv_backend/cli.py`
  - **Tests**: `python/tests/test_cli_errors.py`
- **A single `inf` attribute made a file unopenable** (`Out of range float values are not JSON compliant`); NaN inside tuples crashed too.
  - **Files**: `python/sdv_backend/serialization.py`
  - **Tests**: `python/tests/test_serialization.py`
- **Time filter broke plots of variables without that dimension**: with a global datetime variable selected, plotting e.g. a static `mask(lat)` or a 0-d variable failed with `KeyError`. The filter is applied only to variables sharing the time dimension (with a warning otherwise). A root datetime variable is also found when plotting group variables.
  - **Files**: `python/sdv_backend/plotting/selection.py`
  - **Tests**: `python/tests/test_datetime_filtering.py`
- **Time ranges**: one missing value made min/max `NaT`; cftime calendars (`noleap`, `360_day`…) are now detected and get ISO min/max, and plot filtering works in their calendar.
  - **Files**: `python/sdv_backend/info/extract.py`, `python/sdv_backend/info/variables.py`, `python/sdv_backend/plotting/selection.py`
  - **Tests**: `python/tests/test_datetime_edge_cases.py`, `python/tests/test_datetime_filtering.py`
- **Every 2D plot drawn with equal aspect**: `set_aspect("equal")` was applied even to `(time, station)` arrays, rendering them as slivers; it is now only used when both dimensions are spatial.
  - **Files**: `python/sdv_backend/plotting/draw.py`
  - **Tests**: `python/tests/test_plot_drawing.py`
- **scipy-opened NetCDF3 files** fell into a broken fallback (scipy has no `open_datatree`); unknown extensions reported "Missing dependencies for Unknown files" instead of "Unsupported file format".
  - **Files**: `python/sdv_backend/opening.py`, `python/sdv_backend/environment/engines.py`, `python/sdv_backend/info/extract.py`
  - **Tests**: `python/tests/test_opening.py`, `python/tests/test_cli_errors.py`
- **Contributor docs shipped in the `.vsix`**: the `*.md` rule of `.vscodeignore` only matched files at the root (vsce does not match nested paths with it), so the 48 files of `docs/` (release notes since 0.3, PR summaries, planning docs, `documentation.json`) and `.pytest_cache/README.md` were packaged. `docs/` is now excluded and Markdown files are excluded at any depth; `README.md` stays. Nothing reads `docs/` at runtime, and vsce rewrites the README's relative links to the GitHub repository.
  - **Files**: `.vscodeignore`
  - **Tests**: `npx vsce ls` lists 203 files instead of 252: the 49 removed are `docs/**` and `.pytest_cache/README.md`, nothing else changes
- **Development files shipped in the `.vsix`**: the package also carried the TypeScript sources of the extension host (it runs the compiled `out/`), tool caches (`.ruff_cache/`, `.pytest_cache/`), `.github/`, repository scripts and configs (`*.sh`, `tsconfig*.json`, `pyproject.toml`, pre-commit and secrets baselines), the sample data generators, notebooks and test scripts of `python/`, unused icon sources and the README screenshots (vsce rewrites their links to GitHub). `.vscodeignore` now lists what ships from `src/` (only `src/panel/webview/styles.css`, loaded at runtime) and `python/` (`get_data_info.py`, `check_package_availability.py`, the `sdv_backend` `.py` files); vsce applies `!` patterns whatever their order, which is why the old `!media/**` kept every media file and why the backend negation names `.py` files (no `__pycache__`). The `.vsix` goes from 203 files / 2.5 MB to 100 files / 1.1 MB; the QA pass then made `.vscodeignore` a full allow-list (see below), 70 files / 1.05 MB.
  - **Files**: `.vscodeignore`
  - **Tests**: `npx vsce ls` before / after: nothing added, only the files above removed; from the unpacked `.vsix`, all 71 relative `require`s of `out/src` resolve, the icons, `styles.css`, `webview.js` and Python scripts are present, and `get_data_info.py` info and plot (`sample_data.nc`, `/temperature`, `time=0`) and `check_package_availability.py` run

- **vmin / vmax of magnitude below 1e-6 or from 1e21 broke the plot** (QA 1): JavaScript writes them in exponent notation (`-1e-7`), and argparse took `--vmin -1e-7` for an option without its value: the backend exited with `argument --vmin: expected one argument` and no JSON. Same for any value starting with `-`: a dimension named `-x` as x / y / hue / row / col, a `matplotlibStyle` of `-x` (QA 6). The CLI now joins each value option with the token after it (`--vmin=-1e-7`) before parsing, so every caller (extension, copy-paste command, scripts) is covered. Already in v0.12.
  - **Files**: `python/sdv_backend/cli.py` (`parse_cli_args`)
  - **Tests**: `python/tests/test_cli_option_values.py`; `scripts/qa/backend/diff_scen.py` (`vmin_neg_sci`), `scripts/qa/e2e/suite/s3_plots.test.cjs`
- **`NaN` / `inf` shown as `np.float64(nan)` / `np.float64(inf)`** (QA 3): non-finite floats were written with `repr()`, and `np.float64` is a `float` subclass. Every xarray-written float variable showed `_FillValue : np.float64(nan)` in its Xarray Encoding (18 of the 55 sample files; v0.12 showed `nan`), and `valid_max = inf` read `np.float64(inf)`. They now read `nan`, `inf`, `-inf`.
  - **Files**: `python/sdv_backend/serialization.py` (`sanitize_non_finite`)
  - **Tests**: `python/tests/test_serialization.py`; `scripts/qa/webview/render.mjs` (`attr_zoo.nc`)
- **Closing a viewer while it loaded** (QA 2, 5, 7, 9): the load went on after the panel was closed and then rebuilt the Explorer outline for the closed file (15 quick open / close cycles left 16 cached outlines), or, for a broken file, showed an error notification for a tab that no longer existed. A load superseded by a later one (Refresh after a settings change) could also finish last and overwrite it. `UIController` now ignores a load that ends after its panel is closed or after a newer load started. Closing a viewer also aborts its running plots, which used to run until the plot timeout (up to 10 minutes).
  - **Files**: `src/panel/UIController.ts` (`loadFile`, `handleCreatePlot`, `dispose`)
  - **Tests**: `test/suite/ui/UIController.test.ts` (load ending after dispose, only the latest load counts, dispose aborts plots); `scripts/qa/e2e/suite/s8_multi.test.cjs`, `s3_plots.test.cjs`
- **Export Webview Content exported the wrong viewer in a split** (QA 8): it took the first visible viewer, not the focused one. Already in v0.12.
  - **Files**: `src/DataViewerPanel.ts` (`getActivePanel`)
  - **Tests**: `test/suite/dataViewerPanel.test.ts`; `scripts/qa/e2e/suite/s11_active.test.cjs`
- **Plot All plotted a variable a second time when its plot was already running** (QA 4): two processes for one variable; **Cancel** then stopped only the second one, and the first one later replaced "Plot cancelled." with its result or a timeout error. Plot All now leaves running variables alone.
  - **Files**: `src/panel/webview/plotActions.ts` (`handleCreateAllPlots`)
  - **Tests**: `test/suite/ui/webviewScript.test.ts`; `scripts/qa/webview/cancel.mjs`
- **Kerchunk error messages** (QA 12): an invalid JSON reference file said "no 'refs' mapping" (the precise reason was computed, then replaced); a reference file without Zarr metadata (empty `refs`) failed with `GroupNotFoundError … ReferenceFileSystem`; a reference to a missing data file failed to plot with an empty `ReferenceNotReachable()`. They now say "not valid JSON: …", "no Zarr metadata … nothing to open" and `ReferenceNotReachable: Reference "v/0" failed to fetch target …/gone.bin`. Exceptions whose `repr` carries no message are described by their text.
  - **Files**: `python/sdv_backend/formats/kerchunk.py`, `python/sdv_backend/info/extract.py`, `python/sdv_backend/plotting/api.py` (`describe_exception`)
  - **Tests**: `python/tests/test_kerchunk_references.py`
- **Header toolbar over the version badge below 380 px** (QA 13): the title now gives way (the badge is hidden below 380 px) and the four buttons keep their place.
  - **Files**: `src/panel/webview/styles.css`
  - **Tests**: `scripts/qa/webview/render.mjs` (320, 360, 420, 600, 1000 px)
- **`facetgridFigsize` below its 0.1-inch minimum** was passed to xarray (a tiny image); it is now ignored like other invalid values (QA 14).
  - **Files**: `src/common/config.ts` (`getFacetgridFigsize`)
  - **Tests**: `test/suite/config.test.ts`
- **Outline Expand All could leave an item collapsed** (QA O1): it started one `reveal()` per expandable item at once, and VS Code rejected many of them ("Cannot resolve tree item", 28 on `sample_zarr_arborescence.zarr`). Most rejected items were drawn expanded anyway (the outline returns saved items as expanded), but a nested group of `xss_groups.nc` stayed collapsed. Items are now revealed one at a time, parents first, a failed reveal is retried once after the others, and a refresh of the tree stops the sequence. Checked by recording what VS Code draws (`getTreeItem`): no item left collapsed on any QA file; the reveals still rejected (`sample_data_multiple_groups.nc`) are drawn expanded.
  - **Files**: `src/outline/OutlineProvider.ts` (`revealInOrder`, `revealExpanded`)
  - **Tests**: `test/suite/outline/OutlineProvider.test.ts` (one reveal at a time, parents first; rejected reveal retried once); `scripts/qa/e2e/suite/s7_outline.test.cjs` (fails only when an item is not drawn expanded)
- **Export with no captured page** (QA H2): when the webview could not capture its content, the save dialog opened and the export then failed. It now fails at once, with a message.
  - **Files**: `src/panel/UIController.ts` (`handleExportWebview`), `src/panel/webview/export.ts`
  - **Tests**: `test/suite/ui/UIController.test.ts`
- **"Python environment not ready" said why** (QA H3, H4): the message did not tell a missing interpreter from one without xarray. It now says which: `the interpreter /x/python could not be used: Python interpreter not found …`, `missing core packages in /x/python: xarray. Install them with: pip install …`, or `Python 3.10 or newer is required … (this interpreter is Python 3.8.10)`. A Python older than 3.10 used to crash the package check with `TypeError: 'type' object is not subscriptable` (also in v0.12): `check_package_availability.py` no longer evaluates annotations and both scripts check the version first.
  - **Files**: `src/python/PythonManager.ts` (`corePackagesIssue`, `notReadyReason`), `src/python/DataProcessor.ts`, `src/common/ErrorBoundary.ts`, `python/check_package_availability.py`, `python/get_data_info.py`, `scripts/architecture/graphs.py`, `docs/architecture/` (regenerated)
  - **Tests**: `python/tests/test_python_version_check.py`, `test/suite/dataProcessor.test.ts`, `test/suite/integration.test.ts`; `scripts/qa/e2e/suite/s9_interp.test.cjs`

### Security

- **HTML injection from file metadata**: variable, coordinate, dimension and group names, dims strings and error messages were inserted into the webview with `innerHTML` unescaped, and the webview could ask the extension to run **any** VS Code command with any arguments (`executeCommand`) — a crafted NetCDF/Zarr variable name could run commands when the file was opened. All file-derived values are now escaped (xarray's own HTML repr excepted), names are no longer used in CSS selectors, the page has a **Content-Security-Policy** (no inline scripts or `onclick` handlers), the host only runs the three commands the webview needs, and plot file names from the webview must be relative paths without `..`.
  - **Files**: `src/panel/webview/**`, `src/panel/HTMLGenerator.ts`, `src/panel/UIController.ts`
  - **Tests**: `test/suite/ui/webviewScript.test.ts`, `test/suite/ui/webviewExport.test.ts`, `test/suite/ui/UIController.test.ts`

- **Package install arguments from the webview** (QA H1): the allowlisted install command passed whatever the webview sent to `pip install` / `uv pip install`, options included (`--index-url http://…`). Only exploitable with script execution in the webview, which the CSP and escaping prevent; each package must now be a requirement specifier (`name`, `name[extra]`, version constraints), else nothing runs.
  - **Files**: `src/python/PythonManager.ts` (`isRequirementSpecifier`, `installPackages`)
  - **Tests**: `test/suite/pythonManager.test.ts`

### Upgrade / breaking notes

- **Requires zarr-python ≥ 3** when using **xarray ≥ 2026.4.0**. Users on **zarr 2.x** must upgrade (`pip install "zarr>=3"`) or pin an older xarray — the extension surfaces **`zarr>=3`** in missing-package messages.
- **Extension uv environment** (`useExtensionOwnEnvironment`) is **deleted and rebuilt automatically** once at the first start of v0.13 (new pins: xarray, zarr, h5netcdf, eccodeslib); this needs network access and takes a few minutes. Users of the Python extension's interpreter or `overridePythonInterpreter` must upgrade those packages themselves.
- **Kerchunk** is opt-in (`pip install kerchunk`); ordinary JSON editors are unaffected.
- **Python imports**: code importing from `get_data_info` must use the `sdv_backend` modules; `create_plot` / `get_file_info` take `PlotOptions` / `InfoOptions`. The CLI (`python/get_data_info.py info|plot ...`) and its JSON output are unchanged.
- **Webview protocol**: requests `getDataInfo`, `getCurrentFilePath`, `updateHeaders` and events `uiStateChanged`, `pythonEnvironmentChanged` are removed; `executeCommand` only accepts the extension's show-logs / show-settings / install-packages commands. Only matters for code that drove the webview directly.
- **JSON output**: numeric attributes are numbers / arrays instead of strings; the xarray encoding moves from `__xarray_encoding.*` keys of `attributes` to `encoding` (variables, coordinates) and `encoding_flattened` (groups); `datetime_variables` only lists real datetime variables; `h5py` no longer appears in `available_engines`.
- **Time Controls removed**: settings `globalTimeControls` / `groupTimeControls` are gone (a value left in `settings.json` is ignored); subset time with **Dimension Slices** (`0:24:2`).
- **Building from source** requires `npm run compile` (now also bundles the webview with esbuild); the webview source is `src/panel/webview/*.ts`.
- Apart from the removals above, existing plot flows keep the same webview messages; new CLI flags (`--netcdf-engine-order`, `--open-as-kerchunk`, `--facetgrid-figsize`, etc.) are additive.

### Not shipped (see `docs/v0.13/OUT_OF_SCOPE.md`)

- pyfive last-resort HDF5 reader (P1.4), OME-Zarr (P2.1), Sentinel SAFE re-implementation (P2.2), HDF4 `.hdf` (P2.4), NWB/FITS, STAC/OPeNDAP, Icechunk UX, Dask/expression arrays.

## [0.12.1] - 2026-09-14

### Fixed

- **Export Webview Content — unstyled output**: Exported HTML was rendered without any styling (default serif font on a white background) and ignored `webviewExportTheme`. Since v0.12.0 the webview loads its CSS/JS over `asWebviewUri` (`vscode-resource`) URLs, which resolve to nothing outside VS Code, and `ThemeManager` still looked for the now-absent `<style id="scientific-data-viewer-style">` anchor to inject theme variables. The export now inlines `styles.css` and `webview-script.js` before writing the file.
  - **Files**: `src/panel/HTMLGenerator.ts`, `src/panel/ThemeManager.ts`, `src/panel/UIController.ts`
  - **Tests**: `test/suite/ui/webviewExport.test.ts`
  - **Release notes**: `docs/RELEASE_NOTES_0.12.1.md`
- **Export Webview Content — dropped theme variables**: The exporter discarded the `<html>` inline style holding VS Code's `--vscode-*` custom properties and replaced it with a hardcoded set of 19 colors. Every other variable — including the sizes VS Code added with its size registry — was lost. The captured variables are now carried over and the selected export theme is merged on top of them.
  - **Files**: `src/panel/ThemeManager.ts`
- **Export Webview Content — theme kind rewriting**: The `vscode-dark` / `vscode-light` swap used quoted string replacement over the whole document. It missed `<body>` tags carrying extra classes (`vscode-reduce-motion`, `vscode-using-screen-reader`) and left `vscode-high-contrast` untouched. The theme kind class and `data-vscode-theme-*` attributes are now rewritten on the `<body>` tag only, so the xarray repr follows the exported theme.
  - **Files**: `src/panel/ThemeManager.ts`

## [0.12.0] - 2026-07-01

### Added

- **README generator**: `scripts/generate_readme.py` builds `README.md` from `package.json` (commands, settings, languages, version) and prose in `docs/documentation.json` (features, usage, troubleshooting). Settings tables use each setting’s `markdownDescription` (fallback `description`) from the manifest. Regenerate with `python scripts/generate_readme.py --no-timestamp` before commit/publish; banner records generation time unless `--no-timestamp` is passed.
  - **Files**: `scripts/generate_readme.py`, `docs/documentation.json`, `README.md`
- **NASA CDF as its own language**: `.cdf` files use language id `cdf` and custom editor `cdfEditor` instead of sharing the NetCDF language/editor, matching `cdflib` handling in `get_data_info.py`.
  - **Files**: `package.json`, `src/extension.ts`, `test/suite/extension.test.ts`
- **Extension virtual environment — package visibility and verbose uv logging**: Information view lists installed package versions (`name: version`) via `uv pip list --format=json`. Package updates pass `--upgrade` to `uv pip install`. uv commands run with `-v`; the output channel logs the full command, streamed stdout/stderr, versions before/after install or upgrade, and outdated required packages (`uv pip list --outdated`).
  - **Files**: `src/python/ExtensionVirtualEnvironmentManager.ts`, `src/python/ExtensionVirtualEnvironmentManagerUI.ts`
- **Sample data**: `sample-data/unordered_groups.nc` (unordered dimension groups for Issue #140 / `orderGroupsAlphabetically` testing).
  - **Files**: `python/create_sample_data.py`
- **Issue #131** (focused scope): Observability and lighter defaults without persistent worker, lazy reprs, or metadata cache.
  - **Performance logging**: `PerformanceTimer` logs stage timings (`⏱️`) across the load path — `setHtml`, Python init, `getDataInfo`, `python-exec`, `postMessage`. Check the **Scientific Data Viewer** output channel.
  - **Outline toggle**: `scientificDataViewer.outlineEnabled` (default **on**); Explorer pane hidden via `package.json` `when` clause when disabled (no empty pane / data-provider error). **Reload the window** after toggling.
  - **Issue #140 — Order groups alphabetically**: `scientificDataViewer.orderGroupsAlphabetically` (default **on**). When off, multi-group DataTree paths keep file order instead of alphabetical sort.
  - **Show xarray encoding attributes**: `scientificDataViewer.showXarrayEncodingAttributes` (default **on**). When off, omits `__xarray_encoding.*` entries from group, coordinate, and variable attribute tables.
  - **External webview assets**: Webview JS and CSS loaded via `asWebviewUri` from `src/panel/webview/` instead of inlined in every panel HTML document (~174 KB). Dev mode appends a cache-buster query param. Falls back to inline when `asWebviewUri` is unavailable (e.g. unit tests).
  - **Release notes**: `docs/RELEASE_NOTES_0.12.0.md`; linked from `README.md`.
  - **Files**: `src/common/PerformanceTimer.ts`, `src/python/PythonManager.ts`, `src/python/DataProcessor.ts`, `src/panel/UIController.ts`, `src/panel/HTMLGenerator.ts`, `src/DataViewerPanel.ts`, `src/common/config.ts`, `package.json`, `docs/RELEASE_NOTES_0.12.0.md`
  - **Tests**: `test/suite/common/PerformanceTimer.test.ts`, `test/suite/python/displayFeatureFlags.test.ts`, `config.test.ts`, `python/test_display_feature_flags.py`

### Changed

- **Outline group order**: Explorer outline group headers follow the same order as the webview Data Groups table (`dimensions_flattened`), including when `scientificDataViewer.orderGroupsAlphabetically` is toggled.
  - **Files**: `src/outline/HeaderExtractor.ts`, `test/suite/outline/HeaderExtractor.test.ts`
- **Settings documentation**: Removed `settingNotes` from `docs/documentation.json`; enriched `markdownDescription` in `package.json` for settings that lacked detail (e.g. `globalDimensionSlices`, `groupDimensionSlices`, plot controls).
- **`outlineEnabled` setting**: Description states that a **window reload** is required after toggling (sidebar pane and tree provider register at activation).
- **`getExtensionConfigForWebview()`**: Exposes `outlineEnabled` to the webview.
- **`HTMLGenerator`**: Serves external `<link>` / `<script src>` when the webview supports `asWebviewUri`; `localResourceRoots` includes `src/panel/webview`.

### Fixed

- **Outline refresh on panel activation**: After data reload or settings change, activating a viewer panel rebuilds the outline from fresh `dataInfo` instead of only switching cached headers.
  - **Files**: `src/DataViewerPanel.ts`
- **Healthcheck — open panes**: Zero open Scientific Data Viewer panes is reported as **healthy** (informational), not a warning.
  - **Files**: `src/common/HealthcheckManager.ts`

## [0.11.2] - 2026-06-18

### Added

- **Issue #136**: Degraded mode when CF time decoding fails. `open_datatree` / `open_dataset` first use `decode_cf=True`; on `unable to decode time units`, the extension retries with `decode_cf=False` so NetCDF files with invalid datetime `units` still open.
  - **Files**: `python/get_data_info.py`, `src/panel/webview/webview-script.js`, `src/types.ts`
  - **UI**: File Information shows `Mode: degraded (decode_cf=False)` when the fallback was used.
  - **Sample data**: `python/create_sample_data.py` adds `sample-data/broken_datetime_variable.nc` for manual testing.
- **Issue #137**: Escape HTML in flat attribute displays (`renderGroupAttributes`, `renderVariableAttributes`) via existing `escapeHtml()` so values such as compound-dtype `__xarray_encoding.dtype` strings (with `<i4`, `<f4`, etc.) are not truncated by the browser.
  - **Sample data**: `sample-data/compound_dtype_variable.nc` (NumPy structured-array pets example).
  - **Files**: `src/panel/webview/webview-script.js`, `python/create_sample_data.py`, `python/test_compound_dtype_sample.py`

## [0.11.1] - 2026-04-07

### Fixed

- **`add_legend` on generic `DataArray.plot`**: When the UI or CLI enabled `add_legend` and parameters such as **`col_wrap`** forced the user-provided **`slices_only`** path, kwargs were passed to xarray’s generic `.plot()`, which can route to **`pcolormesh`** (`QuadMesh`). Matplotlib rejects **`add_legend`** there ([issue #134](https://github.com/etienneschalk/scientific-data-viewer/issues/134)). The dispatcher now strips **`add_legend`** unless **`hue`** is set, matching the existing **`plot.imshow`** guard.
  - **Files**: `python/get_data_info.py`
- **Non-regression**: Case **25** in `python/non_regression_test_plot.py` covers **`col_wrap` + `add_legend`** on a **3D** subset without **`cmap`**.

## [0.11.0] - 2026-03-24

### Breaking

- **Python 3.10+ required** to run and parse checked-in **`python/*.py`** scripts after Ruff **pyupgrade** fixes (**UP006** PEP 585: `list[...]` / `dict[...]` instead of `typing.List` / `Dict`; **UP007** PEP 604: `X | Y` instead of `Union` / `Optional`). Older interpreters cannot parse PEP 604 union syntax in source. **`pyproject.toml`** `target-version` is now **`py310`**. See [Ruff UP006](https://docs.astral.sh/ruff/rules/non-pep585-annotation/) and [UP007](https://docs.astral.sh/ruff/rules/non-pep604-annotation-union/) and **v0.11.0 release notes**.

### Added

- **Plot kwargs** (Python `create_plot`, CLI, extension passthrough): **`vmin`**, **`vmax`**, **`add_colorbar`** (default true; CLI `--no-add-colorbar`), **`add_legend`** (default false; CLI `--add-legend`). Colorbar/legend/vlim apply only on compatible xarray paths; histograms use a restricted kwarg set; `add_legend` is not passed to `plot.imshow` without `hue`.
  - **Files**: `python/get_data_info.py`, `src/python/DataProcessor.ts`, `src/panel/UIController.ts`
- **Webview plot controls** for those kwargs: **vmin** / **vmax** inputs on the **cmap** row; **add_colorbar** and **add_legend** checkboxes on the same row as **xincrease** / **yincrease** / **robust** (defaults: colorbar on, **add_legend on** in the UI to mirror typical xarray `plot` defaults on supported plot kinds; Python CLI still omits `--add-legend` unless passed). Global and **group** plot sections stay in sync; inheritance matches other plot parameters (group overrides when the group section is in use). **col_wrap** and **bins** control widths were halved for a tighter layout. **Files**: `src/panel/HTMLGenerator.ts`, `src/panel/webview/webview-script.js`, `src/panel/webview/styles.css`, `src/panel/communication/MessageTypes.ts`
- **`python/non_regression_test_plot.py`**: Visual regression cases for Issue #117 (00–06), extras (10–18), and vlim/legend (20–24); writes `summary.txt` + `summary.md` under `sample-data/non_regression_test_plot/v<version>/` (version from `package.json`).
- **`setup.sh`**: Runs the non-regression plot script after `create_sample_data.py` (non-fatal on failure).
- **Plot API analysis tooling/docs**: Added `python/generate_xarray_plot_design_doc.py` (AST parser for xarray `dataarray_plot.py`) plus `docs/XARRAY_PLOT_GUI_DESIGN.md` (data-only) and `docs/XARRAY_PLOT_GUI_DESIGN_llm_interpretation.md` (design suggestions). This is the baseline for maintainable Plot UI improvements aligned with xarray API evolution.

### Changed

- **Plotting architecture** (`python/get_data_info.py`): `PlotKwargsBundle`, `XarrayPlotDispatcher`, strategy registries for user-provided and auto plot branches; histograms use **`hist_kwargs()`** so non-hist keys are not passed to `plot.hist`.
- **Python typing (Ruff `--unsafe-fixes`)**: Modernized annotations across `python/` (PEP 585/604). **`create_sample_data.py`**: optional **zarr** / **rioxarray** checks use `importlib.util.find_spec` / `importlib.import_module` instead of unused imports; removed dead assignments surfaced by Ruff; hyphen-minus in docstrings/comments (RUF002/RUF003). **Notebooks** under `python/`: minor lint-driven edits (e.g. `print` instead of bare display expressions).

### Fixed

- **robust** (and other imshow-only kwargs) are merged into **every** `DataArray.plot.imshow(...)` path; previously some imshow calls omitted them so the rendered image did not match logs.

## [0.10.1] - 2026-03-18

### Added

- **Issue #126**: Configurable timeout for matplotlib plot generation.
  - **Problem**: The plot timeout was hardcoded; users could not wait longer for expensive plots (e.g. large datasets) without manually slicing first.
  - **Solution**: New setting `scientificDataViewer.plotTimeoutMs` (milliseconds, default 20000, min 1000, max 600000). The same value is used for the webview client timeout (when the UI shows "timed out" and sends abort) and the server-side timeout (when the backend kills the Python process), so behaviour is consistent. Increase the value (e.g. 120000 for 2 minutes) when you want a quicklook on huge data without slicing.
  - **Files modified**: src/common/config.ts (`PLOT_TIMEOUT_MS`, `getPlotTimeoutMs()`, `getExtensionConfigForWebview()` includes `plotTimeoutMs`), package.json (new setting), src/panel/UIController.ts (pass `getPlotTimeoutMs()` to DataProcessor.createPlot), src/panel/webview/webview-script.js (globalState.plotTimeoutMs from config, passed to createPlot; effective timeout clamped and used for abort).

### Fixed

- **Issue #101**: Webview export could put the pane into an error state ("Request timeout: exportWebview") when the user did not click any button on the "Webview content exported successfully" popup. The handler was awaiting the file-action dialog, so the response to the webview was delayed until the user chose Open/Reveal or the popup was dismissed; if the user ignored the popup, the webview request eventually timed out. The handler now returns success to the webview immediately after writing the file and shows the notification without awaiting it, so ignoring the popup no longer causes a timeout error. **Files modified**: src/panel/UIController.ts (handleExportWebview: call showFileActionDialog without await, .catch for logging).

- **Issue #128**: Colormap (cmap) from Group Plot Controls and Global Plot Controls was ignored; plots always used the default (e.g. viridis).
  - **Cause**: In the user-provided plot branch (when dimension slices, facet row/col, or other plot params are set), the backend used `_kwargs_for_plot()` which strips `cmap` and only called generic `var.plot()`, never `var.plot.imshow()`, so the selected cmap was never applied.
  - **Solution**: In the user-provided branch, when the variable is 2D+ and a cmap is set, the backend now calls `var.plot.imshow()` with the chosen cmap (and aspect/size/col_wrap as needed) so the colormap from group or global controls is applied. Auto-plot branch was already correct.
  - **Files modified**: python/get_data_info.py (user-provided branch uses plot.imshow with \_imshow_kw/\_plot_imshow_kw when 2D+ and cmap set; col_wrap passed through; logging improved), src/python/DataProcessor.ts (log colormap sent when creating plot).

### Changed

- **Logging**: Plot and extension logs now reflect actual cmap usage: Python logs when cmap is applied via `plot.imshow()`, which colormap is used in the auto branch, and DataProcessor logs the colormap sent to the backend when creating a plot.

## [0.10.0] - 2026-03-17

### Added

- **Issue #120**: Collapsible nested attributes view for Zarr and other formats
  - **Problem**: Zarr (and similar formats) store attributes in JSON (e.g. `.zattrs`). The SDV view showed only one level of attributes; nested structures were hard to read.
  - **Solution**: New optional **Nested Attributes View** (feature flag `scientificDataViewer.nestedAttributesView`, default `false`). When enabled, group attributes are rendered as an expandable/collapsible tree so users can browse the full nested structure. Supports nested objects and arrays.
  - **Files modified**:
    - src/common/config.ts — `NESTED_ATTRIBUTES_VIEW`, `getNestedAttributesView()`, `getExtensionConfigForWebview()` so the webview receives a plain config object with all feature flags
    - package.json — new setting `scientificDataViewer.nestedAttributesView`, version 0.10.0
    - src/panel/UIController.ts — use `getExtensionConfigForWebview()` in `handleGetExtensionConfig()`
    - src/panel/webview/webview-script.js — `renderAttributesTree()`, and in `renderGroup()` use tree when `nestedAttributesView` is true
    - src/panel/webview/styles.css — `.attributes-tree-node`, `.attribute-tree-summary`, `.attributes-tree-children` for tree styling
  - **Test data**: python/create_sample_data.py — `create_sample_zarr_deeply_nested_attributes()` creates `sample_zarr_deeply_nested_attrs.zarr` with 5–10 levels of nested `.zattrs` for regression and manual testing.
  - **Upstream**: Release notes document the need for improved representation of nested attributes in xarray; users may open or support a feature request on the xarray project.

### Changed

- Extension config sent to the webview is now a plain object built via `getExtensionConfigForWebview()` (including `nestedAttributesView`) instead of the raw WorkspaceConfiguration, so the webview reliably receives all feature flags.

## [0.9.0] - 2026-03-09

### Changed

- **Time Controls disabled by default:** The former **Global Time Controls** and **Group Time Controls** (datetime variable select, start/end time) are now **off by default**. Use the new **Dimension Slices** feature instead to subset by index or slice (including time dimensions) via `isel()`; it is data-agnostic and easier to maintain. You can re-enable Time Controls in settings (`scientificDataViewer.globalTimeControls`, `scientificDataViewer.groupTimeControls`) if you prefer the datetime start/end UI.

### Added

- **Issue #102**: Scalar and small array values are now computed and displayed for variables and coordinates
  - **Problem**: Small variables (e.g. single-value time coordinates after interpolation) showed only shape/dtype/size, not the actual value
  - **Solution**: When a variable or coordinate is at or below 1000 bytes (`SMALL_VARIABLE_BYTES`), its values are loaded and shown in the UI (truncated to 500 chars)
  - **Files Modified**:
    - python/get_data_info.py - `VariableInfo`/`CoordinateInfo` optional `display_value`, `_format_small_value()`, `create_variable_info`/`create_coord_info` set `display_value` when under threshold
    - src/types.ts - optional `display_value` on variable/coordinate items
    - src/panel/webview/webview-script.js - render `display_value` in variable/coordinate details; src/panel/webview/styles.css - `.variable-display-value` styling

- **Issue #117**: Select and slice dimensions in the UI before plotting (xarray-style isel and faceting)
  - **Problem**: Users could not subset data by dimension index/slice or create faceted plots from the UI
  - **Solution**: New "Dimension Slices" section in plot controls: one text input per dimension (Python slice syntax, e.g. `0:24:2`, `100:120`, or `130`), plus Facet row/Facet col, **col_wrap** (positive integer), **x, y, hue** dropdowns, **x increase / y increase** checkboxes, **Aspect / Size** inputs, **Robust** checkbox, and **cmap** text input. Slices are applied as `var.isel(...)` before time filtering and plotting; row/col override default faceting dimensions for 3D/4D plots; col_wrap, x/y/hue and other options map to [xarray plot kwargs](https://docs.xarray.dev/en/latest/user-guide/plotting.html). The section includes a link to the xarray plotting guide.
  - **Files Modified**:
    - src/panel/communication/MessageTypes.ts - `CreatePlotRequest`: `dimensionSlices`, `facetRow`, `facetCol`, `colWrap`, `plotX`, `plotY`, `plotHue`, `xincrease`, `yincrease`, `aspect`, `size`, `robust`, `cmap`
    - python/get_data_info.py - `_parse_dimension_slice_spec`, `_parse_dimension_slices`, `create_plot()` args and isel application, CLI `--dimension-slices` (JSON), `--facet-row`, `--facet-col`, `--col-wrap`, `--plot-x`, `--plot-y`, `--plot-hue`, `--xincrease`, `--yincrease`, `--aspect`, `--size`, `--robust`, `--cmap`
    - src/python/DataProcessor.ts, src/panel/UIController.ts - pass through new params
    - src/panel/HTMLGenerator.ts - Dimension Slices section (incl. link to xarray plotting); src/panel/webview/webview-script.js - `populateDimensionSlices`, `getDimensionSlicesState`, createPlot payload; src/panel/webview/styles.css - dimension-slices-section styling
  - **Experimental**: The improved plotting experience (Dimension Slices, faceting, and related options) is still experimental. Feedback on bugs or inconsistent behaviour is welcome.
  - **Why global and per-group, not per-variable:** Plot parameters (dimension slices, facet row/col, x/y/hue, etc.) are scoped at **global** and **per-group** level to avoid overloading the UI. We assume that within a group you often want to use the same dimension selection for several variables; per-variable plot parameters may be added in a later release only if the need is clearly felt.
  - **Global vs. group inheritance:** Per-field inheritance: for each plot parameter, group value when set (non-empty), else global, so the two can be mixed. Empty/"None" in group selectors falls back to global. Only **dimension slices** are atomic (whole group set or whole global).

  - **Future**: Additional plotting options (e.g. line-plot specifics, step plots, colormap) may be added in later releases based on the [xarray plotting guide](https://docs.xarray.dev/en/latest/user-guide/plotting.html); not included in this release to avoid overloading the UI.

- **Issue #121**: Log full executable command for copy-paste
  - _Note: Finally implemented in 0.8.2_
  - **Problem**: When debugging (e.g. package check on Windows), users had to manually reconstruct the full command from separate log lines
  - **Solution**: Extension now logs a single copy-pasteable command line when executing a Python script (e.g. package check or get_data_info)
  - **Files Modified**:
    - src/python/PythonManager.ts - In `executePythonFileUnchecked()`, log `🐍 📜 Full command (copy-paste): <pythonPath> <scriptPath> <args...>` on one line

### Fixed

- **Issue #125**: File path bug when path contains spaces
  - **Problem**: Opening a supported file (e.g. NetCDF) from a path with spaces caused the extension to pass literal double quotes to get_data_info.py. Python then saw the file extension as `.nc"` instead of `.nc`, leading to "Missing dependencies for Unknown files".
  - **Solution**: Stopped wrapping file paths and other arguments in quotes when calling the Python script. The extension uses `child_process.spawn` with `shell: false`, so arguments are passed as an array and the OS handles spaces; adding quotes made the quote characters part of the path string.
  - **Files Modified**: src/python/DataProcessor.ts - removed quoteIfNeeded() for filePath, scriptPath, and all plot/option arguments passed to get_data_info.py

## [0.8.2] - 2026-03-05

### Added

- **Debug**: Full executed command line is now logged when running Python scripts (e.g. package check), so it can be copy-pasted to reproduce issues locally
  - **Files Modified**: src/python/PythonManager.ts

### Fixed

- **Issue #118** (root cause): Package availability check and Python script stdout/stderr broken on Windows since v0.8.0
  - **Where it was introduced**: In v0.8.0, [PR #110](https://github.com/etienneschalk/scientific-data-viewer/pull/110) (Issue #97 – kill Python on plot timeout) added `detached: true` to the spawn options so the process group could be killed with `process.kill(-pid)`. On Windows, Node.js does not connect a detached child’s stdout/stderr to the parent’s pipes, so the extension received empty output for any script (package check, getDataInfo, and plots). See e.g. [Node.js spawn detached breaks pipe capture on Windows](https://github.com/openclaw/openclaw/issues/18739).
  - **Why get_data_info seemed to work**: getDataInfo only runs when the extension is “ready,” which requires the package check to have succeeded first. On Windows the package check failed (empty stdout), so the env never became ready and getDataInfo was never called in the failing scenario.
  - **Solution**: Spawn Python with `shell: false` so the child process is the Python executable directly (no shell in between). Then (1) stdout/stderr are always captured on all platforms; (2) we never use `detached`, so the Windows pipe issue is avoided; (3) on timeout/abort we kill the single child with `childProcess.kill('SIGTERM')`, which still satisfies Issue #97 (no orphan Python process). No regression for the plot-timeout kill behavior.
  - **Additional hardening**: Windows fallback interpreter order now tries `python` before `python3` to avoid the Windows Store stub; package-check script uses line-buffered stdout and top-level try/except with `_error` JSON on exception; extension sets `PYTHONUNBUFFERED=1` and logs stderr when stdout is empty.
  - **Files Modified**:
    - src/python/PythonManager.ts – spawn with `shell: false`, no `detached`; abort via `childProcess.kill()`; Windows commonPaths order; stderr log when stdout empty
    - python/check_package_availability.py – line buffering, try/except and `_error` payload

- **CI**: Extension debug/info logs from the test child process are now visible in the test (and CI) log. The test runner passes `SCIENTIFIC_DATA_VIEWER_VERBOSE_LOGS=1` into the spawned VS Code process; the Logger writes all levels to stderr when that is set (and skips the console fallback so INFO and above are not duplicated), so the test runner forwards them once and they appear in the job output.
  - **Files Modified**:
    - test/runTest.ts – `extensionTestsEnv: { SCIENTIFIC_DATA_VIEWER_VERBOSE_LOGS: '1' }`, plus `--no-sandbox` and `--disable-gpu` in launchArgs
    - src/common/Logger.ts – when env var set, write only to `process.stderr` (skip console) so child logs are visible in CI without duplication

### Files changed since main (0.8.2 release)

| File                                   | Modification                                                                                                                                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/pr-validation.yml`  | CI matrix: added `windows-latest`; job name includes `matrix.os` and Node version; `fail-fast: false`; separate steps for Linux vs Windows (virtual display setup, run tests).                                              |
| `CHANGELOG.md`                         | New 0.8.2 section: Added (debug command line, CI verbose logs), Fixed (Issue #118), and this file list.                                                                                                                     |
| `README.md`                            | Version set to 0.8.2; added known-issue callout for Windows uv; renumbered “Common issues” (1→2, 2→3, …).                                                                                                                   |
| `docs/RELEASE_NOTES_0.8.2.md`          | New file: release notes for 0.8.2 (Windows fix, CI debug logs).                                                                                                                                                             |
| `package.json`                         | Version 0.8.1 → 0.8.2.                                                                                                                                                                                                      |
| `package-lock.json`                    | Version 0.8.1 → 0.8.2.                                                                                                                                                                                                      |
| `python/check_package_availability.py` | `_log()` helper; line-buffered stdout/stderr; try/except with JSON `_error` on exception; DEBUG/INFO logging; type hints.                                                                                                   |
| `src/common/Logger.ts`                 | When `SCIENTIFIC_DATA_VIEWER_VERBOSE_LOGS=1`, write only to `process.stderr` (skip console) so test/CI shows extension logs once, no duplication.                                                                           |
| `src/python/PythonManager.ts`          | Spawn Python with `shell: false`, no `detached`; log full command line; abort via `childProcess.kill()`; Windows `commonPaths` try `python` before `python3`; log stderr when stdout empty; PID check and cleanup in abort. |
| `test/runTest.ts`                      | `launchArgs`: add `--no-sandbox`, `--disable-gpu`; `extensionTestsEnv`: set `SCIENTIFIC_DATA_VIEWER_VERBOSE_LOGS=1` so child emits logs to stderr.                                                                          |

## [0.8.1] - 2026-02-25

### Added

- **Issue #116**: Support for `.grb2` file extension (GRIB2 format)
  - **Problem**: Users with `.grb2` files could not load them in the viewer; only `.grib`, `.grib2`, and `.grb` were recognized
  - **Solution**: Added `.grb2` to all GRIB-related contributions (context menus, language, custom editor selector), webview supported extensions, and Python backend format/engine mapping
  - **Files Modified**:
    - package.json - Menus, languages.grib.extensions, customEditors.gribEditor.selector
    - src/panel/webview/webview-script.js - SUPPORTED_EXTENSIONS_HARDOCDED
    - python/get_data_info.py - SUPPORTED_EXTENSIONS, SupportedExtensionType, FORMAT_ENGINE_MAP, FORMAT_DISPLAY_NAMES

### Fixed

- **Issue #115**: Extension failed to initialize when "use own environment" (uv) was enabled and a previous install had left an existing uv env in globalStorage (e.g. after uninstall then reinstall)
  - **Problem**: `uv venv` failed with "A virtual environment already exists at ... Use `--clear` to replace it", blocking creation of the extension's virtual environment
  - **Solution**: Pass `--clear` when creating the virtual environment with `uv venv` so an existing env at the same path is replaced instead of causing failure
  - **Files Modified**:
    - src/python/ExtensionVirtualEnvironmentManager.ts - Added `--clear` to `uv venv` arguments in `uvCreateVirtualEnvironment()`

### Attempted to fix

- **Issue #118**: Package availability check could fail on Windows when using the extension's own (uv) environment, with "Invalid response format" and "Missing core packages"
  - **Problem**: When Node spawns the Python package-check script and reads its stdout via a pipe, Windows uses full buffering for the pipe. The script's small JSON output could stay in the buffer and not be flushed before the process exited, so the parent received empty or incomplete stdout and JSON parsing failed.
  - **Solution**: (1) In the package-check script, use `print(..., flush=True)` so stdout is flushed to the pipe immediately on Windows. (2) Added debug logging of the raw package-check result to simplify diagnosis if issues persist.
  - **Files Modified**:
    - python/check_package_availability.py - `print(json.dumps(availability), flush=True)`
    - src/python/PythonManager.ts - debug/error logging for package check result

## [0.8.0] - 2025-12-11

### Added

- **Publishing Script**: New `publish.sh` script for manual extension publishing to both VS Code Marketplace and Open VSX Registry
  - **Version Consistency Checks**: Validates CHANGELOG entry, release notes file, git branch, and git tag
  - **Automatic CHANGELOG Date Update**: Replaces `UNRELEASED` with current date and offers to commit the change
  - **Git Tag Management**: Offers to create and push version tag with user confirmation
  - **Environment Validation**: Checks Node.js 22+ and Python 3.13+ versions before publishing
  - **Dual Marketplace Publishing**: Publishes to both VS Code Marketplace (via `vsce`) and Open VSX (via `ovsx`)
  - **Dry-run Mode**: Test the publishing process without actually publishing (`--dry-run`)
  - **Files Added**:
    - publish.sh - Manual publishing script with comprehensive checks
    - docs/DRAFT_AUTOMATED_PUBLISHING.md - Documentation for future GitHub Actions automated publishing

### Fixed

- **Issue #99**: Fixed "Format: Unknown" always shown in the File Information section
  - **Root Cause**: The webview was looking for `data.format` which was never set by the Python backend; the format name is stored in `format_info.display_name`
  - **Solution**: Updated `renderFileInformation()` to use `format_info.display_name` as fallback when `format` is not set
  - **Files Modified**:
    - src/panel/webview/webview-script.js - Use format_info.display_name for format display

- **Issue #103**: Fixed hardcoded viridis colormap preventing xarray from using appropriate colormaps
  - **Problem**: All plots used hardcoded `cmap="viridis"`, which is inappropriate for diverging data (e.g., data centered around zero)
  - **Solution**: Removed hardcoded colormap parameter to let xarray automatically determine the appropriate colormap based on data characteristics
  - **Files Modified**:
    - python/get_data_info.py - Removed `cmap="viridis"` from all plot.imshow() calls

- **Issue #108**: Fixed attributes being truncated in text representations
  - **Root Cause**: xarray display options had `display_expand_attrs=False` and `display_expand_data=False` applied to text representations, causing attributes and data to show only counts (e.g., `Attributes: (3)`) instead of actual values
  - **Solution**: Updated `XR_TEXT_OPTIONS` to use `display_expand_attrs=True` and `display_expand_data=True` for text representations, ensuring full attribute and data display
  - **HTML Unaffected**: HTML representations retain collapsed attributes since users can interactively expand them
  - **Files Modified**:
    - python/get_data_info.py - Fixed xarray display options for text representations

- **Issue #97**: Fixed resource-intensive plotting processes that timeout but are not killed
  - **Problem**: When plotting large datasets, the request would timeout in the webview but the Python process continued running indefinitely, consuming system resources
  - **Solution**: Implemented two-layer timeout architecture with proper process termination
  - **Features Added**:
    - **Process Tracking**: PythonManager now tracks active processes with unique operation IDs
    - **Process Group Killing**: Uses `detached: true` and negative PID to kill entire process groups, ensuring both shell and Python child processes are terminated
    - **Client-side Timeout (15s)**: Webview timeout provides quick user feedback and sends abort request
    - **Server-side Timeout (20s)**: Safety net that kills processes even if the user closes the tab before client timeout fires
    - **Cancel All Button**: New button appears during Plot All operations, showing count of active operations
    - **Concurrency Limiting**: Plot All now processes max 5 plots simultaneously, leaving resources for cancel operations
    - **Cancellation Flag**: Queued plots are skipped when Cancel All is clicked
  - **Files Modified**:
    - src/python/PythonManager.ts - Process tracking, server-side timeout, abortProcess(), abortAllProcesses()
    - src/python/DataProcessor.ts - Added timeout parameter to createPlot()
    - src/panel/UIController.ts - Added abortPlot message handler
    - src/panel/webview/webview-script.js - Client-side timeout, Cancel All button, concurrency limiting
    - src/panel/HTMLGenerator.ts - Cancel All button HTML
    - src/panel/webview/styles.css - Cancel button styling
    - python/create_sample_data.py - Added large 4D NetCDF test file generator

## [0.7.0] - 2025-12-04

### Added

- **Timestamp Variable Selection and Time Range Filtering**: Comprehensive support for datetime variable selection and time-based filtering (Issue #106)
  - **Automatic Datetime Detection**: Multi-method detection including datetime64 dtype, CF-convention time coordinates, standard_name attributes, and common variable names
  - **Time Range Filtering**: Filter data by specifying start and end datetime values
  - **Monotonicity Handling**: Intelligently handles monotonic increasing, decreasing, and non-monotonic datetime sequences
  - **Cross-Group Support**: Works with datetime variables in different groups than the plotted variable
  - **Min/Max Pre-filling**: Automatically pre-fills time range inputs with min/max values from detected datetime variables
  - **Dual Input Methods**: Native HTML5 datetime-local picker and text input for pasting dates
  - **Bidirectional Binding**: Text and datetime-local inputs stay synchronized
  - **Smart Visibility**: Time controls automatically hide when no datetime variables are found
  - **Files Modified**:
    - python/get_data_info.py - Added datetime detection, monotonicity checking, and time filtering logic
    - src/types.ts - Updated DataInfoResult and CreatePlotRequest interfaces
    - src/python/DataProcessor.ts - Added datetime parameters to createPlot method
    - src/panel/UIController.ts - Added datetime parameter handling
    - src/panel/communication/MessageBus.ts - Updated createPlot signature
    - src/panel/HTMLGenerator.ts - Added time controls UI section
    - src/panel/webview/webview-script.js - Added time controls state management and event handlers
    - src/panel/webview/styles.css - Added time controls styling
    - python/create_sample_data.py - Added sample CDF file with unordered time variable
- **Comprehensive Test Suite**: 27 Python unit tests covering all 16 identified edge cases
  - python/test_datetime_edge_cases.py - Complete test coverage for datetime functionality
  - test/suite/datetimeEdgeCases.test.ts - TypeScript integration tests
  - setup.sh - Integrated Python datetime tests into setup process

### Enhanced

- **Plot Titles**: Conditional suptitle includes start/end time information only when datetime filtering is actually used
- **X-Axis Display**: Full date and time information displayed on x-axis instead of just hours
- **Error Handling**: Comprehensive error handling for all edge cases (invalid datetimes, missing variables, shape mismatches, etc.)
- **Variable Name Handling**: Correctly handles variable names containing dots (e.g., "temperature.hourly")

### Fixed

- **Issue #106**: Implemented timestamp variable selection and time range filtering
- **Timezone Issues**: Fixed timezone conversion problems in datetime input handling
- **Variable Name Parsing**: Fixed issue with variable names containing dots being truncated (changed from `.stem` to `.name`)
- **Cross-Group Variables**: Fixed handling of datetime variables from different groups
- **Monotonicity**: Fixed filtering for monotonic decreasing and non-monotonic datetime sequences
- **Python 3.8 Compatibility**: Changed `str | None` to `Optional[str]` for Python 3.8 support

### Technical Improvements

- **Monotonicity Detection**: Uses pandas Index methods (`is_monotonic_increasing`, `is_monotonic_decreasing`) for efficient checking
- **Filtering Strategy**:
  - Monotonic increasing: Uses `xarray.sel()` with slice notation
  - Monotonic decreasing: Automatically swaps start/end times
  - Non-monotonic: Falls back to boolean indexing
- **Timezone Preservation**: All datetime conversions preserve local time without unexpected timezone shifts
- **Comprehensive Edge Case Handling**: 16 edge cases identified and handled robustly

## [0.6.0] - 2025-12-02

### Added

- **NASA CDF Format Support**: Full support for NASA's Common Data Format (.cdf files)
  - **cdflib Integration**: Uses `cdflib` library for reading and writing CDF files
  - **Format Distinction**: Clear separation between CDF (NASA) and NetCDF formats in all documentation and error messages
  - **Dedicated Engine**: Added `cdflib` as a dedicated engine for `.cdf` file extension
  - **Special Handling**: CDF files are processed using `cdflib.xarray.cdf_to_xarray()` for seamless xarray integration
  - **Sample Data Generation**: Updated sample data creation to use `cdflib` for authentic CDF files
  - **Troubleshooting Support**: Added CDF-specific installation instructions in error messages
  - **Files Modified**:
    - python/get_data_info.py - Added cdflib engine and special handling for CDF files
    - python/create_sample_data.py - Updated to generate CDF files using cdflib
    - src/panel/webview/webview-script.js - Added cdflib installation option in troubleshooting section
    - README.md - Updated format table to distinguish CDF from NetCDF
    - docs/RELEASE_NOTES_0.6.0.md - Comprehensive documentation of CDF support
- **Pre-commit Configuration**: Comprehensive code quality and formatting automation
- **GitHub Actions Workflow**: Streamlined CI/CD pipeline with `pr-validation.yml`
  - **Comprehensive Validation**: Single workflow covering all quality checks
  - **Node.js 22 Support**: Updated to current LTS version
  - **Python 3.13 Support**: Latest Python version for testing
  - **Virtual Display Testing**: Xvfb integration for headless testing
  - **Security Auditing**: npm audit integration for dependency security
  - **Concurrency Control**: Prevents multiple runs of same PR validation
- **TypeScript Configuration**: Enhanced build configuration
  - **Pre-commit TypeScript Config**: Separate `tsconfig.pre-commit.json` for faster type checking
  - **Improved Formatting**: Better code organization and formatting standards

### Enhanced

- **Format Support**: Added NASA CDF format to supported formats list
- **Error Handling**: Improved error messages and troubleshooting guidance for CDF files
- **Documentation**: Updated all documentation to clearly distinguish CDF from NetCDF
- **Developer Experience**: Streamlined development workflow with automated quality checks
- **Code Quality**: Consistent formatting and linting across TypeScript and Python codebases
- **CI/CD Pipeline**: Faster, more reliable continuous integration with comprehensive validation
- **Security**: Automated secret detection and dependency security auditing

### Fixed

- **Issue #104**: Fixed support for CDF files
- **Format Confusion**: Resolved confusion between CDF and NetCDF formats in documentation and error messages

### Technical Improvements

- **ESLint Migration**: Migrated from `.eslintrc.json` to `.eslintrc.js` for better configuration flexibility
- **Pre-commit Hooks**: Comprehensive pre-commit configuration with 10+ quality checks
- **Workflow Optimization**: Single workflow replacing multiple separate CI jobs
- **Type Safety**: Enhanced TypeScript configuration with separate pre-commit type checking
- **Engine Architecture**: Enhanced engine selection logic to support format-specific engines (cdflib for CDF)

## [0.5.0] - 2025-01-08

### Added

- **Export Webview Content**: Complete data viewer content export as self-contained HTML reports
  - **Export Button**: Added export button (🖼️) to header controls in data viewer panel
  - **Command Palette Integration**: "Scientific Data Viewer: Export Webview Content" command
  - **Self-contained Reports**: Generated HTML includes embedded CSS and JavaScript for standalone viewing: "Browser Mode". Copy, Expand All and Collapse All buttons works in this mode.
  - **Complete Data Export**: Includes all visualizations, data tables, metadata, and technical information
  - **Professional Layout**: Clean, professional report layout with copy buttons for easy data extraction
  - **File Management**: Proper file naming with timestamps and save dialog with options to open or reveal files
  - **Use Cases**: Share data analysis results, create documentation, archive sessions, generate reports
  - **Files Modified**:
    - src/common/config.ts - Added CMD_EXPORT_WEBVIEW constant
    - package.json - Added command definition and menu integration
    - src/panel/HTMLGenerator.ts - Added webview export button (🖼️)
    - src/panel/UIController.ts - Added webview export functionality and content capture
    - src/DataViewerPanel.ts - Added exportWebview() method
    - src/extension.ts - Added command handler
    - src/panel/webview/webview-script.js - Added content capture functionality
- **Dev Mode Toggle Command**: Quick access to enable/disable dev mode without navigating settings
  - **Command Palette Integration**: "Scientific Data Viewer: Toggle Dev Mode" command
  - **Global Setting Update**: Updates user's global dev mode setting
  - **User Feedback**: Clear messages about dev mode state changes
  - **Developer Experience**: Significantly improves workflow when switching between development and usage
  - **Files Modified**:
    - src/common/config.ts - Added updateDevMode function and CMD_TOGGLE_DEV_MODE constant
    - package.json - Added command definition and menu integration
    - src/extension.ts - Added command handler with proper error handling
- **Package Availability Detection**: New Python script for efficient package checking
  - **Dedicated Script**: `python/check_package_availability.py` for checking multiple packages at once
  - **JSON Output**: Returns structured availability data for better integration
  - **Performance**: Optimized package detection with single Python process execution (instead of calling N times a script for N dependencies)
  - **Error Handling**: Robust error handling for package availability checks
- **GeoTIFF Band-to-Variables Conversion**: Improved multi-band GeoTIFF file handling
  - **Configuration Option**: `scientificDataViewer.convertBandsToVariables` boolean setting (enabled by default)
  - **Better Readability**: Converts 3D DataArrays with band dimension to separate 2D variables
  - **Improved Plotting**: Each band treated as individual variable with appropriate color scales
  - **Supported Formats**: Works with .tif, .tiff, and .geotiff files
  - **Clean Implementation**: Uses rioxarray's built-in [`band_as_variable`](https://corteva.github.io/rioxarray/html/rioxarray.html#rioxarray.open_rasterio) parameter
  - **User-Friendly**: Simple on/off configuration for all GeoTIFF formats
  - **Backward Compatible**: Existing functionality preserved when disabled
  - **Files Modified**:
    - package.json - Added configuration option
    - src/common/config.ts - Added getter function
    - src/python/DataProcessor.ts - Updated to pass configuration
    - src/panel/UIController.ts - Added configuration logic
    - python/get_data_info.py - Implemented band conversion
    - python/create_sample_data.py - Added test data creation

### Enhanced

- **User Experience**: Improved data sharing and documentation capabilities
- **Professional Workflow**: Better integration with research and documentation workflows
- **Package Management**: Improved package detection and installation workflow
  - **Fine-grained Control**: Differentiate between core packages (xarray) and optional packages (matplotlib)
  - **Better Error Messages**: More specific error messages for missing packages
  - **Help Buttons**: Added install buttons for missing packages directly in error messages
  - **More Command Quoting**: Improved command quoting for better avoidance of space-related issues when calling commands in package installation

### Technical Improvements

- **Code Organization**: Added export functionality to UIController with comprehensive HTML generation
- **Error Handling**: Robust error handling for export operations with user-friendly feedback
- **Testing**: Added test coverage for export functionality
- **Python Script Optimization**: Enhanced Python script structure and error handling
  - **Structured Responses**: Better structured response format for plot creation and data info
  - **Error Wrapping**: Improved error message wrapping and handling
  - **Type Safety**: Enhanced type definitions for better TypeScript integration
  - **Test Updates**: Updated test mocks to match new response structures

### Removed

- **Configuration Settings**:
  - `scientificDataViewer.currentlyInUseInterpreter`: Currently active Python interpreter path (read-only, updated automatically)
    - Reason: It was not actually used, nor necessary, as python interpreter resolution is performed live.
- **Sentinel-1 SAFE Support**: Removed untested Sentinel-1 SAFE (.safe) format support
  - **Reason**: Was never tested and implementing it would be a nice-to-have for later
  - **Cleanup**: Removed related dependencies and sample data generation
  - **Documentation**: Updated RFCs to reflect removal

## [0.4.0] - 2025-10-06

### Added

- **Extension Virtual Environment**: Semi-standalone virtual environment stored in VSCode extension storage
  - **uv Required**: Only works if `uv` is installed on the system
  - **Python 3.13**: Uses uv to install and use Python 3.13 for latest features and performance
  - **Isolated Storage**: Stored in VSCode's extension storage space
  - **Fallback Support**: Falls back to Python extension behavior if uv is not available
  - **Management Commands**: Create, manage, update, and delete extension environment
  - **Status Display**: Shows extension environment status and creation tool in status bar
- **Virtual Environment Management Command**:
  - `Manage Extension Virtual Environment`: Create, update, delete extension environment
- **Configuration Settings**:
  - `scientificDataViewer.overridePythonInterpreter`: Override Python interpreter path (takes precedence over all other options)
  - `scientificDataViewer.python.useExtensionOwnEnvironment`: Activate the use extension's own virtual environment with `uv`
  - `scientificDataViewer.currentlyInUseInterpreter`: Currently active Python interpreter path (read-only, updated automatically)
- **Split View**:
  - Works for files opened via the file explorer, because the webviewPanel is reused (`ScientificDataEditorProvider`)
  - Does not work with files/dirs opened via command nor context menu, because the webviewPanel is created from scratch

### Enhanced

- **Enhanced Status Bar**: Shows virtual environment type and interpreter information

### Removed

- Plotting Capabilities extension feature flag (always on)

### Technical Improvements

- Refactor zones of the code.

### Known Bugs

- Data Structure TreeView is not shown for manually created Webviews in Cursor. See when clause of `scientificDataViewer.outline`.
  - When VSCode doc: https://code.visualstudio.com/api/references/when-clause-contexts
  - Related: https://forum.cursor.com/t/webview-panels-and-commands-not-supported-in-cursor-breaks-extensions/115748

### Fixed

## [0.3.0] - 2025-10-03

### Added

- **Enhanced Data Structure Navigation**: Improved outline view functionality
  - Attributes display for coordinates and variables in outline
  - Granular highlighting for individual attributes with precise navigation
- **Comprehensive DataTree Support**: Full support for hierarchical data structures with group-specific sections
  - Group-specific coordinates, variables, and attributes display
  - Flattened dimensions support for nested datatree groups
  - Enhanced plotting capabilities for nested variables
  - Backward compatibility with regular datasets
- **Advanced Plotting System**: Per-variable plotting capabilities
  - Individual plot controls for each variable
  - Multiple simultaneous plots support
  - Per-variable plot actions (Reset, Save, Save As, Open)
  - Global plot operations (Plot All, Reset All Plots, Save All Plots)
  - Enhanced plot management with VSCode notifications
- **Export and Visualization Features**: Complete visualization export capabilities
  - Save plot functionality with file dialog integration
  - "Save Plot As" with smart filename generation
  - Open plot in new tab with external app fallback
  - PNG export support with configurable resolution
  - VSCode-native file operations and notifications
- **Stress Testing Support**: Comprehensive testing infrastructure for large datasets
  - Test data generator for 100+ variables and attributes
  - Enhanced text representation with size limits
- **Modular Architecture**: Complete UI architecture overhaul
  - Split monolithic DataViewerPanel into focused generator classes
  - HTMLGenerator, CSSGenerator, and JavaScriptGenerator modules
  - Centralized state management with Redux-like pattern
  - Type-safe communication system with MessageBus
  - Component-based UI system with lifecycle management
  - Error boundary system for robust error handling
  - Note: The codebase can still be improved, and the need for an UI framework emerges.

### Enhanced

- **User Interface Improvements**: Better visual feedback and navigation
  - Simplified highlighting with improved visual layout
  - Better icon positioning and spacing in outline view
  - Enhanced scroll functionality with sticky header offset
  - Tree view navigation
- **User Experience**: Improved interface and workflow
  - Per-variable plot controls with intuitive positioning
  - Responsive design (for window resize)
  - Event delegation for efficient dynamic content handling
  - Non-blocking notifications and better error feedback (eg for installing packages)
- **Performance**: Performance improvements
  - Parallelized plot generation with progress tracking
  - Efficient event handling for multiple plot instances
  - Optimized text representation for large datasets
- **Code Quality**: Major architectural improvements
  - 72% reduction in main panel code (1,500+ to ~420 lines)
  - Separation of concerns between UI and business logic
  - Type-safe message system with timeout handling
  - Comprehensive error recovery mechanisms
- **DataTree Integration**: Enhanced hierarchical data support
  - Group-specific sections for coordinates, variables, and attributes
  - Flattened dimensions display for nested structures
  - Enhanced plotting with full variable paths (group/variable)

### Technical Improvements

- **Code Quality**: Enhanced implementation details
  - Simplified Data Structure view for xarray HTML and Text representations
  - Enhanced HeaderExtractor with attributes display for coordinates and variables
  - Improved plotting strategy and 2D classic plotting support
- **Architecture Refactoring**: Complete modularization of UI components
  - HTMLGenerator: Centralized HTML generation utilities
  - CSSGenerator: Modular CSS organization and styling
  - JavaScriptGenerator: Client-side code generation
  - UIController: Separated UI logic from business logic
  - MessageBus: Type-safe communication system
- **State Management**: Centralized, immutable state updates
  - Redux-like pattern for state management
  - Type-safe request/response pattern
  - Component-specific and global error recovery
  - Validation and error handling throughout
  - Note: The current state management system is not used fully.
  - Note: Plot generation is independent of current state management.
- **Error Handling**: Robust error management system
  - Error boundary system for component isolation
  - Per-variable error messages and recovery
  - VSCode integration for user notifications
  - Graceful fallback mechanisms
- **Testing Infrastructure**: Enhanced stress testing capabilities
  - Sample data generator for 100+ variables
  - Performance testing with large datasets
  - Text representation optimization
  - Memory usage monitoring

### Fixed

- **Data Structure Tree View**: Resolved loading issues
  - Fixed data structure tree view not loading for right-click opened files
  - Fixed tree view scrolling for attributes with details elements
  - Fixed treeview navigation with proper IDs for TXT and HTML group representations
  - Improved timing issues in DataViewerPanel constructor
- **Plot Controls**: Resolved issues with grayed-out plot buttons
- **Layout Issues**: Fixed broken variable display structure
- **Event Handling**: Corrected event listener setup for dynamic content
- **Alert Usage**: Replaced all alert() calls with VSCode notifications
- **UI Elements**: Hidden useless divs and removed unnecessary code
- **Display Issues**: Various display fixes for better visual presentation

## [0.2.0] - 2025-09-14

### Added

- **Comprehensive Format Support**: Full support for all xarray-compatible scientific data formats
  - **GRIB/GRIB2**: Complete support with proper eccodes integration
  - **GeoTIFF**: Enhanced support with improved error handling
  - **JPEG2000**: Support for .jp2 and .jpeg2000 files
  - **Sentinel-1 SAFE**: Support for .safe files (UNTESTED)
  - **Enhanced Zarr**: Improved support for complex nested Zarr xarray-compatible datasets
  - **DataTree Support**: Better handling of hierarchical data structures
- **Comprehensive Test Suite**: Complete unit test coverage for all core components
  - DataProcessor tests with mock Python environment and error handling scenarios
  - DataViewerPanel tests with webview panel management and data processing
  - Logger tests with output channel management and log level handling
  - PythonManager tests with extension API integration and environment detection
  - Integration tests for component interaction and concurrent operations
- **Enhanced Sample Data Generator**: Comprehensive test data creation for all supported formats
  - GRIB file creation using eccodes
  - GeoTIFF generation with proper metadata
  - Multi-format sample data for testing
- **Open VSX Publishing Support**: Extension now available in Cursor, VSCodium, and other editors
  - New `openvsx-publish` npm script
  - Comprehensive publishing documentation
  - Cross-platform editor compatibility

### Enhanced

- **Logging System**: Complete overhaul with emoji-based visual indicators
  - Meaningful emojis for all log messages
  - Improved error tracking and debugging
  - Better initialization sequence logging
- **Error Handling**: Streamlined and more robust error management
  - Better dependency notification system
  - Improved Python environment error recovery
  - Enhanced user feedback for missing dependencies
- **WebView Rendering**: Simplified and more efficient data display
  - Better DataTree support for hierarchical data
  - Improved HTML generation for complex datasets
  - Always-visible Dimensions and Variables sections
- **Python Environment Management**: Reduced core dependencies
  - Removed numpy requirement from core package
  - Simplified dependency handling
  - Better Python path detection

### Technical Improvements

- **Code Refactoring**: Major API simplification and cleanup
  - Removed unused methods (getDataSlice, getVariableList, etc.)
  - Streamlined data processing pipeline
  - Better separation of concerns
- **Test Infrastructure**: Robust testing framework with proper mocking and cleanup
  - Enhanced test coverage for edge cases and error scenarios
  - Improved test isolation and cleanup procedures
  - Mock implementations for VSCode API dependencies
  - Comprehensive error handling validation in test scenarios
- **Documentation**: Enhanced RFC documentation and implementation tracking
  - RFC #001 marked as fully implemented
  - Comprehensive implementation summaries
  - Better status tracking for features

### Fixed

- **GRIB File Creation**: Resolved bugs in GRIB file generation
- **Dependency Handling**: Improved missing dependency notifications
- **Data Processing**: Removed duplicate getData calls
- **Test Suite**: Repaired and enhanced all test cases

## [0.1.0] - 2025-09-13

### Added

- **Custom Editors**: Direct file opening with dedicated NetCDF and HDF5 editors
- **Advanced Python Integration**: Automatic Python environment detection via Python extension API
- **Command Palette Integration**: Multiple commands for data viewer operations
- **Real-time Configuration**: Immediate application of setting changes without restart
- **Status Bar Integration**: Shows current Python interpreter status
- **Comprehensive Logging**: Detailed logging system for debugging and monitoring
- **Error Handling**: Robust error handling with user-friendly messages
- **Experimental Features**: Configurable experimental features with clear warnings
- **Multi-format Support**: Support for NetCDF (.nc, .netcdf), Zarr (.zarr), and HDF5 (.h5, .hdf5) files
- **Interactive Data Exploration**: Browse file structure, dimensions, variables, and attributes
- **Enhanced Variable Information**: View variable dimension names, data types, shapes, and memory usage
- **Data Visualization**: Create plots and visualizations directly in VSCode (experimental)
- **File Tree Integration**: Right-click on supported files in the explorer to open them
- **Human-readable File Sizes**: Display file and variable sizes in appropriate units (B, kB, MB, GB, TB)
- **Python Environment Management**: Automatic Python package installation and validation
- **Real-time File Watching**: Auto-refresh when files change
- **Comprehensive Documentation**: Complete documentation and testing setup

### Technical Details

- Built with TypeScript and VSCode Extension API
- Uses xarray for scientific data processing
- Integrates with VSCode Python extension for environment management
- Webview-based data visualization interface
- Support for large file handling with configurable limits
- Custom editor providers for direct file opening
- Real-time configuration management
- Comprehensive error handling and logging

### Configuration Options

- `scientificDataViewer.autoRefresh`: Automatically refresh data when files change
- `scientificDataViewer.maxFileSize`: Maximum file size (MB) to load automatically
- `scientificDataViewer.defaultView`: Default view mode
- `scientificDataViewer.allowMultipleTabsForSameFile`: Allow multiple tabs for same file **(Experimental)**

### Available Commands

- **Open Scientific Data Viewer**: Open a file in the data viewer
- **Refresh Python Environment**: Manually refresh the Python environment
- **Show Extension Logs**: View detailed extension logs
- **Show Settings**: Open Scientific Data Viewer settings

### Known Issues

- Large files (>500MB) may take time to load
- Some complex NetCDF files may not display all attributes correctly
- Plot generation may fail for very large datasets (experimental feature)
- Experimental features may cause unexpected behavior

### Future Enhancements

- Support for additional file formats (GRIB, TIFF, etc.)
- Enhanced visualization options (3D plots, animations)
- Data export functionality
- Performance improvements for large files
- Additional experimental features
- Unit test coverage improvements
