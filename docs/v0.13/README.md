# Scientific Data Viewer v0.13 — planning

Planning notes for **v0.13**, based on a technology watch of xarray **2026.04.0** / **2026.07.0**, zarr-python 3, and related scientific formats (September 2026). **Shipped as v0.13.0** — see [`docs/RELEASE_NOTES_0.13.0.md`](../RELEASE_NOTES_0.13.0.md).

These files are **specifications**, not release notes. They describe what to implement, what to remove, and what to leave out of v0.13.

| Document                             | Contents                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------- |
| [TO_IMPLEMENT.md](./TO_IMPLEMENT.md) | Features and format work to add, with files, APIs, and acceptance criteria |
| [TO_REMOVE.md](./TO_REMOVE.md)       | Dead or misleading surface area to delete or stop advertising              |
| [OUT_OF_SCOPE.md](./OUT_OF_SCOPE.md) | Formats and capabilities explicitly **not** in v0.13                       |
| [PHASES.md](./PHASES.md)             | Suggested implementation order and dependency pins                         |

## Goal

Stay aligned with the 2026 xarray/Zarr stack **without** turning the extension into a general remote-data or bioinformatics IDE. Prefer work that reuses `open_datatree` / `open_dataset` in `python/get_data_info.py` and the existing webview (groups, encoding attrs, experimental plots).

## Current format surface (v0.12.1)

| Format    | Extensions                         | Engine(s)                        |
| --------- | ---------------------------------- | -------------------------------- |
| NetCDF    | `.nc`, `.netcdf`, `.nc4`           | `netcdf4`, `h5netcdf`, `scipy`   |
| NASA CDF  | `.cdf`                             | `cdflib` (not `xr.open_dataset`) |
| HDF5      | `.h5`, `.hdf5`                     | `h5netcdf`, `h5py`, `netcdf4`    |
| Zarr      | `.zarr` folders                    | `zarr`                           |
| GRIB      | `.grib`, `.grib2`, `.grb`, `.grb2` | `cfgrib` (`open_dataset` only)   |
| GeoTIFF   | `.tif`, `.tiff`, `.geotiff`        | `rasterio` / rioxarray           |
| JPEG-2000 | `.jp2`, `.jpeg2000`                | `rasterio` / rioxarray           |

Opening prefers `xr.open_datatree` except for GRIB, rasters, and CDF. Encoding metadata is already shown as `__xarray_encoding.*` when `scientificDataViewer.showXarrayEncodingAttributes` is on.

## Ecosystem facts that drive v0.13

- xarray **2026.04.0** requires **`zarr>=3.0`**. Zarr v2 _data_ remains readable through zarr-python 3; zarr-python 2 is unsupported.
- Plotting gained `col_wrap="auto"` and `set_options(facetgrid_figsize=...)`.
- `DataTree.to_dataset(inherit="all_coords")` exists; inherited coordinates are now a first-class DataTree feature.
- Timedelta decoding via units is fully removed; the existing `decode_cf=False` retry (issue #136) stays the safety net.
- NetCDF default engine order is again **netcdf4 → h5netcdf → scipy**, overridable with `xr.set_options(netcdf_engine_order=...)`.
- h5netcdf **1.8** adds `Variable.filters()` and an optional **pyfive** backend.
- Virtual / cloud-native Zarr (Icechunk, Kerchunk, VirtualiZarr, ZEP-8 URLs) is how new stores are distributed; many are **not** named `*.zarr`.

## Guiding rules

1. **Metadata-first.** Do not require Dask-backed plots of huge arrays for v0.13.
2. **Optional packages stay optional** except where xarray itself now requires them (`zarr>=3` with a current xarray).
3. **No untested format claims.** Do not advertise `.safe` (or OME-Zarr, NWB, FITS) until a backend is wired and covered by sample data + tests.
4. **Custom editors vs folders.** Zarr-like stores are often directories. Reuse `openViewerFolder` and folder detection; do not assume a single file extension.
5. **Remove leftover UI** for formats that were already dropped (Sentinel-1 SAFE context menus).
