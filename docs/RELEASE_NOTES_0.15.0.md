# Scientific Data Viewer v0.15.0 Release Notes

**TL;DR** — Variables that follow the CF conventions for flags are now **plotted by meaning**. A variable with `flag_values` and `flag_meanings` (land cover classes, quality levels, status codes) gets one color per class and a colorbar that names each class with its share: `210 water (14%)`. The colors are the producer's own when the file has a `flag_colors` attribute. 1D flags are drawn as steps with the meanings on the y-axis, and bars replace the meaningless histogram of codes. **Bit flags** (`flag_masks`: cloud, cloud shadow, snow…) get **one panel per flag**, colored where the bit is set, and 1D bit flags a **block plot** with one row per flag. The codes are read **raw**, so a class that shares its number with the fill value (`127 = not_measured`) is still shown. A new **Flags** section in File Information lists every meaning with its value, mask and bits, and says why inconsistent flags cannot be used. New **Flags** plot controls pick meanings by name (`flag_select`), fold bit flags into one map (`flag_combine`: `cloud OR cloud_shadow`), and hide the points of a data variable that its quality flag marks (`hide_flags`, through `ancillary_variables`). The **flags** checkbox turns it all off.

**Start here** to review, test or release v0.15: [`docs/v0.15/GETTING_STARTED.md`](./v0.15/GETTING_STARTED.md).

---

## Why this release?

A CF flag variable stores numbers that stand for names. Before 0.15 the viewer drew those numbers as a continuous field:

| Variable                                   | Before 0.15                                                         | v0.15                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Land cover, codes `10 … 210`               | `viridis` from 10 to 210: "urban" (190) looks close to "bare" (200) | One color per class (`flag_colors` when given), named in the colorbar |
| Quality level `0 … 5` along time           | Shades of one colormap, a numeric colorbar per facet                | Six named colors, one colorbar for the facets                         |
| 1D status, fill value `127` also a meaning | Line between codes; `127` masked as missing (it disappeared)        | Steps, meanings on the y-axis, `127 not measured` shown               |
| A single value, or `bins` set              | Histogram of codes                                                  | One bar per meaning with its share                                    |
| `flag_masks` (bit fields), a map           | Sums of powers of two (`13 = 8 + 4 + 1`)                            | One panel per flag, colored where it is set, bits in the colorbar     |
| `flag_masks` along time only (1D)          | A line between sums of powers of two                                | Block plot: one row per flag along time                               |
| Masks + values (bit fields with states)    | Sums of powers of two                                               | One panel or row per field, one color per state                       |

The goal is to reward producers who describe their masks with the CF attributes: a well-described file reads like its product user guide. The research and full design (what CF section 3.5 says, what cf_xarray, ARM ACT, ESA SNAP, satpy and ESA CCI do, four phases) are in [`docs/v0.15/CF_FLAGS_PROPOSAL.md`](./v0.15/CF_FLAGS_PROPOSAL.md). This release holds the four phases: P1 (`flag_values`), P2 (`flag_masks`, alone or with `flag_values`), P3 (selection and combination by name) and P4 (hiding points through `ancillary_variables`).

---

## Upgrade notes (read before updating)

- **Flag variables look different by default.** Plots of variables with `flag_values` or `flag_masks` + `flag_meanings` change, as described above; a bit-flag map becomes one panel per flag. To get the plain numeric plot back, uncheck **flags** in the plot controls (**Flags** fieldset), globally or for one group.
- **New Flags fieldset** in the plot controls, between Color and Figure: **flags** (moved from Color), **flag_select**, **flag_combine**, **hide_flags**. All empty by default: nothing changes until you set them.
- **Inconsistent flags are not used.** When the attributes contradict each other (counts that differ, a value outside its mask, a value the variable's type cannot hold), the plot stays numeric and a note under it says why: `CF flags not used (...)`. The **Flags** section shows the same reason.
- **Style options ignored for flag plots**: `vmin`, `vmax` and `robust` (one color per class), and `bins` (bars per meaning). A note says so. `cmap` still applies: it is sampled into one color per meaning.
- **Backend JSON contract**: each data variable of the info result has a new `flags` key (`null` without flag attributes). The plot layout can have the kind `bars` and the roles `flags` and `hide_flags`. Scripts that compare the backend output, such as golden snapshots recorded with 0.13, must record again.
- **No change to Python environments**: no new package. The extension's own uv environment is not rebuilt (`ENVIRONMENT_REVISION` unchanged).

---

## What a flag variable looks like now

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
- Set globally, a selection applies to every flag variable that has one of the names; names it does not have are noted (`flag_select: glacier not among the meanings of this variable`), and a selection with no match is ignored with a note.
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

So when decoding changed a flag variable, the plot opens the file again with `mask_and_scale={name: False}` for **that variable only**. The fill value, `missing_value` and `valid_range` then mark the points without data, except a code that is a declared meaning. This works with the netcdf4, h5netcdf, scipy and zarr engines, checked down to xarray 2024.10. Other engines keep the decoded values, with NaN marking no data.

---

## Manual verification

With `python python/create_sample_data.py`, then `artefacts/sample-data/sample_cf_flags.nc`:

1. Expand `land_cover`: **Flags** section, `flag_values: one code per meaning · colors from flag_colors`, 8 rows with swatches.
2. Plot `land_cover`: the colors of the swatches, colorbar `10 cropland (…%)` to `210 water (…%)`, the top rows (fill value) transparent. Layout line: `flags flag_values, 8 meanings, colors: flag_colors`.
3. Uncheck **flags** (Color) and plot again: the plain numeric plot (viridis, 10 to 210), no `flags` item.
4. Plot `quality_level`: three facets (time), one colorbar `0 no data` … `5 best quality`.
5. Plot `station_status`: steps, `127 not measured` on the y-axis, one black point `other (code not in flag_values)`, a note listing code `9`.
6. Plot `lccs_class`: 8 classes listed, note `29 of the 37 meanings are absent from the plotted data and not listed`.
7. Plot `land_cover` with `bins` = 10: bars per meaning, note `bins ignored: …`.
8. Expand `wqsf`: masks shown exactly (`9223372036854775808`, `bit 63`). Plot it: six panels `flag = invalid (bit 0)` … `flag = cloud (bit 63)`, each in its color where set and grey elsewhere, the bottom row (fill value) transparent; colorbar `bit 63 cloud (…%)`.
9. Plot `pixel_flags`: one row per flag (cloud, cloud shadow, snow ice, invalid), one column per time.
10. Plot `sensor_status_qc`: block plot, rows `low battery (bit 0)`, `hardware fault (bit 1)`, `bits 2-3: 3 states` (top to bottom); the last row in three colors along time.
11. Plot `sensor_status_qc` with `status_time` = `20`: bars, `bits 2-3 = 4 offline mode (100%)`.
12. Set **flag_select** = `water, urban` and plot `land_cover`: water and urban in their colors, the rest grey `the 6 other meanings`; layout item `flags … selected: urban, water` outlined.
13. Set **flag_select** = `cloud, cloud shadow` and **flag_combine** = `any`, plot `pixel_flags`: one map per time, `cloud OR cloud shadow (…%)` in blue, `none of them` in grey.
14. Clear them, set **hide_flags** = `cloud, bad data`, plot `sst`: holes where it is cloudy; layout item `hide_flags cloud (pixel_flags); bad data (quality_level)`, note `… values hidden (…%) …`.
15. Expand `broken_mixed`: the Flags section warns `Not used for plots …: questionable: value 1 has bits outside its mask 2 …`; its plot carries the same note.

The click-by-click plan with a results sheet: [`docs/v0.15/MANUAL_TEST_PLAN_0.15.0.md`](./v0.15/MANUAL_TEST_PLAN_0.15.0.md).

---

## Known limitations

- **One panel per flag can be a lot**: a product with 40 bits set somewhere gives 40 panels; use **flag_select** or **flag_combine**.
- **Names are typed, not picked**: no suggestion list yet. The **Flags** section of File Information lists the meanings to copy.
- **`hide_flags` looks in the variable's own group only**, and only at `ancillary_variables`; a quality flag not linked that way cannot hide points.
- **`flag_select` is for flag variables**: set globally, it does not affect a plain data variable (no note), use **hide_flags** for those.
- **Bit flags read as floats lose bits above 2⁵³** on engines that cannot read raw (cfgrib, rasterio, kerchunk, cdflib); a note says so for 64-bit variables.
- **Other engines read decoded values** (cfgrib, rasterio, kerchunk, cdflib). A fill code that is also a meaning is shown as no data there.
- **`flag_colors` is not CF.** It is honoured only with exactly one valid color per meaning, otherwise ignored with a note.
- **Shares count the plotted selection**: with dimension slices, the percentages are those of the slice, not of the whole variable.

---

## Summary

| Area             | Change                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Plots            | `flag_values` variables by meaning: images, steps, bars; colors from `cmap`, `flag_colors`, palette         |
| Bit flags        | `flag_masks` (alone or with `flag_values`): one panel per flag, 1D block plot, bars of shares               |
| Selection        | **flag_select** (meanings by name), **flag_combine** (`any` / `all` / `none` of bit flags)                  |
| Hiding           | **hide_flags**: points of a data variable hidden where its `ancillary_variables` flags are set              |
| Reading          | Flag codes read raw (`mask_and_scale` off for that variable only) on netcdf4 / h5netcdf / scipy / zarr      |
| File Information | **Flags** section: kind, values, masks, bits, swatches, problems, notes                                     |
| Controls         | **Flags** fieldset: **flags** (default on, `--no-flags`), **flag_select**, **flag_combine**, **hide_flags** |
| Backend JSON     | `variables_flattened[*].flags`; plot layout kind `bars`, roles `flags` and `hide_flags`                     |
| Samples          | `sample_cf_flags.nc`; invalid QC flags of `sample_many_encoding.nc` fixed                                   |
| Development      | `scripts/prototypes/cf_flags.py`, `paranoia.sh` step `prototypes`                                           |
