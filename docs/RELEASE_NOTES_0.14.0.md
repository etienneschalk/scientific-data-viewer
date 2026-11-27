# Scientific Data Viewer v0.14.0 Release Notes

**TL;DR** — You can now see and control **how a file is decoded**. When CF time units are broken, the viewer turns off **only time decoding** (`decode_times=False`). `scale_factor` / `add_offset` and `_FillValue` masking keep working on the rest of the file. Before, it switched off all CF decoding (`decode_cf=False`). **Reopen raw** in File Information reloads the file with no decoding at all, to compare with the stored values. **Troubleshooting > How this file was opened** gives the exact xarray call, each keyword commented with where it comes from. Four **Decoding** settings (`maskAndScale`, `decodeTimes`, `decodeCoords`, `useCftime`) and a **`engineBackendKwargs`** setting (allowed keys only, user settings only) make the rest configurable. GeoTIFF / JPEG-2000 times are decoded as `datetime64`, like NetCDF ones. **Security**: `python.overridePythonInterpreter` is now read from user settings only, so a cloned repository can no longer choose the program the extension runs.

**CF flags.** Variables that follow the CF conventions for flags are now **plotted by meaning**. A variable with `flag_values` and `flag_meanings` (land cover classes, quality levels, status codes) gets one color per class and a colorbar that names each class with its share: `210 water (14%)`. The colors are the producer's own when the file has a `flag_colors` attribute. 1D flags are drawn as steps with the meanings on the y-axis, and bars replace the meaningless histogram of codes. **Bit flags** (`flag_masks`: cloud, cloud shadow, snow…) get **one panel per flag**, colored where the bit is set, and 1D bit flags a **block plot** with one row per flag. The codes are read **raw**, so a class that shares its number with the fill value (`127 = not_measured`) is still shown. A new **Flags** section in File Information lists every meaning with its value, mask and bits, and says why inconsistent flags cannot be used. New **Flags** plot controls pick meanings by name (`flag_select`), fold bit flags into one map (`flag_combine`: `cloud OR cloud_shadow`), and hide the points of a data variable that its quality flag marks (`hide_flags`, through `ancillary_variables`). Setting **flags** to `false` turns it all off.

**Log scale and seaborn colormaps.** A new **norm** plot control draws a variable on a **logarithmic scale** without changing the data: the colors follow `log10(value)` and the colorbar shows the values (`10⁻³`, `10⁻²`…), so a chlorophyll or precipitation field over several orders of magnitude no longer looks empty. On a line plot the axis of the values becomes logarithmic. Values ≤ 0 are left out and counted in a note. **cmap** also takes **seaborn colormaps** with a `seaborn:` prefix (`seaborn:rocket`, `seaborn:mako_r`, `seaborn:light:seagreen`); seaborn is added to the extension's own environment, which is **rebuilt once** at the first start of 0.14.

**Plot settings, remade.** The _Global Plot Controls_ and the _Group Plot Controls_ of every group are replaced by **one settings editor**, opened by a **Settings** button right next to **Create Plot**. Its tabs are the levels a setting can belong to: **This variable**, **Group /a**, **Whole file**. The nearest level wins, and an empty field shows in grey what it falls back to (`magma (file)`). You can now set a colormap **for one variable**, a group's settings apply to its **subgroups**, and nothing has to be scrolled to: the editor opens under the button, above the plot. A short **summary** under each Plot button says what applies and from where; click an item, or an item of the line under a plot, to change it. **Plot all**, **Cancel all**, **Save all** and **Clear all plots** are now in the header, and each group has **Plot group**.

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

### CF flag variables

A CF flag variable stores numbers that stand for names. Before 0.14 the viewer drew those numbers as a continuous field:

| Variable                                   | Before 0.14                                                         | v0.14                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Land cover, codes `10 … 210`               | `viridis` from 10 to 210: "urban" (190) looks close to "bare" (200) | One color per class (`flag_colors` when given), named in the colorbar |
| Quality level `0 … 5` along time           | Shades of one colormap, a numeric colorbar per facet                | Six named colors, one colorbar for the facets                         |
| 1D status, fill value `127` also a meaning | Line between codes; `127` masked as missing (it disappeared)        | Steps, meanings on the y-axis, `127 not measured` shown               |
| A single value, or `bins` set              | Histogram of codes                                                  | One bar per meaning with its share                                    |
| `flag_masks` (bit fields), a map           | Sums of powers of two (`13 = 8 + 4 + 1`)                            | One panel per flag, colored where it is set, bits in the colorbar     |
| `flag_masks` along time only (1D)          | A line between sums of powers of two                                | Block plot: one row per flag along time                               |
| Masks + values (bit fields with states)    | Sums of powers of two                                               | One panel or row per field, one color per state                       |

The goal is to reward producers who describe their masks with the CF attributes: a well-described file reads like its product user guide. The research and full design (what CF section 3.5 says, what cf_xarray, ARM ACT, ESA SNAP, satpy and ESA CCI do, four phases) are in [`docs/v0.14/CF_FLAGS_PROPOSAL.md`](./v0.14/CF_FLAGS_PROPOSAL.md). All four phases are in this release: P1 (`flag_values`), P2 (`flag_masks`, alone or with `flag_values`), P3 (selection and combination by name) and P4 (hiding points through `ancillary_variables`).

### Log scale and seaborn colormaps

Users asked to "log10 a variable before plotting it". A log **scale** is better than a log10 transform of the data: the colorbar stays in the variable's units, `vmin` / `vmax` are typed in data units, zeros and negative values are left out instead of becoming `-inf` / `NaN` with warnings, and the title and units still match the data. matplotlib does it with one object, `LogNorm`. The design and the comparison are in [`docs/v0.14/FEATURE_LOG_COLOR_SCALE.md`](./v0.14/FEATURE_LOG_COLOR_SCALE.md).

seaborn's colormaps (`rocket`, `mako`, `flare`, `crest`, `vlag`, `icefire`) are perceptually uniform like viridis and are the defaults of many papers' figures; a plot in the viewer can now match them. The `seaborn:` prefix keeps the name explicit, imports seaborn only when asked, and leaves room for other catalogues later (`cmocean:`, `crameri:`) through the `cmap` package. Design: [`docs/v0.14/FEATURE_SEABORN_COLORMAPS.md`](./v0.14/FEATURE_SEABORN_COLORMAPS.md).

---

### Plot settings

Up to 0.13 the plot controls came twice: a _Global Plot Controls_ section near the top of the page and a _Group Plot Controls_ block in every group, with the same ~20 fields. Users met four problems:

- **Which value wins?** Field by field the group's value, if set, else the global one; but for dimension slices, the group's whole set replaced the global one. The README needed a paragraph to explain it.
- **Scrolling.** The controls were far from the variable. Tuning a plot meant scrolling up to the controls, down to **Create Plot**, then to the image, again and again.
- **No per-variable setting.** Two variables of one group could not get two colormaps.
- **Weight.** Every group carried its controls, open or not: 19 parameters plus three boxes and a slider per dimension. A file with many groups built thousands of controls nobody used.

v0.14 keeps one rule, "the nearest level that sets a value wins", and one editor that shows the levels as tabs. The editor is built when you open it and removed when you close it, so the page holds at most one set of controls. The design and what was left out are in [`docs/v0.14/FEATURE_PLOT_SETTINGS_UI.md`](./v0.14/FEATURE_PLOT_SETTINGS_UI.md).

## Upgrade notes (read before updating)

- **Nothing to do by default.** With every new setting left at `default`, files open as in v0.13. The one change is files with broken time units: they now keep masking and scaling, so packed variables show physical values (e.g. `273.15` K instead of `0`) and fill values show as `NaN`.
- **Settings that need Refresh (🔄)**: `scientificDataViewer.decoding.*` and `scientificDataViewer.engineBackendKwargs` are read at each load. Refresh the viewer, or reopen the file, after changing them.
- **`engineBackendKwargs` in a workspace is ignored on purpose.** The setting is machine-scoped, so put it in your **user** settings. VS Code flags a value in `.vscode/settings.json` as not applicable, and the extension does not read it.
- **Backend JSON contract**: the info result's `decode_cf_degraded` (boolean) is replaced by `open_report` (object, see `OpenReport` in `python/sdv_backend/results.py`). Scripts that parse `get_data_info.py info` output must read `open_report.degraded_decoders` instead. Golden snapshots recorded with v0.13 (`python/tools/golden_snapshots.py`) differ on this key: record them again.
- **`python.overridePythonInterpreter` in a workspace is now ignored.** If you set it in a project's `.vscode/settings.json` (e.g. `.venv/bin/python`), the extension falls back to the next interpreter source (own environment, then the Python extension's interpreter) and logs a warning. Either select that interpreter with **Python: Select Interpreter**, or move the override to your **user** settings with an absolute path. See [§ Interpreter override](#interpreter-override-user-settings-only).
- **Flag variables look different by default.** Plots of variables with `flag_values` or `flag_masks` + `flag_meanings` change, as described above; a bit-flag map becomes one panel per flag. To get the plain numeric plot back, set **flags** to `false` in the plot settings (**Flags** fieldset), for the whole file, a group or one variable.
- **New Flags fieldset** in the plot settings, between Color and Figure: **flags** (moved from Color), **flag_select**, **flag_combine**, **hide_flags**. All empty by default: nothing changes until you set them. The fieldset is shown only where flags apply (a variable with CF flags or `ancillary_variables`, or a group holding one).
- **Inconsistent flags are not used.** When the attributes contradict each other (counts that differ, a value outside its mask, a value the variable's type cannot hold), the plot stays numeric and a note under it says why: `CF flags not used (...)`. The **Flags** section shows the same reason.
- **Style options ignored for flag plots**: `vmin`, `vmax` and `robust` (one color per class), and `bins` (bars per meaning). A note says so. `cmap` still applies: it is sampled into one color per meaning.
- **Backend JSON contract (flags)**: each data variable of the info result has a new `flags` key (`null` without flag attributes). The plot layout can have the kind `bars` and the roles `flags` and `hide_flags`. Golden snapshots recorded with 0.13 differ on these keys too.
- **The extension's own environment is rebuilt once** (users of `useExtensionOwnEnvironment` only): `seaborn` is a new requirement and `ENVIRONMENT_REVISION` goes from 2 to 3. At the first start of 0.14, a notification shows the environment being deleted and recreated (a few minutes, network needed). If the rebuild fails (offline), the previous environment keeps being used and the rebuild is retried at the next start. Interpreters you chose (Python extension, `overridePythonInterpreter`) are never modified: install seaborn there yourself (`pip install seaborn`) if you want `seaborn:` colormaps.
- **norm and seaborn colormaps change nothing until you use them.** **norm** is empty (`linear`) by default, and `cmap` names without the `seaborn:` prefix are matplotlib colormaps as before.
- **Backend JSON contract (log scale)**: the plot layout can have the role `norm`, and `applied_plot_kwargs` the keys `norm` (text such as `"LogNorm(vmin=0.001, vmax=12.5)"`), `center`, `extend`, `xscale` / `yscale`.
- **Where the plot controls went.** _Global Plot Controls_ is gone: its settings are the **Whole file** tab, opened by **Settings** in the **Plot** section of the group `/` (the first group card), or from any variable. _Group Plot Controls_ is the **Group /a** tab. **Plot all** and **Cancel all** are in the header, with **Save all plots** (disk icon) and **Clear all plots** (bin icon).
- **A group's settings now apply to its subgroups**, and **slices merge dimension by dimension**. In 0.13 a group's slices replaced every global slice; now a slice of `time` for the whole file and a slice of `lat` for a group both apply. To cancel a slice set higher up for one variable, give that variable the full range (e.g. start `0`, stop the size).
- **True / false parameters are lists**: empty (falls back, shown in grey), `true`, `false`. The dash of the old three-state checkbox is gone.
- **Settings `globalDimensionSlices` and `groupDimensionSlices` are removed** (they showed or hid the old blocks). A value left in your `settings.json` is ignored; VS Code greys it out as unknown, and you can delete it.
- **Settings are kept while the tab is open**, also through **Refresh**, and forgotten when the tab is closed (as in 0.13).
- **The HTML export** keeps the summary of the settings under each Plot button, not the editor.
- **Expand All no longer opens the Xarray Encoding sections.** They are long and filled the page. To get the 0.13 behavior back, set `scientificDataViewer.expandAllIncludesXarrayEncoding` to `true` (then **Refresh** an open viewer).
- **README and Marketplace page**: new v0.14 screenshots (header buttons, the settings editor, a CF flag variable drawn by meaning).

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

## CF flag variables plotted by meaning

### File Information: the Flags section

Each variable with `flag_values`, `flag_masks` or `flag_meanings` gets a **Flags** section, open by default, after **Attributes**:

| Kind           | Columns                      | Example                                |
| -------------- | ---------------------------- | -------------------------------------- |
| `flag_values`  | value, meaning (with swatch) | `210` ■ `water`                        |
| `flag_masks`   | mask, bits, meaning          | `9223372036854775808` `bit 63` `cloud` |
| masks + values | mask, bits, value, meaning   | `12` `bits 2-3` `8` `calibration_mode` |

Masks and values are shown exactly, `uint64` included. The swatch is the `flag_colors` color, shown only when it is a hex code or a color name. When the flags are inconsistent, a warning line says why they are not used for plots.

### Plots

| Plot kind                                            | Drawn as                                                                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Image (2D, facets)                                   | One color per meaning; colorbar ticks `value meaning (share)`; no data transparent; one colorbar for facets |
| Line (1D)                                            | Steps; meanings on the y-axis; one line: points colored by meaning; `hue` gives one line per index          |
| Bars (single value, `bins` set, too many dimensions) | One horizontal bar per meaning: its share of the values with data                                           |

- **Colors**, first match: the `cmap` you set; the file's `flag_colors` (one valid color per meaning; not CF, written by ESA CCI Land Cover); `tab10` (up to 10 meanings), `tab20` (20), `tab20` + `tab20b` + `tab20c` (60), `turbo`.
- **Codes not in `flag_values`** are one more class, `other`, in black, with a note listing them: they show a gap in the metadata.
- **More than 20 meanings** (ESA CCI Land Cover declares 37): only the ones present in the plotted data are listed, with a note.
- The plot layout line shows an automatic item `flags  flag_values, 8 meanings, colors: flag_colors`.

### Bit flags (`flag_masks`, alone or with `flag_values`)

Each flag can be set independently, so one map cannot show them all. The plot adds a dimension `flag` with one entry per flag. The entry holds the flag's color where it is set, grey `not set` elsewhere, and transparent where there is no data. A mask repeated in `flag_masks` (CF example 3.8: `bits 2-3` hold `offline`, `calibration` or `maintenance` mode) is one entry, with one color per state. The layout engine then places `flag` like any other dimension:

| Data                                            | Drawn as                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| A map                                           | One panel per flag, titled `flag = cloud (bit 0)`                    |
| A map over time                                 | One row of panels per flag, one column per time                      |
| 1D (time series)                                | Block plot: one row per flag along the x-axis, the first flag on top |
| A single point, `bins` set, too many dimensions | Bars: the share of the points where each flag is set                 |

- The colorbar names each flag with its bits and share: `bit 0 cloud (22%)`, `bits 2-3 = 8 calibration mode (25%)`, then `not set`. The shares of bit flags do not add up to 100%: several can be set at once.
- **Bits set in the data but in no `flag_masks`** are counted in a note (`3 values have bits 4, 5 set, in no flag_masks`).
- **More than 20 flags** (Sentinel-3 OLCI `WQSF` has about 40): only those set somewhere in the plotted data are drawn, with a note.
- **Large data**: the plot holds one copy of the data per flag. Above 50 million points in all, the last flags are left out, with a note; slice the variable to see them.
- The layout line reads `flags  flag_masks, 6 meanings, colors: tab10`, or `flag_masks + flag_values, 5 meanings in 3 fields, …`.

### Choosing flags by name (`flag_select`, `flag_combine`)

| Control          | Values                                           | `flag_values` (classes)                                                         | Bit flags                                                                                                |
| ---------------- | ------------------------------------------------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **flag_select**  | meanings, separated by commas                    | The chosen classes keep their color, the others are one grey `N other meanings` | Only the panels of the chosen flags; unchosen states of a field are `not set or not selected`            |
| **flag_combine** | empty (one panel per flag), `any`, `all`, `none` | Ignored, with a note (codes are exclusive)                                      | One map of the chosen flags (all without `flag_select`): `cloud OR cloud shadow`, `… AND …`, `none of …` |

- Names are matched whatever their case, and `_`, `-` and spaces are alike: `Cloud shadow` finds `cloud_shadow`.
- Set for the whole file, a selection applies to every flag variable that has one of the names; names it does not have are noted (`flag_select: glacier not among the meanings of this variable`), and a selection with no match is ignored with a note.
- The layout line shows the selection in the `flags` item (`selected: urban, water`, `any: cloud, cloud shadow`), outlined as a choice of yours.

### Hiding flagged points (`hide_flags`)

CF links a data variable to its quality flags with `ancillary_variables` (`sst:ancillary_variables = "pixel_flags quality_level"`). With **hide_flags** set to meanings of those flag variables (`cloud, bad data`), plotting `sst` hides the points where any of them is set.

- The flag variables are read raw, sliced like the variable, and broadcast along its other dimensions: a 2D land mask hides the same points at every time step. A flag variable with a dimension the variable does not have, or of another size, is skipped with a note.
- The layout line shows `hide_flags  cloud (pixel_flags); bad data (quality_level)`, and a note counts the values hidden: `1420 of 4050 values hidden (35%)`.
- When nothing applies, a note says why: no `ancillary_variables`, no flag with that name, an ancillary variable not in the group.
- Only variables of the same group are looked up (`ancillary_variables` names, not paths).

### Why codes are read raw

xarray's default decoding (`mask_and_scale`) turns an integer variable with a `_FillValue` into floats. For flags this breaks two things:

- A code equal to the fill value disappears, even when it is a declared meaning (`station_status`: `127 = not_measured`).
- 64-bit masks lose their low bits above 2⁵³: `(1 << 63) | 2` reads back as `2**63` (checked with xarray 2026.7).

So when decoding changed a flag variable, the plot opens the file again with `mask_and_scale={name: False}` for **that variable only**, keeping the other decoding settings (`decoding.*`, the time fallback). The fill value, `missing_value` and `valid_range` then mark the points without data, except a code that is a declared meaning. This works with the netcdf4, h5netcdf, scipy and zarr engines, checked down to xarray 2024.10. Other engines keep the decoded values, with NaN marking no data.

With **Reopen raw** or `decoding.maskAndScale: off`, the codes are already raw and the file is not read a second time.

---

## Log color scale (norm = log)

A select in the **Color** fieldset of the plot settings, at any level (whole file, group, variable): `linear` (default, nothing passed) or `log`. Command line: `--norm log`.

| Plot kind        | norm = log                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Image, facets    | Colors follow `log10(value)`; one colorbar for every panel, log ticks, labels in data units |
| Line             | Log scale on the axis of the values (y, or x when the variable is drawn along y)            |
| Histogram, bars  | Ignored, with a note                                                                        |
| CF flag variable | Ignored, with a note (one color per meaning)                                                |

What a log scale cannot show:

- **Values ≤ 0** are not drawn: transparent on an image, a gap in a line. A note counts them: `norm=log: 14 of 239 values ≤ 0 not shown (5.9%)`.
- **No value above 0**: the plot stays linear, `norm=log ignored: no value above 0, linear scale`.
- **`vmin` / `vmax` ≤ 0**: ignored with a note, the smallest / largest value above 0 is used. Limits above 0 are honoured, in data units.
- **`robust`**: the 2nd and 98th percentiles of the values above 0.
- Data of both signs keeps the sequential colormap (`viridis`): xarray's diverging default (`RdBu_r`, centred on 0) makes no sense on a log scale.

The layout line under the plot shows the scale and its limits, `norm log, 0.001 to 12.5`, outlined as set by you.

## seaborn colormaps

`cmap` accepts `seaborn:<name>`, anything `seaborn.color_palette(<name>, as_cmap=True)` accepts:

- the colormaps `rocket`, `mako`, `flare`, `crest`, `vlag`, `icefire`, and their `_r` variants;
- palette strings: `seaborn:light:seagreen`, `seaborn:dark:salmon_r`, `seaborn:blend:#7AB,#EDA`, `seaborn:ch:s=.25,rot=-.25` (only the first colon is the prefix);
- qualitative palettes (`seaborn:deep`, `seaborn:Set2`), as a stepped colormap.

Without the prefix, the name is a matplotlib colormap, as before. seaborn is imported only for a `seaborn:` name. When seaborn is missing or does not know the name, the plot fails with one line that says what to do: `cmap=seaborn:rocket: needs the seaborn package: install it in the viewer's Python environment (pip install seaborn), or use the extension's own environment (...)`. CF flag variables take their colors from it like from any `cmap`.

---

## Plot settings: one editor, three levels

### Levels

| Level         | Tab title       | Applies to                                       |
| ------------- | --------------- | ------------------------------------------------ |
| a variable    | `This variable` | this variable only                               |
| a group       | `Group /a`      | the variables of `/a` and of its subgroups       |
| the group `/` | `Whole file`    | every variable of the file (the former _global_) |

The tabs of a variable's editor are its own level, then its group, the parent groups, and the whole file. For each plot parameter, and for the slice of each dimension, **the first tab from the left that sets it wins**. Without one, the plot chooses it automatically, as before; true / false parameters take their default. A file with one group has two tabs: **This variable** and **Whole file**.

### The editor

- **Settings** opens it under the button: next to **Create Plot** in a variable's **Plot** section, or in the new **Plot** section at the top of each group card (with **Plot group**). It is part of the page, not a pop-up window, so the plot under it stays visible.
- Each tab shows how many values it sets. An empty field shows in grey what it falls back to: `magma (file)`, `0:6 (group /a)` next to a dimension's size, `true (default)`, `auto`, `linear`. A field set in the tab shown is outlined with a `•`, as before.
- **Reset** clears the slices, or the parameters, of the tab shown only.
- **Enter** in a box plots; **Escape**, **Close** or `×` closes the editor. Opening another editor closes the first: there is one at a time, and none is built until you ask.
- The **Flags** fieldset only appears where flags apply.
- A number typed wrong is outlined in red and blocks the plot with a message naming the tab: `Whole file: vmin: "1,5" is not a number (use a dot as decimal separator)`. A value set nearer (in **This variable**) replaces it and the plot goes.

### Summaries and clicks

Under each Plot button, **Settings:** lists every setting that applies, with where it comes from: `time 0:6 file`, `cmap magma file`, `vmax 10 variable`. Items set at the level of that variable or group are outlined; with nothing set it reads `Settings: all automatic`. Click an item: the editor opens on that tab, with the cursor in that field.

The items of the line under a plot (`col time`, `col_wrap 3 •`, `x lon`…) are buttons too: a click opens the field, in the tab that sets it, or in **This variable** for an automatic choice. When a setting that applies to a displayed plot changes, the plot says **Settings changed: plot again to apply them**.

### Buttons

| Button                    | Where                   | What it does                                                  |
| ------------------------- | ----------------------- | ------------------------------------------------------------- |
| **Plot all**              | header                  | every data variable of the file, 5 at a time                  |
| **Cancel all**            | header, while plots run | stops every running plot (also those of Plot group)           |
| **Save all plots** (disk) | header                  | saves every displayed plot under `sdv-plots/`                 |
| **Clear all plots** (bin) | header                  | removes every plot from the page; the settings stay           |
| **Plot group**            | Plot section of a group | the group's own data variables (its subgroups have their own) |
| **Settings**              | variable and group      | opens / closes the editor of that variable or group           |

## Expand All and the Xarray Encoding sections

**Expand All** (header) opens every section except the **Xarray Encoding** sections of groups, coordinates and variables: a file with many variables showed long lists of `_FillValue`, `dtype`, `chunksizes`, `source`… between the attributes. An encoding section you opened by hand stays open, and **Collapse All** still closes everything. The button's tooltip says so: `Expand All Sections (except Xarray Encoding)`.

| Setting                                                | Default | Effect                                                    |
| ------------------------------------------------------ | ------- | --------------------------------------------------------- |
| `scientificDataViewer.expandAllIncludesXarrayEncoding` | `false` | `true`: Expand All opens the Xarray Encoding sections too |

The setting is read when a file loads (**Refresh** applies it to an open viewer). The page keeps it on the button, so an exported HTML page opened in a browser expands the same way.

## Manual verification

Create the sample files first: `python python/create_sample_data.py` (new in v0.14: `broken_datetime_packed_variable.nc`, `sample_geotiff_time_bands.tif`, `sample_cf_flags.nc`, `sample_log_scale.nc`, in `artefacts/sample-data/`). The full step-by-step plan with a results sheet (decoding, flags, log scale and seaborn) is [`docs/v0.14/MANUAL_TEST_PLAN_0.14.0.md`](./v0.14/MANUAL_TEST_PLAN_0.14.0.md).

**Decoding**:

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

**CF flags**, with `artefacts/sample-data/sample_cf_flags.nc`:

12. Expand `land_cover`: **Flags** section, `flag_values: one code per meaning · colors from flag_colors`, 8 rows with swatches.
13. Plot `land_cover`: the colors of the swatches, colorbar `10 cropland (…%)` to `210 water (…%)`, the top rows (fill value) transparent. Layout line: `flags flag_values, 8 meanings, colors: flag_colors`.
14. Open **Settings** of `land_cover`, set **flags** (Flags) to `false` and plot again: the plain numeric plot (viridis, 10 to 210), no `flags` item.
15. Plot `quality_level`: three facets (time), one colorbar `0 no data` … `5 best quality`.
16. Plot `station_status`: steps, `127 not measured` on the y-axis, one black point `other (code not in flag_values)`, a note listing code `9`.
17. Plot `lccs_class`: 8 classes listed, note `29 of the 37 meanings are absent from the plotted data and not listed`.
18. Plot `land_cover` with `bins` = 10: bars per meaning, note `bins ignored: …`.
19. Expand `wqsf`: masks shown exactly (`9223372036854775808`, `bit 63`). Plot it: six panels `flag = invalid (bit 0)` … `flag = cloud (bit 63)`, each in its color where set and grey elsewhere, the bottom row (fill value) transparent; colorbar `bit 63 cloud (…%)`.
20. Plot `pixel_flags`: one row per flag (cloud, cloud shadow, snow ice, invalid), one column per time.
21. Plot `sensor_status_qc`: block plot, rows `low battery (bit 0)`, `hardware fault (bit 1)`, `bits 2-3: 3 states` (top to bottom); the last row in three colors along time.
22. Plot `sensor_status_qc` with `status_time` = `20`: bars, `bits 2-3 = 4 offline mode (100%)`.
23. Set **flag_select** = `water, urban` and plot `land_cover`: water and urban in their colors, the rest grey `the 6 other meanings`; layout item `flags … selected: urban, water` outlined.
24. Set **flag_select** = `cloud, cloud shadow` and **flag_combine** = `any`, plot `pixel_flags`: one map per time, `cloud OR cloud shadow (…%)` in blue, `none of them` in grey.
25. Clear them, set **hide_flags** = `cloud, bad data`, plot `sst`: holes where it is cloudy; layout item `hide_flags cloud (pixel_flags); bad data (quality_level)`, note `… values hidden (…%) …`.
26. Expand `broken_mixed`: the Flags section warns `Not used for plots …: questionable: value 1 has bits outside its mask 2 …`; its plot carries the same note.

**Log scale and seaborn**, with `artefacts/sample-data/sample_log_scale.nc`:

27. Plot `chlorophyll`: four facets in one flat dark color with a few bright pixels. Set **norm** = `log` (Color) and plot again: gradients appear, one colorbar labelled `10⁻²` … `10³`, the land disc and the zero corner transparent; layout item `norm log, … to …` outlined, note `norm=log: … values ≤ 0 not shown (…%)`.
28. Set **vmin** = `0.1`, **vmax** = `10`: the colorbar runs from `10⁻¹` to `10¹` with arrows at both ends. Set **vmin** = `-1`: note `vmin=-1 ignored: a log scale starts above 0 (… used)`.
29. Plot `particle_count`: log y-axis, a gap at sample 17 (a zero). Plot `net_flux`: only the positive half colored, in `viridis` (not red / blue). Plot `depth_negative`: linear plot, note `norm=log ignored: no value above 0, linear scale`. The other variables of the file each test one more case (integers, `robust` with storm cores, tiny and huge values, `±inf`, a constant field, a profile along y, packed values decoded and raw, a flag variable, booleans, a histogram): [M27](./v0.14/MANUAL_TEST_PLAN_0.14.0.md#m27--lines-both-signs-edge-cases-ignored-cases) of the manual test plan.
30. Set **norm** back to `linear`, **cmap** = `seaborn:rocket`, plot `chlorophyll`: black-red-cream colors. `seaborn:light:seagreen`: white to green. `seaborn:rockett`: the plot fails with `cmap=seaborn:rockett: not a seaborn colormap or palette (...)`.
31. With an interpreter without seaborn (**Use My Own Interpreter**), plot with `seaborn:rocket`: one-line error `… needs the seaborn package …`. A `viridis` plot still works.
32. Upgrade, with `useExtensionOwnEnvironment` on and an environment created by 0.13: the first start of 0.14 shows the environment being rebuilt once; the healthcheck then lists `seaborn` among the available packages; a second start does not rebuild.

**Demo video** (development, no display needed):

33. Run `node scripts/demo-video/record.mjs`, then `uv run --no-project --with pillow --with imageio-ffmpeg python scripts/demo-video/montage.py`. `artefacts/demo-video/scientific-data-viewer-demo.mp4` plays in about 1 min 30 s: title card, Python set up from the walkthrough (the uv download, sped up with a `×N` badge when it takes more than 5 s), the sample opened from the Explorer, its attributes, 12 monthly maps, the time series, then **Settings** of `tas` opened, a time slice and `RdYlBu_r` typed there, every third month in `RdYlBu_r`, end card. No VS Code window opened during the recording, and none is left running (`pgrep -f artefacts/demo-video/run` finds nothing).

**Plot settings**, with `artefacts/sample-data/sample_data_multiple_groups.nc` and the sample file (**Scientific Data Viewer: Open Sample File**). The full recipe, for a tester who does not read code, is M31-M38 of the [manual test plan](./v0.14/MANUAL_TEST_PLAN_0.14.0.md#plot-settings-ui-remake).

34. Open the sample file. No _Global Plot Controls_ section; the header has **Plot all**, a disk and a bin icon. The group `/` starts with a **Plot** section: **Plot group**, **Settings**, `Settings: all automatic`.
35. Expand `tas`, click **Settings** next to **Create Plot**: an editor opens under it with tabs **This variable** and **Whole file**. Click **Settings** of the group `/`: the first editor closes, a **Whole file** editor opens.
36. In **Whole file**, type `0:12:3` in the start box of `time` and `RdYlBu_r` in **cmap**. The summaries of the group and of `tas` read `time 0:12:3 file`, `cmap RdYlBu_r file`. Plot `tas`: four maps in red-yellow-blue.
37. Open **Settings** of `tas`: **cmap** shows `RdYlBu_r (file)` in grey. Type `magma` and press **Enter**: `tas` is plotted in magma; `tas_global_mean` still gets the file values.
38. Click the `cmap magma variable` item of the summary: the editor of `tas` opens on **This variable**, cursor in **cmap**. Click `col time` under the plot: cursor in **col**.
39. Change **cmap** of **Whole file**: the `tas_global_mean` plot (if plotted) says **Settings changed: plot again to apply them**.
40. Open `sample_data_multiple_groups.nc`: a variable of a subgroup has one tab per parent group. A **cmap** set on a group applies to its subgroups' variables, not to the other groups.
41. **Plot group** plots only that group's variables; **Plot all** and every **Plot group** are disabled while it runs; **Cancel all** stops it.
42. Export the viewer: the summaries are in the HTML file, not the editor; in a browser the Settings buttons are hidden.

**Expand All**, with the sample file:

43. Click **Expand All** (header): every section opens but the **Xarray Encoding** ones (group `/`, `tas`, `time`…); the tooltip reads `Expand All Sections (except Xarray Encoding)`. **Collapse All** closes everything.
44. Set `scientificDataViewer.expandAllIncludesXarrayEncoding` to `true`, **Refresh**, **Expand All**: the encoding sections open too. Export the viewer and open the file in a browser: **Expand All** there follows the setting of the moment of the export.

## Known limitations

### Decoding

- **Opening errors do not show the report.** When every engine fails, the error page replaces the viewer, including the Troubleshooting section. The engines tried and their errors are in the logs (**Show Extension Logs**).
- **Raw mode is per tab and not saved.** Closing and reopening the file returns to decoded.
- **The time fallback is triggered by one message**, `unable to decode time units`. Other time decoding errors (e.g. out-of-bounds dates with `useCftime: off`) still fail the open: use **Reopen raw** or `decodeTimes: off`.
- **Rasters**: `decode_coords` cannot be changed (rioxarray only supports `all`). `useCftime` only decides whether the viewer converts cftime to `datetime64`. Non-standard calendars stay cftime.
- **NASA CDF**: only `decodeTimes` and `maskAndScale` map to cdflib (`to_datetime`, `fillval_to_nan`). `engineBackendKwargs` has no `cdflib` entry.
- **`engineBackendKwargs` is an allowlist.** An option missing from it needs a code change in `USER_BACKEND_KWARGS_ALLOWED` (`python/sdv_backend/decoding.py`), on purpose.

### CF flags

- **One panel per flag can be a lot**: a product with 40 bits set somewhere gives 40 panels; use **flag_select** or **flag_combine**.
- **Names are typed, not picked**: no suggestion list yet. The **Flags** section of File Information lists the meanings to copy.
- **`hide_flags` looks in the variable's own group only**, and only at `ancillary_variables`; a quality flag not linked that way cannot hide points.
- **`flag_select` is for flag variables**: set for the whole file, it does not affect a plain data variable (no note), use **hide_flags** for those.
- **Bit flags read as floats lose bits above 2⁵³** on engines that cannot read raw (cfgrib, rasterio, kerchunk, cdflib); a note says so for 64-bit variables.
- **Other engines read decoded values** (cfgrib, rasterio, kerchunk, cdflib). A fill code that is also a meaning is shown as no data there.
- **`flag_colors` is not CF.** It is honoured only with exactly one valid color per meaning, otherwise ignored with a note.
- **Shares count the plotted selection**: with dimension slices, the percentages are those of the slice, not of the whole variable.

### Log scale and seaborn colormaps

- **`log` only**: no `symlog` yet for data of both signs (the negative half is left out); no log-spaced bins for histograms; no log scale on a coordinate axis (pressure levels).
- **Limits come from the plotted selection**: with dimension slices, the automatic limits are those of the slice.
- **The values ≤ 0 note is always shown**, even for a handful of values.
- **seaborn colormap names are typed, not picked**: no list of suggestions or previews yet.
- **A `seaborn:` name fails every plot when seaborn is missing**, line plots and histograms included (they would ignore `cmap`): the name is checked before the file is read.

### Plot settings

- **No "apply to the group" button yet**: a value set for one variable has to be typed again in the group's tab to apply it to its neighbours.
- **A slice set higher up cannot be emptied for one variable**: give the full range instead (start `0`, stop the size).
- **Settings are not saved** with the file or the workspace: they live as long as the tab (Refresh keeps them).
- **The x / y / hue / row / col lists offer dimensions only**, as in 0.13 (not other coordinates).

### Found while testing (not fixed)

Two limitations found while building `sample_log_scale.nc`. Both predate v0.14, come from xarray (the viewer passes its behavior through) and do not depend on the log scale. They are recorded here, not fixed in this release.

- **A map of dates cannot be plotted.** A variable whose values are dates (`datetime64`) on two dimensions, such as a "date of the last bloom" map, fails with `UFuncTypeError: ufunc 'add' cannot use operands with types datetime64 and datetime64`, on a linear scale as on a log one. To turn values into colors, xarray computes the color limits with arithmetic (`_determine_cmap_params`) that does not exist for dates; plain `da.plot()` fails the same way (xarray 2026.7). Dates along an axis (time series) are not affected. A possible fix: color the dates as numbers (days since the earliest one) with date labels on the colorbar, or at least an error that says a map of dates cannot be drawn. This is also why `sample_log_scale.nc` tests "not numbers" with booleans (`is_bloom`) rather than dates.
- **Depth is drawn upside down.** A y coordinate with the CF attribute `positive: "down"` (depth: 0 m at the surface, growing downward) is drawn like any other: 0 at the bottom, the deepest values at the top. Neither xarray nor the viewer reads `positive`. Workaround: **yincrease** = `false`. A possible fix: set `yincrease=False` automatically when the y coordinate has `positive: "down"` and the user has not set **yincrease**, as the plot layout already does for its other automatic choices. Seen with `chlorophyll_profile` plotted with **y** = `depth` (manual test plan M27, step 9).

## Summary

| Change                                                   | Kind          | Where                                                                    |
| -------------------------------------------------------- | ------------- | ------------------------------------------------------------------------ |
| Time fallback turns off time decoding only               | Changed       | `opening.py`, `decoding.py`                                              |
| Reopen raw / Reopen decoded                              | Added         | File Information; `UIController`, `setRawMode` request, `--raw`          |
| How this file was opened                                 | Added         | Troubleshooting section; `OpenReport` in the info result                 |
| Decoding settings (4)                                    | Added         | `scientificDataViewer.decoding.*`; `--mask-and-scale` … `--use-cftime`   |
| `engineBackendKwargs`                                    | Added         | User settings only, allowlist; `--engine-backend-kwargs`                 |
| Raster times as `datetime64`                             | Changed       | `opening.py`                                                             |
| Kerchunk time fallback                                   | Fixed         | `opening.py`                                                             |
| `decode_cf_degraded` → `open_report`                     | Changed       | Backend JSON contract                                                    |
| Two sample files                                         | Added         | `python/sample_data/`                                                    |
| `overridePythonInterpreter` user-only                    | Security      | `package.json` scope, `config.ts`, `PythonManager.ts`                    |
| CF `flag_values` plotted by meaning                      | Added         | Images, steps, bars; colors from `cmap`, `flag_colors`, palette          |
| CF bit flags (`flag_masks`)                              | Added         | One panel per flag, 1D block plot, bars of shares                        |
| **flag_select**, **flag_combine**                        | Added         | Flags fieldset; `--flag-select`, `--flag-combine`                        |
| **hide_flags** (`ancillary_variables`)                   | Added         | Flags fieldset; `--hide-flags`                                           |
| Flag codes read raw                                      | Added         | `resolve_open_kwargs(raw_variables=...)`: netcdf4, h5netcdf, scipy, zarr |
| Flags section                                            | Added         | File Information; `variables_flattened[*].flags`                         |
| **flags** control                                        | Added         | Flags fieldset, default on; `--no-flags`                                 |
| Layout kind `bars`, roles `flags`, `hide_flags`          | Changed       | Backend JSON contract                                                    |
| `sample_cf_flags.nc`; `sample_many_encoding.nc` QC flags | Added / Fixed | `python/sample_data/`                                                    |
| Flags prototype                                          | Added         | `scripts/prototypes/cf_flags.py`, `paranoia.sh` step `prototypes`        |
| **norm** `log`: log color scale, log data axis           | Added         | Color fieldset; `--norm log`; `plotting/norm.py`                         |
| `seaborn:` colormaps in **cmap**                         | Added         | `plotting/colormaps.py`; seaborn optional                                |
| seaborn in the extension's own environment               | Changed       | `ALL_REQUIREMENTS`, `ENVIRONMENT_REVISION` 3: rebuilt once               |
| Layout role `norm`                                       | Changed       | Backend JSON contract                                                    |
| `sample_log_scale.nc`                                    | Added         | `python/sample_data/log_scale.py`                                        |
| Demo video, filmed and edited by a script (development)  | Added         | `scripts/demo-video/`; `paranoia.sh --full-with-extras` (`demo-video`)   |
| Plot settings: one editor, levels as tabs                | Changed       | **Settings** buttons; `plotSettings.ts`, `plotEditor.ts`                 |
| Settings per variable; groups apply to subgroups         | Added         | Tabs **This variable**, **Group /a**, **Whole file**                     |
| Slices merged dimension by dimension                     | Changed       | `plotRequestFor`                                                         |
| Summaries and clickable layout items                     | Added         | Under each Plot button and each plot                                     |
| Plot all / Cancel all / Save all / Clear all in header   | Changed       | `HTMLGenerator.generateHeader`                                           |
| **Plot group**                                           | Added         | Plot section of each group                                               |
| `globalDimensionSlices`, `groupDimensionSlices`          | Removed       | `package.json`                                                           |
| Expand All leaves Xarray Encoding closed                 | Changed       | Setting `expandAllIncludesXarrayEncoding` (default `false`)              |
