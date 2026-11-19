# Scientific Data Viewer v0.15.0 Release Notes

**TL;DR** — Variables that follow the CF conventions for flags are now **plotted by meaning**. A variable with `flag_values` and `flag_meanings` (land cover classes, quality levels, status codes) gets one color per class and a colorbar that names each class with its share: `210 water (14%)`. The colors are the producer's own when the file has a `flag_colors` attribute. 1D flags are drawn as steps with the meanings on the y-axis, and bars replace the meaningless histogram of codes. The codes are read **raw**, so a class that shares its number with the fill value (`127 = not_measured`) is still shown. A new **Flags** section in File Information lists every meaning with its value, mask and bits, and says why inconsistent flags cannot be used. The **flags** plot control turns it all off.

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
| `flag_masks` (bit fields)                  | Sums of powers of two                                               | Still numbers in plots (next phase), bits listed in **Flags**         |

The goal is to reward producers who describe their masks with the CF attributes: a well-described file reads like its product user guide. The research and full design (what CF section 3.5 says, what cf_xarray, ARM ACT, ESA SNAP, satpy and ESA CCI do, four phases) are in [`docs/v0.15/CF_FLAGS_PROPOSAL.md`](./v0.15/CF_FLAGS_PROPOSAL.md). This release is phase P1.

---

## Upgrade notes (read before updating)

- **Flag variables look different by default.** Plots of variables with `flag_values` + `flag_meanings` change, as described above. To get the plain numeric plot back, uncheck **flags** in the plot controls (Color), globally or for one group.
- **Inconsistent flags are not used.** When the attributes contradict each other (counts that differ, a value outside its mask, a value the variable's type cannot hold), the plot stays numeric and a note under it says why: `CF flags not used (...)`. The **Flags** section shows the same reason.
- **Style options ignored for flag plots**: `vmin`, `vmax` and `robust` (one color per class), and `bins` (bars per meaning). A note says so. `cmap` still applies: it is sampled into one color per meaning.
- **Backend JSON contract**: each data variable of the info result has a new `flags` key (`null` without flag attributes). The plot layout can have the kind `bars` and the role `flags`. Scripts that compare the backend output, such as golden snapshots recorded with 0.13, must record again.
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
8. Expand `wqsf`: masks shown exactly (`9223372036854775808`, `bit 63`); plot it: numbers, note `CF flag_masks (masks): plotted as numbers …`.
9. Expand `broken_mixed`: the Flags section warns `Not used for plots …: questionable: value 1 has bits outside its mask 2 …`; its plot carries the same note.

The click-by-click plan with a results sheet: [`docs/v0.15/MANUAL_TEST_PLAN_0.15.0.md`](./v0.15/MANUAL_TEST_PLAN_0.15.0.md).

---

## Known limitations

- **`flag_masks` are not drawn by meaning yet** (bit fields, alone or with `flag_values`). They are plotted as numbers, with a note, and their bits are listed in **Flags**. One panel per flag and 1D block plots are phase P2 of the proposal.
- **No selection by meaning yet** (`cloud OR cloud_shadow`, highlight two classes): phase P3. Today, slice the data or use **Flags** to read the codes.
- **Other engines read decoded values** (cfgrib, rasterio, kerchunk, cdflib). A fill code that is also a meaning is shown as no data there.
- **`flag_colors` is not CF.** It is honoured only with exactly one valid color per meaning, otherwise ignored with a note.
- **Shares count the plotted selection**: with dimension slices, the percentages are those of the slice, not of the whole variable.

---

## Summary

| Area             | Change                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| Plots            | `flag_values` variables by meaning: images, steps, bars; colors from `cmap`, `flag_colors`, palette    |
| Reading          | Flag codes read raw (`mask_and_scale` off for that variable only) on netcdf4 / h5netcdf / scipy / zarr |
| File Information | **Flags** section: kind, values, masks, bits, swatches, problems, notes                                |
| Controls         | **flags** checkbox (Color, default on), CLI `--no-flags`                                               |
| Backend JSON     | `variables_flattened[*].flags`; plot layout kind `bars`, role `flags`                                  |
| Samples          | `sample_cf_flags.nc`; invalid QC flags of `sample_many_encoding.nc` fixed                              |
| Development      | `scripts/prototypes/cf_flags.py`, `paranoia.sh` step `prototypes`                                      |
