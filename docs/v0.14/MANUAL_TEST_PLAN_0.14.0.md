# v0.14.0 — Manual test plan

About 60 minutes: M1-M9 for decoding (30 min), M10-M24 for CF flags (35 min). Each step says what to do and what you should see. Write the result in the [results sheet](#results-sheet) at the end.

## Before you start

1. Install the build under test: `npm run package`, then **Extensions > … > Install from VSIX** with `artefacts/vsix-releases/scientific-data-viewer-0.14.0.vsix` (or press F5 from the repository).
2. Create the sample files: `python python/create_sample_data.py`. They land in `artefacts/sample-data/`. v0.14 adds `broken_datetime_packed_variable.nc`, `sample_geotiff_time_bands.tif` and `sample_cf_flags.nc`.
3. Reset the settings this plan touches: `scientificDataViewer.decoding.*` to `default`, `scientificDataViewer.engineBackendKwargs` removed, `scientificDataViewer.convertBandsToVariables` on.
4. Reset the plot controls (**Reset** in Global Plot Controls): **flags** (Flags fieldset) checked, **flag_select**, **flag_combine** (`per flag`) and **hide_flags** empty.

Where to look:

- **File Information** is the first section of the viewer. Its first line ends with **Decoding: …** and a **Reopen raw** / **Reopen decoded** link.
- **How this file was opened** is the first entry of the **Troubleshooting** section, the last section of the viewer.
- The **Flags** section of a variable is after its **Attributes**; the **Flags** fieldset of the plot controls is between Color and Figure.

# Decoding

## M1 — Broken time units keep masking and scaling

1. Open `broken_datetime_packed_variable.nc`.
2. File Information: **Decoding: degraded (decode_times=False, decode_timedelta=False)**.
3. Expand variable `temperature`: dtype `float64`, values `273.15, 283.15, nan, 298.15`.
4. Troubleshooting > How this file was opened: `Time decoding turned off after: ValueError: unable to decode time units …`; the call contains `decode_times=False,  # time fallback`.
5. Click **Copy** next to it and paste in an editor: the same text.

## M2 — Reopen raw / Reopen decoded

1. In the same tab, click **Reopen raw**.
2. **Decoding: raw (no CF decoding)**; the link now reads **Reopen decoded**.
3. `temperature`: dtype `int16`, values `0, 1000, -999, 2500`.
4. The call lists `mask_and_scale`, `decode_times`, `decode_timedelta`, `concat_characters`, `decode_coords`, all `False`, each `# raw mode`.
5. Create a plot of `temperature`: values between `-999` and `2500` on the axis.
6. Click **Refresh** (🔄): still raw.
7. Click **Reopen decoded**: back to M1 step 2.
8. Raw mode on other formats: open each of `sample_data.grib`, `sample_zarr_v3.zarr.zip`, `sample_data.kerchunk.json` (needs `pip install kerchunk`), `sample_data.cdf`, `sample_data.jp2`, click **Reopen raw**. Each opens, without an error.

## M3 — A normal file

1. Open `sample_data.nc`.
2. **Decoding: CF decoded**; the call is `xarray.open_datatree('…sample_data.nc', engine='netcdf4',)` with no decoder.

## M4 — Decoding settings

1. Set `scientificDataViewer.decoding.decodeTimes` to `off`, then **Refresh** `broken_datetime_packed_variable.nc`.
2. No "degraded"; the call shows `decode_times=False,  # setting`. No "Time decoding turned off after" line.
3. Set it back to `default`. Set `decoding.decodeCoords` to `all` and refresh `sample_data.nc`: `decode_coords='all',  # setting`.
4. Set `decodeCoords` back to `default`.

## M5 — GeoTIFF times

1. Open `sample_geotiff_time_bands.tif`. Variables `band_1`, `band_2`, `band_3`. In the report, a note starts with `convertBandsToVariables: each band is a separate variable`.
2. Turn `scientificDataViewer.convertBandsToVariables` off, **Refresh**.
3. One variable `band_data` with dimensions `time, y, x`. Coordinate `time`: dtype `datetime64[ns]`, values `2000-01-01`, `2000-02-01`, `2000-03-01`. A note says `converted from cftime to datetime64`.
4. Set `decoding.useCftime` to `on`, **Refresh**: `time` dtype `object`, note `useCftime=on: raster times are kept as cftime objects.`
5. Set `useCftime` back to `default`; set `decoding.maskAndScale` to `on`, **Refresh**: `band_data` dtype `float32`; the call shows `mask_and_scale=True,  # setting`.
6. Reset `maskAndScale` to `default` and `convertBandsToVariables` to on.

## M6 — engineBackendKwargs (user settings)

1. Open **Preferences: Open User Settings (JSON)** and add:

   ```json
   "scientificDataViewer.engineBackendKwargs": { "netcdf4": { "auto_complex": true, "mode": "w" } }
   ```

   The editor underlines `mode` (not allowed by the schema).

2. **Refresh** `sample_data.nc`: the call contains `backend_kwargs={'auto_complex': True,  # setting}`; a note says `engineBackendKwargs.netcdf4.mode ignored: not an allowed key`.
3. The file's modification time is unchanged (nothing was written).

## M7 — engineBackendKwargs ignored in a workspace

1. Remove the setting from user settings.
2. Open a folder, create `.vscode/settings.json` with the same value.
3. VS Code marks the setting as not applicable in the workspace.
4. Open and refresh `sample_data.nc` from that folder: the call has no `backend_kwargs`.
5. Delete `.vscode/settings.json`.

## M8 — Export

1. With a file open, export the viewer (**Export Webview Content**).
2. Open the HTML file in a browser: the **How this file was opened** text is present; clicking **Reopen raw** does nothing.

## M9 — Interpreter override ignored in a workspace

1. Open a folder and create `.vscode/settings.json` with `"scientificDataViewer.python.overridePythonInterpreter": "/does/not/exist/python"`.
2. VS Code marks the setting as not applicable in the workspace.
3. Run **Scientific Data Viewer: Refresh Python Environment**: the status bar shows the same interpreter as before, and a data file still opens.
4. **Show Extension Logs**: a warning `Ignoring scientificDataViewer.python.overridePythonInterpreter = /does/not/exist/python from the workspace settings`.
5. Put the same key in **user** settings with a real interpreter path (e.g. the output of `which python3`), refresh: the status bar shows it. Remove both values afterwards.

# CF flags

Open `sample_cf_flags.nc` for every step from M10 on.

## M10 — Flags section of a `flag_values` variable

1. Expand `land_cover`.
2. A **Flags** section (open, badge `8`) after **Attributes**: `flag_values: one code per meaning · colors from flag_colors`.
3. 8 rows `10 cropland` … `210 water`, each with a color swatch (yellow, orange, …, blue).

## M11 — Categorical map in the file's colors

1. Create the plot of `land_cover`.
2. The map uses the swatch colors; the colorbar reads `10 cropland (…%)` at the bottom to `210 water (…%)` at the top.
3. The top rows (fill value 255) are empty (background).
4. The layout line ends with `flags flag_values, 8 meanings, colors: flag_colors` (not outlined: automatic).

## M12 — The flags control

1. Uncheck **flags** (Flags fieldset, between Color and Figure) in the Global Plot Controls; it gets the changed outline.
2. Plot `land_cover` again: a continuous colormap from 10 to 210, no `flags` item.
3. **Reset**: **flags** is checked again.

## M13 — Facets share one labelled colorbar

1. Plot `quality_level`.
2. Three panels `time = 0, 1, 2`, one colorbar `0 no data` … `5 best quality`.

## M14 — 1D steps, fill code that is a meaning, undeclared code

1. Plot `station_status`.
2. Steps along `obs_time`; y-axis labels `0 nominal`, `1 degraded`, `2 maintenance`, `127 not measured`, `other (code not in flag_values)`.
3. Four red points at `127 not measured` (around 05:00).
4. One black point at `other` (15:00) and a note `1 value has a code not listed in flag_values (9): drawn as 'other'`.

## M15 — Many classes

1. Plot `lccs_class`: 8 classes in the colorbar.
2. Note `29 of the 37 meanings are absent from the plotted data and not listed`.

## M16 — Bars and ignored style options

1. In the Group Plot Controls of `/`, set `bins` = 10, `vmin` = 3.
2. Plot `land_cover`: horizontal bars, one per class, in the class colors, x-axis `% of the 1170 values with data`.
3. Kind `bars` in the layout line; notes `bins ignored: …` and `vmin ignored: …`.
4. **Reset** the group block.

## M17 — Bit flags: one panel per flag

1. Expand `wqsf`: columns mask / bits / meaning; last row `9223372036854775808`, `bit 63`, `cloud`.
2. Plot it: six panels, `flag = invalid (bit 0)` … `flag = cloud (bit 63)` (titles not cut), each in its own color where set and grey elsewhere; the bottom row (fill value) empty.
3. The colorbar reads `bit 0 invalid (…%)` … `bit 63 cloud (…%)`, then `not set` at the top. Layout line: `col flag`, `flags flag_masks, 6 meanings, colors: tab10`. No note `plotted as numbers`.
4. Plot `pixel_flags`: four rows (cloud, cloud shadow, snow ice, invalid), three columns `time = 0, 1, 2`; layout line `row flag`, `col time`.

## M18 — Block plot and bars of a mixed variable

1. Expand `sensor_status_qc`: mask / bits / value / meaning, `12 bits 2-3 8 calibration_mode`.
2. Plot it: one image with three rows, top to bottom `low battery (bit 0)`, `hardware fault (bit 1)`, `bits 2-3: 3 states`, along `status_time`. The last row is grey, then green, red and purple blocks; the colorbar names `bits 2-3 = 4 offline mode`, `= 8 calibration mode`, `= 12 maintenance mode`.
3. Set the slice `status_time` = `20` and plot: bars, `bits 2-3 = 4 offline mode (100%)`, the others at `0%`; x-axis `% of the 1 value with data where the flag is set`.
4. Clear the slice.

## M19 — Inconsistent flags are explained, not used

1. Expand `broken_mixed`: a warning line `Not used for plots (plain numbers instead): questionable: value 1 has bits outside its mask 2, it can never match (3 such flags)`.
2. Plot it: numeric map, note `CF flags not used (…)`.
3. Expand `broken_colors`: no swatches, note `flag_colors ignored: 2 colors for 3 flag_meanings`; its plot uses `tab10` and carries the same note.

## M20 — Export

1. With the plot of `land_cover` displayed, **Export** the viewer to HTML and open the file: the Flags table and swatches are there.

## M21 — Choose classes by name

1. In the Global Plot Controls, set **flag_select** = `Water, urban` and plot `land_cover`.
2. Water (blue) and urban (red) in their colors, everything else grey; colorbar `190 urban (…%)`, `210 water (…%)`, `the 6 other meanings (…%)`.
3. The layout item `flags … selected: urban, water` is outlined (your choice).
4. Set **flag_select** = `water, glacier`: same plot, note `flag_select: glacier not among the meanings of this variable`.

## M22 — Combine bit flags

1. Set **flag_select** = `cloud, cloud shadow`, **flag_combine** = `any`; plot `pixel_flags`.
2. Three panels (time), each `cloud OR cloud shadow (…%)` in color, `none of them` in grey.
3. **flag_combine** = `none`: the colored points are now the clear ones (`none of cloud, cloud shadow`).
4. In the Group Plot Controls of `/`, the **flag_combine** list starts with `global`; choose `all`: the group value wins (`cloud AND cloud shadow`).
5. Plot `land_cover` (still `any`): note `flag_combine=any ignored: flag_values are exclusive codes …`.
6. **Reset** both blocks: the selects are back to `per flag` / `global`.

## M23 — Hide the points a quality flag marks

1. Set **hide_flags** = `cloud, bad data`; plot `sst`.
2. Three panels with holes where it is cloudy; layout item `hide_flags cloud (pixel_flags); bad data (quality_level)`; note `hide_flags: … values hidden (…%) …`.
3. Slice `time` = `1` and plot again: one map, still with the cloud holes of that time.
4. Plot `land_cover` (no `ancillary_variables`): note `hide_flags ignored: no flag named cloud, bad data (no flag variable in ancillary_variables)`.
5. **Reset**.

## M24 — Flag plots follow the decoding of the tab

1. Open `sample_cf_flags.nc`, click **Reopen raw**, plot `station_status`: the same steps as M14 (`127 not measured` shown, `other` at 15:00).
2. Plot `land_cover`: the same map as M11.
3. Click **Reopen decoded**. Set `scientificDataViewer.decoding.decodeTimes` to `off`, **Refresh**, plot `station_status`: steps by meaning, with `obs_time` as numbers on the x-axis (the second, raw read of the flag codes keeps the decoding settings).
4. Set `decodeTimes` back to `default`.

## Results sheet

| Step | Result (OK / KO + note) | Tester / date |
| ---- | ----------------------- | ------------- |
| M1   |                         |               |
| M2   |                         |               |
| M3   |                         |               |
| M4   |                         |               |
| M5   |                         |               |
| M6   |                         |               |
| M7   |                         |               |
| M8   |                         |               |
| M9   |                         |               |
| M10  |                         |               |
| M11  |                         |               |
| M12  |                         |               |
| M13  |                         |               |
| M14  |                         |               |
| M15  |                         |               |
| M16  |                         |               |
| M17  |                         |               |
| M18  |                         |               |
| M19  |                         |               |
| M20  |                         |               |
| M21  |                         |               |
| M22  |                         |               |
| M23  |                         |               |
| M24  |                         |               |
