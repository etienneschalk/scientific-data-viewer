# QA fixes — v0.13.0

Tracks the fix of every finding of the [QA report](./QA_REPORT_0.13.0.md). A box is checked when the fix is in the working tree with its test; numbers match the report.

## Tooling

- [x] **T. QA harnesses versioned** in `scripts/qa/` (webview harness, backend differential tests, hostile fixtures, VS Code end-to-end suites), runnable without the session scratchpad

## Bugs

- [x] **1. Small or huge negative vmin / vmax break the plot** — `-1e-7`, `-1e+21` are read as CLI options (`argument --vmin: expected one argument`)
- [x] **6. Values starting with `-` read as CLI options** — dimension `-x` as x / y / hue / row / col, `matplotlibStyle` `-x` (same root cause as 1)
- [x] **3. `NaN` / `inf` shown as `np.float64(nan)` / `np.float64(inf)`** — attributes and `_FillValue`; arrays show `"nan"` in quotes
- [x] **2. Closing a viewer while it loads leaves its outline** (and leaks its cached headers)
- [x] **5. Error notification for a viewer already closed** (`broken_file.nc` closed within 1 s)
- [x] **7. An older load can overwrite a newer one** (two refreshes in a row)
- [x] **9. Closing a viewer does not stop its running plot**
- [x] **8. Export Webview exports the first visible panel**, not the active one, in a split
- [x] **4. Plot All re-runs a variable already plotting**; Cancel then leaves an orphan that overwrites "Plot cancelled."
- [x] **10. Invalid numbers silently ignored** (`vmin = 1,5`, `size = -3`)
- [x] **11. A group checkbox left at its default cannot override a changed global checkbox**
- [x] **12. Kerchunk error messages** — invalid JSON reported as "no 'refs' mapping"; missing target as an empty `ReferenceNotReachable()`; empty `refs` as `GroupNotFoundError`
- [x] **13. Header icons overlap the version badge at 320 px**
- [x] **14. Settings bounds** — `maxFileSize` 0 / -1 refuses every file; the limit silently never applies to Zarr directories; `facetgridFigsize` below its 0.1 minimum passed through

## Hardening

- [x] **H1. Install packages from the webview accepts uv / pip options** (`--index-url …`)
- [x] **H2. Export with no captured HTML** fails only after the save dialog
- [x] **H3. "Python environment not ready"** does not say whether the interpreter is missing or lacks packages
- [x] **H4. Python < 3.10 interpreter**: the package check crashes with `TypeError: 'type' object is not subscriptable` instead of saying the interpreter is too old (found while fixing; also in v0.12.1)

## Found while fixing

- [x] **O1. Outline Expand All could leave an item collapsed**, noted by the end-to-end suites (also in v0.12.1). The suites first counted rejected `reveal()` calls (28 on `sample_zarr_arborescence.zarr`), which overstated it: recording what VS Code draws (`getTreeItem`) shows that almost every rejected item is drawn expanded anyway, and that one nested group of `xss_groups.nc` really stayed collapsed. Fixed: items are revealed one at a time, parents first, a failed one is retried once. No item is left collapsed on any QA file; the reveals still rejected on `sample_data_multiple_groups.nc` are drawn expanded (confirmed by hand).

## Known limitations found while fixing (not fixed)

- **N1. Names longer than 256 bytes** (valid in HDF5, not in netCDF; written by h5netcdf): netCDF-C reads them past its `NC_MAX_NAME` limit, so the netcdf4 engine either fails (`UnicodeDecodeError`, then h5netcdf opens the file) or returns a garbled name, depending on memory contents. `info` and `plot` can then disagree ("Variable … not found", 1–4 times in 20 runs, also in v0.12.1). Upstream netCDF4-python / netCDF-C issue; work-around: put `h5netcdf` first in `scientificDataViewer.netcdfEngineOrder`. The QA plot suite skips these names.

## Docs and release

- [x] **D1. Golden snapshots** re-recorded; manual test plan §13 says when to re-record
- [x] **0. Stale `.vsix`** rebuilt from the final tree; file count corrected in the release docs
- [x] **P1. The `.vsix` holds the strict minimum**: `.vscodeignore` is an allow-list (everything excluded, each runtime file named), so nothing new is packaged by accident (`.qa/` was, as a deny-list let any new folder through); no source maps; `vscode:prepublish` deletes `out/` first. 70 files; the unpacked `.vsix` passes the VS Code suites `s1`, `s3`, `s10`
- [x] **Release docs** updated (CHANGELOG, release notes, PR summary)
