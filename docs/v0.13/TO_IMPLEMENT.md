# v0.13 — features to implement

Priority is **P0** (should ship), **P1** (if time), **P2** (stretch, still in-scope if a slice is clean). Out-of-scope items live in [OUT_OF_SCOPE.md](./OUT_OF_SCOPE.md).

Suggested order is in [PHASES.md](./PHASES.md).

---

## P0 — Xarray / Zarr alignment

### P0.1 Pin and document `zarr>=3`

**Why.** xarray 2026.04.0 made zarr-python 3 the minimum. The isolated uv environment currently installs unpinned `'zarr'` (`ExtensionVirtualEnvironmentManager.ALL_PACKAGES`, `PythonManager.extendedPackages`). A zarr 2 install will break a current xarray.

**Do**

- Pin `zarr>=3` (and a compatible `xarray` floor, e.g. `xarray>=2026.04.0` if Python 3.13 / uv env can take it; otherwise document the lowest xarray that still works with zarr 3).
- Apply the same pins in: `src/python/ExtensionVirtualEnvironmentManager.ts`, `src/python/PythonManager.ts`, README / `docs/documentation.json` install snippets, any healthcheck text.
- On env create/update, log resolved `xarray` and `zarr` versions (the webview already has “Show xarray version information”).
- Healthcheck: if `zarr` is present but `< 3`, report a clear error instead of a generic open failure.

**Acceptance**

- Fresh uv env installs zarr 3.x.
- Opening an existing Zarr v2 sample store still works (zarr-python 3 compatibility layer).
- Opening a Zarr v3 sample store works (`zarr.json` present).

**Risks.** Users on the Microsoft Python interpreter with old `zarr` 2.x. Surface a targeted install message, do not silently skip the engine.

---

### P0.2 Open Zarr stores that are not named `*.zarr`

**Why.** Zarr v3 identity is `zarr.json` (and v2 `.zgroup` / `.zarray` / `.zmetadata`). Icechunk and some pipelines use a plain directory. The custom editor and language contribution only match `*.zarr`.

**Do**

- **Detect** a directory as a Zarr store if any of these exist at the root (or a documented nested path):
  - `zarr.json` (v3)
  - `.zgroup` or `.zarray` or consolidated `.zmetadata` (v2)
- Wire detection into:
  - `scientificDataViewer.openViewerFolder` (already the Zarr entry)
  - explorer context menu for **folders** (not only `resourceExtname == .zarr`)
  - optional: when the user opens a file named `zarr.json`, open the **parent directory** as the store (same pattern as treating `.zarr` as a folder).
- Keep `*.zarr` custom editor; add folder-open UX so unnamed stores are reachable without renaming.
- Python: `FORMAT_ENGINE_MAP` / `FileFormatInfo` should accept a directory path whose “extension” is inferred as Zarr by markers, not only `Path.suffix == ".zarr"`.

**Acceptance**

- Sample v3 store in a directory named `sample_ocean` (no `.zarr` suffix) opens from “Open Scientific Data Viewer (Folder)”.
- Opening `zarr.json` in the explorer opens the parent store, not a useless JSON editor path through the scientific viewer (or: context menu on the folder only — pick one and document it).
- Existing `*.zarr` samples still open via custom editor.

**Files (expected)**

- `python/get_data_info.py` (`SupportedExtensionType`, format detection)
- `src/python/DataProcessor.ts` (path passed to CLI)
- `package.json` (`openViewerFolder` menus, possibly a `when` clause for folders)
- tests: sample store without `.zarr` suffix in `python/create_sample_data.py`

---

### P0.3 Zarr ZipStore (`.zip` / `.zarr.zip`)

**Why.** Zarr-python 2 opened paths ending in `.zip` as `ZipStore`. v3 does not; the intended approach is explicit `ZipStore` or [ZEP-8](https://github.com/zarr-developers/zarr-python/issues/2943) URLs such as `archive.zip|zip:|zarr3:`.

**Do**

- Treat `.zip` / `.zarr.zip` as a candidate Zarr store when the archive contains `zarr.json` or `.zgroup` (peek with `zipfile`, do not treat every zip as Zarr).
- Open via xarray `engine="zarr"` with a ZipStore or ZEP-8-style path, depending on the installed zarr-python API.
- Register a custom editor or context-menu item only after the zip sniff succeeds, **or** always offer “Open as Zarr” on `.zip` and fail with a clear message if it is not a store.
- Prefer the second option for v0.13 if VS Code cannot sniff zip contents in `when` clauses.

**Acceptance**

- A zipped copy of an existing sample Zarr opens and shows the same groups/variables as the directory store.
- A random `.zip` (not a store) shows a readable error, not a traceback in the webview.

**Risks.** Large zip central directories; sniff only metadata members (`zarr.json`, `.zgroup`), do not extract arrays.

---

### P0.4 Richer Zarr v3 encoding in the UI

**Why.** `showXarrayEncodingAttributes` already dumps `__xarray_encoding.*`. Zarr v3 adds **shards**, **codecs**, and more consistent **`fill_value`** (xarray 2026.04 / 2026.07 fill_value round-trip fixes). Users cannot tell v2 vs v3 from the current tables.

**Do**

- When collecting encoding, include when present: `chunks`, `shards` / shard shape, compressor/codec pipeline, `fill_value`, `zarr_format` (2 vs 3), `dimension_separator`.
- Optionally add a one-line **store summary** next to format/engine: `Zarr v3`, `consolidated: yes/no`, `sharded: yes/no`.
- Do not invent fields; only surface what xarray/zarr put on `.encoding` or store metadata.

**Acceptance**

- Sample v3 sharded array (if we add one in `create_sample_data.py`) shows shard shape in the encoding table.
- v2 sample still shows chunks / compressor as today.
- Toggling `showXarrayEncodingAttributes` off hides the new keys too.

**Files**

- `python/get_data_info.py` (encoding extraction)
- webview HTML for the optional store summary (`HTMLGenerator` / data info header)

---

### P0.5 `col_wrap="auto"` in the plot GUI

**Why.** xarray 2026.04.0 accepts `col_wrap="auto"`. The UI and CLI only allow a positive integer (`HTMLGenerator.ts`, `MessageTypes.ts`, `get_data_info.py` argparse, webview number inputs).

**Do**

- Global and per-group `col_wrap` controls: empty = unset (current), number ≥ 1 = int, explicit **Auto** (checkbox or select) maps to `"auto"`.
- Python: `col_wrap: int | Literal["auto"] | None`; pass through to `DataArray.plot` / `imshow` kwargs.
- CLI: `--col-wrap auto` or `--col-wrap 4`.
- Fallback: if xarray is older than 2026.04, ignore `"auto"` and log a warning (or map to existing `min(4, size)` heuristic used in auto-plot).

**Acceptance**

- Faceted plot with Auto produces a wrapped grid without the user picking a column count.
- Integer `col_wrap` behaviour unchanged (including issue #134 `add_legend` stripping).
- Group plot section still overrides global when the group section is in use.

**Files**

- `src/panel/HTMLGenerator.ts`, `src/panel/webview/webview-script.js`, `MessageTypes.ts`
- `src/python/DataProcessor.ts` (CLI args)
- `python/get_data_info.py`, `python/non_regression_test_plot.py`

---

## P1 — NetCDF / DataTree / h5netcdf

### P1.1 Optional `netcdf_engine_order`

**Why.** xarray reverted the default to netcdf4-first after a h5netcdf-default experiment. h5netcdf is often faster. The extension already tries engines in `FORMAT_ENGINE_MAP` order: `.nc` → `["netcdf4", "h5netcdf", "scipy"]`.

**Do**

- Setting `scientificDataViewer.netcdfEngineOrder`: enum or list, default matching xarray (`netcdf4`, `h5netcdf`, `scipy`).
- Pass into `get_data_info.py` so `available_engines` / try-order for `.nc` / `.nc4` / `.netcdf` follows the setting.
- Document that this does not apply to `.cdf` (NASA / cdflib).

**Acceptance**

- With only `h5netcdf` installed, files still open.
- With both installed, changing the setting changes `used_engine` in file info (and the webview “engine” display).

---

### P1.2 HDF5 filters next to encoding (`h5netcdf>=1.8`)

**Why.** h5netcdf 1.8.0 added `Variable.filters()` (zlib, szip, bzip2, blosc, zstd, complevel), matching netCDF4-python.

**Do**

- If the used engine is `h5netcdf` or `netcdf4` and filters are available, add `__xarray_encoding.filters.*` or a sibling `__hdf5_filters.*` block (pick one naming scheme; prefer encoding-adjacent, gated by `showXarrayEncodingAttributes`).
- Guard with `hasattr` / try-except so older h5netcdf still works.
- Optional uv pin: `h5netcdf>=1.8` in the isolated env (compatible with xarray 2026).

**Acceptance**

- gzip-compressed NetCDF4 sample shows complevel in the table.
- Missing `filters()` is silent (no error banner).

---

### P1.3 Inherited DataTree coordinates

**Why.** `inherit="all_coords"` (xarray 2026.04) matches how people write hierarchical Zarr/NetCDF. Flattening in `_flatten_datatree_groups` may already show coords only on the node that defines them, which looks like “missing coordinates” on children.

**Do**

- When building per-group coordinate lists, optionally merge inherited coords (default **on**, or a setting `scientificDataViewer.showInheritedCoordinates`, default true).
- Mark inherited coords in the UI (e.g. badge or attribute `inherited_from: /parent`) so they are not confused with local arrays.
- Implementation should use DataTree APIs (`to_dataset(inherit="all_coords")` or equivalent) rather than ad-hoc tree walks where possible.

**Acceptance**

- Existing sample `sample_zarr_*inherited*` (see `create_sample_data.py`) lists parent coords on child groups when the setting is on.
- Plotting a child variable still resolves those coordinates.

---

### P1.4 pyfive as last-resort HDF5/NetCDF reader

**Why.** h5netcdf 1.8 can use **pyfive** (pure Python HDF5) when libnetcdf / h5py wheels are painful. Niche but fits “open the file in the editor”.

**Do only if low cost**

- Optional extra `pyfive`; try h5netcdf with that backend if `netcdf4` and default h5netcdf fail.
- Document as experimental; do not make it a custom editor.

**Acceptance**

- If skipped for time, this item moves to a later version; do not advertise pyfive in the README.

---

## P1 — Virtual Zarr (Kerchunk references)

### P1.5 Open Kerchunk / VirtualiZarr reference files

**Why.** xarray’s IO guide treats Kerchunk JSON/Parquet references as a way to view NetCDF/HDF5/GRIB/TIFF archives as Zarr without copying data. High leverage for the same viewer.

**Do**

- New extensions: `.json` is too broad — **do not** steal all JSON. Use:
  - context menu **“Open as Kerchunk / virtual Zarr”** on `.json` / `.parquet` / `.parq`, and/or
  - filenames matching `*.kerchunk.json`, `*.ref.json`, or a setting for extra globs.
- Open with `engine="zarr"` plus fsspec `reference://` (or current VirtualiZarr/Icechunk-recommended API). Keep this **experimental**.
- Optional packages: `fsspec`, `kerchunk` (and `ujson` if still required). Do not add Icechunk as required.

**Acceptance**

- One small fixture: kerchunk JSON pointing at a local sample NetCDF; viewer shows variables without duplicating the `.nc`.
- Invalid JSON / non-reference file: clear error.
- No activation on every `.json` in the workspace.

**Out of this item.** Writing references, Icechunk commits, S3 auth, STAC.

---

## P2 — New scientific formats (opt-in packages)

Implement only with sample data, engine mapping, custom editor **or** folder opener, README row, and tests. Prefer one format done fully over three stubs.

### P2.1 OME-Zarr / NGFF (multiscale)

**Why.** Plain `open_datatree(..., engine="zarr")` already opens the store, but pyramids (`0`, `1`, `2` / `s0`, `s1`) look like unrelated groups. Bioimaging is a large Zarr user base.

**Stack (pick one, document the choice)**

- [ngff-zarr](https://ngff-zarr.readthedocs.io/) — NGFF v0.1–v0.6, `.ozx` zip (RFC-9)
- [xarray-ome](https://github.com/ianhi/xarray-ome) — DataTree-oriented backend
- [ome-zarr-py](https://github.com/ome/ome-zarr-py/) v0.16+

**Do**

- Detect OME-Zarr via NGFF `multiscales` (and optionally `omero`) attributes on the root/group.
- Present **one logical image** with scale levels as groups or a scale selector; do not dump every array as an unrelated variable if the library gives a better model.
- Optional `.ozx` as ZipStore + OME (depends on P0.3).
- Package: optional `ngff-zarr` or `ome-zarr`; not in core `ALL_PACKAGES` unless size is acceptable.

**Acceptance**

- Public or generated OME-Zarr sample: structure is understandable; at least one scale plots.
- Non-OME Zarr samples unchanged.

**Do not** convert arbitrary TIFF → OME on open.

---

### P2.2 Sentinel-1 SAFE via `xarray-sentinel` (optional)

**Why.** SAFE support was **removed** in v0.5.0 as untested, but `package.json` explorer menus still mention `.safe`. [xarray-sentinel 0.9.6](https://pypi.org/project/xarray-sentinel/) (June 2026) is a real xarray backend. Copernicus also ships **COG_SAFE**.

**Do (only as a complete feature)**

- Optional extra: `xarray-sentinel` (pulls rioxarray/dask).
- Open SAFE **directories** (and maybe `.SAFE` zip) with `engine="sentinel-1"` (confirm entry point name).
- Map SAFE tree (subgroups in attrs) onto existing DataTree / group flattening.
- Custom editor is awkward (directory product); use **Open Folder** + context menu on folders whose name ends with `.SAFE` / `.safe`.
- Sample: tiny fixture or documented skip in CI if too large.

If this is not fully done in v0.13, **still execute [TO_REMOVE.md](./TO_REMOVE.md) leftover `.safe` menus** so we do not pretend it works.

---

### P2.3 COG as a first-class label (not a new engine)

**Why.** Cloud Optimized GeoTIFF is already opened via rasterio. Users look for “COG” in the format table.

**Do**

- After a successful `rasterio` open, if GDAL/rasterio reports a tiled GeoTIFF with overviews (or `LAYOUT=COG`), set `display_name` / format string to **Cloud Optimized GeoTIFF (COG)** instead of generic GeoTIFF.
- Keep `band_as_variable` behaviour.
- README: mention COG under GeoTIFF, no new extension required (still `.tif` / `.tiff`).

**Acceptance**

- A COG sample shows the COG label; a plain striped TIFF stays “GeoTIFF”.
- Detection failure falls back to GeoTIFF (no error).

---

### P2.4 Extra GDAL raster extensions (narrow list)

**Why.** rioxarray/GDAL can read more than TIF/JP2. Unbounded GDAL support is out of scope.

**Consider only**

- `.hdf` (HDF4) if GDAL is present — common in older NASA products, distinct from `.h5`
- `.img` (ENVI) — only if sniff is cheap

**Do**

- Add to `FORMAT_ENGINE_MAP` as `rasterio`.
- Fail with “install rasterio/GDAL” like other rasters.
- Do **not** register every GDAL driver.

---

### P2.5 NWB (`.nwb`) via pynwb

**Why.** NWB is HDF5 (or Zarr via hdmf-zarr). Generic HDF5 open is a poor experience (typed neurophysiology hierarchy).

**Do only if** there is capacity for a dedicated path (like `cdflib`): `pynwb.NWBHDF5IO` → xarray conversion or a documented subset (TimeSeries as DataArrays).

**Minimum viable**

- Custom editor `*.nwb`
- Optional package `pynwb`
- Show file identity (`session_description`, `identifier`, start time) + a flat list of TimeSeries-like datasets
- Plot one 1D/2D series

If that subset is not honest, **defer** (see OUT_OF_SCOPE).

---

### P2.6 FITS (`.fits` / `.fit`)

**Why.** Astronomy; xarray lists FITS as Kerchunk-virtualizable, not as a built-in engine.

**Do (stretch)**

- Optional `astropy`; HDUs as groups, image HDUs as DataArrays, table HDUs as summarized columns (not a full spreadsheet).
- Or: only via Kerchunk (P1.5) without native FITS.

Prefer Kerchunk-only in v0.13 unless astropy is already an easy optional extra.

---

## P2 — Plotting extras

### P2.7 `facetgrid_figsize` setting

**Why.** xarray `set_options(facetgrid_figsize=...)` (2026.04).

**Do**

- Optional setting or plot-control pair (width, height) passed into `xr.set_options` for the plot subprocess only (do not leak globally across later CLI invocations if the process is one-shot — today’s architecture is one process per plot, so `set_options` in that process is enough).

**Acceptance**

- Faceted plots honor the size; single-panel plots unchanged.

---

## Cross-cutting implementation notes

### Python CLI / types

- Extend `SupportedExtensionType` / `FORMAT_ENGINE_MAP` / `FORMAT_DISPLAY_NAMES` / `ENGINE_PACKAGES` together.
- Keep `DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET` for cfgrib, rasterio, cdflib; add new engines that cannot DataTree-open.
- New optional extras must appear in missing-package messages the same way as `cfgrib` / `rioxarray`.

### VS Code contributions

For each new **file** format: language id (optional), custom editor selector, explorer context `when` clause, outline `when` clause (`activeCustomEditorId`).

For each new **directory** format: folder context menu + `openViewerFolder` only.

### Tests

- Python: open + flatten for each new store type; plot non-regression when plot kwargs change.
- Extension: `package.json` contribution tests (`test/suite/extension.test.ts`) for new editors / menus.
- Sample data: `python/create_sample_data.py` + git-lfs or generated-in-test policy consistent with existing samples.

### Docs to update when implementing (not this folder)

- `README.md` (generated from `docs/documentation.json` — update the source)
- `CHANGELOG.md` at release time
- Wiki Getting Started format table
