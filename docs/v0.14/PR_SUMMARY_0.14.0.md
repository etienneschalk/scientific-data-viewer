# v0.14.0 — CF decoding you can see and control, CF flags plotted by meaning, log scale and seaborn colormaps, plot settings remade

Branch `eschalk/v0.14-cf-decoding`, based on the 0.13.1 release branch; `main` merged in after 0.13.1 was released (tag `v0.13.1`, 2026-11-20).

Four parts:

- **CF decoding** (commits 1-4): see and control how a file is decoded.
- **CF flags** (commits 5-9): variables with `flag_values` / `flag_masks` / `flag_meanings` plotted by meaning. Designed in [CF_FLAGS_PROPOSAL.md](./CF_FLAGS_PROPOSAL.md) (research, plot kinds, phases P1-P4) and written for 0.15 on `eschalk/v0.15-cf-flags` (from 0.13.0), then cherry-picked here: the flag codes are read raw through the decoding layer (`resolve_open_kwargs(raw_variables=...)`), so the decoding settings and **Reopen raw** apply to flag plots too. All four phases are in: **P1** (`flag_values`), **P2** (`flag_masks`, alone or with `flag_values`), **P3** (`flag_select`, `flag_combine`), **P4** (`hide_flags` through `ancillary_variables`).
- **Log scale and seaborn colormaps** (commits 10, 11): the **norm** plot control (`log`) and `seaborn:<name>` in **cmap**, as specified in [FEATURE_LOG_COLOR_SCALE.md](./FEATURE_LOG_COLOR_SCALE.md) and [FEATURE_SEABORN_COLORMAPS.md](./FEATURE_SEABORN_COLORMAPS.md) (commit 3); seaborn joins the extension's own environment (`ENVIRONMENT_REVISION` 3, rebuilt once).
- **Plot settings UI remake** (commit 16): the _Global Plot Controls_ and _Group Plot Controls_ blocks are replaced by one settings editor, opened by **Settings** next to **Create Plot** or in a group's **Plot** section, with the levels as tabs (**This variable**, **Group /a**, **Whole file**; the nearest level wins). Built on demand, one at a time; summaries under each Plot button; **Plot all** / **Cancel all** / **Save all** / **Clear all** in the header, **Plot group** per group. Designed in [FEATURE_PLOT_SETTINGS_UI.md](./FEATURE_PLOT_SETTINGS_UI.md).

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

### Log scale and seaborn colormaps

| Change                       | User-visible effect                                                                                                                                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **norm** `log` (Color)       | Image / facets: `LogNorm` from the values above 0, one colorbar in data units; line: log axis of the values; histogram, flags, dates: ignored with a note                                                                              |
| Values ≤ 0                   | Not drawn (transparent, a gap), counted in a note; no value above 0: linear with a note; `vmin` / `vmax` ≤ 0 ignored with a note                                                                                                       |
| `robust` with `log`          | 2nd / 98th percentiles of the values above 0                                                                                                                                                                                           |
| `seaborn:<name>` in **cmap** | seaborn colormaps (`rocket`, `mako_r`...), palette strings (`light:seagreen`, `ch:...`), qualitative palettes; flag plots too                                                                                                          |
| seaborn missing / unknown    | One-line error before the file is read, saying what to install or which names exist                                                                                                                                                    |
| Extension's own environment  | `seaborn` in `ALL_REQUIREMENTS`, `ENVIRONMENT_REVISION` 2 → 3: rebuilt once; user interpreters untouched                                                                                                                               |
| Backend JSON                 | Layout role `norm`; `applied_plot_kwargs` `norm` (text), `center`, `extend`, `xscale` / `yscale`                                                                                                                                       |
| Sample                       | `sample_log_scale.nc`: one variable per case: chlorophyll with land and zeros, 1D counts, both signs, nothing above 0, integers, rain (`robust`), tiny / huge values, `±inf`, constant, profile along y, packed (raw), flags, booleans |

### Plot settings (UI remake)

| Change                                  | User-visible effect                                                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| One settings editor, levels as tabs     | **Settings** next to **Create Plot** or in a group's **Plot** section; tabs **This variable**, **Group /a** (and parents), **Whole file**                                      |
| Nearest level wins                      | Per parameter and per dimension slice; empty fields show in grey what they fall back to (`magma (file)`, `true (default)`)                                                     |
| Per-variable settings, tree inheritance | New: one variable apart; a group's settings apply to its subgroups; slices merge dimension by dimension (0.13: group slices replaced all)                                      |
| Built on demand, one at a time          | No plot control in the page until a Settings button is clicked (0.13: ~20 parameters + slices for the global block and every group)                                            |
| True / false as selects                 | Empty (fallback), `true`, `false`; no three-state checkbox                                                                                                                     |
| Flags fieldset only where flags apply   | A variable with CF flags or `ancillary_variables`, a group holding one                                                                                                         |
| Summaries, clickable layout items       | `Settings: time 0:6 file · vmax 10 variable` under each Plot button; a click (or a click on an item under a plot) opens that level and field                                   |
| "Settings changed" note                 | A displayed plot says when a setting that applies to it changed                                                                                                                |
| Header buttons, **Plot group**          | **Plot all**, **Cancel all**, **Save all plots**, **Clear all plots** in the sticky header; **Plot group** per group                                                           |
| Keys                                    | **Enter** in a box plots, **Escape** closes                                                                                                                                    |
| Removed settings                        | `globalDimensionSlices`, `groupDimensionSlices`                                                                                                                                |
| Request                                 | Unchanged for the same settings (same fields, bools always sent)                                                                                                               |
| Expand All and Xarray Encoding          | **Expand All** (header) leaves the Xarray Encoding sections closed; setting `expandAllIncludesXarrayEncoding` (default `false`) opens them too; exported pages keep the choice |

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

### Log scale and seaborn colormaps

| Step             | Where                                   | What                                                                                                                                                         |
| ---------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Resolve the cmap | `plotting/colormaps.py`, `api.py`       | `resolve_cmap` before the file is read: `seaborn:` → lazy `import seaborn`, `color_palette(name, as_cmap=True)`; `ColormapError` → `CreatePlotError`         |
| Kwargs objects   | `plotting/kwargs.py`                    | `PlotKwargsBundle.objects` (Colormap, LogNorm) next to `raw` (text, returned as `applied_plot_kwargs`); `for_call` swaps them in for the xarray call         |
| Log scale        | `plotting/norm.py`, `api.py`            | `apply_norm` after the layout: kind / dtype / flag checks, values above 0, `LogNorm` + `center=False` + `extend` (image) or `yscale` / `xscale` + NaN (line) |
| Flag colors      | `plotting/flags.py`                     | `_palette` uses `get_colormap` (matplotlib or seaborn)                                                                                                       |
| Report           | `plotting/layout.py`                    | Role `norm` (reported only, not an xarray kwarg)                                                                                                             |
| Control          | `plotParams.ts`                         | `norm`: kind `choice`, options `linear` (empty) / `log`; `cmap` placeholder and tooltip mention `seaborn:`                                                   |
| Environment      | `ExtensionVirtualEnvironmentManager.ts` | `seaborn` in `ALL_REQUIREMENTS` (also `EXTENDED_PACKAGES`: healthcheck), `ENVIRONMENT_REVISION = 3`                                                          |

### Plot settings

| Step              | Where                                                     | What                                                                                                                                        |
| ----------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Model             | `plotSettings.ts` (`setPlotModel`)                        | Groups (dimensions of the subtree, own variables), variables (dimensions, flag related) from each `dataLoaded`                              |
| Levels            | `plotSettings.ts` (`scopeChain`)                          | `v:/g/name` → `g:/g` → parent groups → `g:/`, only groups of the file                                                                       |
| Store             | `plotSettings.ts` (`updateLevelSettings`)                 | Text of each control per level (`RawParams`, slices `[start, stop, step]`); empty values pruned; kept through Refresh                       |
| Resolution        | `plotSettings.ts` (`plotRequestFor`)                      | First level that sets each parameter / slice; numbers checked at the winning level only; bool defaults                                      |
| Editor            | `plotEditor.ts`                                           | Built from the store on open / tab switch / Reset; input and change events write back; `withoutCapture` while the content is replaced       |
| Controls          | `plotParams.ts`, `dimensionSlices.ts`                     | No element ids in the table; fixed ids `plot-setting-<key>` / `plot-slice-<dim>` (one editor); grey fallback in placeholders, first options |
| Summaries         | `plotEditor.ts` (`refreshSettingsSummaries`)              | Re-rendered on every store change, only when their HTML changed                                                                             |
| Clicks            | `render/plotLayout.ts`, `plotEditor.ts` (`editSetting`)   | `data-focus-param` (layout role → parameter, own keys only) / `data-focus-dimension`; level = `data-scope`, else the one that sets it       |
| Plot group, stale | `plotActions.ts` (`handlePlotGroup`, `refreshStalePlots`) | `plotMany` shared with Plot all; request of each displayed plot compared after each change                                                  |
| Export            | `export.ts`                                               | Editor left out; summaries kept; the unused form-state copy removed                                                                         |

## Files

| Area          | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend       | `decoding.py` (new), `opening.py`, `results.py`, `cli.py`, `info/options.py`, `info/extract.py`, `plotting/options.py`, `plotting/api.py`; `flags.py` (new), `plotting/flags.py` (new), `plotting/api.py`, `plotting/draw.py`, `plotting/layout.py`, `plotting/options.py`, `opening.py`, `results.py`, `info/variables.py`, `cli.py`                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Extension     | `package.json`, `src/common/config.ts`, `src/python/DataProcessor.ts`, `src/panel/UIController.ts`, `src/panel/communication/MessageTypes.ts`, `src/panel/HTMLGenerator.ts`, `src/types.ts`; `src/shared/flags.ts` (new), `src/shared/plotLayout.ts`, `src/types.ts`, `src/python/DataProcessor.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Webview       | `bus.ts`, `main.ts`, `render/dataInfo.ts`, `render/representations.ts`; `render/variables.ts` (`renderFlags`), `plotParams.ts` (Flags fieldset: `useFlags`, `flagSelect`, `flagCombine`, `hideFlags`; kind `choice`), `styles.css`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Samples       | `python/sample_data/netcdf.py`, `geotiff.py`, `main.py`; `flags.py` (new), `netcdf_encoding.py`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Tests         | `python/tests/test_decoding.py` (new), `test_decode_times_fallback.py` (renamed); `test/suite/dataProcessor.test.ts`, `config.test.ts`, `ui/UIController.test.ts`, `ui/webviewScript.test.ts`, `integration.test.ts`, `pythonManager.test.ts`; `python/tests/test_flags.py` (new); `test/suite/ui/webviewScript.test.ts`, `test/suite/dataProcessor.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Docs          | `CHANGELOG.md`, `docs/RELEASE_NOTES_0.14.0.md`, `docs/v0.14/` (incl. `CF_FLAGS_PROPOSAL.md`), `docs/PLOTTING.md`, `docs/DEVELOPMENT.md`, `CLAUDE.md`, `docs/documentation.json`, `README.md`, `scripts/architecture/`, `docs/architecture/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Log / seaborn | `plotting/norm.py` (new), `plotting/colormaps.py` (new), `plotting/kwargs.py`, `plotting/api.py`, `plotting/draw.py`, `plotting/flags.py`, `plotting/layout.py`, `plotting/options.py`, `cli.py`; `src/panel/webview/plotParams.ts`, `src/types.ts`, `src/python/DataProcessor.ts`, `src/shared/plotLayout.ts`, `src/python/ExtensionVirtualEnvironmentManager.ts`, `media/walkthrough/setup-python.md`, `requirements-dev.txt`; `python/sample_data/log_scale.py` (new); tests `python/tests/test_plot_norm.py` (new), `test_colormaps.py` (new), `test/suite/ui/webviewScript.test.ts`, `dataProcessor.test.ts`, `python/extensionEnvironmentUpdate.test.ts`; `scripts/qa/webview/controls.mjs`, `python/tools/golden_snapshots.py`, `python/non_regression_test_plot.py`, `scripts/generate_readme.py` |
| Tooling       | `scripts/prototypes/cf_flags.py` (new), `paranoia.sh` (`prototypes`), `scripts/architecture/graphs.py`, `docs/architecture/` (regenerated)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Plot settings | `src/panel/webview/plotSettings.ts` (new), `plotEditor.ts` (new), `plotParams.ts`, `dimensionSlices.ts`, `changedFields.ts`, `plotActions.ts`, `main.ts`, `export.ts`, `styles.css`, `render/dataInfo.ts`, `render/variables.ts`, `render/plotLayout.ts`; `src/panel/HTMLGenerator.ts`, `src/shared/icons.ts`, `src/outline/HeaderExtractor.ts`, `src/common/config.ts`, `package.json`; `test/suite/ui/webviewScript.test.ts`, `test/suite/config.test.ts`; `scripts/qa/webview/` (`controls.mjs`, `render.mjs`, `harness.mjs`), `scripts/screenshots/take-screenshots.mjs`, `scripts/demo-video/scenario.mjs`, `scripts/architecture/`; `docs/v0.14/FEATURE_PLOT_SETTINGS_UI.md` (new)                                                                                                                  |
| Demo video    | `scripts/demo-video/` (new: `record.mjs`, `scenario.mjs`, `montage.py`, `README.md`, `lib/`), `paranoia.sh` (`demo-video`, profile `--full-with-extras`), `scripts/paranoia/checks.py` (status `EXTRA`), `docs/DEVELOPMENT.md`, `CLAUDE.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

## Testing

| Check                                                                                                                                        | Result                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pytest python/tests`                                                                                                                        | 405 passed (88 in `test_flags.py`, 19 in `test_plot_norm.py`, 26 in `test_colormaps.py`, 18 in `test_log_scale_sample.py`)                                                                                                                                                     |
| `test_flags.py`, `test_decoding.py`, `test_plot_norm.py`, `test_colormaps.py` on Python 3.10, xarray 2024.10, matplotlib 3.9, seaborn 0.13.2 | 132 passed, 2 skipped (zarr 2 and no rasterio in that env); without seaborn there, the seaborn tests skip                                                                                                                                                                      |
| `npm test` (VS Code, `env -u ELECTRON_RUN_AS_NODE`)                                                                                          | 371 passing (plot settings: 18 tests new or rewritten in `webviewScript.test.ts`, 2 config tests of the removed settings dropped; Expand All: 3 webview tests, 1 config test)                                                                                                  |
| `npm run typecheck`, `npm run lint`                                                                                                          | clean                                                                                                                                                                                                                                                                          |
| `scripts/architecture/generate.py --check`                                                                                                   | clean (diagrams regenerated)                                                                                                                                                                                                                                                   |
| `npx vsce ls`                                                                                                                                | 86 files (`decoding.py`, `flags.py`, `plotting/flags.py`, `plotting/norm.py`, `plotting/colormaps.py`, `out/src/shared/flags.js` added)                                                                                                                                        |
| Webview QA `controls.mjs` (`SDV_PYTHON=.venv/bin/python`)                                                                                    | 38/38 (new: `seaborn:mako` plot, `seaborn:nope` error, `norm` log sent, outlined, layout item; plot settings editor: none built in advance, tabs, Reset kept in the store, levels, slices per dimension, summaries, "settings changed")                                        |
| Webview QA `run-all.mjs` (render, controls, cancel; headless Chromium, real backend)                                                         | 102/102: render 47 (every settings editor opened on the hostile fixtures, header at 320-1000 px), controls 38, cancel 17                                                                                                                                                       |
| `npm run screenshots` (dark and light, scenarios 01-08)                                                                                      | Looked at: header buttons, group Plot section, editor with tabs and grey fallbacks, summaries, narrow header (icons only)                                                                                                                                                      |
| Golden snapshots, plot cases                                                                                                                 | 30/30 (new: `plot__norm_log`, `plot__cmap_seaborn`); the info cases recorded with 0.13 differ on `open_report` / `flags`, as documented                                                                                                                                        |
| Non-regression gallery                                                                                                                       | All cases drawn, new `26_norm_log`, `27_cmap_seaborn_rocket`                                                                                                                                                                                                                   |
| Backend on `sample_log_scale.nc` with `--norm log`                                                                                           | `chlorophyll` facets on one LogNorm, `particle_count` log y-axis with a gap, `net_flux` half shown in viridis, `depth_negative` linear with a note; the 10 variables added later each reach their case (17 cases + packed raw in `test_log_scale_sample.py`), images looked at |
| `scripts/upgrade-sandbox.sh --old 0.13.1 --expect rebuild`                                                                                   | not run yet (release checklist)                                                                                                                                                                                                                                                |
| Backend on sample data, decoded and raw                                                                                                      | NetCDF, HDF5, Zarr dir / ZIP, GRIB, GeoTIFF, JPEG-2000, Kerchunk, CDF: all open                                                                                                                                                                                                |
| Backend on `sample_cf_flags.nc`                                                                                                              | Every variable plotted: images, facets, steps, bars, panels per bit, block plot, notes as expected; `station_status` the same decoded, raw, with `decodeTimes` or `maskAndScale` off                                                                                           |
| `scripts/demo-video/record.mjs` + `montage.py` (VS Code 1.147.0, empty uv cache)                                                             | recorded again after the plot settings remake (step 6 opens **Settings** of `tas`): 2189 frames in 81 s; MP4 88 s, 1920 × 1080, 8.9 MB; uv set up in 5 s (Python 3.13 and 41 packages downloaded); watchdog: `--limit 25` and `kill -9` of the recorder leave no process       |
| Manual test plan                                                                                                                             | [MANUAL_TEST_PLAN_0.14.0.md](./MANUAL_TEST_PLAN_0.14.0.md): to run (M1-M9 decoding, M10-M24 flags, M25-M30 log scale, seaborn, upgrade, M31-M38 plot settings, M39 Expand All)                                                                                                 |

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
.venv/bin/python python/get_data_info.py plot artefacts/sample-data/sample_log_scale.nc /chlorophyll --norm log --cmap seaborn:rocket
.venv/bin/python python/non_regression_test_plot.py
SDV_PYTHON=$PWD/.venv/bin/python node scripts/qa/webview/controls.mjs
SDV_PYTHON=$PWD/.venv/bin/python node scripts/qa/webview/run-all.mjs
npm run screenshots -- --theme dark-modern --theme light-modern
.venv/bin/python scripts/prototypes/cf_flags.py
./paranoia.sh --quick
node scripts/demo-video/record.mjs
uv run --no-project --with pillow --with imageio-ffmpeg python scripts/demo-video/montage.py
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
10. feat(plotting): log color scale, the norm plot control
11. feat(plotting): seaborn colormaps in cmap, seaborn in the extension's environment
12. chore(demo-video): film and edit the demo video by script, paranoia step demo-video
13. chore(paranoia): run the demo video only with --full-with-extras
14. feat(samples): sample_log_scale.nc gets one variable per case of the log scale
15. docs(v0.14): record two plotting limitations found while testing (dates as a map, depth upside down)
16. feat(ui): one plot settings editor with levels as tabs, plot buttons in the header (v0.14 UI remake)
17. docs(v0.14): demo video recorded again with the plot settings editor (length and size)
18. merge: main after the 0.13.1 release (release date, publish.sh fix)
19. docs(readme): v0.14 screenshots: header buttons, plot settings editor, CF flags
20. fix(pre-commit): run Prettier and ESLint as one process each (all files ran out of memory)
21. chore(workspace): VS Code no longer watches the generated folders (file watchers ran out)
22. feat(viewer): Expand All leaves the Xarray Encoding sections closed, setting expandAllIncludesXarrayEncoding
