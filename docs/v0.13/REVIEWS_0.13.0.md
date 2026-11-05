# Reviews — v0.13.0

Every review pass of the release, oldest first. All items are fixed unless marked otherwise; each fix is described in the [CHANGELOG](../../CHANGELOG.md) and the [release notes](../RELEASE_NOTES_0.13.0.md).

| Pass                                   | Date         | Scope                                               | Items                                                             |
| -------------------------------------- | ------------ | --------------------------------------------------- | ----------------------------------------------------------------- |
| [1. Code review](#1-code-review)       | October 2026 | Whole codebase, read line by line                   | 63, all fixed (manual test plan T16–T19)                          |
| [2. QA pass](#2-qa-pass)               | 2026-10-29   | Exploratory and adversarial testing against v0.12.1 | 1 blocker, 14 bugs, 4 hardening, all fixed (manual test plan T29) |
| [3. Release review](#3-release-review) | 2026-11-05   | Code and docs before publishing                     | 16 code items (15 fixed, 1 not a bug), docs cleanup, 8 overlaps   |

---

## 1. Code review

Tracking list of the fixes found in the October 2026 codebase review.
Every item is fixed, with its tests.

Baseline before the work: `npm test` 294 passing, `pytest python/tests` 112 passing.

### 1. Security

- **S1** Escape file-derived names (variables, coordinates, dimensions, groups, dims strings, error messages) inserted with `innerHTML` in the webview
- **S2** Escape names used in `querySelector` attribute selectors (`CSS.escape`)
- **S3** Allowlist the commands the webview may run through `executeCommand` (show logs, install packages, show settings)
- **S4** Validate the `fileName` sent by the webview for `savePlot` / `openPlot` (no path separators / traversal)
- **S5** Add a Content-Security-Policy to the webview (replace inline `onclick=` handlers first)

### 2. Extension host bugs

- **H1** Drop `shell: true` from `uv` / Python spawns (version pins like `xarray>=2026.4.0` were shell redirects) and drop `quoteIfNeeded` for spawn args
- **H2** "Open as Kerchunk / virtual Zarr" loses the `openAs=kerchunk` flag (URI rebuilt from `fsPath`)
- **H3** `ErrorBoundary` hooks `process.on('uncaughtException')` in the shared extension host — remove
- **H4** `ErrorBoundary` component handlers are never unregistered (closed panels leak)
- **H5** "File too large" message prints the limit in bytes with an `MB` suffix
- **H6** Plot save / save-as / webview export split paths on `/` (broken on Windows)
- **H7** Save plot / Save as await the "file saved" notification → false timeout in webview, "Save All" stops
- **H8** Concurrent Python (re)initialisation: single-flight init, serialise env create/upgrade, debounce `onDidEnvironmentsChanged`
- **H9** "Install packages" uses `python -m pip`, which fails in the extension's own uv env
- **H10** False "uv is not installed" error after enabling `useExtensionOwnEnvironment` when an override interpreter is set
- **H11** Manage-environment UI writes `useExtensionOwnEnvironment` at Workspace level (fails with no folder open)
- **H12** Subprocess robustness: no timeout on `getDataInfo` / init package check; non-JSON stdout resolved as raw string; `getDataInfo` swallows mapped errors into "file might be corrupted"
- **H13** Stale interpreter state kept when no interpreter is found; `prepareExisting` marks env initialised when install failed
- **H14** Outline: `treeView.reveal()` rejections uncaught; TreeView / emitter not disposed; outline not cleared when current panel closes
- **H15** `openHealthcheckReport` opens the document twice; `forEach(async …)` fire-and-forget in open commands and `refreshPanelsWithErrors`
- **H16** Outline links to group attributes don't match webview ids in nested attributes view (`attribute` vs `attributes`/`attr`)

### 3. Python backend bugs

- **P1** Unexpected exceptions (corrupt / missing file) produce no JSON — catch-all in `extract.py` and `cli.main`
- **P2** `inf` (and NaN inside tuples) in attributes crashes JSON serialisation
- **P3** `ComplexEncoder.default` shadowed by `default=str` → numpy numbers / arrays serialised as strings
- **P4** Global datetime filter applied to variables that don't have that dimension → `KeyError`
- **P5** Time-variable name heuristic flags e.g. temperature `t` (units K); ranges computed from non-datetime values
- **P6** One NaT in a time coordinate makes min/max `"NaT"`
- **P7** cftime calendars: detection and min/max
- **P8** `set_aspect("equal")` forced on every 2D plot
- **P9** `h5py` listed as an xarray engine
- **P10** Broken `NotImplementedError` fallback in `opening.py`
- **P11** Unknown extensions reported as "Missing dependencies for Unknown files"
- **P12** Root datetime variable (`"time"`, parent `"."`) resolved against the plotted variable's group

### 4. Webview bugs

- **W1** `displayDataInfo` references undefined `contentContainer`, reads `dimensions_flattened` before the null guard, throws with no groups
- **W2** Group time-control text inputs ignored; group datetime select not prefilled
- **W3** Stale `globalTimeControlsState.datetimeVariableName` after Refresh
- **W4** HTML strings assigned to `textContent`; stray `</div>`
- **W5** `createPlot` timeout leaves the `pendingRequests` entry behind

### 5. Message bus and panel state (simplification)

- **M1** Replace `MessageBus` with a small typed channel (request handlers + event emission only); remove the unused host-side request/response/event-listener path and convenience methods
- **M2** Remove unused payload interfaces, `COMMANDS`, `isEventMessage`; type the protocol with one requests map and one events map
- **M3** Remove unused request handlers (`getDataInfo`, `getCurrentFilePath`, `updateHeaders`) and the unused `pythonEnvironmentChanged` / `uiStateChanged` events
- **M4** Replace `StateManager` (undo history, validation, unused actions) with plain fields; stop posting the full state on every change
- **M5** One error path for load failures (drop the raw `{command:'error'}` post)
- **M6** Pass plot options as one object end to end (webview → `UIController` → `DataProcessor` → CLI args builder) instead of 24 positional arguments
- **M7** Remove redundant `try { … } catch (e) { throw e }`, dead `|| {}` on promises, and double `ErrorBoundary` wrapping
- **M8** Rewrite `MessageBus` tests for the new channel

### 6. Dead code

- **D1** `types.ts`: duplicate `DataInfoResult` / `DataInfoError`; `format_info.is_supported` and `format` never sent by Python
- **D2** `package-types.ts`: unused types
- **D3** `getCustomEditorViewTypes` unused while `extension.ts` hard-codes the list
- **D4** Unused helpers: `isPlotOperationActive`, `getActiveOperations`, `ATTEMPT_CREATING_EXTENSION_OWN_UV_ENVIRONMENT`, unreachable `showErrorMessage`, `DEFAULT_PLOT_TIMEOUT_MS` comment, `HeaderExtractor.extractHeaders` (test-only, needs `DOMParser`), unreachable `'$(plus) Create'` case, `Logger.getThreadId` fallback, unused env `packages` field, uncertain Python-extension API fallbacks
- **D5** Merge `CSSGenerator` / `JavaScriptGenerator` into one asset reader
- **D6** Webview: "enable buttons" loop, `handlePlotTypeSelect`, `exportHtmlButton`, `sendRequest` logging monkey-patch, `getDataInfo`, `getActiveOperationIds`, outdated `SUPPORTED_EXTENSIONS_HARDOCDED`
- **D7** CSS: `.variable-item`, `.dimension-item`, `.variable-row`, `.plot-progress`, ineffective 480px media query, commented-out CSS
- **D8** Python: pre-DataTree group-listing branches, `is_spatial_dimension`, unreachable 2D/3D cmap branches, `ComplexEncoder` dead branches / unused `encoder` param, duplicate `XR_OPTIONS`, stray comments

- **D9** `package.json`: unused runtime dependency `axios`; `jsdom` (tests only) moved to `devDependencies`

### 7. Over-engineering / structure

- **O1** `HealthcheckManager`: merge overlapping checks, single Python package check, reuse package lists and uv detection, drop tautological checks
- **O2** One `runProcess(cmd, args, { timeout })` helper instead of ~9 spawn-and-collect wrappers
- **O3** `HealthcheckManager` / `DataProcessor` singletons → simpler ownership
- **O4** Python plot strategies: replace ABC + registries + dispatcher with plain functions; collapse identical `*_imshow_merged_kw`; simplify engine tables
- **O5** Webview: one plot-parameter table for global and group controls (render / read / reset / merge)
- **O6** Webview: `resolvePlotOptions(variable)` shared by single and "all" plots; drop `globalTimeControlsState` DOM mirror; `sendRequest` timeout hook instead of the duplicated one in `createPlot`; shared CSS input class
- **O7** Split `webview-script.js` into TypeScript modules bundled into one script with esbuild

### 8. Documentation

- **Doc1** `CHANGELOG.md`, `docs/RELEASE_NOTES_0.13.0.md`, `docs/v0.13/PR_SUMMARY_0.13.0.md`, and developer docs made stale by the changes (`CLAUDE.md`, `docs/DEVELOPMENT.md`, `docs/TECHNICAL_ARCHITECTURE.md`)

---

## 2. QA pass

Branch `eschalk/backend-package` @ `1f8bf6d` · 2026-10-29 · exploratory + automated adversarial testing. The findings below describe the state before the fixes; [§ Fixes](#fixes) lists what was done, and the summary table says which are fixed.

### Verdict

No regression was found in what the viewer reads or plots: every sample file gives the same data as v0.12.1 and the default plots are pixel-identical. The security fix holds against every injection attempt. **One release blocker** (the `.vsix` on disk is stale) and **13 bugs** were found, none critical. Most are pre-existing; four are new in v0.13 or incomplete v0.13 fixes (marked **v0.13**).

| #   | Severity    | Finding                                                                                                      | Origin                   | Fixed |
| --- | ----------- | ------------------------------------------------------------------------------------------------------------ | ------------------------ | ----- |
| 0   | **Blocker** | `scientific-data-viewer-0.13.0.vsix` on disk predates 25 commits (246 files, old ignore rules)               | packaging                | ✓     |
| 1   | Medium      | vmin / vmax of magnitude < 1e-6 or ≥ 1e21 (negative) break the plot                                          | pre-existing             | ✓     |
| 2   | Medium      | Closing a viewer while it loads leaves its outline (and cache) behind                                        | **v0.13** fix incomplete | ✓     |
| 3   | Low–medium  | `NaN` / `inf` shown as `np.float64(nan)` / `np.float64(inf)`                                                 | **v0.13** regression     | ✓     |
| 4   | Low–medium  | Plot All re-runs a variable already plotting; Cancel then leaves an orphan that overwrites "Plot cancelled." | **v0.13** feature gap    | ✓     |
| 5   | Low–medium  | Error notification for a viewer already closed                                                               | **v0.13** (likely)       | ✓     |
| 6   | Low         | Values starting with `-` (dimension names, `matplotlibStyle`) read as CLI options                            | pre-existing             | ✓     |
| 7   | Low         | An older load can overwrite a newer one (refresh race)                                                       | pre-existing             | ✓     |
| 8   | Low         | Export Webview exports the first visible panel, not the active one                                           | pre-existing             | ✓     |
| 9   | Low         | Closing a viewer does not stop its running plot                                                              | pre-existing             | ✓     |
| 10  | Low (UX)    | Invalid numbers (`1,5`, `-3` for size) silently ignored                                                      | pre-existing             | ✓     |
| 11  | Low (UX)    | Group checkbox left at default cannot override a changed global checkbox                                     | design (documented)      | ✓     |
| 12  | Low         | Kerchunk messages: invalid JSON → "no 'refs' mapping"; missing target → empty `ReferenceNotReachable()`      | v0.13 feature            | ✓     |
| 13  | Low         | Header icons overlap the version badge at 320 px                                                             | **v0.13** styling        | ✓     |
| 14  | Low         | Settings bounds: `maxFileSize` 0 / -1 refuses everything; never applies to Zarr directories                  | pre-existing             | ✓     |

Notes, not bugs: the default plot of `sample-data/sample_data.nc` (365 facets) always exceeds the 20 s default timeout (same in v0.12.1); plotting cftime axes needs `nc-time-axis` (documented); the local golden snapshots are stale (§ Automated suites).

---

### How the testing was done

| Layer                  | Method                                                                                                                                                                                                                                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend, differential  | v0.12.1 (`git worktree add <dir> v0.12.1`) and v0.13 `get_data_info.py` run with the **same interpreter** (the extension's uv env: xarray 2026.9, zarr 3.4) on every file of `sample-data/` + 53 hostile files; `info` JSON compared structurally, `plot` images compared pixel by pixel (title timestamp masked)       |
| Backend, option matrix | 77 plot-option scenarios (slices, facets, axes, colour, figure, time filters, other formats), old vs new                                                                                                                                                                                                                |
| Webview                | The real page (HTMLGenerator markup, **real CSP**, compiled `webview.js`, `styles.css`, VS Code theme variables) in headless Chromium, driven by real keyboard / mouse input over DevTools; the host side runs the backend through the extension's compiled `buildCreatePlotCliArgs`, `runProcess`, `parseScriptResult` |
| Extension host         | Custom mocha suites inside VS Code 1.144 (`@vscode/test-electron`) calling the live `DataViewerPanel` / `UIController` / `MessageBus`, dialogs stubbed, Python processes checked with `ps`                                                                                                                              |
| Packaging              | `npx vsce ls`; the exact packaged file set run as the extension; on-disk `.vsix` unpacked and diffed                                                                                                                                                                                                                    |
| Environments           | uv env (xarray 2026.9), `.venv` (xarray 2026.7 + kerchunk), throwaway venvs with xarray 2024.6 and with zarr 2.18                                                                                                                                                                                                       |

Hostile fixtures: HTML / script payloads in variable, group, dimension and attribute names and values (NetCDF, Zarr, GeoTIFF band descriptions and tags), unicode / RTL / 300-char names, names starting with `-`, file names with `#`, `%25`, `?`, `;$(touch PWNED)`, quotes, leading `-`; `inf`/`nan` attributes, 200 000-char strings, 20 000-element arrays, uint64 max, bytes; all-NaN, constant, bool, string, timedelta, complex, scalar, zero-length, 5-D, enum, vlen variables; cftime calendars (noleap, 360_day, julian); curvilinear coordinates; NetCDF3, unlimited dims, pure HDF5; empty / truncated / text files, directory named `.nc`, dangling symlink; Zarr v2/v3, Zarr directory named `.tif`, unsuffixed directory with spaces, ZIP at root / under a prefix / two stores / deflated / corrupt / empty; Kerchunk inline, relative, `./`, `../`, absolute, `file://`, missing target, invalid JSON, JSON array, empty refs.

---

### 0. Blocker — stale `.vsix` on disk

- `scientific-data-viewer-0.13.0.vsix` was built 2026-10-29 12:25; 25 commits are newer (HEAD 19:53).
- It holds **246 files** with the old ignore rules (45 `docs/` entries, `.github/`, `.pytest_cache/`, `publish.sh`, `python/sample_data/`, notebooks, screenshots). It **lacks** `out/src/shared/icons.js` and `out/src/shared/time.js`; its `webview.js`, `styles.css`, `package.json`, 5 host files and 11 backend files differ from HEAD.
- `npx vsce ls` at HEAD gives **100 files** with every runtime file present; that exact set runs correctly as the extension (96/96 E2E checks, backend from the packaged copy).
- **Action:** rebuild with `npm run package` before publishing. Doc nit: release notes, CHANGELOG and PR summary say 98 files (now 100).

### 1. Medium — small or huge negative vmin / vmax break the plot (pre-existing)

**Repro (UI):** open `sample-data/sample_data.netcdf`, Group Plot Controls → slice `time` start `0`, vmin `-0.0000001` (or `-1e-7`), Create Plot.

**Observed:** `Error creating plot: get_data_info.py: error: argument --vmin: expected one argument`.

**Cause:** the webview parses the box to a number; `buildCreatePlotCliArgs` (`src/python/DataProcessor.ts:143-148`) passes `String(value)`, which JS writes in exponent notation for |x| < 1e-6 or ≥ 1e21 (`-1e-7`, `-1e+21`). argparse only treats `-1`, `-0.5` style strings as negative numbers, so `-1e-7` is read as an option and the backend exits 2 with no JSON. `-0.5` and `1e-7` work. Data in SI flux units (kg m⁻² s⁻¹ …) routinely needs such bounds.

**Proof:** `qa/logs/ui_controls.txt` (UI), `qa/logs/scen.txt` case `vmin_neg_sci` (fails identically in v0.12.1), E2E `s3/results.json`. Suggested direction: `--vmin=<value>` form.

### 2. Medium — closing a viewer while it loads leaves a ghost outline (v0.13 fix incomplete)

**Repro:** open `sample-data/sample_data_multiple_groups.nc` and close the tab before it finishes loading (~1 s).

**Observed:** once the load ends, 0 panels are open but the Explorer **Data Structure** outline shows the closed file's tree (`outlineCurrent=5` = the closed panel; its headers stay cached). After 15 rapid open/close cycles, 16 cache entries leak and the outline shows closed panel 22.

**Cause:** `UIController.loadFile` has no disposed guard; after `disposePanel()` cleared the outline, the in-flight load calls `onOutlineUpdateCallback` → `DataViewerPanel.updateOutline()` → `OutlineProvider.updateHeaders(closedId)` (`src/DataViewerPanel.ts:264-268, 327-341`).

**Expected:** release notes §18.8 (now manual test plan T18) "Close the viewer → the outline is cleared" (true when closed after load). **Proof:** E2E `s8/results.json` ("dispose during load", "rapid open/close"); code path read and confirmed.

### 3. Low–medium — `NaN` / `inf` displayed as `np.float64(nan)` / `np.float64(inf)` (v0.13)

**Repro:** open any xarray-written float file, e.g. `sample-data/sample_data.nc`, expand a coordinate → Xarray Encoding → `_FillValue : np.float64(nan)`. An attribute `valid_max = inf` shows `np.float64(inf)`.

- **Regression:** v0.12.1 showed `_FillValue` as `nan`. Affects **18 of the 55** sample files.
- Contradicts release notes §19.2 (now manual test plan T19) / manual test plan ("the attribute shows `inf`"). Inconsistent: float32 `inf` shows `inf`, float64 shows `np.float64(inf)`; arrays show `[0.1,"nan","inf"]` with quotes.
- **Cause:** `sanitize_non_finite` (`python/sdv_backend/serialization.py:22-23`) uses `repr()`, and `np.float64` is a `float` subclass; `python/tests/test_serialization.py:33` asserts this output.
- **Proof:** DOM `<span class="attribute-value" title="np.float64(inf)">np.float64(inf)</span>` (`qa/ui/t_inf.mjs`); `grep` over the info JSON of v0.12.1 vs v0.13 (`qa/info_uv/`).

### 4. Low–medium — Plot All re-runs a variable that is already plotting (v0.13 Cancel feature)

**Repro:** with a slow variable (a ~20 s plot): **Create Plot** on it, then **Plot All** while it runs, then **Cancel** on that variable.

**Observed:**

1. Two `createPlot` requests and two Python processes for the same variable (the release notes say Create Plot is disabled so "a second click" cannot start a second process; Plot All bypasses that).
2. Cancel aborts only the second one (`runningPlots` keeps the latest operation id), shows "Plot cancelled.".
3. The orphaned first run keeps going and, ~20 s later, replaces "Plot cancelled." with `Error creating plot: Plot request timeout … (>20s)`. Had it finished in time, its image would have appeared after the user cancelled — contradicting "the response of a cancelled plot is ignored".

**Proof:** `qa/logs/ui_cancel.txt`, scenario 2 (creates `plot-…2cugykt` and `plot-…oztf6p3`, one abort, final state an error).

Everything else about Cancel passed (below).

### 5. Low–medium — error notification for a viewer already closed

**Repro:** open `sample-data/broken_file.nc` and close it within ~1 s.

**Observed:** a VS Code error toast `Scientific Data Viewer Error: cannot mmap an empty file` for a tab that no longer exists. `UIController.dispose()` unregisters the panel's ErrorBoundary handler, so the late failure goes to the global handler (`src/extension.ts:72-77`). **Proof:** E2E `s8/results.json` (`popups`).

### 6. Low — values starting with `-` are read as CLI options (pre-existing)

A dimension named `-x` chosen as x / y / hue / row / col (`get_data_info.py: error: argument --plot-x: expected one argument`), or `matplotlibStyle` set to `-x`. Variable names starting with `-` are fine (always sent as `/…`), as are slices (JSON). Same root cause as #1. **Proof:** `qa/adv/dash_names.zarr`, E2E `s3`, `s6`.

### 7. Low — an older load can overwrite a newer one (pre-existing)

Refresh, then change `maxFileSize` to 1 and Refresh again within ~0.5 s: the second load fails at once, the first one finishes last, and the viewer ends showing data the current settings refuse (events `error`, then `dataLoaded`). `UIController.loadFile` has no sequence guard. **Proof:** E2E `s8` ("stale load race").

### 8. Low — Export Webview exports the wrong panel in a split (pre-existing)

Two viewers side by side, focus the right one, run **Export Webview Content**: the save dialog proposes the left file. `DataViewerPanel.getActivePanel()` (`src/DataViewerPanel.ts:70-82`) returns the first `visible` panel, not the `active` one. **Proof:** E2E `s11`; code read.

### 9. Low — closing a viewer does not stop its plot (pre-existing)

With `plotTimeoutMs=600000`, a running plot's Python process survives the viewer for up to 10 minutes (it dies at the timeout, or on VS Code shutdown). `abortAllProcesses` mentions panel disposal in its doc but nothing calls it there. **Proof:** E2E `s3`.

### 10. Low (UX) — invalid numbers silently ignored (pre-existing)

`vmin = 1,5` (decimal comma) or `size = -3`: no red outline, no message; the plot is created as if the box were empty. (Slice boxes do outline invalid input in red.) **Proof:** `qa/logs/ui_controls.txt`.

### 11. Low (UX) — group checkbox cannot override a changed global checkbox (documented design)

Global `add_colorbar` unchecked, group `add_colorbar` left checked: the plot has no colorbar while the group control shows it checked. Same for `robust`, `xincrease`, `yincrease`, `add_legend`. This matches the release notes ("a group checkbox left at its default uses the global value") but is confusing; a tri-state or "inherit" marker would make it visible. Global dimension slices are likewise dropped entirely when the group has any slice (documented).

### 12. Low — Kerchunk error messages

- `{not json` in a `.kerchunk.json` → "This file is not a Kerchunk / virtual Zarr reference (no 'refs' mapping)." (release notes promise a clear invalid-JSON message).
- Reference to a missing data file: File Information opens, plotting fails with `Error creating plot: ReferenceNotReachable()` and no path.
- Empty `refs` → `GroupNotFoundError … ReferenceFileSystem`.

### 13. Low — header overlap at 320 px

At 320 px the export / collapse icons are drawn over the `v0.13.0` badge. 420 px (the width in the test plan) is fine, with no horizontal scroll at 420 or 320. **Proof:** `qa/img/header_narrow.png`.

### 14. Low — settings bounds (pre-existing)

`maxFileSize` 0 or -1 refuses every file ("Maximum allowed: 0MB"; no schema minimum); the limit never applies to Zarr directories (directory inode size); `facetgridFigsize [1e-9, 1e-9]` is passed through although the schema minimum is 0.1.

### Hardening observations

- `executeCommand('scientificDataViewer.python.installPackages', [['--index-url', 'http://…', …]])` from the webview is forwarded to `uv pip install` as options. Only exploitable with script execution in the webview, which the CSP and escaping prevent (see below). Validating package names would close it.
- `exportWebview` with `htmlContent: null` (webview capture failure) errors after the user has picked a file.
- Wrong interpreter path and an interpreter without xarray both give the same vague "Python environment not ready".

---

### Fixes

Every finding above is fixed, with its test; numbers match the findings. The scenarios that reproduced a finding now check its fix.

#### Tooling

- **T. QA harnesses versioned** in `scripts/qa/` (webview harness, backend differential tests, hostile fixtures, VS Code end-to-end suites), runnable without the session scratchpad

#### Bugs

- **1. Small or huge negative vmin / vmax break the plot** — `-1e-7`, `-1e+21` are read as CLI options (`argument --vmin: expected one argument`)
- **6. Values starting with `-` read as CLI options** — dimension `-x` as x / y / hue / row / col, `matplotlibStyle` `-x` (same root cause as 1)
- **3. `NaN` / `inf` shown as `np.float64(nan)` / `np.float64(inf)`** — attributes and `_FillValue`; arrays show `"nan"` in quotes
- **2. Closing a viewer while it loads leaves its outline** (and leaks its cached headers)
- **5. Error notification for a viewer already closed** (`broken_file.nc` closed within 1 s)
- **7. An older load can overwrite a newer one** (two refreshes in a row)
- **9. Closing a viewer does not stop its running plot**
- **8. Export Webview exports the first visible panel**, not the active one, in a split
- **4. Plot All re-runs a variable already plotting**; Cancel then leaves an orphan that overwrites "Plot cancelled."
- **10. Invalid numbers silently ignored** (`vmin = 1,5`, `size = -3`)
- **11. A group checkbox left at its default cannot override a changed global checkbox**
- **12. Kerchunk error messages** — invalid JSON reported as "no 'refs' mapping"; missing target as an empty `ReferenceNotReachable()`; empty `refs` as `GroupNotFoundError`
- **13. Header icons overlap the version badge at 320 px**
- **14. Settings bounds** — `maxFileSize` 0 / -1 refuses every file; the limit silently never applies to Zarr directories; `facetgridFigsize` below its 0.1 minimum passed through

#### Hardening

- **H1. Install packages from the webview accepts uv / pip options** (`--index-url …`)
- **H2. Export with no captured HTML** fails only after the save dialog
- **H3. "Python environment not ready"** does not say whether the interpreter is missing or lacks packages
- **H4. Python < 3.10 interpreter**: the package check crashes with `TypeError: 'type' object is not subscriptable` instead of saying the interpreter is too old (found while fixing; also in v0.12.1)

#### Found while fixing

- **O1. Outline Expand All could leave an item collapsed**, noted by the end-to-end suites (also in v0.12.1). The suites first counted rejected `reveal()` calls (28 on `sample_zarr_arborescence.zarr`), which overstated it: recording what VS Code draws (`getTreeItem`) shows that almost every rejected item is drawn expanded anyway, and that one nested group of `xss_groups.nc` really stayed collapsed. Fixed: items are revealed one at a time, parents first, a failed one is retried once. No item is left collapsed on any QA file; the reveals still rejected on `sample_data_multiple_groups.nc` are drawn expanded (confirmed by hand).

#### Known limitations found while fixing (not fixed)

- **N1. Names longer than 256 bytes** (valid in HDF5, not in netCDF; written by h5netcdf): netCDF-C reads them past its `NC_MAX_NAME` limit, so the netcdf4 engine either fails (`UnicodeDecodeError`, then h5netcdf opens the file) or returns a garbled name, depending on memory contents. `info` and `plot` can then disagree ("Variable … not found", 1–4 times in 20 runs, also in v0.12.1). Upstream netCDF4-python / netCDF-C issue; work-around: put `h5netcdf` first in `scientificDataViewer.netcdfEngineOrder`. The QA plot suite skips these names.

#### Docs and release

- **D1. Golden snapshots** re-recorded; manual test plan T13 says when to re-record
- **0. Stale `.vsix`** rebuilt from the final tree; file count corrected in the release docs
- **P1. The `.vsix` holds the strict minimum**: `.vscodeignore` is an allow-list (everything excluded, each runtime file named), so nothing new is packaged by accident (`.qa/` was, as a deny-list let any new folder through); no source maps; `vscode:prepublish` deletes `out/` first. 70 files at the time (72 at release); the unpacked `.vsix` passes the VS Code suites `s1`, `s3`, `s10`
- **Release docs** updated (CHANGELOG, release notes, PR summary)

---

### What was verified to work

#### Regression (v0.12.1 vs v0.13, same interpreter)

- **`info` on 56 sample files:** every difference traces to an intended change — encoding moved out of attributes, numbers instead of numpy text, non-datetime variables (`t` in GRIB, integer `time` steps, `delta`) dropped from the time selector, corrupt files now return JSON errors (v0.12.1 crashed without JSON on 9 of them), unsuffixed / ZIP Zarr now open, `inherited_from` added (checked against the real group structure with netCDF4 / `to_dataset(inherit=False)`).
- **Default plot of every variable (145):** 133 pixel-identical, 3 newly working (unsuffixed / ZIP Zarr), 1 intended change (2-D `(time, station)` no longer a sliver), 8 failing identically in both.
- **77 option scenarios:** 49 identical; vmin / vmax now applied with slices, facets and x / y (images checked); `--no-add-colorbar` applies; robust on 1-D fixed; `col_wrap=auto`, `facetgridFigsize` and no-inherit plots now work; empty selections give "No data to plot …" instead of `ZeroDivisionError`.
- **53 hostile files:** no backend crash without JSON; v0.12.1 crashed on `attr_zoo.nc` (inf attributes), now fixed.

#### Security

- 8 hostile files (NetCDF, nested NetCDF groups, Zarr, Zarr nested JSON attributes, GeoTIFF band description / tags, unicode, `-` names, attribute zoo): every variable plotted, every section expanded, outline scroll to 40 ids each, export. **0 script executions, 0 dialogs, 0 CSP violations, 0 injected elements / `on*` attributes**; names shown as literal text.
- The exported HTML of each, opened standalone in a browser (no CSP), with every button and summary clicked: nothing executed.
- Command allowlist: only the 3 commands run; terminal / `vscode.open` / settings / case variants / `constructor` rejected. Error-page buttons all map to allowed commands.
- Plot file names: `../`, absolute, `C:\`, UNC, empty, `\..\` rejected; file names with `;$(touch PWNED)` opened and plotted, no file created (no shell).

#### Webview behaviour (headless Chromium, real input)

- **Cancel:** Create disabled + Cancel shown while running; "Plot cancelled." at once in a neutral callout; `abortPlot` carries the same operation id; the Python process is gone within 2.5 s; nothing appears afterwards; Cancel right after Create works; Create → Cancel → Create works.
- **Cancel All / Plot All:** at most 5 concurrent; Cancel All kills every process, restores the buttons, marks each card; nothing arrives later; summary "1 successful, 4 cancelled"; a single Cancel during Plot All counts as cancelled ("4 successful, 1 cancelled").
- **Slices:** `0:4:2` pasted spreads over the boxes; `1:5` typed key by key moves box to box; `2::2` → stop = size; `-1` alone = last index; ignored step struck through and not sent; stop ≤ start outlined and explained; `::-1` disables the slider and plots; `1.5` outlined and rejected clearly; out-of-range index explained; real mouse drags on both handles, including crossing.
- **Reset** per block clears only its block; col_wrap **auto** disables the number box (group and global) and Reset re-enables it; group fields override global ones field by field.
- **Time range:** only datetime variables offered (including cftime); prefilled with the data range; sent as naive ISO in Paris, New York and Tokyo time zones; bounds inclusive.
- **Load time:** local time with offset (`+05:30` in Kolkata), UTC with the setting off, updated on Refresh.
- **Layout:** cards start collapsed, encoding sections present / absent with the setting; no horizontal scroll at 420 and 320 px with everything expanded (including a 200 000-char attribute); 400-group file expands in 0.8 s (114 k DOM nodes).
- Refresh while plotting leaves consistent controls; error page for broken / text / corrupt ZIP / plain JSON / Kerchunk-without-kerchunk files.
- xarray 2024.6: "xarray 2024.6.0 is too old … pip install -U …" shown on the error page; zarr 2.18: Zarr v3 stores report `zarr>=3` missing, NetCDF still works.

#### Extension host (real VS Code)

- `npm test`: **311 passing**, 0 failing. pytest: 175 passed. `npm run typecheck`, `npm run compile`, `generate.py --check`: pass.
- 74/74 open scenarios across every format and both open commands (folder command for unsuffixed Zarr, `.zip` via the context command); every broken file ends in a clean error state, nothing hangs; 20 files opened in 3.7 s.
- Kerchunk: inline, `.ref.json`, Open as Kerchunk on plain JSON (second tab), `package.json` rejected; relative / `./` / `../` / absolute / `file://` references plot from any cwd.
- Settings: engine order (incl. `[]`, bogus, scipy fallback, not applied to `.cdf`), inherited coordinates, encoding, group order, `maxFileSize`, `facetgridFigsize`, bands, plot timeout clamping (500 / -1 / "abc" → 20 000; 1e9 → 600 000).
- Outline built for 491- and 1 915-item trees, cleared on normal close, follows the active panel.
- Sample generation: two runs from scratch exit 0 and produce 2 669 identical files except `compound_dtype_variable.nc` (HDF5 header timestamp, as documented).

#### Automated suites

`python python/tools/golden_snapshots.py check` reports 46 / 82 failing locally; all are `info` cases: 33 differ only by the intended encoding move, 13 also by empty `encoding: {}` fields; all plot cases pass. The snapshots (`python/.golden/`, gitignored) predate the encoding commit: re-record them. Manual test plan §13 ("expect 0 failing") will mislead a tester until then.

---

### Not covered

- Windows paths and behaviour (only the rejection of `C:\` / UNC names was checked on Linux).
- The uv environment rebuild (`ENVIRONMENT_REVISION`), to avoid touching the real environment (`scripts/upgrade-sandbox.sh` exists for it).
- High-contrast themes visually (CSS variables only checked in Dark Modern / Light Modern screenshots).
- Remote (SSH / WSL) hosts.

### Evidence

The harnesses are versioned in [`scripts/qa/`](../../scripts/qa/README.md) and write to the git-ignored `.qa/`:

- `scripts/qa/fixtures/make_fixtures.py` — the hostile fixtures above.
- `scripts/qa/backend/` — `diff_info.py`, `diff_plot.py`, `diff_scen.py` against a baseline checkout (`make_baseline.sh v0.12.1`).
- `scripts/qa/webview/` — the page harness (`harness.mjs`) and the scenarios (`render`, `controls`, `time`, `cancel`); screenshots and exported pages in `.qa/webview/`.
- `scripts/qa/e2e/` — the VS Code suites (`s1`…`s11`); results in `.qa/e2e/runs/<run>/results.json` and `extension.log`.

The scenarios that reproduced a finding now check its fix, so they fail on the code this report describes.

---

## 3. Release review

A last review of the code and docs before publishing (2026-11-05), done while the manual test plan ran. One commit per item; the status gives the commit subject. ☑ done, ✗ not changed (reason). User-facing summary: [release notes § Release review](../RELEASE_NOTES_0.13.0.md#release-review); manual check: [manual test plan T36](./MANUAL_TEST_PLAN_0.13.0.md#t36-release-review-fixes).

### 1. Docs cleanup

| #   | Issue                                                                                                                                                              | Status                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| D1  | 0.13.0 date still the feature-work date (2026-09-15); duplicate §25 / §26 in the release notes; `.vsix` count 70 vs 72; stale size figures; commit list incomplete | ☑ `docs: pre-release cleanup of the 0.13.0 docs` |
| D2  | Docs describing removed code, unreferenced notes and notebooks deleted; historical docs moved to `docs/archive/`                                                   | ☑ same commit                                    |

### 2. Code issues

| #   | Issue                                                                                                                                                                                                                              | Status                                                                                                                                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Webview requests time out after 60 s: a slow **refresh**, a package install (`executeCommand`), or a **Save As** / **Export** dialog left open showed "Request timeout" while the work then completed (`src/panel/webview/bus.ts`) | ☑ `fix(webview): no request timeout on refresh, installs and save dialogs`                                                                                                                                                                                                        |
| C2  | Package installs into the extension's own environment skip the queue of create / update / recreate / delete (`PythonManager.installPackages`)                                                                                      | ☑ `fix(python): queue package installs behind environment rebuilds`                                                                                                                                                                                                               |
| C3  | `deactivate` aborts only plot processes; a running info process is not killed                                                                                                                                                      | ☑ `fix(python): stop info runs too when the extension deactivates`                                                                                                                                                                                                                |
| C4  | `DataViewerPanel.disposePanel` sets `_isDisposed` last, and the `onDidDispose` subscription is not disposed                                                                                                                        | ☑ `fix(panel): mark the panel disposed before tearing it down`                                                                                                                                                                                                                    |
| C5  | A settings change touching both `overridePythonInterpreter` and `useExtensionOwnEnvironment` handles only the first (`extension.ts` `if / else if`)                                                                                | ☑ `fix(config): handle both interpreter settings changed in one save`                                                                                                                                                                                                             |
| C6  | A cancelled **Export** answers `success: true` with an error text, unlike **Save As** (`UIController.handleExportWebview`)                                                                                                         | ☑ `fix(panel): report a cancelled save dialog as cancelled`                                                                                                                                                                                                                       |
| C7  | Process output decoded chunk by chunk: a multi-byte character split between two chunks is corrupted in the logs (`runProcess`)                                                                                                     | ☑ `fix(process): decode process output as UTF-8 streams`                                                                                                                                                                                                                          |
| C8  | `create_plot`: `file_format_info` unbound in the `except` if format detection raises (`python/sdv_backend/plotting/api.py`)                                                                                                        | ☑ `fix(plot): report format detection errors instead of UnboundLocalError`                                                                                                                                                                                                        |
| C9  | A missing or unreadable `.zip` is reported as "not a Zarr store" instead of "file not found" (`python/sdv_backend/info/extract.py`)                                                                                                | ☑ `fix(info): report a missing .zip as file not found`                                                                                                                                                                                                                            |
| C10 | Python floors look inconsistent: runtime gate 3.10, `ALL_REQUIREMENTS` `xarray>=2026.4.0` (needs 3.11), `python/pyproject.toml` `xarray>=2024.10` and `requires-python >= 3.13`, `CLAUDE.md` "Python 3.13+"                        | ✗ not a bug: 3.10 + xarray ≥ 2024.10 is the deliberate floor for users' own interpreters (`UPGRADE_TEST_PLAN.md`); `xarray>=2026.4.0` is only for the uv env. Floors stated in `CLAUDE.md` / `DEVELOPMENT.md` (`docs: state the Python floors of the backend and of development`) |
| C11 | Dead code: `scientificDataViewer.defaultView` (declared "currently unused"), `DataViewerPanel.getExtensionUri`, `getPanelsWithErrorsCount`, unused `param` of `isPlotParameterSet`, two leftover TODOs                             | ☑ `refactor: remove the unused defaultView setting and dead code`                                                                                                                                                                                                                 |
| C12 | `activationEvents`: `onFileSystem:*` entries do nothing (no file system provider); `onLanguage:*` are implicit since VS Code 1.74                                                                                                  | ☑ `chore(manifest): drop activation events that can never fire` (`onLanguage:*` kept: redundant but harmless, no activation change before release)                                                                                                                                |
| C13 | Unused devDependencies `husky`, `lint-staged`, `@types/glob`                                                                                                                                                                       | ☑ `chore(deps): remove unused husky, lint-staged and @types/glob`                                                                                                                                                                                                                 |
| C14 | CI: `pr-validation.yml` concurrency group is `pr-` on pushes, so pushes to `main` and `develop` cancel each other                                                                                                                  | ☑ `fix(ci): do not let pushes to main and develop cancel each other`                                                                                                                                                                                                              |
| C15 | CI: pull requests never run the Python tests (only paranoia does)                                                                                                                                                                  | ☑ `ci: run the Python backend tests on pull requests`                                                                                                                                                                                                                             |
| C16 | `setup.sh` installs with global `pip3` and creates no `.venv`, while `paranoia.sh` and `publish.sh` say the `.venv` comes from it                                                                                                  | ☑ `fix(setup): create the .venv from requirements-dev.txt and run all Python tests` (syntax checked, not run end to end)                                                                                                                                                          |

### 3. Overlaps

| #   | Overlap                                                                                                                                                   | Status                                                                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | `QA_REPORT_0.13.0.md` and `QA_FIXES_0.13.0.md` list the same 14 findings                                                                                  | ☑ `docs: merge the code review, QA report and QA fixes into one reviews doc`                                                                                                     |
| O2  | `CODE_REVIEW_TODO.md` is fully checked; its content is in the release notes §16–§19 and the CHANGELOG                                                     | ☑ same commit (§ Code review of `REVIEWS_0.13.0.md`)                                                                                                                             |
| O3  | The upgrade test is described in four places (`UPGRADE_TEST_PLAN`, manual test plan B20, release notes §15, `GETTING_STARTED` § 2)                        | ☑ `docs: link the upgrade test steps instead of repeating them` (the only real copy was release notes §15; `GETTING_STARTED` § 2 and B20 already linked)                         |
| O4  | `RELEASE_NOTES_0.13.0.md` (~1,090 lines) mixes user notes with the contributor verification guide (§0–§35), paranoia and architecture diagrams            | ☑ `docs: move the technical verification guide into the manual test plan` (release notes 1,090 → 560 lines; steps renamed T0–T35)                                                |
| O5  | Tooling: `golden_snapshots.py` (vs last release) and `make_baseline.sh` + `diff_info.py` / `diff_plot.py` compare the backend with the same release twice | ☑ `chore(tooling): one checkout of the last release, issue #117 cases in diff_scen` (golden kept: it reuses the QA baseline checkout; its N/A handling of unknown options stays) |
| O6  | Tooling: `non_regression_test_plot.py` (images, no comparison) overlaps `diff_scen.py` (scenarios compared to the baseline)                               | ☑ same commit: `diff_scen.py` imports the gallery cases (`i117_*`), the `non-regression` paranoia step is gone; the gallery script stays for visual review                       |
| O7  | Tooling: the screenshots script and the webview QA harness each have their own Chrome finder and DevTools client                                          | ☑ `chore(tooling): share the headless Chrome code of screenshots and webview QA`                                                                                                 |
| O8  | `TO_REMOVE.md` R5: alignment comment next to `SupportedExtensionType` never added                                                                         | ☑ `test(backend): check the format list against the custom editors` (comment plus a test, so drift fails CI)                                                                     |
