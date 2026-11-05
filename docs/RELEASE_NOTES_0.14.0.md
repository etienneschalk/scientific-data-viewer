# Scientific Data Viewer v0.14.0 Release Notes

**TL;DR** — You can now see and control **how a file is decoded**. When CF time units are broken, the viewer turns off **only time decoding** (`decode_times=False`). `scale_factor` / `add_offset` and `_FillValue` masking keep working on the rest of the file. Before, it switched off all CF decoding (`decode_cf=False`). **Reopen raw** in File Information reloads the file with no decoding at all, to compare with the stored values. **Troubleshooting > How this file was opened** gives the exact xarray call, each keyword commented with where it comes from. Four **Decoding** settings (`maskAndScale`, `decodeTimes`, `decodeCoords`, `useCftime`) and a **`engineBackendKwargs`** setting (allowed keys only, user settings only) make the rest configurable. GeoTIFF / JPEG-2000 times are decoded as `datetime64`, like NetCDF ones. **Security**: `python.overridePythonInterpreter` is now read from user settings only, so a cloned repository can no longer choose the program the extension runs.

**Start here** to review, test or release v0.14: [`docs/v0.14/GETTING_STARTED.md`](./v0.14/GETTING_STARTED.md).

---

## Why this release?

### Where the decoding choices came from

The viewer's decoding history, from the git log:

| Date       | Version       | Change                                                                                                                                                                                      |
| ---------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2025-09-29 | 0.x           | `mask_and_scale=False` for rasterio (commit "Display fixes", no rationale written): rasters keep their integer dtype and raw values, nodata stays an attribute, no float copy of each band. |
| 2025-10-08 | 0.x           | `decode_cf=False` hard-coded, the day after a fix of NaN handling in the JSON output.                                                                                                       |
| 2025-10-09 | 0.x           | "More robust defaults with `decode_cf=False` except for rasterio engine": a per-engine table.                                                                                               |
| 2025-12-04 | 0.x           | Back to `decode_cf=True` "for better CF convention handling", with the xarray encoding shown in the attributes.                                                                             |
| 2026-06-18 | 0.11.2 (#136) | Retry with `decode_cf=False` when CF time units cannot be decoded; File Information shows **Mode: degraded (decode_cf=False)**.                                                             |
| 2026-10    | 0.13.0        | Same behaviour, moved into the `sdv_backend` package.                                                                                                                                       |

The fallback was too blunt. A single variable with a bad `units` attribute turned off **every** decoder for the **whole** file. Packed variables (`int16` with `scale_factor`) then showed their stored integers, and `_FillValue` stopped being masked. Users could not choose the decoding or see it. The only way to inspect raw values was to edit the code.

### What v0.14 changes

| Area                     | v0.13                                                    | v0.14                                                                                                            |
| ------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Broken time units        | `decode_cf=False`: no masking, no scaling, no times      | `decode_times=False`, `decode_timedelta=False`: everything else still decoded                                    |
| Looking at stored values | Not possible                                             | **Reopen raw** / **Reopen decoded** in File Information (per tab)                                                |
| How the file was opened  | `Used Engine` only                                       | **Troubleshooting > How this file was opened**: reproducible call, source of each keyword, notes, failed engines |
| Decoders                 | Fixed                                                    | Settings `decoding.maskAndScale`, `decodeTimes`, `decodeCoords`, `useCftime` (default: the engine decides)       |
| Engine `backend_kwargs`  | Hard-coded table                                         | Setting `engineBackendKwargs` (allowlist, user settings only)                                                    |
| Raster times             | cftime objects (band axis), or lost (bands as variables) | `datetime64` (band axis); bands as variables still honoured, with a note explaining the lost axis                |
| Kerchunk time fallback   | No effect (xarray does not forward `decode_cf` to it)    | Works; raw mode works too                                                                                        |

---

## Upgrade notes (read before updating)

- **Nothing to do by default.** With every new setting left at `default`, files open as in v0.13. The one change is files with broken time units: they now keep masking and scaling, so packed variables show physical values (e.g. `273.15` K instead of `0`) and fill values show as `NaN`.
- **Settings that need Refresh (🔄)**: `scientificDataViewer.decoding.*` and `scientificDataViewer.engineBackendKwargs` are read at each load. Refresh the viewer, or reopen the file, after changing them.
- **`engineBackendKwargs` in a workspace is ignored on purpose.** The setting is machine-scoped, so put it in your **user** settings. VS Code flags a value in `.vscode/settings.json` as not applicable, and the extension does not read it.
- **Backend JSON contract**: the info result's `decode_cf_degraded` (boolean) is replaced by `open_report` (object, see `OpenReport` in `python/sdv_backend/results.py`). Scripts that parse `get_data_info.py info` output must read `open_report.degraded_decoders` instead. Golden snapshots recorded with v0.13 (`python/tools/golden_snapshots.py`) differ on this key: record them again.
- **`python.overridePythonInterpreter` in a workspace is now ignored.** If you set it in a project's `.vscode/settings.json` (e.g. `.venv/bin/python`), the extension falls back to the next interpreter source (own environment, then the Python extension's interpreter) and logs a warning. Either select that interpreter with **Python: Select Interpreter**, or move the override to your **user** settings with an absolute path. See [§ Interpreter override](#interpreter-override-user-settings-only).
- **No change to Python environments**: no new package. The extension's own uv environment is not rebuilt (`ENVIRONMENT_REVISION` unchanged).

---

## Time fallback: only time decoding is turned off

When opening raises `ValueError: unable to decode time units …` (issue #136), the viewer opens the file again with:

```python
xarray.open_datatree(path, engine="netcdf4", decode_times=False, decode_timedelta=False)
```

`mask_and_scale`, `decode_coords` and `concat_characters` keep their values. File Information shows **Decoding: degraded (decode_times=False, decode_timedelta=False)**, and the Troubleshooting report quotes the original error. If you already set `decoding.decodeTimes` to `off`, the first open succeeds and no fallback is reported. **Reopen raw** never falls back: it already decodes nothing.

## Reopen raw / Reopen decoded

**File Information > Decoding** has a link that reloads the file in the same tab:

- **Reopen raw** passes `mask_and_scale=False`, `decode_times=False`, `decode_timedelta=False`, `concat_characters=False` and `decode_coords=False`. That is what `decode_cf=False` does, written out, because some engines (kerchunk) only receive decoders passed one by one. `use_cftime` is dropped. Each decoder an engine does not take is skipped and listed in the report. For example, rioxarray only accepts `decode_coords="all"` and has no `concat_characters`.
- **Reopen decoded** goes back to the settings.

The mode belongs to the tab. Plots created after the switch use it, and **Refresh** keeps it. It is never saved: a new tab, or reopening the file, starts decoded. In an exported HTML report the link does nothing.

## Troubleshooting > How this file was opened

This is the first entry of the Troubleshooting section, at the end of the viewer, with a **Copy** button. Example for a file with broken time units and an `h5netcdf` setting:

```text
Engine: netcdf4 (xarray.open_datatree)
Decoding: degraded (decode_times=False, decode_timedelta=False)
Time decoding turned off after: ValueError: unable to decode time units '(days since 2000-01-01 00:00:00)-1' with 'the default calendar'. …

xarray.open_datatree(
    '/data/broken_datetime_packed_variable.nc',
    engine='netcdf4',
    decode_times=False,  # time fallback
    decode_timedelta=False,  # time fallback
)

Each keyword is commented with its source. Decoders not in the call keep the engine default.
```

The **sources** are:

- `viewer default`: rasterio `mask_and_scale=False`, cfgrib `indexpath=''`.
- `setting`: one of the new settings.
- `setting convertBandsToVariables`: rasterio `band_as_variable=True`.
- `viewer (ZIP store)`: the `consolidated` / `group` keywords of a zipped Zarr store.
- `time fallback` and `raw mode`.

**Notes** list the settings that did not apply to this engine, the `engineBackendKwargs` keys that were ignored and why, and the raster time handling. **Engines that failed first** lists the earlier engines, for example when `netcdf4` fails and `h5netcdf` opens the file.

## Decoding settings

| Setting                                      | Values                                           | Default behaviour                                        |
| -------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------- |
| `scientificDataViewer.decoding.maskAndScale` | `default`, `on`, `off`                           | on; GeoTIFF / JPEG-2000: off (viewer default, unchanged) |
| `scientificDataViewer.decoding.decodeTimes`  | `default`, `on`, `off` (also `decode_timedelta`) | on                                                       |
| `scientificDataViewer.decoding.decodeCoords` | `default`, `coordinates`, `all`, `off`           | `coordinates`; not configurable for rasters (rioxarray)  |
| `scientificDataViewer.decoding.useCftime`    | `default`, `on`, `off`                           | `datetime64` when the calendar allows it                 |

With `default`, nothing is passed and the engine decides. A value that an engine does not take is skipped rather than passed (xarray would raise a `TypeError`), and the report says so. For **NASA CDF** (cdflib, its own API), `decodeTimes: off` passes `to_datetime=False` and `maskAndScale: on` passes `fillval_to_nan=True`. `decodeCoords` and `useCftime` do not apply to CDF.

## `engineBackendKwargs`: allowed keys, user settings only

```json
"scientificDataViewer.engineBackendKwargs": {
    "h5netcdf": { "phony_dims": "sort" },
    "cfgrib": { "filter_by_keys": { "typeOfLevel": "surface" } }
}
```

| Engine     | Allowed keys                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `netcdf4`  | `auto_complex`                                                                                                                                          |
| `h5netcdf` | `phony_dims`, `invalid_netcdf`, `decode_vlen_strings`                                                                                                   |
| `scipy`    | `mmap`                                                                                                                                                  |
| `zarr`     | `consolidated`, `zarr_format`, `use_zarr_fill_value_as_mask`                                                                                            |
| `cfgrib`   | `filter_by_keys`, `read_keys`, `ignore_keys`, `encode_cf`, `squeeze`, `time_dims`, `errors`, `extra_coords`, `coords_as_attributes`, `cache_geo_coords` |
| `rasterio` | `parse_coordinates`, `masked`, `default_name`                                                                                                           |

**Why an allowlist.** These keywords reach xarray and then the engine. Some would write files (`mode`, `clobber`, `persist`, cfgrib `indexpath`). Others reach the network or take credentials (`storage_options`, h5netcdf `driver`, rasterio `open_kwargs`). Those keys are refused. Decoders have their own settings, and `band_as_variable` stays under `convertBandsToVariables`. A key that is allowed but unknown to the installed engine version, or that the viewer already sets for the file, is ignored too. Every ignored key is listed in the report.

**Why user settings only.** A repository's `.vscode/settings.json` is applied as soon as the folder is opened, so it could steer the extension's subprocess. The setting is `"scope": "machine"` (VS Code ignores workspace values), and the extension reads only the global value as well.

## Interpreter override: user settings only

`scientificDataViewer.python.overridePythonInterpreter` names the program the extension runs, and it wins over every other interpreter source. Until v0.13 it could be set at any scope. A repository could ship `.vscode/settings.json` with `"scientificDataViewer.python.overridePythonInterpreter": "./tools/run.sh"`, and opening any data file from that folder ran the script. The extension's backend has no workspace trust of its own to stop this.

In v0.14 the setting is `"scope": "machine"`: VS Code ignores and flags values in workspace and folder settings. The extension also reads only the global (user, or remote machine) value. When a workspace value is present, the log says it was ignored. Per-project interpreters keep working through **Python: Select Interpreter**, which the Python extension manages under VS Code's workspace trust.

## Raster times

rioxarray decodes CF time tags (`NETCDF_DIM_time_VALUES`, `time#units`: GeoTIFFs written by GDAL from NetCDF) as cftime objects, always. The viewer converts standard-calendar time coordinates to `datetime64` so dates behave as they do in NetCDF files. Set `decoding.useCftime: on` to keep cftime.

`convertBandsToVariables` (on by default) is **honoured**. Each band then becomes its own variable, so the band axis, and with it the time coordinate, is not built. Its values stay raw in the `NETCDF_DIM_*` attributes. The report explains this and says to turn the setting off to get a decoded `time` coordinate.

---

## Manual verification

Create the sample files first: `python python/create_sample_data.py` (new in v0.14: `broken_datetime_packed_variable.nc`, `sample_geotiff_time_bands.tif`, in `artefacts/sample-data/`). The full step-by-step plan with a results sheet is [`docs/v0.14/MANUAL_TEST_PLAN_0.14.0.md`](./v0.14/MANUAL_TEST_PLAN_0.14.0.md).

1. Open `broken_datetime_packed_variable.nc`. File Information shows **Decoding: degraded (decode_times=False, decode_timedelta=False)**. `temperature` is `float64` with values `273.15, 283.15, nan, 298.15`.
2. Open **Troubleshooting > How this file was opened**. The call contains `decode_times=False,  # time fallback`, and the time error is quoted. **Copy** copies the text.
3. Click **Reopen raw**. Decoding shows **raw (no CF decoding)**, `temperature` is `int16` with `0, 1000, -999, 2500`, and the call lists five decoders with `# raw mode`. Create a plot of `temperature`: it shows the stored values.
4. Click **Refresh**: still raw. Click **Reopen decoded**: back to step 1.
5. Open `sample_data.nc`. It shows **Decoding: CF decoded**, and the call has no decoder (engine defaults).
6. Open `sample_geotiff_time_bands.tif` (default settings). You get `band_1` … `band_3`, and the report has a note about `NETCDF_DIM_EXTRA`. Set `convertBandsToVariables` off and refresh: `band_data(time, y, x)` with `time` as `datetime64[ns]` (`2000-01-01`, `2000-02-01`, `2000-03-01`), and a note "converted from cftime".
7. Set `decoding.maskAndScale` to `on` and refresh the GeoTIFF. `band_data` becomes `float32` with `NaN` in the nodata corner, and the call shows `mask_and_scale=True,  # setting`.
8. In **user** settings, set `engineBackendKwargs` to `{"netcdf4": {"auto_complex": true, "mode": "w"}}` and refresh `sample_data.nc`. `auto_complex` is in `backend_kwargs` with `# setting`, and a note says `netcdf4.mode` was ignored. The file is unchanged on disk.
9. Remove it from user settings and put the same value in a **workspace** `.vscode/settings.json` only. VS Code flags it as a setting that cannot be applied in the workspace, and after a refresh the call has no `backend_kwargs`.
10. Set `decoding.decodeTimes` to `off` and open `broken_datetime_packed_variable.nc`. The Decoding line has no "degraded", and the call shows `decode_times=False,  # setting`.
11. In a **workspace** `.vscode/settings.json`, set `scientificDataViewer.python.overridePythonInterpreter` to a path that does not exist, then run **Refresh Python Environment**. The status bar keeps the previous interpreter, files still open, and the logs (**Show Extension Logs**) contain `Ignoring scientificDataViewer.python.overridePythonInterpreter … from the workspace settings`.

## Known limitations

- **Opening errors do not show the report.** When every engine fails, the error page replaces the viewer, including the Troubleshooting section. The engines tried and their errors are in the logs (**Show Extension Logs**).
- **Raw mode is per tab and not saved.** Closing and reopening the file returns to decoded.
- **The time fallback is triggered by one message**, `unable to decode time units`. Other time decoding errors (e.g. out-of-bounds dates with `useCftime: off`) still fail the open: use **Reopen raw** or `decodeTimes: off`.
- **Rasters**: `decode_coords` cannot be changed (rioxarray only supports `all`). `useCftime` only decides whether the viewer converts cftime to `datetime64`. Non-standard calendars stay cftime.
- **NASA CDF**: only `decodeTimes` and `maskAndScale` map to cdflib (`to_datetime`, `fillval_to_nan`). `engineBackendKwargs` has no `cdflib` entry.
- **`engineBackendKwargs` is an allowlist.** An option missing from it needs a code change in `USER_BACKEND_KWARGS_ALLOWED` (`python/sdv_backend/decoding.py`), on purpose.

## Summary

| Change                                     | Kind     | Where                                                                  |
| ------------------------------------------ | -------- | ---------------------------------------------------------------------- |
| Time fallback turns off time decoding only | Changed  | `opening.py`, `decoding.py`                                            |
| Reopen raw / Reopen decoded                | Added    | File Information; `UIController`, `setRawMode` request, `--raw`        |
| How this file was opened                   | Added    | Troubleshooting section; `OpenReport` in the info result               |
| Decoding settings (4)                      | Added    | `scientificDataViewer.decoding.*`; `--mask-and-scale` … `--use-cftime` |
| `engineBackendKwargs`                      | Added    | User settings only, allowlist; `--engine-backend-kwargs`               |
| Raster times as `datetime64`               | Changed  | `opening.py`                                                           |
| Kerchunk time fallback                     | Fixed    | `opening.py`                                                           |
| `decode_cf_degraded` → `open_report`       | Changed  | Backend JSON contract                                                  |
| Two sample files                           | Added    | `python/sample_data/`                                                  |
| `overridePythonInterpreter` user-only      | Security | `package.json` scope, `config.ts`, `PythonManager.ts`                  |
