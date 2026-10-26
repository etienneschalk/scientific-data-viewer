# Scientific Data Viewer v0.13.0 Release Notes

**TL;DR** — Aligns with **xarray 2026.4+** and **zarr-python 3**: better Zarr discovery (unsuffixed dirs, ZIP archives, v3 encoding metadata), NetCDF/DataTree quality settings, experimental **Kerchunk** references, **COG** labelling, and plot extras (`col_wrap='auto'`, `facetgridFigsize`). Removes stale **Sentinel-1 SAFE** claims from the UI. Internally, the Python backend is restructured from one 3,700-line script into the **`sdv_backend`** package (no user-visible behaviour change), and sample data generation becomes a reproducible package with **`--overwrite`**.

**Planning docs** (what shipped vs deferred): [`docs/v0.13/`](./v0.13/README.md)

---

## Why this release?

v0.13 is a **technology alignment** release. xarray **2026.04.0** raised its minimum **zarr** to **3.x** and added DataTree/plotting improvements the extension now surfaces. The viewer stays **metadata-first** (no Dask clusters, no cloud auth, no write/convert pipelines).

| Area                  | What v0.13 adds                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zarr 3 stack**      | Pins `xarray>=2026.4.0`, `zarr>=3` in the optional uv env; rejects zarr 2.x as “too old”                                                                         |
| **Zarr UX**           | Opens stores **without** a `.zarr` suffix; **ZIP** archives; **v2/v3** format label and codec/shard encoding in attribute tables                                 |
| **NetCDF / DataTree** | Configurable **engine order**; **HDF5 filter** metadata; **inherited coordinates** on child groups                                                               |
| **Virtual Zarr**      | Experimental **Kerchunk** JSON (named patterns + context menu)                                                                                                   |
| **Rasters**           | **COG** label in File Information after rasterio open                                                                                                            |
| **Plots**             | **`col_wrap='auto'`** checkbox; **`facetgridFigsize`** workspace setting                                                                                         |
| **Honesty**           | **`.safe`** removed from explorer menus/keywords (was never implemented)                                                                                         |
| **Maintainability**   | Python backend split into the **`sdv_backend`** package; sample generators into **`sample_data`** (see [§ Backend restructuring](#python-backend-restructuring)) |

**Not in v0.13:** OME-Zarr, NWB, FITS, pyfive fallback, HDF4 `.hdf`, Sentinel SAFE re-implementation, STAC/OPeNDAP/Icechunk UX. See [`docs/v0.13/OUT_OF_SCOPE.md`](./v0.13/OUT_OF_SCOPE.md).

---

## Upgrade notes (read before updating)

### Python / zarr version

- **xarray ≥ 2026.4.0 requires zarr-python ≥ 3.0.** If your interpreter still has **zarr 2.x**, the extension reports it as unusable and suggests `zarr>=3`.
- **Zarr v2 data** on disk remains readable through **zarr-python 3**; you do not need to rewrite stores for metadata viewing.
- **Extension uv environment:** If you use **Scientific Data Viewer → Use Extension Own Environment**, run **Manage Extension Virtual Environment → Update** after upgrading so pins (`xarray>=2026.4.0`, `h5netcdf>=1.8`, `zarr>=3`) apply.

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
| `plotting/`                      | `create_plot` (~110 lines): `selection.py` (variable, slices, datetime filter), strategies, `render.py` |

Sample generators moved to **`python/sample_data/`** (one module per format family); `python/create_sample_data.py` remains the entry point.

### How behaviour was preserved

Before any code moved, a **golden snapshot harness** (`python/tools/golden_snapshots.py`) recorded the backend's JSON output for 74 `info` / `plot` invocations on `sample-data/` (plot images compared by hash, with a frozen clock). Each refactoring step was checked against it; the code was moved verbatim first and only then decomposed. Snapshots stayed identical except where a bug fix below intentionally changed the output.

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

## New settings (summary)

| Setting                    | Default                          | Effect                                                                                             |
| -------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `netcdfEngineOrder`        | `["netcdf4","h5netcdf","scipy"]` | Try-order for `.nc` / `.nc4` / `.netcdf` only (not NASA `.cdf`)                                    |
| `showInheritedCoordinates` | `true`                           | Child DataTree groups show parent coords; `inherited_from` attribute marks source path             |
| `facetgridFigsize`         | `[]` (unset)                     | Optional `[width, height]` inches → `xr.set_options(facetgrid_figsize=...)` during plot subprocess |

Existing settings from v0.12 still apply (`orderGroupsAlphabetically`, `showXarrayEncodingAttributes`, plot controls, etc.).

---

## Manual verification guide

Use this checklist if you have **not** reviewed every commit on the branch. Each section states **what to expect**, **how to test**, and **common failure modes**.

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

**Expect:** With **`showXarrayEncodingAttributes`** on (default), variables/coordinates show `__xarray_encoding.*` including Zarr v3 **codecs**, **shards**, etc.; format string distinguishes **Zarr v2** vs **Zarr v3**.

**Test:**

1. Open a **v3** store (directory with `zarr.json`).
2. Expand a variable → attributes include keys like `__xarray_encoding.compressors` / shard-related entries (exact keys depend on the store).
3. Toggle **`showXarrayEncodingAttributes`** off → refresh → encoding keys disappear.
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

**Expect:** gzip (or other) compressed NetCDF4 variables show `__xarray_encoding.filters.*` (e.g. `zlib`, `complevel`) when encoding attributes are enabled.

**Test:**

1. Create a small gzip NetCDF locally:

   ```python
   import xarray as xr, numpy as np
   ds = xr.Dataset({"temp": ("x", np.arange(8, dtype="float32"))})
   ds.to_netcdf("gzip.nc", encoding={"temp": {"zlib": True, "complevel": 4}})
   ```

2. Open in viewer → variable attributes include `__xarray_encoding.filters.zlib` and `complevel`.
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

---

## Known limitations (unchanged or noted)

- **Plotting** remains **experimental** (timeout, auto strategy only).
- **`fileSize`** for directory stores is still `os.path.getsize` on the directory inode (rough size, not store bytes).
- **Unsupported paths** may still show “Missing dependencies for Unknown files:” with an empty package list (pre-existing).
- **Kerchunk** Parquet references: context menu exists; validation is lighter than JSON `refs` sniffing, and relative target paths are not resolved (JSON only) — treat as experimental.
- **NaN `fill_value`** of Zarr variables is displayed as the text `np.float64(nan)` in encoding attributes.
- **Timedelta units decoding** is not restored (xarray 2026 removed it); degraded `decode_cf=False` retry from v0.11.2 still applies.

---

## Summary of changes

| Area          | Change                                                                                                                                                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Python**    | xarray 2026 / zarr 3 pins; Zarr ZIP + detection; Kerchunk engine; COG sniff; NetCDF order; inherited coords; plot options                                                                                                                     |
| **Backend**   | `get_data_info.py` split into the `sdv_backend` package; `create_plot` / `get_file_info` decomposed; plot-type and empty-selection errors fixed; golden snapshot harness                                                                      |
| **Extension** | New settings; Kerchunk command/editor; folder/ZIP menus                                                                                                                                                                                       |
| **Docs**      | `docs/v0.13/` planning; `docs/PR_SUMMARY_0.13.0.md`; README regenerated; this release note                                                                                                                                                    |
| **Samples**   | `python/sample_data/` package (unsuffixed Zarr v3, sharded Zarr, Zarr ZIP, gzip NetCDF, COG, Kerchunk ref); reproducible; `python python/create_sample_data.py [--overwrite]`                                                                 |
| **Tests**     | moved to `python/tests/`; new `test_empty_selection.py`; `test_zarr_store_detection.py`, `test_kerchunk_references.py`, `test_netcdf_datatree_quality.py`, `test_cog_detection.py`, `test_facetgrid_figsize.py`, extension contribution tests |

---

## Links

- [Changelog](../CHANGELOG.md#0130---2026-09-15)
- [Pull request summary / MR description](./PR_SUMMARY_0.13.0.md)
- [v0.13 planning folder](./v0.13/README.md)
- [Previous release: v0.12.1](./RELEASE_NOTES_0.12.1.md)
