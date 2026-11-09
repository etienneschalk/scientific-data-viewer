# Scientific Data Viewer v0.13.0 Release Notes

**TL;DR** — Aligns with **xarray 2026.4+** and **zarr-python 3**: better Zarr discovery (unsuffixed dirs, ZIP archives, v3 encoding metadata), NetCDF/DataTree quality settings, experimental **Kerchunk** references, **COG** labelling, and plot extras (`col_wrap='auto'`, `facetgridFigsize`). Removes stale **Sentinel-1 SAFE** claims from the UI. Internally, the Python backend is restructured from one 3,700-line script into the **`sdv_backend`** package (no user-visible behaviour change), and sample data generation becomes a reproducible package with **`--overwrite`**. A full **code review** pass fixes a security issue (HTML injection from file metadata → arbitrary VS Code commands), uv installs that silently dropped version pins, broken **Open as Kerchunk**, Windows save paths, several backend crashes, and removes a large amount of dead or duplicated code (webview rewritten as bundled TypeScript modules). The viewer also gets a **modern, VS Code-native look** (rounded cards, wider gutters, icon toolbar, consistent form controls), and the unused one-option **plot type selector** ("Auto (Recommended)") is removed. The **xarray encoding** moves out of the attributes into its own collapsed **Xarray Encoding** section, and each variable becomes a card with collapsible **Attributes**, **Xarray Encoding** and **Plot** sections. A running plot can be **cancelled on its own**, next to its **Create Plot** button. The **Loaded:** time at the top right is now shown in **local time** (new setting `showLoadTimeInLocalTime`, on by default). A final **QA pass** (adversarial, differential and end-to-end testing; tools kept in `scripts/qa/`) found no regression in what is read or plotted and fixed 20 issues: small negative **vmin / vmax** (`-1e-7`) that broke the plot, `np.float64(nan)` shown for `NaN`, viewers closed while loading that left their outline or kept plotting, Plot All re-running a running plot, numbers typed wrong silently ignored, group checkboxes that could not override the global ones, unclear Kerchunk and Python-environment errors (see [§ QA pass](#qa-pass)). Finally, **plots keep their automatic layout when you change one control**: slicing a dimension, or setting only `col_wrap`, `x` or `row`, used to switch the whole plot to manual (slicing `lat` of a `(time, lat, lon)` variable gave a histogram); now every empty control is still chosen automatically, the **controls you changed are outlined**, and a line under each plot shows what was set by you and what was chosen (see [§ Progressive plot layout](#progressive-plot-layout), and [`docs/PLOTTING.md`](./PLOTTING.md) for the whole mechanism). The little-used **Time Controls** (datetime range, off by default) are removed with their two settings: **Dimension Slices** subset time by index (see [§ Time Controls removed](#time-controls-removed)). The **Marketplace page** is refreshed: display name with the main formats, so a search for "netcdf" finds the extension, and v0.13 screenshots instead of v0.3.0 ones (see [§ Marketplace listing](#marketplace-listing)). For contributors, **`./paranoia.sh`** runs every automated check before a release and writes a readiness report (see [§ Paranoia](#paranoia-every-check-before-a-release)).

**Start here** to review, test or release v0.13: [`docs/v0.13/GETTING_STARTED.md`](./v0.13/GETTING_STARTED.md). **Planning docs** (what shipped vs deferred): [`docs/v0.13/`](./v0.13/README.md)

---

## Why this release?

v0.13 is a **technology alignment** release. xarray **2026.04.0** raised its minimum **zarr** to **3.x** and added DataTree/plotting improvements the extension now surfaces. The viewer stays **metadata-first** (no Dask clusters, no cloud auth, no write/convert pipelines).

| Area                  | What v0.13 adds                                                                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zarr 3 stack**      | Pins `xarray>=2026.4.0`, `zarr>=3` in the optional uv env (rebuilt automatically on update); rejects zarr 2.x as “too old”                                                                   |
| **Zarr UX**           | Opens stores **without** a `.zarr` suffix; **ZIP** archives; **v2/v3** format label and codec/shard encoding in attribute tables                                                             |
| **NetCDF / DataTree** | Configurable **engine order**; **HDF5 filter** metadata; **inherited coordinates** on child groups                                                                                           |
| **Virtual Zarr**      | Experimental **Kerchunk** JSON (named patterns + context menu)                                                                                                                               |
| **Rasters**           | **COG** label in File Information after rasterio open                                                                                                                                        |
| **Plots**             | **`col_wrap='auto'`** checkbox; **`facetgridFigsize`** workspace setting; **Cancel** button for a single plot (see [§ Cancel a single plot](#cancel-a-single-plot))                          |
| **Honesty**           | **`.safe`** removed from explorer menus/keywords (was never implemented)                                                                                                                     |
| **Code review**       | Security fix (escaping, CSP, command allowlist); uv pins; Kerchunk; Windows paths; backend robustness; dead code removed (see [§ Code review fixes](#code-review-fixes))                     |
| **Look and feel**     | Restyled to match current VS Code: rounded cards, wider gutters, icon toolbar, twisties, consistent inputs (see [§ Viewer styling](#viewer-styling-refresh))                                 |
| **Variables**         | Xarray encoding in its own collapsed section; variable and group cards with collapsible sections (see [§ Xarray Encoding](#xarray-encoding-section))                                         |
| **Plot controls**     | Aligned fields sorted in Facets / Axes / Color / Figure, Reset per block; slices as start : stop : step boxes with a two-handle slider (see [§ Plot controls layout](#plot-controls-layout)) |
| **Plot layout**       | One control changed keeps the automatic choice of the others; changed controls outlined; layout line under each plot (see [§ Progressive plot layout](#progressive-plot-layout))             |
| **Maintainability**   | Python backend split into the **`sdv_backend`** package; sample generators into **`sample_data`** (see [§ Backend restructuring](#python-backend-restructuring))                             |
| **Contributors**      | Architecture diagrams generated from the code in `docs/architecture/` (see [§ Architecture diagrams](#architecture-diagrams))                                                                |
| **Time Controls**     | Removed (off by default, little tested); **Dimension Slices** subset time; two settings gone (see [§ Time Controls removed](#time-controls-removed))                                         |
| **QA pass**           | 20 fixes from adversarial / differential / end-to-end testing; harnesses in `scripts/qa/` (see [§ QA pass](#qa-pass))                                                                        |

**Not in v0.13:** OME-Zarr, NWB, FITS, pyfive fallback, HDF4 `.hdf`, Sentinel SAFE re-implementation, STAC/OPeNDAP/Icechunk UX. See [`docs/v0.13/OUT_OF_SCOPE.md`](./v0.13/OUT_OF_SCOPE.md).

---

## Upgrade notes (read before updating)

### Python / zarr version

- **xarray ≥ 2026.4.0 requires zarr-python ≥ 3.0.** If your interpreter still has **zarr 2.x**, the extension reports it as unusable and suggests `zarr>=3`.
- **Zarr v2 data** on disk remains readable through **zarr-python 3**; you do not need to rewrite stores for metadata viewing.
- **Extension uv environment (automatic):** if you use **Scientific Data Viewer → Use Extension Own Environment**, nothing to do. At the first start of v0.13 the extension **deletes its environment and builds it again from scratch** with the new pins (`xarray>=2026.4.0`, `h5netcdf>=1.8`, `zarr>=3`, `eccodeslib<2.48`), showing a progress notification. It needs network access and takes a few minutes. If that fails (e.g. offline), the previous environment is restored and keeps working, and the rebuild is retried at the next start; **Manage Extension Virtual Environment → Recreate** forces it. If the extension is stuck after the update, see **Troubleshooting → The extension stopped working after an update** in the README.
- **eccodeslib pin:** the uv environment also pins `eccodeslib<2.48` (`ENVIRONMENT_REVISION` 2): eccodeslib 2.48+ crashes the Python process at exit when pyproj is also loaded (`free(): invalid pointer` / `double free or corruption` on GRIB and TIFF files). Environments that already received a newer release are rebuilt at the next start. On your own interpreter, if you see these errors: `pip install "eccodeslib<2.48"`.
- **Your own interpreter (manual):** if the extension uses the **Python extension's** selected interpreter or **`overridePythonInterpreter`**, the extension never modifies it. Upgrade it yourself:

  ```bash
  pip install --upgrade "xarray>=2026.4.0" "zarr>=3" "h5netcdf>=1.8"
  ```

### Kerchunk is optional

- **Kerchunk** is **not** installed in the default uv bundle. Install manually: `pip install kerchunk` (plus its dependencies, e.g. `fsspec`) in the interpreter the extension uses.
- Ordinary **`.json`** files are **not** registered as custom editors. Only `*.kerchunk.json`, `*.ref.json`, or the explicit **Open as Kerchunk / virtual Zarr** command opt in.

### Settings that need **Refresh** (🔄)

After toggling these, use the viewer **Refresh** control (or reopen the file):

- `scientificDataViewer.netcdfEngineOrder`
- `scientificDataViewer.showInheritedCoordinates`
- `scientificDataViewer.orderGroupsAlphabetically`
- `scientificDataViewer.showXarrayEncodingAttributes`

### Time Controls removed

- The settings `scientificDataViewer.globalTimeControls` and `scientificDataViewer.groupTimeControls` no longer exist. If you set them, the line stays in `settings.json`, greyed out as _Unknown Configuration Setting_, and is ignored: delete it when convenient. Subset time with **Dimension Slices** (e.g. `0:24:2`). See [§ Time Controls removed](#time-controls-removed).

### Outline / sidebar

- Kerchunk editor id **`kerchunkEditor`** is included in outline `when` clauses (same as other custom editors).

### Code review changes visible to users

- **Exported HTML** keeps the slice widgets frozen: sliders no longer move, the red outline of an empty selection is kept, and the Reset buttons are hidden.
- **vmin / vmax** now apply when a dimension slice, a facet or x / y / hue is set (they were silently dropped unless a `cmap` was given); unchecking **add_colorbar** works there too. Checking **robust** on a 1D variable no longer fails with `unexpected keyword argument 'robust'`.
- **Group plot overrides** now apply **field by field**: an empty group field (or a group checkbox left at its default) uses the global value. Before, any non-default group setting made all of the group's checkboxes win.
- **Numeric attributes** show as numbers / arrays (`-999`, `[0.0, 2.0]`) instead of numpy text (`"[0. 2.]"`).
- **Healthcheck** report: the **Logging System** and **Performance** sections are gone (one always passed, the other duplicated Memory).
- **xarray older than 2024.10** in your own interpreter: the viewer now shows _"xarray X is too old…"_ with the `pip install` command, instead of `module 'xarray' has no attribute 'DataTree'` (v0.12 failed the same way). xarray 2024.10 – 2026.3 still works for NetCDF / HDF5; 2026.4+ is recommended.
- Plotting a **cftime** time axis needs `nc-time-axis` (not in the uv bundle); without it the plot error says so.
- The **plot type selector** ("Auto (Recommended)") next to **Create Plot** is gone. It only ever offered `auto`, so plots do not change. Scripts calling the backend directly use `get_data_info.py plot <file> <variable> [flags]`: the third positional argument (`auto`) no longer exists and would be read as an unexpected argument.

### Plots keep the automatic layout when one control is set

- Before, setting **any** dimension slice or layout control (row, col, col_wrap, x, y, hue, size, aspect) replaced the automatic layout by a manual one where nothing else was chosen: a 3D variable with one dimension sliced was drawn as a **histogram**, and setting `x` alone left xarray to guess the rest. Now every control left empty is still chosen automatically, so such plots change (for the better): sliced 3D variables keep their time facets, `x` alone gives an image with the other dimensions laid out around it. With no control set, plots are the same as before.
- Images drawn with a user layout use `imshow` like the automatic ones (it was `pcolormesh`), unless `x` / `y` names a non-dimension coordinate.
- The JSON result of `get_data_info.py plot` gains `plot_layout`; `applied_isel_kwargs` reports slices as `5:15` instead of `slice(5, 15, None)`. The `createPlot` webview request now answers `{plotData, layout, appliedSlices}` instead of the bare PNG string.

### QA pass changes visible to users

- **Group Plot Controls checkboxes** start at "use the global value", drawn as a dash; a click gives the group its own value, **Reset** returns to the global one. Before, a group checkbox left at its default could not override a changed global checkbox.
- **Numbers typed wrong** in the plot parameters (`1,5`, `-3` for size) are outlined in red and **Create Plot** says which field is wrong instead of plotting without it.
- **`NaN` / `inf`** read `nan` / `inf` (not `np.float64(nan)`); numeric array attributes read `[0.1, nan, inf]`.
- **vmin / vmax** like `-0.0000001` work (they failed with `argument --vmin: expected one argument`).
- **`maxFileSize`** of 0 or less means no limit; the limit never applied to Zarr directories, which the setting now says.
- **"Python environment not ready"** says why: interpreter not found, missing core packages (with the `pip install` command) or Python older than 3.10.
- Closing a viewer stops its running plots.

### Removed setting

- **`scientificDataViewer.defaultView`** was declared "currently unused" and never read. It is removed; a value left in `settings.json` is shown as an unknown setting and has no effect, as before.

### Building from source (contributors)

- `npm run compile` now also bundles the webview (`src/panel/webview/*.ts` → `out/webview/webview.js`, esbuild); `npm run typecheck` checks the extension host and the webview. Run `npm install` first (new devDependency `esbuild`).
- Development dependencies on their current major versions, so that `npm audit` is clean: eslint 10 with a flat config (`eslint.config.mjs` replaces `.eslintrc.js`, same rules), `typescript-eslint` 8, mocha 12, `glob` 14, `@vscode/vsce` 4, and `overrides` forcing `minimatch` 11 and `glob` 14. Run `npm install` (Node 22.12 or newer).
- The `.vsix` now contains only what the extension runs: 72 files / 1.05 MB instead of 252 files / 2.5 MB. Gone: `docs/`, the TypeScript sources of the extension host and their source maps, tool caches, repository scripts and configs, the sample data generators, notebooks and test scripts of `python/`, unused icons and the README screenshots. `.vscodeignore` is an allow-list: it excludes everything and names each runtime file, so **a new runtime file must be added to it**, and nothing else can be packaged by accident (vsce applies `!` patterns whatever their order). `vscode:prepublish` deletes `out/` before compiling. Check with `npx vsce ls`.

### Python backend location (contributors)

- The backend moved from `python/get_data_info.py` to the **`python/sdv_backend/`** package. `python/get_data_info.py` is kept as a thin entry point, so the extension, its logged "copy-paste" command and existing scripts keep working; `python -m sdv_backend` (from `python/`) is equivalent.
- Python tests moved from `python/test_*.py` to **`python/tests/`** (`pytest python/tests`).
- Code that imported from `get_data_info` must import from the package modules instead (e.g. `from sdv_backend.info.extract import get_file_info`). `create_plot` / `get_file_info` now take a **`PlotOptions`** / **`InfoOptions`** dataclass instead of 30 / 9 keyword arguments.

---

## Python backend restructuring

### Why

`python/get_data_info.py` had grown to ~3,700 lines mixing JSON serialization, package checks, format detection, file opening, metadata extraction, plotting and the CLI, with a 540-line `create_plot` and a 330-line `get_file_info`. It had become hard to understand and risky to change. `python/create_sample_data.py` (~6,000 lines) had the same problem.

### What changed

The backend is now the **`python/sdv_backend/`** package; imports flow one way: `cli → info / plotting → opening → formats → environment`.

| Module                           | Responsibility                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `cli.py`                         | Argument parsing; builds `InfoOptions` / `PlotOptions`; prints the single JSON line                     |
| `results.py`, `serialization.py` | Result dataclasses (the JSON contract with the extension) and JSON encoding                             |
| `environment/`                   | Installed packages and xarray engine selection per extension                                            |
| `formats/`                       | Format detection: Zarr (incl. ZIP), Kerchunk, GeoTIFF / COG                                             |
| `opening.py`                     | Opening with engine and `decode_cf` fallback; `OpenedData` hides the DataTree-vs-dict-of-Datasets split |
| `info/`                          | `get_file_info`, now split into small steps (reprs, per-group metadata, datetime ranges)                |
| `plotting/`                      | `create_plot` (~110 lines): `selection.py` (variable, slices, datetime filter), `draw.py`, `render.py`  |

Sample generators moved to **`python/sample_data/`** (one module per format family); `python/create_sample_data.py` remains the entry point.

### How behaviour was preserved

Before any code moved, a **golden snapshot harness** (`python/tools/golden_snapshots.py`) recorded the backend's JSON output for 68 `info` / `plot` invocations (83 today, with the v0.13 sample formats) on `artefacts/sample-data/` (plot images compared by hash, with a frozen clock). Each refactoring step was checked against it; the code was moved verbatim first and only then decomposed. Snapshots stayed identical except where a bug fix below intentionally changed the output.

### Bugs found and fixed along the way

- **Unsupported plot type crashed the backend:** `plot <file> <var> histogram` died with `UnboundLocalError` and printed no JSON. It now returns a JSON error. The CLI help no longer advertises `line` / `histogram` (only `auto` exists; the extension always sends `auto`).
- **Empty plot selections:** a datetime range or dimension slice matching no values failed inside xarray with `ZeroDivisionError`. The plot now fails with _"No data to plot: dimension(s) time are empty after selection. Check the time range […] on 'time'."_
- **Kerchunk plots failed with relative references:** a reference pointing at `sample_data.nc` (no folder) was looked up in the backend's working directory, not next to the `.kerchunk.json`, so plotting failed while File Information worked. Relative targets are now resolved from the reference file's folder (JSON references).
- **Open files leaked on plot errors:** files were closed only on success; they are now closed on every path.
- **Sample generation always aborted:** writing `sample_data.geotiff` failed (GDAL cannot infer a driver from `.geotiff`), and `main()` stopped at the first error, so the v0.13 fixtures (Zarr v3, Kerchunk, COG, JPEG-2000, broken files, temporal datasets) were never generated. Fixed, and a failing generator no longer stops the others.

### Sample data is reproducible

- Random data is seeded per generator and creation timestamps are fixed (2025-01-01), so regenerating gives the same data every time (byte-identical except HDF5 / CDF library header timestamps).
- **`python python/create_sample_data.py --overwrite`** regenerates existing files (by default existing files are kept); files no generator produces are left untouched. **`--disposable`** also creates the deletion-test files.

---

## Code review fixes

### Why

A review of the whole codebase (October 2026, tracked item by item in [`REVIEWS_0.13.0.md` § Code review](./v0.13/REVIEWS_0.13.0.md#1-code-review)) found a security issue, several real bugs hidden by over-engineered plumbing, and a lot of dead code: a message bus whose request/response half was never used, a Redux-like state store with undo history nobody called that broadcast the whole state ~9 times per load, a 4,000-line untyped webview script with every plot parameter duplicated, a 1,184-line healthcheck, and Python plot strategies spread over 8 classes and 2 registries.

### What changed

- **Security**: file-derived names were inserted into the webview HTML unescaped, and the webview could make the extension run any VS Code command. Values are escaped, the page has a Content-Security-Policy, the extension only runs three allowlisted commands, and plot file names from the webview cannot leave the data folder.
- **Extension host**: subprocesses never use a shell (`runProcess`), which fixes uv receiving no version pins and stray `=2026.4.0` files; Python initialisation is single-flight and environment operations are serialised; "Install packages" works in the extension's uv environment; messages about uv / override interpreters are accurate; `ErrorBoundary` no longer catches other extensions' errors.
- **Panel**: `MessageBus` reduced to `handle` / `emit` with typed `Requests` / `Events` maps; `StateManager` removed; one message per load; plot options as one object; `DataProcessor` no longer a singleton; Kerchunk URI kept; Windows-safe paths; saves no longer time out waiting for the notification.
- **Webview**: TypeScript modules bundled by esbuild; one plot-parameter table for global and group controls; several display bugs fixed.
- **Python backend**: always prints JSON (corrupt files, `inf` attributes); numpy values serialised as numbers; time filter, time ranges and cftime fixed; aspect only equal for spatial 2D plots; strategies replaced by `plotting/draw.py`.

### How behaviour was preserved

- Golden snapshots recorded before the Python changes: 27 info cases changed, all intended (numbers instead of strings, no false datetime variables, error JSON for corrupt files, no `h5py` engine); 0 plot PNG diffs. The non-regression plot gallery is byte-identical.
- New tests: webview bundle in jsdom (escaping, CSP, plot payloads, time controls, export), UIController through the real channel, `runProcess`, healthcheck, CLI arguments; Python tests from 112 to 159.

---

## Viewer styling refresh

### Why

The panel was styled like a plain web page from the early 2010s: square bordered boxes, emoji toolbar buttons, 15 px gutters, controls styled one by one (some plot inputs were white in dark themes), and a page that sat in a fixed 768 px column on the left. Current VS Code (Settings editor, sidebar panes, quick input) uses rounded corners, larger spacing and quiet, icon-only toolbars; the viewer now follows that language while staying sober.

### What changed

- **Layout**: centred column up to 960 px with 24 px gutters (12 px below 480 px); nested content lines up with its section title. Space for the vertical scrollbar is always kept free (`scrollbar-gutter: stable`), so the column no longer jumps left when the scrollbar appears after loading.
- **Header**: sticky toolbar with a bottom hairline, version badge, and 28 px icon buttons (SVG line icons in the theme icon color, hover like editor title actions) instead of 🖼️ 📁 📂 🔄; the 🕒 next to the load time is an icon too.
- **Sections**: VS Code-style twisties on every collapsible section; top-level titles stay sticky under the header; Dimensions / Coordinates / Variables / Attributes / Group Plot Controls use the uppercase pane-header style.
- **Variables**: each variable is a rounded card (summary row, value, attributes, and for data variables the plot controls and plot); `📄` markers removed; dims and dtypes in the editor font.
- **Controls**: one style for every text, number, date input, select and checkbox (theme input / dropdown colors, focus ring); plot actions (Reset, Save, Save As, Open) are secondary buttons, Create Plot stays primary; copy buttons read **Copy** / **Copied** and float in the corner of text representations and plot errors.
- **Icons**: no emoji left in the viewer. Toolbar, Plot All / Cancel All, install / settings / logs links, external links, the error title, the troubleshooting heading and the Browser Mode badge use one set of inline SVG line icons (`src/shared/icons.ts`) drawn in the surrounding text color.
- **Feedback**: error page and plot errors as callouts with an accent border; loading spinner; `<kbd>` styled like VS Code keybinding labels; outline navigation highlight uses the focus color.
- **Themes**: colors come only from `--vscode-*` variables. Derived surfaces and borders use `color-mix()`; VS Code < 1.77 (no `color-mix()`) falls back to flat surfaces. High-contrast themes get explicit contrast borders and no tinted surfaces.

Element ids, CSS classes used by the script, and the outline are unchanged; exported HTML embeds the new stylesheet as before.

### How it was checked

- `npm test` (290 passing), `npm run typecheck`, pre-commit hooks.
- **`npm run screenshots`** (new, for contributors): full-page screenshots of the real page in the four built-in VS Code themes, with real backend data and plots, saved to `artefacts/screenshots/v0.13/<theme>/`. Run it again for the next version and compare the `artefacts/screenshots/v0.14/` folder with this one. See [`SCREENSHOTS.md`](./SCREENSHOTS.md).
- First pass: the scrolled state (sticky header and section title) was checked with a one-off capture.

---

## Xarray Encoding section

### Why

The xarray encoding (`dtype`, `_FillValue`, chunks, compression, Zarr codecs) was mixed into the attribute tables as `__xarray_encoding.*` entries. It is a different kind of information: attributes describe the data, the encoding describes how it is stored. Mixed together, a variable with 3 attributes showed 15 lines, the prefix took half the width of the name column, and the HDF5 compression keys showed up twice (`__xarray_encoding.zlib` and `__xarray_encoding.filters.zlib`). Clicking a variable also only toggled its attributes: the plot row stayed visible, so a group could not be reduced to a list of variables.

### What changed

- **Variable card**: the summary row (name, dims, dtype, shape, size), then up to three sections, each with a pane-style header and an entry count: **Attributes** (open by default), **Xarray Encoding** (collapsed by default), **Plot** (data variables, open by default). Each section collapses on its own; clicking the summary row shows or hides the whole card. Opening a card again brings back the sections as they were left (progressive disclosure: a group first reads as one line per variable, and the details stay one click away).
- **Cards start collapsed**, the Plot section included (before, **Create Plot** was visible under each collapsed variable). **Create Plot** is one click further away; **Plot All** and a single plot open the card and its Plot section so the result is never hidden. Groups keep the state the user chose.
- **Group Xarray Encoding**: groups get an **Xarray Encoding** section after **Attributes**, collapsed by default (`source`, `unlimited_dims`…). The group sections show their entry count as a badge.
- **Plain keys**: `dtype`, `chunks`, `compressors` instead of `__xarray_encoding.dtype`… The duplicated `__xarray_encoding.filters.*` keys are gone: with both the netcdf4 and h5netcdf engines, the compression keys (`zlib`, `complevel`, `shuffle`, `fletcher32`) are already in the encoding.
- **Outline**: **Xarray Encoding (n)** under groups, coordinates and variables; clicking it opens the section in the viewer.
- **Group cards**: groups are built like the variable cards, so a group reads as one block instead of a title followed by detached sections. One bordered card per group: a header row (group name, then "3 dimensions · 3 coordinates · 3 variables", useful when the group is collapsed) that stays pinned under the toolbar while you scroll the group, then **Group Plot Controls**, **Dimensions**, **Coordinates**, **Variables**, **Attributes**, **Xarray Encoding** as sections divided by hairlines, with the same headers and indentation as a variable's sections. The dimensions line and the group plot control panels no longer draw their own box inside the card.
- **Setting**: `showXarrayEncodingAttributes` keeps its name (no migration); off, the encoding sections are not shown.
- **JSON** (scripts reading `get_data_info.py info`): `encoding` on variables and coordinates and `encoding_flattened` per group; `attributes` / `attributes_flattened` only hold the attributes.

### How it was checked

- `npm test` (294 passing, including new jsdom tests of the card sections, their default states and ids, the group section, and the card opening on plot), `pytest python/tests` (165 passing; compression keys checked with netcdf4 and h5netcdf), `npm run typecheck`, pre-commit.
- `npm run screenshots`: overview (collapsed cards, badges), every section expanded, plots (cards opened by the plots), 420 px, in Dark Modern and Light Modern; a one-off capture of the page scrolled into a group (pinned group header, nothing showing through it).

---

## Cancel a single plot

### Why

A slow plot (large variable, no slice) could only be stopped with **Cancel All** in the Global Plot Controls, which may be far from the variable and also stops the other plots. And a cancelled plot then showed an error ("Process was aborted… This usually happens when a plot operation times out…") as if something had gone wrong.

### What changed

- While a variable's plot runs, a **Cancel** button appears next to **Create Plot**; **Create Plot** is disabled until the plot ends (a second click used to start a second process for the same variable).
- **Cancel** aborts that variable's process only (the same `abortPlot` request as **Cancel All**, with the plot's operation id). The plot area shows **Plot cancelled.** at once, in a neutral callout.
- The response of a cancelled plot is ignored: a plot that finishes just before the abort reaches its process does not appear afterwards, and the abort error is not shown.
- **Cancel All** marks every running plot the same way. During **Plot All**, a plot cancelled on its own counts as cancelled, not as failed, in the summary notification.
- Nothing changes on the extension host or the backend: the abort path, the timeouts and the protocol are the ones **Cancel All** already used.

### How it was checked

- `npm test` (296 passing, including two new jsdom tests: single Cancel, and Cancel All on a running plot), `npm run typecheck`, `generate.py --check`, pre-commit.

---

## Load time in local time

### Why

The **Loaded:** timestamp at the top right of the viewer was always in UTC (`2026-10-29T13:03:12.345Z`), so users outside UTC had to convert it to know when the file was read.

### What changed

- New setting **`scientificDataViewer.showLoadTimeInLocalTime`** (default **on**): the timestamp is shown in the local time zone, still ISO 8601 and with the UTC offset, so it stays unambiguous (`2026-10-29T14:03:12.345+01:00`). Off → UTC as before.
- The webview formats the time, so with a remote host (Remote SSH, WSL, Dev Containers) it is the time zone of the machine running the VS Code window.
- The setting is read at each load: after changing it, press **Refresh** (🔄).

### How it was checked

- `npm test` (300 passing; new tests for the formatter, the webview with the setting on and off, `HTMLGenerator` and the `package.json` default), `npm run typecheck`, `generate.py --check`, pre-commit.

---

## Plot controls layout

### Why

The plot controls were hard to scan: each row was a flow of `label: input` pairs of different widths, so nothing lined up from one row to the next; the time controls, dimension slices and plot parameters used three heading styles; checkboxes came after their label; and the global controls stacked a box per panel.

### What changed

- **Blocks**: **Dimension slices** (`isel`) and **Plot parameters** (`plot`) share one heading style with a one-line hint and their own **Reset** button on the right, separated by hairlines. Global Plot Controls are one card; Group Plot Controls draw no box inside the group card.
- **Fields**: each parameter shows its xarray name (editor font) with a short hint (`hue colors`, `robust 2–98 %`, `size height, in`), and its control below at full width. Fields sit in a grid whose columns line up across blocks; it falls back to two columns on narrow editors.
- **Fieldsets**: plot parameters are sorted by meaning: **Facets** (row, col, col_wrap), **Axes** (x, y, hue, xincrease, yincrease), **Color** (vmin, vmax, cmap, robust, add_colorbar), **Figure** (size, aspect, bins, add_legend).
- **Reset per block**: **Reset** next to Dimension slices clears only the slices (before, the single "Clear Dimension Slices and Plot Parameters" button cleared both); Plot parameters have their own Reset.
- Nothing changes in what is sent to the backend; element ids are unchanged.
- **Dimension slices: three boxes and a slider**: each dimension has **start : stop : step** boxes joined into one control, and a slider whose two handles set start and stop (the step is kept). Typing moves the handles; dragging one handle changes only its own box (both when the handles cross). Start with an empty stop selects one index, a typed step being then ignored (struck through); handles on top of each other give that index; handles at both ends clear the selection. A whole slice typed or pasted in a box (`0:24:2`) is spread over the boxes, and `5::2` keeps its Python meaning (stop = dimension size). Negative start / stop count from the end: the handles show the positive position and the box keeps the typed text until its own handle moves. A negative step disables the slider; an empty selection (stop at or before start) and non-integer input are outlined in red. Before, a slice was one text box where the Python syntax had to be typed.

### How it was checked

- `npm test` (301 passing; new test: each Reset clears its own block), `npm run typecheck`, pre-commit.
- Screenshots of the global and group plot controls (time controls turned on) in Dark Modern, Light Modern and at 420 px.
- Slices: jsdom tests of the two-way sync; screenshots of a slice, an index and an open slice with a step; real mouse drags in headless Chromium (one handle; overlapped handles pulled apart in both directions).

---

## Progressive plot layout

### Why

The automatic plot works well, but it was all or nothing: the backend chose the layout only when **no** layout control was set (`PlotOptions.has_user_layout`). Setting one slice or one facet switched to a "user layout" built from the user's values only, so a single change could turn a grid of maps into a histogram. In `sample_data_multiple_groups.nc`, `root_data(time, lat, lon)` is drawn as one map per time step (4 per row); slicing `lat` to `5:15` then gave a histogram of the 3D array. Users also could not tell which of the many controls they had touched.

### What changed

- **Backend (`plotting/layout.py`, new)**: `resolve_layout` keeps every role the user set (x, y, hue, row, col, col_wrap, size, aspect) and fills the others from the dimensions left free, in a fixed order: `bins` → histogram; plot kind from the dimensions left (hue → lines, two or more → image, one → line); empty axes take the last free dimensions (x the last, y the one before); remaining dimensions become `col`, or `row` and `col`; `col_wrap` and figure size get defaults. Dimension slices and the time range only select data and never change the mode. Size-1 dimensions not chosen are taken at index 0. With no control set, the result is the historical automatic mode.
- **Each choice is tagged** `user` or `auto`, and user choices that cannot be used (a facet dimension the variable lacks — global controls apply to every variable —, the same dimension in two roles, `col_wrap` without column facets, more dimensions than facets) are dropped with a note instead of silently. The result JSON gains `plot_layout`.
- **`draw.py`** makes one xarray call per kind (`imshow` / `pcolormesh` / `line` / `hist`) and `kwargs.py` passes each kind only the style options it accepts (`for_kind`). `PlotOptions.has_user_layout`, `draws_color_mesh` and the two drawing routes are removed.
- **Webview, changed outline (`changedFields.ts`, new)**: a field whose value differs from its default is outlined, with a dot after its name: dimension slices and plot parameters, global and group. A group checkbox showing the dash counts as default. Reset clears the outlines; exported HTML keeps them.
- **Webview, layout line (`render/plotLayout.ts`, new)**: under each plot, the plot kind then every slice and role with its value; the items you set are outlined like the changed fields, the others were chosen automatically. Notes list the choices that could not be used.
- **Docs**: [`docs/PLOTTING.md`](./PLOTTING.md) explains the whole mechanism; two new generated diagrams, _Plot parameters_ and _Plot layout decision_ (`docs/architecture/`).

### How it was checked

- `pytest python/tests` (new `test_plot_layout.py`: automatic 2D/3D/4D layouts, one option changed keeps the others, user x / row / col / hue, size-1 dimensions, too many dimensions, bins, unusable choices explained, aspect without size, datetime x-axis; `test_plot_drawing.py` and `test_col_wrap.py` updated).
- A sampled sweep of 1,750 combinations of x / y / hue / row / col (valid, absent, repeated), col_wrap, bins, size and aspect over 7 shapes (1D to 5D, size-1 dimensions, datetime coordinates) drawn with every style option: the only failures are a size-1 datetime dimension chosen as an image axis, which xarray cannot draw (known limitation).
- `npm test` (328 passing; new: changed outlines set / cleared / Reset / group checkbox / prefilled time range; layout line with user and automatic items, escaped notes, cleared by Reset).
- `node scripts/qa/webview/run-all.mjs` (real webview in headless Chromium, real backend): all scenarios pass; `sample_data_multiple_groups.nc` `root_data` with `lat` `5:15` and `col_wrap` 5 gives 10 maps in 2 rows, both fields outlined, layout line `image [lat 5:15] col time [col_wrap 5] y lat x lon size 4 aspect 1`.
- `generate.py --check`, diagrams regenerated.

---

## Architecture diagrams

For contributors only; nothing changes in the extension.

### Why

The architecture was described in prose and one ASCII sketch (`docs/TECHNICAL_ARCHITECTURE.md`). The parts that are hard to assemble from prose (which process talks to which, the message protocol, how a plot is cancelled, how the interpreter is chosen, how the uv environment is rebuilt) are now drawn. Hand-made diagrams go stale silently, so these are generated from the code and checked against it.

### What changed

- **`docs/architecture/`**: 11 figures (including the plot parameters and the plot layout decision, see [§ Progressive plot layout](#progressive-plot-layout)) and the webview protocol tables, as a `README.md` that GitHub renders (standalone SVG files that follow the light or dark color scheme) and as a single page, `architecture.html`, to open in a browser.
- **`scripts/architecture/generate.py`** writes them. The module graphs are laid out by Graphviz from the import statements of `src/` and `python/sdv_backend/`; the protocol tables are read from `MessageTypes.ts`; the version, editor and command counts and the timeouts quoted in the figures come from `package.json` and the constants in the code. The process overview, the two sequence diagrams and the backend pipelines are drawn by `figures.py`.
- **`generate.py --check`** (no Graphviz needed) fails when a module is not placed in the diagrams, when a symbol named by a figure or by the text no longer exists in its file, or when the protocol notes no longer match `MessageTypes.ts`. Run it after moving or renaming modules; it tells which table or figure to update.

### How it was checked

- `--check` passes, and reports each kind of drift injected on purpose (unplaced module, missing module, renamed symbol, missing protocol note). Two runs give byte-identical files.
- The SVG files parse as XML and render as images in light and dark; the HTML page in headless Chromium; pre-commit leaves the generated `README.md` unchanged. `docs/architecture/` is not in the `.vsix` (`vsce ls`).

---

## QA pass

### Why

Many things changed in v0.13; a tester's pass was needed before the release, trying to break the viewer on every format rather than following the happy path.

### What was done

- **Backend, differential**: v0.12.1 and v0.13 run with the same interpreter on every sample file and 53 hostile files; `info` compared structurally, every variable plotted by both and the images compared pixel by pixel, ~80 plot-option scenarios. Every difference traced to an intended change; 133 of 145 default plots are pixel-identical (the rest: newly opened formats, the intended `(time, station)` aspect fix, identical failures).
- **Webview**: the real page (real CSP, compiled bundle, VS Code theme variables) in headless Chromium, with real typing and mouse drags, the backend through the extension's own argument builder and process runner. No injection through any hostile name or value (live page and exported HTML).
- **Extension host**: suites inside a real VS Code against the live panels and message bus (opening every format, Kerchunk, plots, abort, save paths, settings, outline, multiple panels, packaging).
- Report and fixes: [`REVIEWS_0.13.0.md` § QA pass](./v0.13/REVIEWS_0.13.0.md#2-qa-pass). The tools are versioned in `scripts/qa/` (see its README).

### What was fixed

| Finding                                                                                      | Fix                                                                                     |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| vmin / vmax `-1e-7`, values starting with `-` read as CLI options                            | The CLI joins each value option with its value (`--vmin=-1e-7`) before parsing          |
| `np.float64(nan)` / `np.float64(inf)` in attributes and `_FillValue`                         | Written `nan` / `inf`; numeric arrays shown `[0.1, nan, inf]`                           |
| Viewer closed while loading: ghost outline, error toast, plot kept running                   | A load ending after close (or superseded by a newer one) is ignored; close aborts plots |
| Export Webview exported the first visible viewer, not the focused one                        | Focused viewer first                                                                    |
| Plot All re-ran a plot already running; Cancel then left an orphan                           | Plot All skips running variables                                                        |
| Numbers typed wrong silently ignored                                                         | Outlined in red; the plot is refused with the list of fields                            |
| Group checkbox could not override a changed global checkbox                                  | "Use the global value" state (dash) until clicked                                       |
| Kerchunk: generic or empty error messages                                                    | Precise reasons (invalid JSON, no Zarr metadata, missing target file)                   |
| Header icons over the version badge below 380 px                                             | Badge hidden, buttons kept                                                              |
| `maxFileSize` ≤ 0 refused everything; `facetgridFigsize` < 0.1 accepted                      | No limit; ignored                                                                       |
| Install command accepted pip / uv options from the webview                                   | Requirement specifiers only                                                             |
| Export with no captured page opened the save dialog first                                    | Fails at once                                                                           |
| "Python environment not ready" without a reason; Python 3.8 `TypeError`                      | Reason given; Python < 3.10 reported as such                                            |
| Outline Expand All: hundreds of concurrent reveals, one nested group left collapsed          | Revealed one at a time, parents first, failed ones retried once                         |
| `.vsix` was a deny-list: any new top-level folder (`.qa/`) got packaged; source maps shipped | Allow-list of runtime files; no source maps; `out/` cleaned before packaging            |

### How it was checked

- `npm test` (325 passing), `pytest python/tests` (195 passing), `npm run typecheck`, `generate.py --check`, golden snapshots re-recorded after checking that every difference is the encoding move or `nan`.
- `scripts/qa/`: webview scenarios (render, controls, time, cancel), end-to-end suites in VS Code 1.144, backend differential against v0.12.1 (no regression).

## Time Controls removed

### Why

The **Time range** block (datetime variable, start / end) has been off by default since v0.9 and was little tested, while **Dimension Slices** subset any dimension by index, time included (`0:24:2`). Keeping two ways to select time doubled the controls to maintain and to explain. The plot controls now focus on the generic ones; a label-based selection (`sel`) working for every coordinate can come back once it is defined.

### What changed

- The **Time range** block is gone from **Global Plot Controls** and **Group Plot Controls**, with the settings **`scientificDataViewer.globalTimeControls`** and **`scientificDataViewer.groupTimeControls`**.
- **Settings left in `settings.json`**: nothing breaks. VS Code does not validate unknown keys strictly: a removed setting is greyed out as _Unknown Configuration Setting_ in `settings.json` and ignored. A `deprecationMessage` is only useful while a setting still has an effect (or is renamed); this one does nothing any more, so it is removed, not deprecated. You can delete the line.
- The webview no longer sends `datetimeVariableName` / `startDatetime` / `endDatetime`, and `PlotOptions` / `buildCreatePlotCliArgs` drop them.
- **Python backend unchanged**: `get_data_info.py plot … --datetime-variable time --start-datetime … --end-datetime …` and the `datetime_variables` field of `info` still work from the command line, so the feature can be re-added on the webview side only.

### How it was checked

- `npm test` (310 passing; a file with datetime variables shows no time control), `npm run typecheck`, `generate.py --check` (diagrams regenerated), pre-commit.

## Paranoia: every check before a release

For contributors only; nothing changes in the extension.

### Why

v0.13 added several safety nets (golden snapshots, architecture `--check`, QA harnesses against the last release, upgrade sandbox, screenshots) on top of `npm test`, `pytest` and pre-commit. Each needs its own command, interpreter and setup, so before a release some were forgotten. The checks also looked at the working tree, while users install the `.vsix`: a runtime file missing from `.vscodeignore` breaks the extension for them and not under F5.

### What changed

- **`./paranoia.sh`** runs them in order, in three profiles: `--quick` (release documents, pre-commit, clean build, package, `.vsix` audit, pytest, `npm test`; ~5 min), the default (+ golden snapshots, backend `info` / plots / ~80 plot scenarios against the last release, real webview in headless Chromium, npm audit, CI status; ~20 min) and `--full` (+ e2e suites in VS Code, the three upgrade scenarios, screenshots; ~45 min). `--only` / `--skip` select steps, `--list` shows them.
- **What users install is tested**: the `.vsix` is built in the run folder and audited (every runtime file present, every relative `require()` of the compiled code resolves, no source map, test, script or data, files added / removed since the previous release); its Python backend answers `info` and `plot` on sample files from outside the repository; the e2e suites and the upgrade sandbox run on it.
- **New release checks**: the version is above the Marketplace and Open VSX ones and has no tag elsewhere; `package-lock.json`, CHANGELOG section, release notes and PR summary exist for it; relative links of README / CHANGELOG / release documents resolve; a change of the uv environment since the last release makes the upgrade sandbox mandatory.
- **Report**: `artefacts/paranoia/<date-time>/REPORT.md` (`artefacts/paranoia/latest`) with a verdict (`NOT READY`, `NOT FULLY VERIFIED`, `READY AFTER REVIEW`, `READY`; only a `--full` run can be ready), a table of the checks with links to their logs, the end of the log of each failure or warning, the files to look at, and what is left to check by hand. Exit code 1 when a check fails.
- **Migration** (`--full`): an update from each older release, played as a user (own environment on, settings of their own, a file opened before and after): the uv environment is rebuilt or kept as `ENVIRONMENT_REVISION` says, the viewer shows the file with it, the settings are unchanged. Two synthetic cases test the counter: same release → kept, revision raised → rebuilt.
- **Everything runs, outputs in `artefacts/`**: every development script writes to the git-ignored `artefacts/` folder (sample data, golden snapshots, non-regression plots, screenshots, QA and paranoia runs, `.vsix` packages in `artefacts/vsix-releases/`). Each run regenerates the sample data, compares the issue #117 plot gallery cases with the last release (`qa-scen`), regenerates the architecture diagrams and compares them with the committed ones, and rebuilds the old releases it needs from their git tags (`scripts/release-vsix.sh`).
- **On GitHub**: `.github/workflows/paranoia.yml` runs it on an Ubuntu runner (label `paranoia` on a pull request, **Run workflow** by hand, every Monday on the default branch), so nothing opens on your screen; the verdict is on the run's summary page and the files in its artifact. Development packages pinned in `requirements-dev.txt`. Without local golden snapshots, the `golden` step compares HEAD with the last release (its tag); cases using options that release does not know are rerun without them when they are only defaults of the extension, else reported `N/A`.
- **Time limits**: each step has one (`./paranoia.sh --list`; about 4x its duration in a full run, 5 min at least): a step that reaches it is stopped and fails, so a hung VS Code cannot block the run. The upgrade sandbox limits its VS Code CLI calls (60 s), its waits for a log line (600 s) and each of its runs (900 s).
- **eccodes variables**: those of the shell are recorded in `logs/env.log`; with the extension's own environment as backend, the harnesses run it without `ECCODES_DEFINITION_PATH`, as the extension does.
- **Plot comparisons to look at**: `qa-plot` and `qa-scen` write a Markdown report (`<run>/backend/plots/plots.md`, `<run>/backend/scenarios/scenarios.md`) with the images of the last release and of this one side by side, grouped by tag (regressions first, then plots drawn differently, of another size, changed error messages, fixed, same error, identical), each with its options, statuses, image sizes and full error messages. The warning of the step names it. How to read the logs and tags: `scripts/qa/README.md` § Reading the results.
- **No sleep during a run**: on desktop Linux the script holds a `systemd-inhibit` lock (idle and sleep), so the machine does not suspend in the middle of a step; closing the lid still suspends. `logs/env.log` says whether the lock was taken.
- **GitHub Actions on Node.js 24**: the workflows use the current majors of their actions (`checkout@v7`, `setup-node@v7`, `setup-python@v7`, `cache@v6`, `upload-artifact@v7`, `setup-uv@v10.3.3`), which run on Node 24, so the runs no longer show the Node 20 deprecation notice; `pr-validation.yml` runs pre-commit itself instead of `pre-commit/action` (still on `actions/cache@v4`).
- **Read-only**: nothing is published, tagged or committed (`./publish.sh` comes after). When pre-commit hooks reformat files, their fix is saved to `pre-commit.patch` and the files are restored. QA outputs and the baseline checkout stay in the run folder.

### How it was checked

- `--quick`, default and `--full` runs on this branch. The first ones found two committed planning documents of `docs/v0.13/` that prettier reformats and 9 `npm audit` findings (both fail the CI), and `publish.sh` crashing with the system `python3` 3.8; the `--full` run found the interrupted upgrade scenario of `upgrade-sandbox.sh` timing out on a harness bug (`grep -q` with `pipefail`) and an `npm test` case failing now and then (two loads reaching the test stub in either order). All are fixed.
- The `--full` run of 2026-10-31 found GRIB unreadable with the extension's own environment when the shell sets `ECCODES_DEFINITION_PATH` (fixed, see [§ GRIB files and `ECCODES_DEFINITION_PATH`](#grib-files-and-eccodes_definition_path)), an `interrupted` upgrade scenario that depended on the speed of the install, and a VS Code CLI call that blocked the run for 90 min. Since then: the `interrupted` scenario passes from 0.12.1 (97 s); a hung step is stopped at its limit, with no process left; `./paranoia.sh --only env,package,vsix,vsix-backend` passes from a shell with the eccodes variables.
- The `--full` run of 2026-11-02 failed only one e2e test: the laptop suspended for 4 min 40 s during a plot, and mocha, which measures with the wall clock, reported a timeout once it resumed. The run now blocks idle suspend; the e2e suites pass again.
- In that run the `golden` step compared nothing for the 54 `info` cases: the reference backend rejected `--netcdf-engine-order` (new in 0.13) and the snapshot was an empty output with exit code 2, so every diff was additions only. Against v0.12.1 it now records 50 of them without that option and shows the real changes (encoding moved out of the attributes into `encoding`, `plot_layout`, …); 4 cases whose tested option v0.12.1 lacks are `N/A`.

---

## GRIB files and `ECCODES_DEFINITION_PATH`

### Why

`ECCODES_DEFINITION_PATH` tells eccodes where its definitions are. Set in a shell profile for a system install (common on meteorology workstations), it reached the extension's uv environment, whose eccodes is another version (2.47 against 2.31 in the case found): every GRIB message failed to decode, and the viewer reported `No valid message found … Check if the file is corrupted or in an unsupported format`, for valid files.

### What changed

- The extension no longer passes `ECCODES_DEFINITION_PATH` to the Python scripts it runs with **its own environment**: the eccodes installed there uses the definitions it ships. The log says it once at start: `ECCODES_DEFINITION_PATH (…) is not passed to the extension's own environment`.
- Interpreters you choose (`overridePythonInterpreter`, the Python extension, the system Python) keep your environment variables unchanged: there the variable may be what makes your eccodes work.

### How it was checked

- Same file, same interpreter, same packaged backend: `No valid message found` with `ECCODES_DEFINITION_PATH` pointing at eccodes 2.31, the file opens without it (`ECCODES_DIR` alone has no effect).
- Unit tests of `pythonScriptEnvironment` (dropped for the own environment whatever the case of the name, kept for the other sources); `scripts/upgrade-sandbox.sh --scenario interrupted` with the variable set: the backend of the new environment opens `sample_data.grib`.

---

## Plot options that cannot be used are explained

### Why

The review of the `qa-scen` images of the `paranoia.sh` run of 2026-11-03 found four plot options that could not be used and gave no sign of it, unlike `x` / `col` on a missing dimension, which already had a note: a slice on a dimension the variable does not have, `vmin` above `vmax`, an unknown matplotlib style, and the line drawn against a datetime variable, which lost its axis label and title. None of them is a regression from v0.12.1.

### What changed

- **Slice on a missing dimension**: still skipped (the global slices apply to every variable), now with a note under the plot: `Slice on depth ignored: not a dimension of this variable (dimensions: time, lat, lon)`.
- **vmin above vmax** on an image: the two are swapped, with a note `vmin=5 is above vmax=1: the two are swapped` (lines and histograms ignore both, no note there).
- **Unknown style** in `scientificDataViewer.matplotlibStyle`: the default style is used, as before, with a note naming the setting.
- **Line against the datetime variable** (command line `--datetime-variable` only): keeps the variable's attributes and scalar coordinates, so the y-axis reads `Monthly Precipitation [mm]` again instead of `precipitation`, and the title shows the sliced indexes.
- `PlotOptions.style` defaults to `""` (matplotlib's default, as the command line) instead of `"auto"`, a name matplotlib does not know.

### How it was checked

- `pytest python/tests` (new `test_plot_notes.py`: each note, no note on a line or a known style; `test_plot_drawing.py`: label and title of the datetime line).
- The `qa-scen` scenarios `slice_unknown_dim`, `vmin_inverted`, `style_bad` run with the packaged backend and the extension's environment: each returns its note; `style_dark` none.

---

## High contrast themes

### Why

In **High Contrast Light**, the file path and the xarray text representation were white text on a light gray background. In **High Contrast Dark**, the xarray HTML representation stayed light, and so did the plots: neither recognised it as a dark theme.

### What changed

- **Code blocks** (file path, text representations): VS Code inverts `textPreformat` in high contrast (white on dark blue in HC light, black on white in HC dark). That foreground is meant for its own background, but the blocks drew it on the `textCodeBlock` background (`#F2F2F2` in HC light, black in HC dark). In high contrast they now use the editor text color. Light and dark themes are unchanged.
- **xarray HTML repr**: xarray switches to its dark palette on `body.vscode-dark` or `body[data-theme="dark"]`. VS Code tags High Contrast Dark as `vscode-high-contrast` only, so the webview now sets `data-theme="dark"` there, and updates it when the theme changes, without a reload (`src/panel/webview/theme.ts`). The HTML export removes the attribute when it applies the export theme, so a page captured in HC dark and exported as a light theme gets a light repr.
- **Plots**: the automatic matplotlib style (empty `scientificDataViewer.matplotlibStyle`) is `dark_background` in High Contrast Dark, as in dark themes.

### How it was checked

- `npm test` (314 passing, new export test included), `npm run typecheck`, `generate.py --check`, pre-commit.
- QA webview harness (`scripts/qa/webview/harness.mjs`) in the four captured themes. HC light: file path and text repr `rgb(41, 41, 41)` on `#F2F2F2`. HC dark: white on black, xarray background `#111111`. Dark / Light Modern unchanged. The attribute follows a live switch HC dark → HC light → HC dark.

---

## Variables of 0 bytes show "Empty"

### Why

A NetCDF variable over a dimension of length 0 (a record dimension with no record yet, for instance) has a size of 0 bytes. The webview tested the size as a boolean, so a size of 0 removed the size column from the variable row: its dimensions, dtype and shape then no longer lined up with the other rows of the group. The backend was right (`size_bytes: 0`); the bug was in the webview only, and dates back to before v0.13.

### What changed

- The size column is always present. It reads **Empty** when the size is 0 bytes (or when the backend gives no size), and keeps its formatted value otherwise (`32 B`, `1.5 kB`…).
- New sample `artefacts/sample-data/sample_data_empty_dimension.nc` (`python python/create_sample_data.py`): dimension `obs` of length 0 (unlimited), coordinate `obs`, data variables `measurement(obs)` (1-D) and `flag(time, obs)` (2-D), both 0 bytes, and `temperature(time)` (32 B) for comparison. It is also one of the golden snapshot files.

### How it was checked

- `npm test`: the 0-byte variable and coordinate read `Empty`, a 24-byte variable `24 B`, every row keeps its five columns.
- `pytest python/tests/test_empty_dimension_sample.py`: the sample reports `size_bytes: 0` for `obs`, `measurement` and `flag`.
- `node scripts/qa/webview/run-all.mjs render` (step `qa-webview` of `paranoia.sh`): real backend and webview on the sample, `Empty` on the three 0-byte rows, five columns on every row, size column right edges aligned; screenshot `artefacts/qa/webview/ui_empty_dimension.png`. With the fix reverted, the two layout checks fail.

---

## Release review

### Why

v0.13 is the largest release of the extension, and its documents had grown with it. A last review of the code and docs (2026-11-05), done while the manual test plan ran, looked for loose ends before publishing. It is tracked item by item in [`REVIEWS_0.13.0.md` § Release review](./v0.13/REVIEWS_0.13.0.md#3-release-review).

### What changed

- **No more false "Request timeout"**: **Refresh**, a package install started from an error message, and the **Save As** / **Export** dialogs wait for the extension instead of giving up after 60 s while the work went on.
- **Closing a save dialog** is reported as cancelled, for **Export** as for **Save As** (Export answered "success" with an error text).
- **A missing `.zip`** says "No such file or directory", like any other missing file, instead of "not a Zarr store".
- **Closing a tab stops everything it started**: the file load (info run) is stopped like its plots, instead of running on in the background for up to 5 minutes.
- **Robustness**: a package install waits for an environment rebuild in progress; deactivation stops info runs too, not only plots; panel disposal survives a failing step; both interpreter settings changed in one save are handled; non-ASCII characters split between two output chunks are no longer garbled; a format detection error is reported instead of `UnboundLocalError`.
- **Removed**: the unused setting `scientificDataViewer.defaultView`, dead code, unused development dependencies, activation events that could never fire.
- **Contributors**: pull requests run the Python tests; pushes to `main` and `develop` no longer cancel each other's CI runs; `setup.sh` creates the `.venv` from `requirements-dev.txt`; `paranoia.sh` checks out the last release once (golden snapshots and QA diffs share it) and compares the issue #117 gallery cases with it; the screenshots and the webview QA share one headless Chrome module; a test keeps the backend's format list aligned with `package.json`.
- **Docs**: the date of the release set; stale docs deleted and historical ones moved to `docs/archive/`; the three review documents merged into `REVIEWS_0.13.0.md`; the technical verification guide moved from these notes to the manual test plan (Part E), so these notes are for users.

### How it was checked

- `npm test` (323 passing) and `pytest python/tests` after each fix, each with a test that fails without the fix where it can be tested automatically; `node scripts/qa/webview/run-all.mjs`; `./paranoia.sh --only qa-baseline,golden`; the issue #117 scenarios of `diff_scen.py` against v0.12.1.
- Manual: [manual test plan T36](./v0.13/MANUAL_TEST_PLAN_0.13.0.md#t36-release-review-fixes).

---

## Marketplace listing

### Why

The extension had about 5,000 Marketplace installs and 9,000 Open VSX downloads, and ranked first on the Marketplace for "zarr", "grib", "geotiff" and "xarray", but only about 10th for "netcdf", behind older viewers with "NetCDF" in their name (one unmaintained since 2023). Its page showed screenshots of v0.3.0, a year and ten releases old, and none of the v0.13 look.

### What changed

- **Display name** `Scientific Data Viewer – NetCDF, Zarr, HDF5, GRIB, GeoTIFF`: the Marketplace search weighs the display name most. The extension id `eschalk0.scientific-data-viewer` does not change: installs, settings and links are kept.
- **The UI keeps the short name** `Scientific Data Viewer`: output channel (**Show Extension Logs**), viewer title and outline, status bar, error messages, healthcheck report.
- **Description** says what the extension does; **30 keywords** (the maximum, was 12) for the formats and the domains (climate, weather, Earth observation, oceanography…); the category "Other" is removed; a dark gallery banner.
- **README** (the Marketplace page): short title, new tagline, a large image of a faceted plot at the top, and v0.13 screenshots of the file structure, a map and the plot controls instead of the v0.3.0 ones.
- For contributors: `npm run screenshots` draws the plots again (they all showed "Python script failed" since the plot layout report); `documentation.json` accepts `header.title`, `header.hero` and a `width` per screenshot.

### How it was checked

- `npm test` (324 passing; new test: `displayName` starts with the UI name, at most 30 keywords); `npx vsce ls`: still 72 files (the screenshots are not packaged: the Marketplace takes them from GitHub).
- Manual: [manual test plan T37](./v0.13/MANUAL_TEST_PLAN_0.13.0.md#t37-marketplace-listing).

---

## New settings (summary)

| Setting                    | Default                          | Effect                                                                                             |
| -------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `netcdfEngineOrder`        | `["netcdf4","h5netcdf","scipy"]` | Try-order for `.nc` / `.nc4` / `.netcdf` only (not NASA `.cdf`)                                    |
| `showInheritedCoordinates` | `true`                           | Child DataTree groups show parent coords; `inherited_from` attribute marks source path             |
| `facetgridFigsize`         | `[]` (unset)                     | Optional `[width, height]` inches → `xr.set_options(facetgrid_figsize=...)` during plot subprocess |
| `showLoadTimeInLocalTime`  | `true`                           | **Loaded:** time (top right) in local time with its UTC offset; `false` → UTC                      |

Existing settings from v0.12 still apply (`orderGroupsAlphabetically`, `showXarrayEncodingAttributes`, plot controls, etc.), except **`globalTimeControls`** and **`groupTimeControls`**, removed (see [§ Time Controls removed](#time-controls-removed)).

---

## Manual verification

- **Testers:** [`MANUAL_TEST_PLAN_0.13.0.md`](./v0.13/MANUAL_TEST_PLAN_0.13.0.md), click by click with a results sheet (Parts A–D).
- **Reviewers and contributors:** its [Part E — Technical verification guide](./v0.13/MANUAL_TEST_PLAN_0.13.0.md#part-e--technical-verification-guide) gives, for each change (T0–T36), what to expect, how to test it and the common failure modes.

---

## Known limitations (unchanged or noted)

- **Plotting** remains **experimental** (timeout). Images use `imshow`, which assumes evenly spaced coordinates; pick a non-dimension coordinate as x / y to get `pcolormesh`. A size-1 datetime dimension chosen as an image axis cannot be drawn by xarray (the error is shown). More than four dimensions without slices give a histogram (the note under the plot says which dimensions to slice). The automatic facets have no upper limit: `sample_data.nc :: /temperature` (365 days) draws 365 panels and exceeds the plot timeout, as in v0.12.1; slice the first dimension first.
- **`fileSize`** for directory stores is still `os.path.getsize` on the directory inode (rough size, not store bytes).
- **eccodeslib** stays below 2.48 in the extension environment until a fixed release exists; other interpreters with eccodeslib ≥ 2.48 and pyproj still crash at exit (`pip install "eccodeslib<2.48"`).
- **cftime axes** need `nc-time-axis` to be plotted (not in the uv bundle).
- **`joinId`** maps every non-alphanumeric character to `-`, so groups like `/a.b` and `/a-b` share element ids (rare; pre-existing).
- **Kerchunk** Parquet references: context menu exists; validation is lighter than JSON `refs` sniffing, and relative target paths are not resolved (JSON only) — treat as experimental.
- **Names longer than 256 bytes** (allowed by HDF5, not by netCDF): the netcdf4 engine reads them past netCDF-C's limit, so a file may open with a garbled name, or `info` and `plot` may disagree ("Variable … not found"). Upstream issue; put `h5netcdf` first in `netcdfEngineOrder` for such files.
- **Python 3.10** or newer is required by the backend; older interpreters are reported as such.
- **Viewer styling on VS Code < 1.77** (no `color-mix()`): cards and panels have no tinted background; everything stays readable.
- **Screenshots** use theme variables recorded from VS Code 1.144 (`scripts/screenshots/themes/`); re-run `capture-themes.mjs` when the default themes change. The xarray HTML representation keeps its own colors in high-contrast themes.
- **Architecture diagrams**: the sequence diagrams, the process overview and the pipelines are drawn by hand in `scripts/architecture/figures.py`; `--check` only catches renamed or removed symbols, not a changed order of calls. Graph layouts can differ slightly between Graphviz versions (generated with 2.43).
- **Cancelling a plot right after clicking Create Plot**: if the abort reaches the extension before the Python process is started, nothing is stopped and the process runs to the end (its result is ignored; the plot timeout still applies). The same was already true of **Cancel All**.
- **Load time setting** applies at the next load or **Refresh** (🔄), like the other display settings; an exported webview keeps the time as shown at export.
- **Timedelta units decoding** is not restored (xarray 2026 removed it); degraded `decode_cf=False` retry from v0.11.2 still applies.

---

## Summary of changes

| Area               | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Python**         | xarray 2026 / zarr 3 pins; Zarr ZIP + detection; Kerchunk engine; COG sniff; NetCDF order; inherited coords; plot options                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Backend**        | `get_data_info.py` split into the `sdv_backend` package; `create_plot` / `get_file_info` decomposed; plot-type and empty-selection errors fixed; golden snapshot harness; plot layout resolved per role (`plotting/layout.py`): user choices kept, the rest automatic; notes for a slice on a missing dimension, vmin above vmax and an unknown style                                                                                                                                                                                 |
| **Extension**      | New settings; Kerchunk command/editor; folder/ZIP menus; uv environment rebuilt automatically when a version requires it (not at every start), **Recreate** action; backend says when xarray is too old                                                                                                                                                                                                                                                                                                                               |
| **Docs**           | Issue templates: all fields optional; `docs/v0.13/` planning; `docs/v0.13/PR_SUMMARY_0.13.0.md`; README regenerated; this release note; architecture diagrams generated from the code (`docs/architecture/`, `scripts/architecture/`)                                                                                                                                                                                                                                                                                                 |
| **Samples**        | `python/sample_data/` package (unsuffixed Zarr v3, sharded Zarr, Zarr ZIP, gzip NetCDF, COG, Kerchunk ref, empty dimension); reproducible; `python python/create_sample_data.py [--overwrite]`                                                                                                                                                                                                                                                                                                                                        |
| **Review**         | Security fix (escaping, CSP, command allowlist, path validation); uv pins; Kerchunk URI; Windows paths; init races; message bus / state store simplified; webview in TypeScript (esbuild); healthcheck and plot strategies simplified; backend always returns JSON; see [`REVIEWS_0.13.0.md`](./v0.13/REVIEWS_0.13.0.md#1-code-review)                                                                                                                                                                                                |
| **UI**             | Viewer restyled to match current VS Code (rounded cards, wider gutters, SVG icon toolbar, twisties, consistent form controls, callouts); colors from the theme only; one-option plot type selector removed; xarray encoding in its own section; variable and group cards; Cancel button for a single plot; load time in local time; changed plot controls outlined; layout line under each plot; Time Controls removed; high contrast themes fixed (code blocks, dark xarray repr and plots); **Empty** size for variables of 0 bytes |
| **Listing**        | Marketplace display name with the main formats (UI keeps `Scientific Data Viewer`); description, 30 keywords, banner; README title, hero image and v0.13 screenshots (see [§ Marketplace listing](#marketplace-listing))                                                                                                                                                                                                                                                                                                              |
| **Release review** | No false request timeouts; cancelled dialogs, missing `.zip` reported right; installs queued behind rebuilds; `defaultView` and dead code removed; Python tests in PR CI; docs merged and archived (see [§ Release review](#release-review))                                                                                                                                                                                                                                                                                          |
| **QA**             | 20 fixes from the QA pass (see [§ QA pass](#qa-pass)); QA harnesses in `scripts/qa/`; `paranoia.sh` runs every check and writes a readiness report; [`REVIEWS_0.13.0.md`](./v0.13/REVIEWS_0.13.0.md#2-qa-pass); GRIB readable with `ECCODES_DEFINITION_PATH` set; paranoia steps have time limits                                                                                                                                                                                                                                     |
| **Tests**          | moved to `python/tests/`; new `test_empty_selection.py`, `test_plot_layout.py`, `test_plot_notes.py`, `test_empty_dimension_sample.py`; `test_zarr_store_detection.py`, `test_kerchunk_references.py`, `test_netcdf_datatree_quality.py`, `test_cog_detection.py`, `test_facetgrid_figsize.py`, extension contribution tests                                                                                                                                                                                                          |

---

## Links

- [Changelog](../CHANGELOG.md#0130---2026-11-05)
- [Pull request summary / MR description](./v0.13/PR_SUMMARY_0.13.0.md)
- [Getting started with v0.13 (review, test, release hub)](./v0.13/GETTING_STARTED.md)
- [Manual test plan (step by step, with results sheet)](./v0.13/MANUAL_TEST_PLAN_0.13.0.md)
- [Upgrade test plan (users updating from v0.12)](./v0.13/UPGRADE_TEST_PLAN.md)
- [Reviews: code review, QA pass, release review](./v0.13/REVIEWS_0.13.0.md)
- [v0.13 planning folder](./v0.13/README.md)
- [Previous release: v0.12.1](./RELEASE_NOTES_0.12.1.md)
