# Scientific Data Viewer v0.13.0 Release Notes

**TL;DR** — Aligns with **xarray 2026.4+** and **zarr-python 3**: better Zarr discovery (unsuffixed dirs, ZIP archives, v3 encoding metadata), NetCDF/DataTree quality settings, experimental **Kerchunk** references, **COG** labelling, and plot extras (`col_wrap='auto'`, `facetgridFigsize`). Removes stale **Sentinel-1 SAFE** claims from the UI. Internally, the Python backend is restructured from one 3,700-line script into the **`sdv_backend`** package (no user-visible behaviour change), and sample data generation becomes a reproducible package with **`--overwrite`**. A full **code review** pass fixes a security issue (HTML injection from file metadata → arbitrary VS Code commands), uv installs that silently dropped version pins, broken **Open as Kerchunk**, Windows save paths, several backend crashes, and removes a large amount of dead or duplicated code (webview rewritten as bundled TypeScript modules). The viewer also gets a **modern, VS Code-native look** (rounded cards, wider gutters, icon toolbar, consistent form controls), and the unused one-option **plot type selector** ("Auto (Recommended)") is removed. The **xarray encoding** moves out of the attributes into its own collapsed **Xarray Encoding** section, and each variable becomes a card with collapsible **Attributes**, **Xarray Encoding** and **Plot** sections. A running plot can be **cancelled on its own**, next to its **Create Plot** button. The **Loaded:** time at the top right is now shown in **local time** (new setting `showLoadTimeInLocalTime`, on by default).

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
| **Maintainability**   | Python backend split into the **`sdv_backend`** package; sample generators into **`sample_data`** (see [§ Backend restructuring](#python-backend-restructuring))                             |
| **Contributors**      | Architecture diagrams generated from the code in `docs/architecture/` (see [§ Architecture diagrams](#architecture-diagrams))                                                                |

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

### Outline / sidebar

- Kerchunk editor id **`kerchunkEditor`** is included in outline `when` clauses (same as other custom editors).

### Code review changes visible to users

- **Group plot overrides** now apply **field by field**: an empty group field (or a group checkbox left at its default) uses the global value. Before, any non-default group setting made all of the group's checkboxes win.
- **Numeric attributes** show as numbers / arrays (`-999`, `[0.0, 2.0]`) instead of numpy text (`"[0. 2.]"`).
- **Time selector** lists only real datetime variables (`datetime64`, cftime); variables such as temperature `t` no longer appear.
- **Healthcheck** report: the **Logging System** and **Performance** sections are gone (one always passed, the other duplicated Memory).
- **xarray older than 2024.10** in your own interpreter: the viewer now shows _"xarray X is too old…"_ with the `pip install` command, instead of `module 'xarray' has no attribute 'DataTree'` (v0.12 failed the same way). xarray 2024.10 – 2026.3 still works for NetCDF / HDF5; 2026.4+ is recommended.
- Plotting a **cftime** time axis needs `nc-time-axis` (not in the uv bundle); without it the plot error says so.
- The **plot type selector** ("Auto (Recommended)") next to **Create Plot** is gone. It only ever offered `auto`, so plots do not change. Scripts calling the backend directly use `get_data_info.py plot <file> <variable> [flags]`: the third positional argument (`auto`) no longer exists and would be read as an unexpected argument.

### Building from source (contributors)

- `npm run compile` now also bundles the webview (`src/panel/webview/*.ts` → `out/webview/webview.js`, esbuild); `npm run typecheck` checks the extension host and the webview. Run `npm install` first (new devDependency `esbuild`).
- The `.vsix` now contains only what the extension runs: 98 files / 1.1 MB instead of 252 files / 2.5 MB. Gone: `docs/`, the TypeScript sources of the extension host, tool caches, repository scripts and configs, the sample data generators, notebooks and test scripts of `python/`, unused icons and the README screenshots. `.vscodeignore` lists what ships from `src/` and `python/`: **a new runtime file there must be added to it** (vsce applies `!` patterns whatever their order). Check with `npx vsce ls`.

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

Before any code moved, a **golden snapshot harness** (`python/tools/golden_snapshots.py`) recorded the backend's JSON output for 68 `info` / `plot` invocations (83 today, with the v0.13 sample formats) on `sample-data/` (plot images compared by hash, with a frozen clock). Each refactoring step was checked against it; the code was moved verbatim first and only then decomposed. Snapshots stayed identical except where a bug fix below intentionally changed the output.

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

A review of the whole codebase (October 2026, tracked item by item in [`CODE_REVIEW_TODO.md`](./v0.13/CODE_REVIEW_TODO.md)) found a security issue, several real bugs hidden by over-engineered plumbing, and a lot of dead code: a message bus whose request/response half was never used, a Redux-like state store with undo history nobody called that broadcast the whole state ~9 times per load, a 4,000-line untyped webview script with every plot parameter duplicated, a 1,184-line healthcheck, and Python plot strategies spread over 8 classes and 2 registries.

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
- **`npm run screenshots`** (new, for contributors): full-page screenshots of the real page in the four built-in VS Code themes, with real backend data and plots, saved to `screenshots/v0.13/<theme>/`. Run it again for the next version and compare the `screenshots/v0.14/` folder with this one. See [`SCREENSHOTS.md`](./SCREENSHOTS.md).
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

- **Blocks**: **Time range**, **Dimension slices** (`isel`) and **Plot parameters** (`plot`) share one heading style with a one-line hint and their own **Reset** button on the right, separated by hairlines. Global Plot Controls are one card; Group Plot Controls draw no box inside the group card.
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

## Architecture diagrams

For contributors only; nothing changes in the extension.

### Why

The architecture was described in prose and one ASCII sketch (`docs/TECHNICAL_ARCHITECTURE.md`). The parts that are hard to assemble from prose (which process talks to which, the message protocol, how a plot is cancelled, how the interpreter is chosen, how the uv environment is rebuilt) are now drawn. Hand-made diagrams go stale silently, so these are generated from the code and checked against it.

### What changed

- **`docs/architecture/`**: 9 figures and the webview protocol tables, as a `README.md` that GitHub renders (standalone SVG files that follow the light or dark color scheme) and as a single page, `architecture.html`, to open in a browser.
- **`scripts/architecture/generate.py`** writes them. The module graphs are laid out by Graphviz from the import statements of `src/` and `python/sdv_backend/`; the protocol tables are read from `MessageTypes.ts`; the version, editor and command counts and the timeouts quoted in the figures come from `package.json` and the constants in the code. The process overview, the two sequence diagrams and the backend pipelines are drawn by `figures.py`.
- **`generate.py --check`** (no Graphviz needed) fails when a module is not placed in the diagrams, when a symbol named by a figure or by the text no longer exists in its file, or when the protocol notes no longer match `MessageTypes.ts`. Run it after moving or renaming modules; it tells which table or figure to update.

### How it was checked

- `--check` passes, and reports each kind of drift injected on purpose (unplaced module, missing module, renamed symbol, missing protocol note). Two runs give byte-identical files.
- The SVG files parse as XML and render as images in light and dark; the HTML page in headless Chromium; pre-commit leaves the generated `README.md` unchanged. `docs/architecture/` is not in the `.vsix` (`vsce ls`).

---

## New settings (summary)

| Setting                    | Default                          | Effect                                                                                             |
| -------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `netcdfEngineOrder`        | `["netcdf4","h5netcdf","scipy"]` | Try-order for `.nc` / `.nc4` / `.netcdf` only (not NASA `.cdf`)                                    |
| `showInheritedCoordinates` | `true`                           | Child DataTree groups show parent coords; `inherited_from` attribute marks source path             |
| `facetgridFigsize`         | `[]` (unset)                     | Optional `[width, height]` inches → `xr.set_options(facetgrid_figsize=...)` during plot subprocess |
| `showLoadTimeInLocalTime`  | `true`                           | **Loaded:** time (top right) in local time with its UTC offset; `false` → UTC                      |

Existing settings from v0.12 still apply (`orderGroupsAlphabetically`, `showXarrayEncodingAttributes`, plot controls, etc.).

---

## Manual verification guide

Use this checklist if you have **not** reviewed every commit on the branch. For a click-by-click version written for testers who don't know the formats (with a results sheet), see [`MANUAL_TEST_PLAN_0.13.0.md`](./v0.13/MANUAL_TEST_PLAN_0.13.0.md). Each section states **what to expect**, **how to test**, and **common failure modes**.

### 0. Environment setup

1. **Node 22** (extension host / hooks): `nvm use` in the repo (see `.nvmrc`).
2. **Python:** Activate the interpreter the extension uses (workspace Python or extension uv env).
3. **Reload window** after installing packages or changing **Use Extension Own Environment**: `Developer: Reload Window`.
4. **Output channel:** View → Output → **Scientific Data Viewer** for Python errors and `used_engine` logs.

**Quick package check** (same interpreter as the extension):

```bash
python -c "import xarray, zarr; print('xarray', xarray.__version__, 'zarr', zarr.__version__)"
```

Expect **xarray ≥ 2026.4** and **zarr ≥ 3** for full v0.13 behaviour.

**Automated tests** (optional sanity):

```bash
source .venv/bin/activate   # or your interpreter
python -m pytest python/tests -q
npm run compile && npm test
```

**Regenerate v0.13 sample files** (written under `sample-data/`, run from the repository root):

```bash
python python/create_sample_data.py --overwrite
```

New fixtures include `sample_ocean_grid_v3/` (unsuffixed Zarr v3), `sample_zarr_v3_sharded.zarr`, `sample_zarr_v3.zarr.zip`, `sample_netcdf_gzip.nc`, `sample_data_cog.tif`, and `sample_data.kerchunk.json` (requires `pip install kerchunk`).

---

### 1. Zarr 3 / dependency pins (P0.1)

**Expect:** Healthcheck / missing-package messages mention `zarr>=3` and `xarray>=2026.4.0` when versions are too old.

**Test:**

1. With a **current** env, open any existing `.zarr` sample (generate samples with `python python/create_sample_data.py` from the repository root).
2. File Information should show format **Zarr v2** or **Zarr v3** (see §4).
3. _(Optional)_ In a throwaway venv with `zarr==2.18`, confirm `.zarr` is reported as missing **`zarr>=3`**.

---

### 2. Zarr store without `.zarr` suffix (P0.2)

**Expect:** A directory containing `zarr.json` (v3) or `.zgroup` (v2) opens from **Open Scientific Data Viewer (Folder)** even when the folder name is **not** `something.zarr`.

**Test:**

1. Copy or create a small Zarr store as a plain directory name (e.g. `my_dataset/` with `zarr.json` inside).
2. Right-click the folder → **Open Scientific Data Viewer (Folder)** (available on **all folders** in the explorer).
3. Viewer should load variables/coordinates like a normal Zarr file.
4. A directory named `scene.tif` that happens to contain Zarr metadata should still be treated as **GeoTIFF** if `.tif` suffix wins (edge case covered by tests).

---

### 3. Zarr in ZIP archives (P0.3)

**Expect:** `.zip` files that contain a Zarr store (at root or nested prefix) open; arbitrary ZIPs show a clear **not a Zarr store** error.

**Test:**

1. Zip an existing `.zarr` directory (store at archive root) or use a sample generator if you add one locally.
2. Context menu on `.zip` → **Open Scientific Data Viewer**.
3. File Information format should mention **Zarr** and **(ZIP)**.
4. Open a normal ZIP (no `zarr.json` / `.zgroup`) → error message should **not** claim missing scientific packages with an empty list.

---

### 4. Zarr v3 encoding metadata (P0.4)

**Expect:** With **`showXarrayEncodingAttributes`** on (default), the **Xarray Encoding** section of variables/coordinates includes Zarr v3 **codecs**, **shards**, etc.; format string distinguishes **Zarr v2** vs **Zarr v3**.

**Test:**

1. Open a **v3** store (directory with `zarr.json`).
2. Expand a variable, then its **Xarray Encoding** section → keys like `compressors` / `shards` (exact keys depend on the store).
3. Toggle **`showXarrayEncodingAttributes`** off → refresh → the **Xarray Encoding** sections disappear.
4. Open a **v2** store (`.zgroup`) → label should say **Zarr v2**.

---

### 5. Plot `col_wrap='auto'` (P0.5)

**Expect:** In Global / Group plot controls, an **auto** checkbox next to **col_wrap** sets xarray `col_wrap='auto'` (xarray 2026.04+). Integer col_wrap still works when auto is unchecked.

**Test:**

1. Open a multi-panel-friendly dataset (3D+ variable).
2. Set **Facet col** to a dimension with many labels; check **auto** for col_wrap.
3. Create Plot (experimental) → should not error; on older xarray Python would warn and omit the kwarg.
4. Uncheck **auto**, enter `2` → plot uses numeric col_wrap.

---

### 6. NetCDF engine order (P1.1)

**Setting:** `scientificDataViewer.netcdfEngineOrder` (default: netcdf4 → h5netcdf → scipy)

**Expect:** File Information **engine** field reflects the first **installed** engine in your configured order. **Does not apply** to NASA `.cdf` (always cdflib).

**Test:**

1. Open `sample_data.nc` (or any `.nc` with both netCDF4 and h5netcdf available).
2. Note **used engine** in File Information (default: `netcdf4`).
3. Change setting to `["h5netcdf","netcdf4","scipy"]` → **Refresh** → engine should become `h5netcdf`.
4. Open a `.cdf` NASA file → engine remains **`cdflib`** regardless of setting.

---

### 7. HDF5 / NetCDF compression filters (P1.2)

**Expect:** gzip (or other) compressed NetCDF4 variables show `zlib`, `complevel` (and `shuffle`, `fletcher32`) in their **Xarray Encoding** section when the encoding is enabled, with the netcdf4 and the h5netcdf engine.

**Test:**

1. Create a small gzip NetCDF locally:

   ```python
   import xarray as xr, numpy as np
   ds = xr.Dataset({"temp": ("x", np.arange(8, dtype="float32"))})
   ds.to_netcdf("gzip.nc", encoding={"temp": {"zlib": True, "complevel": 4}})
   ```

2. Open in viewer → expand `temp`, then **Xarray Encoding** → `zlib : true`, `complevel : 4`. Set `netcdfEngineOrder` to `["h5netcdf"]`, **Refresh** → same keys.
3. Requires **h5netcdf ≥ 1.8** in env for best metadata parity (pinned in extension uv env).

---

### 8. Inherited DataTree coordinates (P1.3)

**Setting:** `scientificDataViewer.showInheritedCoordinates` (default: **true**)

**Expect:** Child groups list parent coordinates (time, lat, lon, …). Inherited coords have attribute **`inherited_from`** with the defining group path (e.g. `/`).

**Test:**

1. Generate samples (from the repository root): `python python/create_sample_data.py`.
2. Open **`sample-data/sample_zarr_inherited_coords.zarr`** as a folder.
3. Navigate to a child group (e.g. under `root/temperature`) → **Coordinates** should include inherited dims.
4. Click a coordinate → attributes show `inherited_from`.
5. Set **`showInheritedCoordinates`** to `false` → Refresh → child groups show **only** locally defined coordinates.
6. **Plot check:** Plot a child variable that uses inherited dims → should still resolve coordinates (no “missing coord” plot error).

---

### 9. Kerchunk / virtual Zarr (P1.5, experimental)

**Expect:**

- `*.kerchunk.json` and `*.ref.json` open in **Kerchunk (virtual Zarr) Data Viewer**.
- Other `.json` / `.parquet` → only via **Open as Kerchunk / virtual Zarr** (context menu or command palette).
- Invalid JSON or non-reference JSON → **ValueError** with a clear message (not a generic ImportError).

**Test:**

1. `pip install kerchunk` in the active interpreter.
2. Generate a reference pointing at a local NetCDF:

   ```python
   import json, numpy as np, xarray as xr
   from pathlib import Path
   from kerchunk.hdf import SingleHdf5ToZarr

   nc = Path("src.nc")
   xr.Dataset({"temp": ("x", np.arange(6, dtype="float32"))}).to_netcdf(nc)
   refs = SingleHdf5ToZarr(str(nc), str(nc), inline_threshold=200).translate()
   Path("src.kerchunk.json").write_text(json.dumps(refs))
   ```

3. Click **`src.kerchunk.json`** → opens; File Information format **Kerchunk (virtual Zarr)**; variable **`temp`** visible without copying the NetCDF.
4. Rename to `refs.json` → does **not** auto-open; right-click → **Open as Kerchunk / virtual Zarr**.
5. Open `package.json` with the Kerchunk command → should **fail** with “not a Kerchunk reference” (ordinary JSON not hijacked).

---

### 10. Cloud Optimized GeoTIFF label (P2.3)

**Expect:** True COGs show **Cloud Optimized GeoTIFF (COG)** in File Information; plain GeoTIFF stays **GeoTIFF**.

**Test:**

1. Create a COG with rasterio:

   ```python
   import numpy as np, rasterio
   from rasterio.transform import from_origin
   data = np.arange(100, dtype="uint8").reshape(10, 10)
   with rasterio.open("test_cog.tif", "w", driver="COG", height=10, width=10,
                      count=1, dtype="uint8", transform=from_origin(0, 10, 1, 1),
                      crs="EPSG:4326", compress="deflate") as dst:
       dst.write(data, 1)
   ```

2. Open → format **Cloud Optimized GeoTIFF (COG)**.
3. Open a plain striped TIFF (`sample_data.tif` from sample generator) → **GeoTIFF**.

---

### 11. FacetGrid figure size (P2.7)

**Setting:** `scientificDataViewer.facetgridFigsize` — e.g. `[4, 3]` (width, height in inches)

**Expect:** Faceted plots (when facet row/col used) honor xarray `facetgrid_figsize`; single-panel plots unchanged.

**Test:**

1. Set `facetgridFigsize` to `[6, 2]`.
2. Open a faceted-capable variable; set facet row/col; create plot.
3. Panel layout should differ vs unset (subjective visual check); no Python error in Output channel.
4. Clear setting (empty array) → xarray defaults restored.

---

### 12. Sentinel SAFE claims removed (Phase 0)

**Expect:** Explorer context menus and keywords **no longer** mention `.safe` / Sentinel SAFE.

**Test:**

1. Inspect **package.json** contributions or right-click files in explorer — no SAFE-specific open entry.
2. Extension test suite includes regression for this (`test/suite/extension.test.ts`).

---

### 13. Python backend restructuring (no behaviour change expected)

**Expect:** Every viewer feature behaves exactly as before; only the two error messages below are new.

**Test:**

1. Run the snapshot check (needs `sample-data/`; record a baseline first if `python/.golden/` is empty):

   ```bash
   python python/tools/golden_snapshots.py record   # on a known-good commit
   python python/tools/golden_snapshots.py check    # after changes: expect "0 failing"
   ```

2. Open a few files of different formats (NetCDF with groups, Zarr, GeoTIFF, Kerchunk) and create plots with facets and dimension slices: results should match v0.13 before the restructuring.
3. Plot with a datetime range that matches no data → clear _"No data to plot"_ error instead of a `ZeroDivisionError`.
4. `python python/create_sample_data.py --overwrite` completes with exit code 0 and rewrites the generated files; running it twice yields the same snapshots.

### 14. Issue templates (repository)

1. On GitHub, **New issue** → pick each of _Bug Report_, _Feature Request_, _Question / Discussion_.
2. The intro says all fields are optional; no field is marked with a red asterisk.
3. Submit with only a title → the issue is created (try on a fork to avoid noise).

---

### 15. Automatic rebuild of the extension uv environment

**Expect:** with **`useExtensionOwnEnvironment`** on, an environment created by an older version (or recorded with a lower `ENVIRONMENT_REVISION`) is deleted and created again from scratch once at startup; later starts reuse it without reinstalling. If the rebuild fails, the previous environment is restored.

**Automated:** `scripts/upgrade-sandbox.sh` runs a real v0.12.1 → v0.13.0 upgrade in a throw-away VS Code profile, with the scenarios `normal`, `offline` and `interrupted`; see [`UPGRADE_TEST_PLAN.md`](./v0.13/UPGRADE_TEST_PLAN.md).

**Test by hand:**

1. Remove any `overridePythonInterpreter` setting (it takes precedence), enable `scientificDataViewer.python.useExtensionOwnEnvironment`, reload. Wait for the environment to be created (first time only).
2. Simulate an environment from v0.12: in the environment folder (Linux: `~/.config/Code/User/globalStorage/eschalk0.scientific-data-viewer/python-environment/`; **Manage Extension Virtual Environment → Open in Explorer** shows it), delete `sdv-environment.json` and create an empty file `old.txt`.
3. Reload window → notification _"rebuilding its Python environment for this new version…"_, then _"Python environment rebuilt"_. `sdv-environment.json` is back with `"revision": 2` and `eccodeslib<2.48` in its requirements; `old.txt` is gone; no `python-environment.previous` folder is left.
4. Reload again → **no** notification; the logs show `Extension virtual environment is up to date` (no `uv venv --clear`, no package install).
5. **Manage Extension Virtual Environment → Recreate** → progress notification, then _"recreated successfully"_; files still open.
6. _(Optional, offline)_ delete `sdv-environment.json` again, disconnect the network, reload → warning that the rebuild failed; files still open with the previous environment. Reconnect, reload → the rebuild runs.

### 16. Code review: security (escaping, CSP, commands)

**Expect:** names from files are shown as text; nothing is executed.

**Test:**

1. In Python, create a file whose variable name contains HTML:
   ```python
   import xarray as xr
   xr.Dataset({'<img src=x onerror=alert(1)>': ('x', [1, 2])}).to_netcdf('xss.nc')
   ```
2. Open `xss.nc` → the variable list shows the literal text `<img src=x onerror=alert(1)>`; no broken image, no alert.
3. **Developer: Open Webview Developer Tools** → Console: no CSP violation errors during normal use (loading, plotting, collapsing sections, error page links).
4. On the error page (open an unsupported file, e.g. a `.txt` renamed to `.nc` with garbage content), click **🎮 Extension Settings**, **🎮 Check VSCode Output panel**, **🎮 Install xarray** → each still works.

### 17. Code review: uv environment and interpreters

**Test:**

1. With `useExtensionOwnEnvironment` on, **Manage Extension Virtual Environment → Update Packages** → the log shows `uv pip install … xarray>=2026.4.0 … zarr>=3` (pins quoted in the log) and **no** files named `=2026.4.0` / `=3` appear in the opened workspace folder.
2. From the error page, click **🎮 Install matplotlib** with the extension environment active → installs with uv (no "pip is not available").
3. Set `overridePythonInterpreter`, then enable `useExtensionOwnEnvironment` → the message says the override takes precedence (not "uv is not installed").
4. With **no folder open**, create the environment from **Manage Extension Virtual Environment** → success message, no "Failed to create" error.

### 18. Code review: panel and plots

**Test:**

1. Right-click a Kerchunk reference saved as plain `refs.json` → **Open as Kerchunk / virtual Zarr** → File Information shows the Kerchunk engine (not a JSON error); opening it normally as well gives a second tab.
2. Set `maxFileSize` to `1` and open a file > 1 MB → message says `Maximum allowed: 1MB`. Reset the setting.
3. Create a plot, click **Save** and ignore the "Plot saved" notification for > 60 s → no "Request timeout" error; **Save All Plots** saves every plot.
4. _(Windows)_ Save a plot → the file lands in `sdv-plots/` next to the data file; **Save As** proposes that folder.
5. Select a global time variable, then plot a variable without a time dimension → the plot is created (warning in the logs) instead of `KeyError`.
6. In a group, set only **cmap** in the Group Plot Controls → the group plot uses that cmap and the **global** checkbox values (e.g. robust).
7. Plot a 2D `(time, station)` variable → not squeezed into a sliver.
8. Outline (Explorer → Data Structure): click a group attribute → the viewer scrolls to it. Close the viewer → the outline is cleared.

### 19. Code review: backend errors and attributes

**Test:**

1. Open a corrupt `.nc` (e.g. `echo garbage > bad.nc`) → error page with an error type and suggestion (not the generic "file might be corrupted").
2. Open a file with a `valid_max = inf` attribute → opens; the attribute shows `inf`.
3. Attributes such as `_FillValue` / `valid_range` show numbers / arrays (`-999`, `[0.0, 2.0]`).
4. GRIB sample with temperature `t` → `t` is **not** offered in the time selector.

### 20. eccodeslib pin (GRIB / TIFF crash)

**Expect:** GRIB and GeoTIFF files open with the extension's uv environment, with no `free(): invalid pointer` / `double free or corruption` in the logs.

**Test:**

1. With `useExtensionOwnEnvironment` on and an environment recorded as `"revision": 1` (or with `eccodeslib` ≥ 2.48: check with `uv pip list --python <env>/bin/python`), reload the window → the rebuild notification appears once; afterwards `uv pip list` shows `eccodeslib 2.47.3.23`.
2. Open `sample-data/sample_data.grib`, `sample_data.grib2`, `sample_data.tif`, `sample_data_cog.tif` → each loads; plot a variable of each.
3. Command line check: `<env>/bin/python -c "import eccodes, pyproj"` exits with code 0.

### 21. Viewer styling refresh

**Expect:** the viewer looks like a native VS Code page in every theme, with no unreadable control.

**Test:**

1. Open `sample-data/sample_data.nc` with **Dark Modern**, then **Light Modern**, then a **High Contrast** theme (Preferences: Color Theme) → header toolbar shows four line icons (export, collapse all, expand all, refresh) whose tooltips match; every input / select is readable (no white input in dark themes); high contrast shows visible borders around cards and panels.
2. Scroll down → the header and the current section title stay at the top, with no gap between them.
3. Click **Collapse all** then **Expand all** → twisties rotate; nested content lines up under its title.
4. Expand a variable → the card shows its attributes; **Create Plot** → the plot appears inside the same card. Plot a variable that fails → red callout with a **Copy** button in its corner; click it → **Copied** for 2 s.
5. **Xarray Text Representation** → the **Copy** button floats in the top-right corner of the code block and does not hide the first line.
6. Narrow the editor to ~400 px → variable rows stack, time-control labels go above their inputs, no horizontal scroll.
7. Explorer → Data Structure: click a variable → the viewer scrolls to it and highlights it with the focus color.
8. Export the webview (download icon) and open the HTML in a browser → same look as in VS Code.
9. Open `sample-data/broken_file.nc` → the error page is a red-accented callout; the troubleshooting steps show `Ctrl`+`Shift`+`P` as keybinding labels and the install links as small outlined buttons.
10. No emoji is left: **Plot All** shows a warning line icon (a stop icon on **Cancel All** while plotting), and the error page uses line icons for its title, the troubleshooting heading, the install / settings / logs links and after external links.
11. _(Contributors)_ `npm run screenshots` → 24 PNG files in `screenshots/v0.13/<theme>/` and `screenshots/v0.13/index.html`; open the gallery and compare it with the steps above.
12. Make the editor wider than 1000 px and open `sample-data/sample_data.nc` → while **Loading** shows there is no scrollbar; when the content appears and the scrollbar shows up, the header and the content do not move sideways.

### 22. Plot type selector removed

**Expect:** each variable's plot row shows only the **Create Plot** button; plots look as before.

**Test:**

1. Open `sample-data/sample_data.nc`, expand a group → under each variable there is a **Create Plot** button and no "Auto (Recommended)" drop-down.
2. **Create Plot** on `temperature` and on a 1-D variable → both plots appear, same as v0.12 with "Auto" selected.
3. Make a plot fail (e.g. a dimension slice on a dimension that does not exist, in the group plot controls) → the error text ends with `(file_path=… variable_path=…)`, without `plot_type=`.
4. _(Contributors)_ `.venv/bin/python python/get_data_info.py plot sample-data/sample_data.nc /precipitation` → one JSON line with `plot_data`; `pytest python/tests` and `python python/tools/golden_snapshots.py check` pass (re-`record` once: error snapshots lose `plot_type='auto'`, and `plot__histogram` no longer exists).

### 23. Architecture diagrams (contributors)

**Expect:** the diagrams in `docs/architecture/` are regenerated from the code and match it.

**Test:**

1. `.venv/bin/python scripts/architecture/generate.py --check` → "every module is placed and every referenced symbol exists", exit code 0.
2. With Graphviz installed (`dot -V`): `.venv/bin/python scripts/architecture/generate.py` → "Wrote 9 SVG figures, architecture.html and README.md"; `git status docs/architecture` shows no change on a clean checkout.
3. Open `docs/architecture/README.md` on GitHub (or in the VS Code Markdown preview) → 10 sections, 9 figures readable in the light and the dark theme, two protocol tables.
4. Open `docs/architecture/architecture.html` in a browser → same content on one page; hovering a box of the module graphs shows its path.
5. Add an empty `src/common/Example.ts`, run step 1 again → it fails with `src/common/Example.ts is not placed in graphs.HOST_LAYERS`; delete the file.

### 24. Xarray Encoding section and variable card sections

**Expect:** the encoding has its own collapsed section; a variable's sections collapse one by one or all at once from its row.

**Test:**

1. Open `sample-data/sample_data.nc` → under **Variables**, each variable is one collapsed line; the section headers of the group show counts (e.g. **VARIABLES 3**); a collapsed **XARRAY ENCODING** section follows **ATTRIBUTES**.
2. Click a data variable's row → **ATTRIBUTES n** (open), **XARRAY ENCODING n** (collapsed), **PLOT** (open, **Create Plot**). No `__xarray_encoding.` text anywhere.
3. Open **Xarray Encoding** → `dtype`, `_FillValue`, `source`… Collapse **Attributes**. Click the variable's row → everything hides; click again → Attributes still collapsed, Encoding still open.
4. Click a coordinate → **Attributes** and **Xarray Encoding**, no Plot section. A coordinate with neither (and no small value) shows a plain row, without twistie.
5. Collapse all variables, press **Plot All** → each plotted variable opens on its Plot section; collapsed groups stay collapsed.
6. Explorer → Data Structure: expand a variable → **Xarray Encoding (n)**; click an entry → the viewer opens the card and the section and highlights the line.
7. Set `"scientificDataViewer.showXarrayEncodingAttributes": false`, **Refresh** → no Xarray Encoding section (groups, coordinates, variables, outline); attributes unchanged.
8. Export the webview → open the HTML in a browser → sections open / closed as at export time, and they still collapse.
9. Each group is one card: its header shows the group name and its counts (e.g. "3 dimensions · 3 coordinates · 3 variables"); its sections (Group Plot Controls … Xarray Encoding) are separated by thin lines inside the same border. Scroll down inside an open group → its header stays under the toolbar until the end of the group, and the content passes under it. Collapse the group → only the header row is left, with its counts.
10. Expand the group **Attributes** section → each `:` sits right after the attribute name, as in a variable's **Attributes** and in the **Xarray Encoding** sections (it used to sit next to the value).

### 25. Cancel a single plot

**Expect:** a running plot can be stopped from its own Plot section.

**Test:**

1. Open a large file (or set `"scientificDataViewer.plotTimeoutMs": 60000` and plot a large variable without slices) → click **Create Plot** → **Create Plot** is greyed out and a red **Cancel** button appears next to it; **Cancel All (1)** appears in the Global Plot Controls.
2. Click **Cancel** → the plot area shows **Plot cancelled.** (no red error), **Cancel** disappears, **Create Plot** works again, **Cancel All** is hidden. **Show Logs**: `Aborting process for operation: plot-…`.
3. Start two plots, cancel one → only that one shows **Plot cancelled.**; the other finishes and **Cancel All** shows (1) meanwhile.
4. Start a plot and click **Cancel All** → the variable shows **Plot cancelled.**, not the "Process was aborted" error.
5. Press **Plot All**, then **Cancel** on one running variable → the final notification counts it as cancelled, not failed.

### 26. Load time in local time

**Expect:** the **Loaded:** time at the top right is in local time by default.

**Test:**

1. Open any sample file → the top right shows `Loaded: <date>T<time>.<ms>+HH:MM` (or `-HH:MM`), with the time of your clock and your time zone offset (`+00:00` in UTC).
2. Set `"scientificDataViewer.showLoadTimeInLocalTime": false` → **Refresh** (🔄) → `Loaded: …Z`, in UTC (same instant).
3. Set it back to `true` (or remove it) → **Refresh** → local time again.

### 25. Plot controls layout

**Expect:** plot controls read as aligned fields in titled blocks.

**Test:**

1. Open `sample-data/sample_data.nc` → **Global Plot Controls** → one card: **Dimension slices** and **Plot parameters** (and **Time range** with `globalTimeControls` on), each with a bold title, a hint and **Reset** on the right.
2. Plot parameters show four captions (**Facets**, **Axes**, **Color**, **Figure**); every field has its name above its control, and the controls line up in columns across captions. Checkboxes sit in the same columns as the inputs.
3. Type `0` in a dimension slice and `20` in **bins** → **Reset** of Dimension slices clears the slice only → **Reset** of Plot parameters clears `bins` and restores the default checkboxes.
4. Expand a group → **Group Plot Controls** has the same layout, without a box of its own. A group value still overrides the global one (`bins` 10 in the group, 30 globally → the group's variable uses 10).
5. Narrow the editor to ~400 px → two columns of fields, no horizontal scroll.

### 26. Dimension slices: boxes and slider

**Expect:** a slice can be typed in three boxes or set with a slider, and both stay in sync.

**Test:**

1. Open `sample-data/sample_data.nc` → **Global Plot Controls** → **Dimension slices**: each dimension shows `start : stop : step` boxes and a slider with both handles at the ends.
2. Type `2` in **start** of `time` → both handles jump to 2. Type `5` in **stop** → the second handle moves to 4 (stop excluded), the track between them is highlighted.
3. Drag the right handle → only **stop** follows (handle index + 1), **start** is not rewritten (type `-10` in start first: it stays `-10`). Drag it over the left one and beyond → the handles swap roles, both boxes change and show lower : higher.
4. Put the two handles on the same position → **stop** empties: a single index. With a **step** typed, stop empties too and the step is struck through (ignored); pull the handles apart → the step counts again.
5. Drag the handles back to both ends → start and stop empty (no selection); the step box is never changed by the slider.
6. Paste `0:24:2` in **start** → the three boxes fill and the focus goes to **step**. Paste `5::2` → stop becomes the dimension size (to the end). Type `abc` in a box, or start `8` stop `3` → outlined in red. Type step `-1` → the slider greys out.
7. **Create Plot** with `time` start `0`, stop `2` → the plot uses two time steps; with start `1` only → one time step (no time dimension left).
8. **Reset** next to **Dimension slices** → boxes empty, handles back at both ends. Same in a group's **Group Plot Controls** (group values still override the global ones).

---

## Known limitations (unchanged or noted)

- **Plotting** remains **experimental** (timeout, auto strategy only).
- **`fileSize`** for directory stores is still `os.path.getsize` on the directory inode (rough size, not store bytes).
- **eccodeslib** stays below 2.48 in the extension environment until a fixed release exists; other interpreters with eccodeslib ≥ 2.48 and pyproj still crash at exit (`pip install "eccodeslib<2.48"`).
- **cftime axes** need `nc-time-axis` to be plotted (not in the uv bundle).
- **`joinId`** maps every non-alphanumeric character to `-`, so groups like `/a.b` and `/a-b` share element ids (rare; pre-existing).
- **Kerchunk** Parquet references: context menu exists; validation is lighter than JSON `refs` sniffing, and relative target paths are not resolved (JSON only) — treat as experimental.
- **NaN `fill_value`** of Zarr variables is displayed as the text `np.float64(nan)` in the Xarray Encoding section.
- **Viewer styling on VS Code < 1.77** (no `color-mix()`): cards and panels have no tinted background; everything stays readable.
- **Screenshots** use theme variables recorded from VS Code 1.144 (`scripts/screenshots/themes/`); re-run `capture-themes.mjs` when the default themes change. The xarray HTML representation keeps its own colors in high-contrast themes.
- **Architecture diagrams**: the sequence diagrams, the process overview and the pipelines are drawn by hand in `scripts/architecture/figures.py`; `--check` only catches renamed or removed symbols, not a changed order of calls. Graph layouts can differ slightly between Graphviz versions (generated with 2.43).
- **Cancelling a plot right after clicking Create Plot**: if the abort reaches the extension before the Python process is started, nothing is stopped and the process runs to the end (its result is ignored; the plot timeout still applies). The same was already true of **Cancel All**.
- **Load time setting** applies at the next load or **Refresh** (🔄), like the other display settings; an exported webview keeps the time as shown at export.
- **Timedelta units decoding** is not restored (xarray 2026 removed it); degraded `decode_cf=False` retry from v0.11.2 still applies.

---

## Summary of changes

| Area          | Change                                                                                                                                                                                                                                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Python**    | xarray 2026 / zarr 3 pins; Zarr ZIP + detection; Kerchunk engine; COG sniff; NetCDF order; inherited coords; plot options                                                                                                                                                                                                          |
| **Backend**   | `get_data_info.py` split into the `sdv_backend` package; `create_plot` / `get_file_info` decomposed; plot-type and empty-selection errors fixed; golden snapshot harness                                                                                                                                                           |
| **Extension** | New settings; Kerchunk command/editor; folder/ZIP menus; uv environment rebuilt automatically when a version requires it (not at every start), **Recreate** action; backend says when xarray is too old                                                                                                                            |
| **Docs**      | Issue templates: all fields optional; `docs/v0.13/` planning; `docs/v0.13/PR_SUMMARY_0.13.0.md`; README regenerated; this release note; architecture diagrams generated from the code (`docs/architecture/`, `scripts/architecture/`)                                                                                              |
| **Samples**   | `python/sample_data/` package (unsuffixed Zarr v3, sharded Zarr, Zarr ZIP, gzip NetCDF, COG, Kerchunk ref); reproducible; `python python/create_sample_data.py [--overwrite]`                                                                                                                                                      |
| **Review**    | Security fix (escaping, CSP, command allowlist, path validation); uv pins; Kerchunk URI; Windows paths; init races; message bus / state store simplified; webview in TypeScript (esbuild); healthcheck and plot strategies simplified; backend always returns JSON; see [`CODE_REVIEW_TODO.md`](./v0.13/CODE_REVIEW_TODO.md)       |
| **UI**        | Viewer restyled to match current VS Code (rounded cards, wider gutters, SVG icon toolbar, twisties, consistent form controls, callouts); colors from the theme only; one-option plot type selector removed; xarray encoding in its own section; variable and group cards; Cancel button for a single plot; load time in local time |
| **Tests**     | moved to `python/tests/`; new `test_empty_selection.py`; `test_zarr_store_detection.py`, `test_kerchunk_references.py`, `test_netcdf_datatree_quality.py`, `test_cog_detection.py`, `test_facetgrid_figsize.py`, extension contribution tests                                                                                      |

---

## Links

- [Changelog](../CHANGELOG.md#0130---2026-09-15)
- [Pull request summary / MR description](./v0.13/PR_SUMMARY_0.13.0.md)
- [Getting started with v0.13 (review, test, release hub)](./v0.13/GETTING_STARTED.md)
- [Manual test plan (step by step, with results sheet)](./v0.13/MANUAL_TEST_PLAN_0.13.0.md)
- [Upgrade test plan (users updating from v0.12)](./v0.13/UPGRADE_TEST_PLAN.md)
- [v0.13 planning folder](./v0.13/README.md)
- [Previous release: v0.12.1](./RELEASE_NOTES_0.12.1.md)
