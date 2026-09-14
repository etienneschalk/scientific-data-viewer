# v0.13 — out of scope

Explicit **non-goals** so v0.13 stays a metadata viewer on xarray, not a data lake client. Revisit after P0/P1.

---

## Formats and products

| Item | Why not v0.13 |
| ---- | ------------- |
| **AnnData / `.h5ad`** | Single-cell object model (obs/var layers), not Dataset/DataTree. Needs a different UI. |
| **TileDB** | Separate array engine; xarray backend exists but is a new stack (and often cloud). |
| **Apache Parquet as tables** | Columnar tables, not n-D labeled arrays. Kerchunk *reference* Parquet (P1.5) is in scope; generic spreadsheet Parquet is not. |
| **STAC catalogs / collections** | Catalog of assets, not one dataset. Would need search UI and network. |
| **HDF5 packaging formats we do not understand** (MATLAB `.mat` v7.3, arbitrary HDF-EOS without a backend) | Generic `.h5` already opens best-effort; do not claim domain semantics. |
| **netCDF-Java / `.ncml`** | JVM stack; not xarray. |
| **GRIB via GDAL as a second GRIB path** | `cfgrib` remains the GRIB engine; dual engines for the same extensions cause confusing `used_engine` behaviour. |
| **Write / convert / export to other formats** | Viewer is read-only aside from plot PNG and HTML export of the webview. No `to_zarr` / Icechunk commit / OME write. |
| **OME-TIFF full microscopy workbench** | P2.1 is OME-**Zarr** only. TIFF stays GeoTIFF/rasterio. ngff-zarr can convert TIFF→OME; we will not run that on open. |
| **High Content Screening plates as a first-class UI** | Even if OME-Zarr lands, HCS layout is extra; show groups or defer. |
| **NWB if only a stub** | Either a honest TimeSeries subset (P2.5) or nothing. No “opens as HDF5 and good luck”. |
| **FITS tables as a dataframe editor** | Stretch P2.6 is images + summary only. |

---

## Remote, cloud, and compute

| Item | Why not v0.13 |
| ---- | ------------- |
| **OPeNDAP / Pydap / `https://` dataset URLs** | Custom editors are path-based; auth (URS, `.netrc`) and long lazy opens need a dedicated “Open URL” command and cancellation UX. |
| **Icechunk as a required extra** | Snapshots, branches, S3, virtual chunks. P0.2 may *detect* a local Icechunk dir as Zarr if `open_zarr` works with zarr 3; no branch picker, no commit. |
| **VirtualiZarr authoring** | Creating references is a pipeline tool. We only **open** existing Kerchunk JSON/Parquet if P1.5 ships. |
| **fsspec S3/GCS/Azure** in the isolated env by default | Credentials, region, huge installs. Local + optional user interpreter packages only. |
| **Dask cluster / expression arrays (xarray 2026.07)** | Plot and info stay in-process, eager or lightly lazy. No dashboard, no `chunks={}`. |
| **Persistent Python worker** | Called out as non-goal in v0.12.0 notes; still out of v0.13. |

---

## Plotting and xarray APIs we will not expose yet

From `docs/XARRAY_PLOT_GUI_DESIGN.md`, many kwargs exist (`surface`, `contourf` levels, `norm`, `extend`, 3D, etc.). v0.13 only adds **`col_wrap="auto"`** (P0.5) and optionally **`facetgrid_figsize`** (P2.7).

Do **not** in v0.13:

- Full plot-kind picker (`contour`, `surface`, `step`, …) beyond what already exists
- `inherit` as a user-facing NetCDF write option
- Restoring timedelta-from-units decoding (see [TO_REMOVE.md](./TO_REMOVE.md) R3)
- Switching default netCDF engine globally without a setting (P1.1 is the setting; no silent flip)

---

## Packaging

| Item | Why not |
| ---- | ------- |
| **Install every optional extra in the uv env** | `ALL_PACKAGES` is already large (`cfgrib` → eccodes). Do not add `pynwb`, `astropy`, `ome-zarr`, `xarray-sentinel`, `kerchunk`, `icechunk` to the default uv set unless a P2 feature ships **and** wheel size is reviewed. Default uv set should gain **`zarr>=3` pins** only (P0.1). |
| **Drop `netCDF4` in favour of h5netcdf-only** | Still needed for some files and DAP; P1.1 is order, not removal. |
| **Python versions other than 3.13 in the uv env** | Unrelated to this watch. |

---

## Product / UX

- No Jupyter kernel inside the webview
- No map widget / cartopy basemap requirement (rioxarray CRS attrs may display as attributes only)
- No “open all files in this STAC item”
- No claiming Sentinel, OME, NWB, or FITS in the Marketplace description until the corresponding P2 item is done **and** leftover removal (R1) is consistent with that claim
