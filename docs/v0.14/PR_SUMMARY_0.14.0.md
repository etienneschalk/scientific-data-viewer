# v0.14.0 — CF decoding you can see and control

Branch `eschalk/v0.14-cf-decoding`, based on `eschalk/backend-package` (v0.13.0).

## Summary

| Change                                   | User-visible effect                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Time fallback: `decode_times=False` only | Files with broken time units keep `scale_factor` / `add_offset` and `_FillValue` masking                  |
| **Reopen raw** / **Reopen decoded**      | File Information link: reload the tab without any CF decoding (info and plots), not persisted             |
| **How this file was opened**             | First Troubleshooting entry: reproducible xarray call, source of each keyword, notes, engines that failed |
| Settings `decoding.*` (4)                | `maskAndScale`, `decodeTimes`, `decodeCoords`, `useCftime`; `default` = engine decides                    |
| Setting `engineBackendKwargs`            | Extra `backend_kwargs` per engine; allowlist; machine scope, user settings only                           |
| Raster times                             | `datetime64` instead of cftime (standard calendars); `convertBandsToVariables` honoured, with a note      |
| Kerchunk                                 | Time fallback and raw mode now take effect (decoders passed one by one)                                   |
| Backend JSON                             | `decode_cf_degraded` → `open_report` (`OpenReport`)                                                       |

## Design

| Layer (later wins) | Decoders                                     | `backend_kwargs`                                                                      |
| ------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------- |
| Engine default     | nothing passed                               | nothing passed                                                                        |
| Viewer default     | rasterio `mask_and_scale=False`              | cfgrib `indexpath=''`; rasterio `band_as_variable`; ZIP Zarr `consolidated` / `group` |
| Setting            | `decoding.*`                                 | `engineBackendKwargs` (allowlist, not over viewer keys)                               |
| Time fallback      | `decode_times`, `decode_timedelta` = `False` | —                                                                                     |
| Raw mode           | five decoders `False`, `use_cftime` dropped  | —                                                                                     |

Each decoder is passed only if the engine's `open_dataset_parameters` has it (kerchunk forwards everything to `open_zarr`); rioxarray's `decode_coords` is fixed to `"all"`. The resolution lives in `python/sdv_backend/decoding.py`; `opening.py` applies it and builds the `OpenReport`.

## Files

| Area      | Files                                                                                                                                                                                                                                         |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend   | `decoding.py` (new), `opening.py`, `results.py`, `cli.py`, `info/options.py`, `info/extract.py`, `plotting/options.py`, `plotting/api.py`                                                                                                     |
| Extension | `package.json`, `src/common/config.ts`, `src/python/DataProcessor.ts`, `src/panel/UIController.ts`, `src/panel/communication/MessageTypes.ts`, `src/panel/HTMLGenerator.ts`, `src/types.ts`                                                   |
| Webview   | `bus.ts`, `main.ts`, `render/dataInfo.ts`, `render/representations.ts`                                                                                                                                                                        |
| Samples   | `python/sample_data/netcdf.py`, `geotiff.py`, `main.py`                                                                                                                                                                                       |
| Tests     | `python/tests/test_decoding.py` (new), `test_decode_times_fallback.py` (renamed); `test/suite/dataProcessor.test.ts`, `config.test.ts`, `ui/UIController.test.ts`, `ui/webviewScript.test.ts`, `integration.test.ts`, `pythonManager.test.ts` |
| Docs      | `CHANGELOG.md`, `docs/RELEASE_NOTES_0.14.0.md`, `docs/v0.14/`, `docs/DEVELOPMENT.md`, `CLAUDE.md`, `docs/documentation.json`, `README.md`, `scripts/architecture/`, `docs/architecture/`                                                      |

## Testing

| Check                                               | Result                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------- |
| `pytest python/tests`                               | 246 passed                                                                      |
| `npm test` (VS Code, `env -u ELECTRON_RUN_AS_NODE`) | 331 passing                                                                     |
| `npm run typecheck`, `npm run lint`                 | clean                                                                           |
| `scripts/architecture/generate.py --check`          | clean (diagrams regenerated)                                                    |
| `npx vsce ls`                                       | 73 files                                                                        |
| Backend on sample data, decoded and raw             | NetCDF, HDF5, Zarr dir / ZIP, GRIB, GeoTIFF, JPEG-2000, Kerchunk, CDF: all open |
| Manual test plan                                    | [MANUAL_TEST_PLAN_0.14.0.md](./MANUAL_TEST_PLAN_0.14.0.md): to run              |

```bash
source ~/.nvm/nvm.sh && nvm use
npm run compile && npm run lint && npm run typecheck
env -u ELECTRON_RUN_AS_NODE npm test
.venv/bin/python -m pytest python/tests
.venv/bin/python scripts/architecture/generate.py --check
python python/create_sample_data.py
python python/get_data_info.py info artefacts/sample-data/broken_datetime_packed_variable.nc --raw
```

## Commits

Not committed yet: the work is in the working tree of `eschalk/v0.14-cf-decoding`.
