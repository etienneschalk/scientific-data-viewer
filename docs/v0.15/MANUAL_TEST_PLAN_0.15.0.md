# v0.15.0 — Manual test plan

About 20 minutes. Each step says what to do and what you should see. Write the result in the [results sheet](#results-sheet) at the end.

## Before you start

1. Install the build under test: `npm run package`, then **Extensions > … > Install from VSIX** with `artefacts/vsix-releases/scientific-data-viewer-0.15.0.vsix` (or press F5 from the repository).
2. Create the sample files: `python python/create_sample_data.py`. They land in `artefacts/sample-data/`. v0.15 adds `sample_cf_flags.nc`.
3. Reset the plot controls (**Reset** in Global Plot Controls): **flags** (Color) checked.

Open `sample_cf_flags.nc` for every step.

## M1 — Flags section of a `flag_values` variable

1. Expand `land_cover`.
2. A **Flags** section (open, badge `8`) after **Attributes**: `flag_values: one code per meaning · colors from flag_colors`.
3. 8 rows `10 cropland` … `210 water`, each with a color swatch (yellow, orange, …, blue).

## M2 — Categorical map in the file's colors

1. Create the plot of `land_cover`.
2. The map uses the swatch colors; the colorbar reads `10 cropland (…%)` at the bottom to `210 water (…%)` at the top.
3. The top rows (fill value 255) are empty (background).
4. The layout line ends with `flags flag_values, 8 meanings, colors: flag_colors` (not outlined: automatic).

## M3 — The flags control

1. Uncheck **flags** (Color) in the Global Plot Controls; it gets the changed outline.
2. Plot `land_cover` again: a continuous colormap from 10 to 210, no `flags` item.
3. **Reset**: **flags** is checked again.

## M4 — Facets share one labelled colorbar

1. Plot `quality_level`.
2. Three panels `time = 0, 1, 2`, one colorbar `0 no data` … `5 best quality`.

## M5 — 1D steps, fill code that is a meaning, undeclared code

1. Plot `station_status`.
2. Steps along `obs_time`; y-axis labels `0 nominal`, `1 degraded`, `2 maintenance`, `127 not measured`, `other (code not in flag_values)`.
3. Four red points at `127 not measured` (around 05:00).
4. One black point at `other` (15:00) and a note `1 value has a code not listed in flag_values (9): drawn as 'other'`.

## M6 — Many classes

1. Plot `lccs_class`: 8 classes in the colorbar.
2. Note `29 of the 37 meanings are absent from the plotted data and not listed`.

## M7 — Bars and ignored style options

1. In the Group Plot Controls of `/`, set `bins` = 10, `vmin` = 3.
2. Plot `land_cover`: horizontal bars, one per class, in the class colors, x-axis `% of the 1170 values with data`.
3. Kind `bars` in the layout line; notes `bins ignored: …` and `vmin ignored: …`.
4. **Reset** the group block.

## M8 — Bit masks are listed, plotted as numbers

1. Expand `wqsf`: columns mask / bits / meaning; last row `9223372036854775808`, `bit 63`, `cloud`.
2. Plot it: a numeric map and a note `CF flag_masks (masks): plotted as numbers; the meaning of each bit is listed in the variable's Flags section`.
3. Expand `sensor_status_qc`: mask / bits / value / meaning, `12 bits 2-3 8 calibration_mode`.

## M9 — Inconsistent flags are explained, not used

1. Expand `broken_mixed`: a warning line `Not used for plots (plain numbers instead): questionable: value 1 has bits outside its mask 2, it can never match (3 such flags)`.
2. Plot it: numeric map, note `CF flags not used (…)`.
3. Expand `broken_colors`: no swatches, note `flag_colors ignored: 2 colors for 3 flag_meanings`; its plot uses `tab10` and carries the same note.

## M10 — Export

1. With the plot of `land_cover` displayed, **Export** the viewer to HTML and open the file: the Flags table and swatches are there.

## Results sheet

| Step | Result (OK / KO + note) |
| ---- | ----------------------- |
| M1   |                         |
| M2   |                         |
| M3   |                         |
| M4   |                         |
| M5   |                         |
| M6   |                         |
| M7   |                         |
| M8   |                         |
| M9   |                         |
| M10  |                         |
