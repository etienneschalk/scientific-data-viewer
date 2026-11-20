# v0.14.0 — CF decoding you can see and control, CF flags plotted by meaning

Branch `eschalk/v0.14-cf-decoding`, based on `eschalk/v0.13.1-release` (0.13.1).

Two parts:

- **CF decoding** (commits 1-4): see and control how a file is decoded.
- **CF flags** (commits 5-9): variables with `flag_values` / `flag_masks` / `flag_meanings` plotted by meaning. Designed in [CF_FLAGS_PROPOSAL.md](./CF_FLAGS_PROPOSAL.md) (research, plot kinds, phases P1-P4) and written for 0.15 on `eschalk/v0.15-cf-flags` (from 0.13.0), then cherry-picked here: the flag codes are read raw through the decoding layer (`resolve_open_kwargs(raw_variables=...)`), so the decoding settings and **Reopen raw** apply to flag plots too. All four phases are in: **P1** (`flag_values`), **P2** (`flag_masks`, alone or with `flag_values`), **P3** (`flag_select`, `flag_combine`), **P4** (`hide_flags` through `ancillary_variables`).

Start with [GETTING_STARTED.md](./GETTING_STARTED.md).

## Summary

### CF decoding

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
| `python.overridePythonInterpreter`       | Machine scope, user settings only: a repository can no longer choose the program the extension runs       |

### CF flags

| Change                           | User-visible effect                                                                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flag_values` plotted by meaning | One color per class (`cmap`, else `flag_colors`, else palette), colorbar `value meaning (share)`, facets share it                                                            |
| 1D flags                         | Steps, meanings on the y-axis, points colored by meaning                                                                                                                     |
| Bars (kind `bars`)               | In place of the histogram of codes: one bar per meaning                                                                                                                      |
| Codes read raw                   | `resolve_open_kwargs(raw_variables=...)`: `mask_and_scale={name: False}` reopen with the tab's decoding settings; a fill code that is a meaning is shown; uint64 masks exact |
| Flags section                    | File Information: kind, value / mask / bits / meaning, swatches, problems, notes                                                                                             |
| **flags** control                | Flags fieldset, default on; off = plain numbers (`--no-flags`)                                                                                                               |
| Bit flags (P2)                   | `flag` dimension, one entry per field: one panel per flag, row per flag over time, 1D block plot, bars of shares                                                             |
| Selection (P3)                   | **flag_select** (meanings by name, others grey / panels dropped), **flag_combine** (`any` / `all` / `none` of bit flags, one map)                                            |
| Hiding (P4)                      | **hide_flags**: NaN where an `ancillary_variables` flag variable has one of the meanings set; layout item, count of hidden values                                            |
| **Flags** fieldset               | `flags` moved from Color; new control kind `choice` (select) for `flag_combine`                                                                                              |
| Notes                            | Why flags are not used (inconsistent spec), ignored `vmin` / `vmax` / `robust` / `bins`, bits in no `flag_masks`                                                             |
| Samples                          | `sample_cf_flags.nc`; the invalid QC flags of `sample_many_encoding.nc` fixed                                                                                                |
| Proposal, prototype              | `docs/v0.14/CF_FLAGS_PROPOSAL.md`; `scripts/prototypes/cf_flags.py`, `paranoia.sh` step `prototypes`                                                                         |

## Design

### CF decoding

| Layer (later wins) | Decoders                                     | `backend_kwargs`                                                                      |
| ------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------- |
| Engine default     | nothing passed                               | nothing passed                                                                        |
| Viewer default     | rasterio `mask_and_scale=False`              | cfgrib `indexpath=''`; rasterio `band_as_variable`; ZIP Zarr `consolidated` / `group` |
| Setting            | `decoding.*`                                 | `engineBackendKwargs` (allowlist, not over viewer keys)                               |
| Time fallback      | `decode_times`, `decode_timedelta` = `False` | —                                                                                     |
| Raw mode           | five decoders `False`, `use_cftime` dropped  | —                                                                                     |

Each decoder is passed only if the engine's `open_dataset_parameters` has it (kerchunk forwards everything to `open_zarr`); rioxarray's `decode_coords` is fixed to `"all"`. The resolution lives in `python/sdv_backend/decoding.py`; `opening.py` applies it and builds the `OpenReport`.

### CF flags

| Step            | Where                                          | What                                                                                                                                                                                                                                      |
| --------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parse and check | `sdv_backend/flags.py`                         | `read_flag_spec(attrs, raw_dtype)` -> `FlagSpec` (kind, flags, colors, problems, notes); numpy only                                                                                                                                       |
| Info            | `info/variables.py`                            | `VariableInfo.flags = spec.to_json()` (values and masks as text)                                                                                                                                                                          |
| Raw codes       | `plotting/api.py`, `opening.py`, `decoding.py` | Reopen with `options.decoding` and `raw_variables=(name,)` when decoding changed the dtype and the engine allows it; `resolve_open_kwargs` turns it into `mask_and_scale={name: False}` (source `flag codes read raw`) unless already off |
| Index array     | `plotting/flags.py`                            | `prepare_flag_plot`: categories, shares, `other`, present-only above 20 meanings, palette                                                                                                                                                 |
| Bit fields      | `plotting/flags.py`                            | `flag_fields` (one per mask, states of a repeated mask), `_prepare_fields`: dimension `flag`, `not set`                                                                                                                                   |
| Layout          | `plotting/layout.py` (unchanged logic)         | `resolve_layout` on the index array; then `adjust_layout`: `histogram` / line on `flag` -> `bars`, role `flags`, notes                                                                                                                    |
| Selection       | `flags.py`, `plotting/flags.py`                | `FlagSpec.match`; `FlagChoice` -> `_prepare_values` / `_prepare_fields` / `_prepare_combined`                                                                                                                                             |
| Hidden points   | `plotting/api.py`, `plotting/flags.py`         | `_hide_flags` (lookup, raw read, slices) -> `hide_flagged` (NaN, notes, `hide_flags` item)                                                                                                                                                |
| Draw            | `plotting/draw.py` -> `plotting/flags.py`      | `ListedColormap` + `BoundaryNorm`, labelled colorbar; steps; bars; `flag` axis ticks, facet titles                                                                                                                                        |

## Files

| Area      | Files                                                                                                                                                                                                                                                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend   | `decoding.py` (new), `opening.py`, `results.py`, `cli.py`, `info/options.py`, `info/extract.py`, `plotting/options.py`, `plotting/api.py`; `flags.py` (new), `plotting/flags.py` (new), `plotting/api.py`, `plotting/draw.py`, `plotting/layout.py`, `plotting/options.py`, `opening.py`, `results.py`, `info/variables.py`, `cli.py`                        |
| Extension | `package.json`, `src/common/config.ts`, `src/python/DataProcessor.ts`, `src/panel/UIController.ts`, `src/panel/communication/MessageTypes.ts`, `src/panel/HTMLGenerator.ts`, `src/types.ts`; `src/shared/flags.ts` (new), `src/shared/plotLayout.ts`, `src/types.ts`, `src/python/DataProcessor.ts`                                                          |
| Webview   | `bus.ts`, `main.ts`, `render/dataInfo.ts`, `render/representations.ts`; `render/variables.ts` (`renderFlags`), `plotParams.ts` (Flags fieldset: `useFlags`, `flagSelect`, `flagCombine`, `hideFlags`; kind `choice`), `styles.css`                                                                                                                           |
| Samples   | `python/sample_data/netcdf.py`, `geotiff.py`, `main.py`; `flags.py` (new), `netcdf_encoding.py`                                                                                                                                                                                                                                                              |
| Tests     | `python/tests/test_decoding.py` (new), `test_decode_times_fallback.py` (renamed); `test/suite/dataProcessor.test.ts`, `config.test.ts`, `ui/UIController.test.ts`, `ui/webviewScript.test.ts`, `integration.test.ts`, `pythonManager.test.ts`; `python/tests/test_flags.py` (new); `test/suite/ui/webviewScript.test.ts`, `test/suite/dataProcessor.test.ts` |
| Docs      | `CHANGELOG.md`, `docs/RELEASE_NOTES_0.14.0.md`, `docs/v0.14/` (incl. `CF_FLAGS_PROPOSAL.md`), `docs/PLOTTING.md`, `docs/DEVELOPMENT.md`, `CLAUDE.md`, `docs/documentation.json`, `README.md`, `scripts/architecture/`, `docs/architecture/`                                                                                                                  |
| Tooling   | `scripts/prototypes/cf_flags.py` (new), `paranoia.sh` (`prototypes`), `scripts/architecture/graphs.py`, `docs/architecture/` (regenerated)                                                                                                                                                                                                                   |

## Testing

| Check                                                                              | Result                                                                                                                                                                               |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pytest python/tests`                                                              | 342 passed (88 in `test_flags.py`, 2 new tests for the raw re-read through `decoding.py`)                                                                                            |
| `test_flags.py`, `test_decoding.py` on Python 3.10, xarray 2024.10, matplotlib 3.9 | 87 passed, 2 skipped (zarr 2 and no rasterio in that env)                                                                                                                            |
| `npm test` (VS Code, `env -u ELECTRON_RUN_AS_NODE`)                                | 360 passing                                                                                                                                                                          |
| `npm run typecheck`, `npm run lint`                                                | clean                                                                                                                                                                                |
| `scripts/architecture/generate.py --check`                                         | clean (diagrams regenerated)                                                                                                                                                         |
| `npx vsce ls`                                                                      | 84 files (`decoding.py`, `flags.py`, `plotting/flags.py`, `out/src/shared/flags.js` added)                                                                                           |
| Backend on sample data, decoded and raw                                            | NetCDF, HDF5, Zarr dir / ZIP, GRIB, GeoTIFF, JPEG-2000, Kerchunk, CDF: all open                                                                                                      |
| Backend on `sample_cf_flags.nc`                                                    | Every variable plotted: images, facets, steps, bars, panels per bit, block plot, notes as expected; `station_status` the same decoded, raw, with `decodeTimes` or `maskAndScale` off |
| Manual test plan                                                                   | [MANUAL_TEST_PLAN_0.14.0.md](./MANUAL_TEST_PLAN_0.14.0.md): to run (M1-M9 decoding, M10-M24 flags)                                                                                   |

```bash
source ~/.nvm/nvm.sh && nvm use
npm run compile && npm run lint && npm run typecheck
env -u ELECTRON_RUN_AS_NODE npm test
.venv/bin/python -m pytest python/tests
.venv/bin/python scripts/architecture/generate.py --check
.venv/bin/python python/create_sample_data.py --overwrite
.venv/bin/python python/get_data_info.py info artefacts/sample-data/broken_datetime_packed_variable.nc --raw
.venv/bin/python python/get_data_info.py plot artefacts/sample-data/sample_cf_flags.nc /land_cover
.venv/bin/python python/get_data_info.py plot artefacts/sample-data/sample_cf_flags.nc /wqsf
.venv/bin/python python/get_data_info.py plot artefacts/sample-data/sample_cf_flags.nc /pixel_flags --flag-select cloud,cloud_shadow --flag-combine any
.venv/bin/python python/get_data_info.py plot artefacts/sample-data/sample_cf_flags.nc /sst --hide-flags "cloud, bad data"
.venv/bin/python scripts/prototypes/cf_flags.py
./paranoia.sh --quick
```

## Commits

1. feat(decoding): show and control how files are decoded (v0.14.0)
2. fix(config): read the interpreter override from user settings only
3. docs: proposals for a log color scale and seaborn colormaps
4. docs(v0.14): rebase on the 0.13.1 release branch
5. docs(flags): proposal for plotting CF flag variables, with its prototype
6. feat(flags): plot CF flag_values variables by meaning, list flags in File Information
7. feat(flags): draw CF bit flags (flag_masks) as one panel per flag, 1D as a block plot (P2)
8. feat(flags): choose flags by name, combine bit flags, hide points flagged by ancillary_variables (P3, P4)
9. docs(v0.14): fold the CF flags release (0.15.0) into 0.14.0
