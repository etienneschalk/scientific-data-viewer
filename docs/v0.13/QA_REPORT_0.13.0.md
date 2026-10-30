# QA report — v0.13.0 release candidate

Branch `eschalk/backend-package` @ `1f8bf6d` · 2026-10-29 · exploratory + automated adversarial testing. This report describes the state before the fixes; each finding's fix is tracked in [`QA_FIXES_0.13.0.md`](./QA_FIXES_0.13.0.md).

## Verdict

No regression was found in what the viewer reads or plots: every sample file gives the same data as v0.12.1 and the default plots are pixel-identical. The security fix holds against every injection attempt. **One release blocker** (the `.vsix` on disk is stale) and **13 bugs** were found, none critical. Most are pre-existing; four are new in v0.13 or incomplete v0.13 fixes (marked **v0.13**).

| #   | Severity    | Finding                                                                                                      | Origin                   |
| --- | ----------- | ------------------------------------------------------------------------------------------------------------ | ------------------------ |
| 0   | **Blocker** | `scientific-data-viewer-0.13.0.vsix` on disk predates 25 commits (246 files, old ignore rules)               | packaging                |
| 1   | Medium      | vmin / vmax of magnitude < 1e-6 or ≥ 1e21 (negative) break the plot                                          | pre-existing             |
| 2   | Medium      | Closing a viewer while it loads leaves its outline (and cache) behind                                        | **v0.13** fix incomplete |
| 3   | Low–medium  | `NaN` / `inf` shown as `np.float64(nan)` / `np.float64(inf)`                                                 | **v0.13** regression     |
| 4   | Low–medium  | Plot All re-runs a variable already plotting; Cancel then leaves an orphan that overwrites "Plot cancelled." | **v0.13** feature gap    |
| 5   | Low–medium  | Error notification for a viewer already closed                                                               | **v0.13** (likely)       |
| 6   | Low         | Values starting with `-` (dimension names, `matplotlibStyle`) read as CLI options                            | pre-existing             |
| 7   | Low         | An older load can overwrite a newer one (refresh race)                                                       | pre-existing             |
| 8   | Low         | Export Webview exports the first visible panel, not the active one                                           | pre-existing             |
| 9   | Low         | Closing a viewer does not stop its running plot                                                              | pre-existing             |
| 10  | Low (UX)    | Invalid numbers (`1,5`, `-3` for size) silently ignored                                                      | pre-existing             |
| 11  | Low (UX)    | Group checkbox left at default cannot override a changed global checkbox                                     | design (documented)      |
| 12  | Low         | Kerchunk messages: invalid JSON → "no 'refs' mapping"; missing target → empty `ReferenceNotReachable()`      | v0.13 feature            |
| 13  | Low         | Header icons overlap the version badge at 320 px                                                             | **v0.13** styling        |
| 14  | Low         | Settings bounds: `maxFileSize` 0 / -1 refuses everything; never applies to Zarr directories                  | pre-existing             |

Notes, not bugs: the default plot of `sample-data/sample_data.nc` (365 facets) always exceeds the 20 s default timeout (same in v0.12.1); plotting cftime axes needs `nc-time-axis` (documented); the local golden snapshots are stale (§ Automated suites).

---

## How the testing was done

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

## 0. Blocker — stale `.vsix` on disk

- `scientific-data-viewer-0.13.0.vsix` was built 2026-10-29 12:25; 25 commits are newer (HEAD 19:53).
- It holds **246 files** with the old ignore rules (45 `docs/` entries, `.github/`, `.pytest_cache/`, `publish.sh`, `python/sample_data/`, notebooks, screenshots). It **lacks** `out/src/shared/icons.js` and `out/src/shared/time.js`; its `webview.js`, `styles.css`, `package.json`, 5 host files and 11 backend files differ from HEAD.
- `npx vsce ls` at HEAD gives **100 files** with every runtime file present; that exact set runs correctly as the extension (96/96 E2E checks, backend from the packaged copy).
- **Action:** rebuild with `npm run package` before publishing. Doc nit: release notes, CHANGELOG and PR summary say 98 files (now 100).

## 1. Medium — small or huge negative vmin / vmax break the plot (pre-existing)

**Repro (UI):** open `sample-data/sample_data.netcdf`, Group Plot Controls → slice `time` start `0`, vmin `-0.0000001` (or `-1e-7`), Create Plot.

**Observed:** `Error creating plot: get_data_info.py: error: argument --vmin: expected one argument`.

**Cause:** the webview parses the box to a number; `buildCreatePlotCliArgs` (`src/python/DataProcessor.ts:143-148`) passes `String(value)`, which JS writes in exponent notation for |x| < 1e-6 or ≥ 1e21 (`-1e-7`, `-1e+21`). argparse only treats `-1`, `-0.5` style strings as negative numbers, so `-1e-7` is read as an option and the backend exits 2 with no JSON. `-0.5` and `1e-7` work. Data in SI flux units (kg m⁻² s⁻¹ …) routinely needs such bounds.

**Proof:** `qa/logs/ui_controls.txt` (UI), `qa/logs/scen.txt` case `vmin_neg_sci` (fails identically in v0.12.1), E2E `s3/results.json`. Suggested direction: `--vmin=<value>` form.

## 2. Medium — closing a viewer while it loads leaves a ghost outline (v0.13 fix incomplete)

**Repro:** open `sample-data/sample_data_multiple_groups.nc` and close the tab before it finishes loading (~1 s).

**Observed:** once the load ends, 0 panels are open but the Explorer **Data Structure** outline shows the closed file's tree (`outlineCurrent=5` = the closed panel; its headers stay cached). After 15 rapid open/close cycles, 16 cache entries leak and the outline shows closed panel 22.

**Cause:** `UIController.loadFile` has no disposed guard; after `disposePanel()` cleared the outline, the in-flight load calls `onOutlineUpdateCallback` → `DataViewerPanel.updateOutline()` → `OutlineProvider.updateHeaders(closedId)` (`src/DataViewerPanel.ts:264-268, 327-341`).

**Expected:** release notes §18.8 "Close the viewer → the outline is cleared" (true when closed after load). **Proof:** E2E `s8/results.json` ("dispose during load", "rapid open/close"); code path read and confirmed.

## 3. Low–medium — `NaN` / `inf` displayed as `np.float64(nan)` / `np.float64(inf)` (v0.13)

**Repro:** open any xarray-written float file, e.g. `sample-data/sample_data.nc`, expand a coordinate → Xarray Encoding → `_FillValue : np.float64(nan)`. An attribute `valid_max = inf` shows `np.float64(inf)`.

- **Regression:** v0.12.1 showed `_FillValue` as `nan`. Affects **18 of the 55** sample files.
- Contradicts release notes §19.2 / manual test plan ("the attribute shows `inf`"). Inconsistent: float32 `inf` shows `inf`, float64 shows `np.float64(inf)`; arrays show `[0.1,"nan","inf"]` with quotes.
- **Cause:** `sanitize_non_finite` (`python/sdv_backend/serialization.py:22-23`) uses `repr()`, and `np.float64` is a `float` subclass; `python/tests/test_serialization.py:33` asserts this output.
- **Proof:** DOM `<span class="attribute-value" title="np.float64(inf)">np.float64(inf)</span>` (`qa/ui/t_inf.mjs`); `grep` over the info JSON of v0.12.1 vs v0.13 (`qa/info_uv/`).

## 4. Low–medium — Plot All re-runs a variable that is already plotting (v0.13 Cancel feature)

**Repro:** with a slow variable (a ~20 s plot): **Create Plot** on it, then **Plot All** while it runs, then **Cancel** on that variable.

**Observed:**

1. Two `createPlot` requests and two Python processes for the same variable (the release notes say Create Plot is disabled so "a second click" cannot start a second process; Plot All bypasses that).
2. Cancel aborts only the second one (`runningPlots` keeps the latest operation id), shows "Plot cancelled.".
3. The orphaned first run keeps going and, ~20 s later, replaces "Plot cancelled." with `Error creating plot: Plot request timeout … (>20s)`. Had it finished in time, its image would have appeared after the user cancelled — contradicting "the response of a cancelled plot is ignored".

**Proof:** `qa/logs/ui_cancel.txt`, scenario 2 (creates `plot-…2cugykt` and `plot-…oztf6p3`, one abort, final state an error).

Everything else about Cancel passed (below).

## 5. Low–medium — error notification for a viewer already closed

**Repro:** open `sample-data/broken_file.nc` and close it within ~1 s.

**Observed:** a VS Code error toast `Scientific Data Viewer Error: cannot mmap an empty file` for a tab that no longer exists. `UIController.dispose()` unregisters the panel's ErrorBoundary handler, so the late failure goes to the global handler (`src/extension.ts:72-77`). **Proof:** E2E `s8/results.json` (`popups`).

## 6. Low — values starting with `-` are read as CLI options (pre-existing)

A dimension named `-x` chosen as x / y / hue / row / col (`get_data_info.py: error: argument --plot-x: expected one argument`), or `matplotlibStyle` set to `-x`. Variable names starting with `-` are fine (always sent as `/…`), as are slices (JSON). Same root cause as #1. **Proof:** `qa/adv/dash_names.zarr`, E2E `s3`, `s6`.

## 7. Low — an older load can overwrite a newer one (pre-existing)

Refresh, then change `maxFileSize` to 1 and Refresh again within ~0.5 s: the second load fails at once, the first one finishes last, and the viewer ends showing data the current settings refuse (events `error`, then `dataLoaded`). `UIController.loadFile` has no sequence guard. **Proof:** E2E `s8` ("stale load race").

## 8. Low — Export Webview exports the wrong panel in a split (pre-existing)

Two viewers side by side, focus the right one, run **Export Webview Content**: the save dialog proposes the left file. `DataViewerPanel.getActivePanel()` (`src/DataViewerPanel.ts:70-82`) returns the first `visible` panel, not the `active` one. **Proof:** E2E `s11`; code read.

## 9. Low — closing a viewer does not stop its plot (pre-existing)

With `plotTimeoutMs=600000`, a running plot's Python process survives the viewer for up to 10 minutes (it dies at the timeout, or on VS Code shutdown). `abortAllProcesses` mentions panel disposal in its doc but nothing calls it there. **Proof:** E2E `s3`.

## 10. Low (UX) — invalid numbers silently ignored (pre-existing)

`vmin = 1,5` (decimal comma) or `size = -3`: no red outline, no message; the plot is created as if the box were empty. (Slice boxes do outline invalid input in red.) **Proof:** `qa/logs/ui_controls.txt`.

## 11. Low (UX) — group checkbox cannot override a changed global checkbox (documented design)

Global `add_colorbar` unchecked, group `add_colorbar` left checked: the plot has no colorbar while the group control shows it checked. Same for `robust`, `xincrease`, `yincrease`, `add_legend`. This matches the release notes ("a group checkbox left at its default uses the global value") but is confusing; a tri-state or "inherit" marker would make it visible. Global dimension slices are likewise dropped entirely when the group has any slice (documented).

## 12. Low — Kerchunk error messages

- `{not json` in a `.kerchunk.json` → "This file is not a Kerchunk / virtual Zarr reference (no 'refs' mapping)." (release notes promise a clear invalid-JSON message).
- Reference to a missing data file: File Information opens, plotting fails with `Error creating plot: ReferenceNotReachable()` and no path.
- Empty `refs` → `GroupNotFoundError … ReferenceFileSystem`.

## 13. Low — header overlap at 320 px

At 320 px the export / collapse icons are drawn over the `v0.13.0` badge. 420 px (the width in the test plan) is fine, with no horizontal scroll at 420 or 320. **Proof:** `qa/img/header_narrow.png`.

## 14. Low — settings bounds (pre-existing)

`maxFileSize` 0 or -1 refuses every file ("Maximum allowed: 0MB"; no schema minimum); the limit never applies to Zarr directories (directory inode size); `facetgridFigsize [1e-9, 1e-9]` is passed through although the schema minimum is 0.1.

## Hardening observations

- `executeCommand('scientificDataViewer.python.installPackages', [['--index-url', 'http://…', …]])` from the webview is forwarded to `uv pip install` as options. Only exploitable with script execution in the webview, which the CSP and escaping prevent (see below). Validating package names would close it.
- `exportWebview` with `htmlContent: null` (webview capture failure) errors after the user has picked a file.
- Wrong interpreter path and an interpreter without xarray both give the same vague "Python environment not ready".

---

## What was verified to work

### Regression (v0.12.1 vs v0.13, same interpreter)

- **`info` on 56 sample files:** every difference traces to an intended change — encoding moved out of attributes, numbers instead of numpy text, non-datetime variables (`t` in GRIB, integer `time` steps, `delta`) dropped from the time selector, corrupt files now return JSON errors (v0.12.1 crashed without JSON on 9 of them), unsuffixed / ZIP Zarr now open, `inherited_from` added (checked against the real group structure with netCDF4 / `to_dataset(inherit=False)`).
- **Default plot of every variable (145):** 133 pixel-identical, 3 newly working (unsuffixed / ZIP Zarr), 1 intended change (2-D `(time, station)` no longer a sliver), 8 failing identically in both.
- **77 option scenarios:** 49 identical; vmin / vmax now applied with slices, facets and x / y (images checked); `--no-add-colorbar` applies; robust on 1-D fixed; `col_wrap=auto`, `facetgridFigsize` and no-inherit plots now work; empty selections give "No data to plot …" instead of `ZeroDivisionError`.
- **53 hostile files:** no backend crash without JSON; v0.12.1 crashed on `attr_zoo.nc` (inf attributes), now fixed.

### Security

- 8 hostile files (NetCDF, nested NetCDF groups, Zarr, Zarr nested JSON attributes, GeoTIFF band description / tags, unicode, `-` names, attribute zoo): every variable plotted, every section expanded, outline scroll to 40 ids each, export. **0 script executions, 0 dialogs, 0 CSP violations, 0 injected elements / `on*` attributes**; names shown as literal text.
- The exported HTML of each, opened standalone in a browser (no CSP), with every button and summary clicked: nothing executed.
- Command allowlist: only the 3 commands run; terminal / `vscode.open` / settings / case variants / `constructor` rejected. Error-page buttons all map to allowed commands.
- Plot file names: `../`, absolute, `C:\`, UNC, empty, `\..\` rejected; file names with `;$(touch PWNED)` opened and plotted, no file created (no shell).

### Webview behaviour (headless Chromium, real input)

- **Cancel:** Create disabled + Cancel shown while running; "Plot cancelled." at once in a neutral callout; `abortPlot` carries the same operation id; the Python process is gone within 2.5 s; nothing appears afterwards; Cancel right after Create works; Create → Cancel → Create works.
- **Cancel All / Plot All:** at most 5 concurrent; Cancel All kills every process, restores the buttons, marks each card; nothing arrives later; summary "1 successful, 4 cancelled"; a single Cancel during Plot All counts as cancelled ("4 successful, 1 cancelled").
- **Slices:** `0:4:2` pasted spreads over the boxes; `1:5` typed key by key moves box to box; `2::2` → stop = size; `-1` alone = last index; ignored step struck through and not sent; stop ≤ start outlined and explained; `::-1` disables the slider and plots; `1.5` outlined and rejected clearly; out-of-range index explained; real mouse drags on both handles, including crossing.
- **Reset** per block clears only its block; col_wrap **auto** disables the number box (group and global) and Reset re-enables it; group fields override global ones field by field.
- **Time range:** only datetime variables offered (including cftime); prefilled with the data range; sent as naive ISO in Paris, New York and Tokyo time zones; bounds inclusive.
- **Load time:** local time with offset (`+05:30` in Kolkata), UTC with the setting off, updated on Refresh.
- **Layout:** cards start collapsed, encoding sections present / absent with the setting; no horizontal scroll at 420 and 320 px with everything expanded (including a 200 000-char attribute); 400-group file expands in 0.8 s (114 k DOM nodes).
- Refresh while plotting leaves consistent controls; error page for broken / text / corrupt ZIP / plain JSON / Kerchunk-without-kerchunk files.
- xarray 2024.6: "xarray 2024.6.0 is too old … pip install -U …" shown on the error page; zarr 2.18: Zarr v3 stores report `zarr>=3` missing, NetCDF still works.

### Extension host (real VS Code)

- `npm test`: **311 passing**, 0 failing. pytest: 175 passed. `npm run typecheck`, `npm run compile`, `generate.py --check`: pass.
- 74/74 open scenarios across every format and both open commands (folder command for unsuffixed Zarr, `.zip` via the context command); every broken file ends in a clean error state, nothing hangs; 20 files opened in 3.7 s.
- Kerchunk: inline, `.ref.json`, Open as Kerchunk on plain JSON (second tab), `package.json` rejected; relative / `./` / `../` / absolute / `file://` references plot from any cwd.
- Settings: engine order (incl. `[]`, bogus, scipy fallback, not applied to `.cdf`), inherited coordinates, encoding, group order, `maxFileSize`, `facetgridFigsize`, bands, plot timeout clamping (500 / -1 / "abc" → 20 000; 1e9 → 600 000).
- Outline built for 491- and 1 915-item trees, cleared on normal close, follows the active panel.
- Sample generation: two runs from scratch exit 0 and produce 2 669 identical files except `compound_dtype_variable.nc` (HDF5 header timestamp, as documented).

### Automated suites

`python python/tools/golden_snapshots.py check` reports 46 / 82 failing locally; all are `info` cases: 33 differ only by the intended encoding move, 13 also by empty `encoding: {}` fields; all plot cases pass. The snapshots (`python/.golden/`, gitignored) predate the encoding commit: re-record them. Manual test plan §13 ("expect 0 failing") will mislead a tester until then.

---

## Not covered

- Windows paths and behaviour (only the rejection of `C:\` / UNC names was checked on Linux).
- The uv environment rebuild (`ENVIRONMENT_REVISION`), to avoid touching the real environment (`scripts/upgrade-sandbox.sh` exists for it).
- High-contrast themes visually (CSS variables only checked in Dark Modern / Light Modern screenshots).
- Remote (SSH / WSL) hosts.

## Evidence

The harnesses are versioned in [`scripts/qa/`](../../scripts/qa/README.md) and write to the git-ignored `.qa/`:

- `scripts/qa/fixtures/make_fixtures.py` — the hostile fixtures above.
- `scripts/qa/backend/` — `diff_info.py`, `diff_plot.py`, `diff_scen.py` against a baseline checkout (`make_baseline.sh v0.12.1`).
- `scripts/qa/webview/` — the page harness (`harness.mjs`) and the scenarios (`render`, `controls`, `time`, `cancel`); screenshots and exported pages in `.qa/webview/`.
- `scripts/qa/e2e/` — the VS Code suites (`s1`…`s11`); results in `.qa/e2e/runs/<run>/results.json` and `extension.log`.

The scenarios that reproduced a finding now check its fix, so they fail on the code this report describes.
