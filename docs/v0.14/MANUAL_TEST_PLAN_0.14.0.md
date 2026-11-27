# v0.14.0 — Manual test plan

About 110 minutes: M1-M9 for decoding (30 min), M10-M24 for CF flags (35 min), M25-M30 for the log scale, seaborn colormaps and the environment upgrade (25 min, plus the rebuild), M31-M38 for the new plot settings (20 min, no code knowledge needed), M39 for Expand All (5 min). Each step says what to do and what you should see. Write the result in the [results sheet](#results-sheet) at the end.

## Before you start

1. Install the build under test: `npm run package`, then **Extensions > … > Install from VSIX** with `artefacts/vsix-releases/scientific-data-viewer-0.14.0.vsix` (or press F5 from the repository).
2. Create the sample files: `python python/create_sample_data.py`. They land in `artefacts/sample-data/`. v0.14 adds `broken_datetime_packed_variable.nc`, `sample_geotiff_time_bands.tif`, `sample_cf_flags.nc` and `sample_log_scale.nc`.
3. Reset the settings this plan touches: `scientificDataViewer.decoding.*` to `default`, `scientificDataViewer.engineBackendKwargs` removed, `scientificDataViewer.convertBandsToVariables` on.
4. Plot settings start empty in a new viewer tab. To start a step from scratch, close the viewer tab and open the file again (settings are kept as long as the tab is open, even through **Refresh**).
5. For M30 only: keep an extension environment created by v0.13 (`useExtensionOwnEnvironment` on, environment created with the 0.13.x `.vsix`) before installing the 0.14 build.

Where to look:

- **File Information** is the first section of the viewer. Its first line ends with **Decoding: …** and a **Reopen raw** / **Reopen decoded** link.
- **How this file was opened** is the first entry of the **Troubleshooting** section, the last section of the viewer.
- The **Flags** section of a variable is after its **Attributes**; the **Flags** fieldset of the plot settings is between Color and Figure (shown only where flags apply).
- **Plot settings** (slices and plot parameters) are in an editor that opens under a **Settings** button: next to **Create Plot** of a variable, or in the **Plot** section at the top of each group card. Its tabs are the levels: **This variable**, **Group /a**, **Whole file**. **Unless a step says otherwise, set plot settings in the Whole file tab**: click **Settings** in the **Plot** section of the group `/` (the first group card). The editor stays open while you plot; **Escape** closes it.
- **Plot all**, **Cancel all**, **Save all plots** (disk icon) and **Clear all plots** (bin icon) are in the header bar at the top.

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

1. In **Whole file**, set **flags** (Flags fieldset, between Color and Figure) to `false`; it gets the changed outline.
2. Plot `land_cover` again: a continuous colormap from 10 to 210, no `flags` item.
3. **Reset** (Plot parameters): **flags** is empty again and shows `true (default)` in grey.

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

1. Open **Settings** of `land_cover` (tab **This variable**), set `bins` = 10, `vmin` = 3.
2. Plot `land_cover`: horizontal bars, one per class, in the class colors, x-axis `% of the 1170 values with data`.
3. Kind `bars` in the layout line; notes `bins ignored: …` and `vmin ignored: …`.
4. **Reset** the plot parameters of this tab.

## M17 — Bit flags: one panel per flag

1. Expand `wqsf`: columns mask / bits / meaning; last row `9223372036854775808`, `bit 63`, `cloud`.
2. Plot it: six panels, `flag = invalid (bit 0)` … `flag = cloud (bit 63)` (titles not cut), each in its own color where set and grey elsewhere; the bottom row (fill value) empty.
3. The colorbar reads `bit 0 invalid (…%)` … `bit 63 cloud (…%)`, then `not set` at the top. Layout line: `col flag`, `flags flag_masks, 6 meanings, colors: tab10`. No note `plotted as numbers`.
4. Plot `pixel_flags`: four rows (cloud, cloud shadow, snow ice, invalid), three columns `time = 0, 1, 2`; layout line `row flag`, `col time`.

## M18 — Block plot and bars of a mixed variable

1. Expand `sensor_status_qc`: mask / bits / value / meaning, `12 bits 2-3 8 calibration_mode`.
2. Plot it: one image with three rows, top to bottom `low battery (bit 0)`, `hardware fault (bit 1)`, `bits 2-3: 3 states`, along `status_time`. The last row is grey, then green, red and purple blocks; the colorbar names `bits 2-3 = 4 offline mode`, `= 8 calibration mode`, `= 12 maintenance mode`.
3. Open **Settings** of `sensor_status_qc`, type `20` in the start box of `status_time` and plot: bars, `bits 2-3 = 4 offline mode (100%)`, the others at `0%`; x-axis `% of the 1 value with data where the flag is set`.
4. Click **Reset** next to **Dimension slices**.

## M19 — Inconsistent flags are explained, not used

1. Expand `broken_mixed`: a warning line `Not used for plots (plain numbers instead): questionable: value 1 has bits outside its mask 2, it can never match (3 such flags)`.
2. Plot it: numeric map, note `CF flags not used (…)`.
3. Expand `broken_colors`: no swatches, note `flag_colors ignored: 2 colors for 3 flag_meanings`; its plot uses `tab10` and carries the same note.

## M20 — Export

1. With the plot of `land_cover` displayed, **Export** the viewer to HTML and open the file: the Flags table and swatches are there.

## M21 — Choose classes by name

1. In **Whole file**, set **flag_select** = `Water, urban` and plot `land_cover`.
2. Water (blue) and urban (red) in their colors, everything else grey; colorbar `190 urban (…%)`, `210 water (…%)`, `the 6 other meanings (…%)`.
3. The layout item `flags … selected: urban, water` is outlined (your choice).
4. Set **flag_select** = `water, glacier`: same plot, note `flag_select: glacier not among the meanings of this variable`.

## M22 — Combine bit flags

1. Set **flag_select** = `cloud, cloud shadow`, **flag_combine** = `any`; plot `pixel_flags`.
2. Three panels (time), each `cloud OR cloud shadow (…%)` in color, `none of them` in grey.
3. **flag_combine** = `none`: the colored points are now the clear ones (`none of cloud, cloud shadow`).
4. Open **Settings** of `pixel_flags` (tab **This variable**): the **flag_combine** list shows `none (file)` in grey. Choose `all` and plot: this variable's value wins (`cloud AND cloud shadow`).
5. Plot `land_cover` (it gets `none` from the whole file): note `flag_combine=none ignored: flag_values are exclusive codes …`.
6. **Reset** the plot parameters of **This variable** (`pixel_flags`), then of **Whole file**: **flag_combine** shows `per flag` in both tabs.

## M23 — Hide the points a quality flag marks

1. Set **hide_flags** = `cloud, bad data`; plot `sst`.
2. Three panels with holes where it is cloudy; layout item `hide_flags cloud (pixel_flags); bad data (quality_level)`; note `hide_flags: … values hidden (…%) …`.
3. Open **Settings** of `sst`, type `1` in the start box of `time` and plot again: one map, still with the cloud holes of that time. **Reset** its slices.
4. Plot `land_cover` (no `ancillary_variables`): note `hide_flags ignored: no flag named cloud, bad data (no flag variable in ancillary_variables)`.
5. **Reset**.

## M24 — Flag plots follow the decoding of the tab

1. Open `sample_cf_flags.nc`, click **Reopen raw**, plot `station_status`: the same steps as M14 (`127 not measured` shown, `other` at 15:00).
2. Plot `land_cover`: the same map as M11.
3. Click **Reopen decoded**. Set `scientificDataViewer.decoding.decodeTimes` to `off`, **Refresh**, plot `station_status`: steps by meaning, with `obs_time` as numbers on the x-axis (the second, raw read of the flag codes keeps the decoding settings).
4. Set `decodeTimes` back to `default`.

# Log scale and seaborn colormaps

Open `sample_log_scale.nc` for M25-M28. The **norm** select is in the Color fieldset, after **cmap**.

## M25 — Log color scale on facets

1. Plot `chlorophyll` (norm `linear`): four facets in one flat dark color, a few bright pixels near the coast.
2. Set **norm** = `log` (**Whole file**): the field is outlined. Plot again: gradients from west to east, **one** colorbar labelled `10⁻²` … `10³`, the land disc and the bottom-left corner (zeros) left blank.
3. Layout line: `norm log, 0.00487 to 2.41e+03`, outlined (set by you). Note: `norm=log: 192 of 19064 values ≤ 0 not shown (1%)`.

## M26 — Limits and robust on a log scale

1. Keep **norm** = `log`, set **vmin** = `0.1`, **vmax** = `10`: colorbar from `10⁻¹` to `10¹`, arrows at both ends; layout item `norm log, 0.1 to 10`.
2. Set **vmin** = `-1`: note `vmin=-1 ignored: a log scale starts above 0 (0.00487 used)`.
3. Clear vmin / vmax, set **robust** to `true`: the limits shrink (2nd / 98th percentiles of the values above 0), arrows at both ends.

## M27 — Lines, both signs, edge cases, ignored cases

**norm** = `log` (**Whole file**) for every step but the last. Each variable's `long_name` says what it tests.

1. Set **robust** back to empty. Plot `particle_count`: log y-axis from about `10⁻¹` to `10⁵`, a gap at sample 17; note `1 of 120 values ≤ 0 not shown`.
2. Plot `net_flux`: only the positive half colored, in `viridis` (not red and blue); half the values counted in the note.
3. Plot `depth_negative`: a linear plot with note `norm=log ignored: no value above 0, linear scale`.
4. Plot `photon_counts` (integers): a bright disc, colorbar `10⁰` to `10⁴`, the zero pixels around it transparent; note `norm=log: 1988 of 4941 values ≤ 0 not shown (40%)`.
5. Plot `rain_rate`: rain bands, the dry area transparent (note `… values ≤ 0 not shown (23%)`), the storm cores in the top colors. Set **robust** to `true`: limits about `0.986 to 34.1`, arrows at both ends, the cores saturated. Set **robust** back to empty.
6. Plot `aerosol_tiny` then `no2_column_huge`: readable colorbar labels, `10⁻¹¹` … `10⁻⁷` and `10¹⁴` … `10¹⁶`; no note.
7. Plot `backscatter_with_inf`: three short blank rows (`+inf`, `-inf`, NaN), the colorbar from the finite values; no error.
8. Plot `constant_positive`: one color, a colorbar around `3` (layout item `norm log, 3 to 3`); no error.
9. Plot `chlorophyll_profile`: log y-axis (layout `norm log (y axis)`). Set **y** = `depth`: the values on a log x-axis (`norm log (x axis)`); **yincrease** = `false` puts the surface at the top. Clear y and yincrease.
10. Plot `chlorophyll_packed`: like the first month of `chlorophyll`, layout `norm log, 0.0049 to 431`, note `48 of 4766 values ≤ 0`. Set `decoding.maskAndScale` to `off`, **Refresh**, plot again: the raw integers, `norm log, 49 to 4.31e+06`, note `223 of 4941 values ≤ 0 not shown (4.5%)` (the 175 fill values `-1` among them). Reset `maskAndScale` to `default`.
11. Plot `water_class`: drawn by meaning (four classes), note `norm=log ignored: a CF flag variable is drawn by meaning`. Plot `is_bloom`: note `norm=log ignored: the values are not numbers (bool)`. Set **bins** = `50`, plot `photon_counts`: a histogram, note `norm=log ignored: not used by a histogram`. Clear bins.
12. Set **norm** of **Whole file** back to `linear`. Open **Settings** of `chlorophyll` and set its **norm** to `log`: `chlorophyll` is drawn on a log scale (the variable wins), `particle_count` is not. **Reset** both tabs.

## M28 — seaborn colormaps

1. Set **cmap** = `seaborn:rocket`, plot `chlorophyll`: black, red and cream colors. With **norm** = `log` too: the same colors on the log scale.
2. **cmap** = `seaborn:light:seagreen`: white to green. **cmap** = `seaborn:mako_r`: light to dark blue.
3. **cmap** = `seaborn:rockett`: the plot fails with one line `cmap=seaborn:rockett: not a seaborn colormap or palette ('rockett' is not a valid palette name). Examples: …`.
4. Open `sample_cf_flags.nc`, **cmap** = `seaborn:rocket`, plot `land_cover`: eight classes in rocket colors; layout item `flags … colors: cmap seaborn:rocket`. Clear **cmap**.

## M29 — seaborn missing

1. Select an interpreter without seaborn (**Use My Own Interpreter**, e.g. a venv with `xarray netCDF4 matplotlib` only).
2. Plot any variable with **cmap** = `seaborn:rocket`: one-line error `cmap=seaborn:rocket: needs the seaborn package: install it in the viewer's Python environment (pip install seaborn), or use the extension's own environment (…)`.
3. **cmap** = `viridis`: the plot works. **Run the healthcheck**: `seaborn` is listed among the missing optional packages (a warning, not an error).

## M30 — The extension's own environment is rebuilt once

1. With the v0.13 environment of step 5 of [Before you start](#before-you-start), install the 0.14 build and reload VS Code.
2. A notification shows the environment being deleted and recreated (`environment revision 2 is older than required revision 3` in **Show Extension Logs**). Files open once it is done.
3. **Run the healthcheck**: `seaborn` among the available packages. `seaborn:rocket` plots work.
4. Reload VS Code again: no rebuild this time.

# Plot settings (UI remake)

These steps check the new way to set plot options. You do not need to read code: do what each step says, and compare with **what you should see**. If something differs, write it in the results sheet with a screenshot.

Words used below:

- **Panel**: the plot settings editor. It opens under a **Settings** button and has **tabs** at its top.
- **Summary**: the line `Settings: …` under the buttons of a variable or a group. Each item is a small box: name, value, where it is set (`file`, `group /a`, `variable`).
- **Header**: the bar at the very top of the viewer, with the title and the icons.

Most steps use the sample file. Open it with the Command Palette (**Ctrl+Shift+P**, or **Cmd+Shift+P** on macOS): type `Open Sample File` and choose **Scientific Data Viewer: Open Sample File**. It has two groups: `/` (variables `tas`, `tas_global_mean`, `sftlf`) and `/stations` (variable `tas`).

## M31 — No more Global Plot Controls; plot buttons in the header

1. Open the sample file.
2. Look at the header. After the title and the load time you see: **▷ Plot all**, a **disk** icon, a **bin** icon, a thin separator, then the four icons that were already there (export, collapse, expand, refresh). Hover the disk: `Save all plots`. Hover the bin: `Clear all plots (the plot settings are kept)`.
3. Scroll the whole page: there is **no** section called _Global Plot Controls_.
4. The first group card is **Group: /**. Its first section is **PLOT**, open, with **▷ Plot group**, **Settings**, and the text `Settings: all automatic`.
5. Make the viewer narrow (drag the border between the editor and the sidebar, or split the editor, until the viewer is about as wide as a phone): every header icon stays visible; **Plot all** keeps its ▷ icon and loses its label.

## M32 — Open and close the panel

1. In **Group: /**, under **VARIABLES**, click the row `tas` to open it. Its **PLOT** section shows **Create Plot**, **Settings**, and `Settings: all automatic`.
2. Click **Settings** of `tas`. A panel opens right under the buttons. Tabs: **This variable** (underlined) and **Whole file**. The text under the tabs starts with `These settings apply to this variable only.` Then **Dimension slices** (`lat`, `lon`, `time`, each with three boxes and a slider) and **Plot parameters** (Facets, Axes, Color, Figure). There is **no Flags** block: this file has no flags.
3. Click **Settings** in the **PLOT** section of the group `/`. The panel of `tas` closes and a panel opens in the group, with one tab: **Whole file**. Only one panel is ever open.
4. Close it with the **×** at its top right. Open it again and close it with **Close** at its bottom. Open it again, click in any box and press **Escape**: it closes. Clicking **Settings** of an open panel also closes it.

## M33 — Settings for the whole file

1. Click **Settings** of the group `/` (tab **Whole file**).
2. In the `time` field, click the **start** box and type `0:12:3`. The three boxes become `0`, `12`, `3`. The field gets a blue outline and a `•` after `time`.
3. In **cmap** (Color), type `RdYlBu_r`.
4. Read the summary of the group `/` and the summary of `tas` (open `tas` if needed): both show `time 0:12:3 file` and `cmap RdYlBu_r file`. In the group, these items are outlined (they are set there).
5. Click **Create Plot** of `tas`: four maps (one every three months) in red, yellow and blue. In the line just above the image, `time 0:12:3` is outlined with a `•`.
6. Open `tas_global_mean` and click **Create Plot**: a line with 4 points (the time slice applies to it too).

## M34 — A setting for one variable only

1. Click **Settings** of `tas`. In the tab **This variable**, the **cmap** box shows `RdYlBu_r (file)` in grey. The `time` field reads `size 12 · 0:12:3 (file)`. The tab **Whole file** shows a small `2` (it sets two values).
2. Type `magma` in **cmap** and press **Enter**: `tas` is plotted again, in purple and orange, without clicking anything else. The tab **This variable** now shows `1`.
3. The summary of `tas` shows `time 0:12:3 file`, `cmap magma variable` (this one outlined). The summary of the group `/` still shows `cmap RdYlBu_r file`.
4. Open `sftlf` and click **Create Plot**: it is in red, yellow and blue (the file value), not magma.
5. In the panel of `tas`, click the tab **Whole file**: you see `0:12:3` and `RdYlBu_r`, outlined. Click **This variable**: `magma` again.

## M35 — Click a summary item, or an item above a plot

1. Press **Escape** to close the panel.
2. In the summary of `tas`, click `time 0:12:3 file`. The panel of `tas` opens on the tab **Whole file**, the cursor in the **start** box of `time`, and the `time` field flashes.
3. Click `cmap magma variable` in the same summary: the panel switches to **This variable**, the cursor in **cmap**.
4. In the line just above the `tas` plot, click `col time` (a choice the viewer made by itself): the panel shows **This variable**, the cursor in **col**.

## M36 — "Settings changed" and Reset

1. The `tas` plot is shown. In its panel (tab **This variable**), delete the text of **cmap**. Next to the buttons of `tas` appears, in yellow or orange, `Settings changed: plot again to apply them`.
2. Type `magma` again: the message disappears.
3. Click **Reset** next to **Plot parameters**: **cmap** is empty and shows `RdYlBu_r (file)` in grey; the message is back. Click **Create Plot**: red, yellow and blue; the message disappears.
4. Click the tab **Whole file**, then **Reset** next to **Dimension slices**: the `time` boxes are empty, and no summary lists `time` any more. **cmap** is still `RdYlBu_r` (the other block is not reset).

## M37 — Groups inside groups, Plot group, Plot all

1. Open `artefacts/sample-data/sample_data_multiple_groups.nc`. Its group cards: `/`, `/atmosphere`, `/atmosphere/wind`, `/land`, `/ocean`.
2. Open the card **Group: /atmosphere/wind**, open `u_component`, click **Settings**. Four tabs: **This variable**, **Group /atmosphere/wind**, **Group /atmosphere**, **Whole file**.
3. Click the tab **Group /atmosphere** and type `viridis` in **cmap**. Click the tab **Whole file** and type `magma` in **cmap**.
4. Summaries: `u_component` shows `cmap viridis group /atmosphere`; so does `temperature` (in the card **Group: /atmosphere**). `salinity` (card **Group: /ocean**) shows `cmap magma file`.
5. In the card **Group: /atmosphere/wind**, click **Plot group**: `u_component` and `v_component` are plotted, in green-blue-yellow (viridis), and no other variable. While they run, **Plot all** and every **Plot group** are greyed out and **Cancel all** appears in the header; when they are done, a notification says `Plot group /atmosphere/wind: 2 successful`.
6. Click **Plot all** in the header: every variable of the file is plotted; those of `/`, `/land` and `/ocean` in magma, those of `/atmosphere` and its subgroup in viridis.
7. Click the **bin** icon (**Clear all plots**): every plot disappears. The summaries are unchanged.

## M38 — Wrong numbers, Refresh, export, removed settings

1. Still in `sample_data_multiple_groups.nc`, open **Settings** of the group `/` (**Whole file**) and type `1,5` in **vmin**. The box gets a red outline; hovering it shows `vmin: "1,5" is not a number (use a dot as decimal separator)`.
2. Click **Create Plot** of `root_data` (card **Group: /**): nothing is plotted. A red message reads `Invalid plot parameters, nothing was plotted:` and `Whole file: vmin: "1,5" is not a number (use a dot as decimal separator)`.
3. Change it to `1.5`: the red outline goes away, and **Create Plot** works.
4. Click **Refresh** (circular arrow in the header). The page reloads; the panel is closed; the summaries still list `cmap` and `vmin`.
5. Click the **export** icon (arrow down) in the header, save the HTML file, and open it in a web browser. The summaries are there (`Settings: vmin 1.5 file …`); there is no **Settings** or **Plot group** button and no panel.
6. Close the viewer tab and open the file again: every summary reads `Settings: all automatic` (settings are not saved).
7. Open your user settings as JSON (Command Palette: **Preferences: Open User Settings (JSON)**). If `scientificDataViewer.globalDimensionSlices` or `scientificDataViewer.groupDimensionSlices` is there, VS Code greys it out as an unknown setting. Delete it.

## M39 — Expand All leaves the Xarray Encoding sections closed

1. Open the sample file. In the header, hover the icon of a square with a **+** inside: the tooltip reads `Expand All Sections (except Xarray Encoding)`. Click it.
2. Every section opens (File Information, the representations, the groups, the variables and their attributes, Troubleshooting) **except** the sections titled **XARRAY ENCODING**, in the group `/` and in its variables and coordinates (`tas`, `time`…): they stay closed.
3. Click one **XARRAY ENCODING** title to open it, then **Expand All** again: that one stays open.
4. Click the icon of a square with a **−** inside (**Collapse All**): everything closes, the encoding sections too.
5. Open the settings (Command Palette: **Preferences: Open Settings (UI)**), search `expandAllIncludesXarrayEncoding` and tick it. In the viewer, click **Refresh** (circular arrow), then **Expand All**: the encoding sections open too, and the tooltip reads `Expand All Sections`.
6. Click the export icon (arrow down), save the HTML file and open it in a web browser. Click **Expand All** there: the encoding sections open (the setting was on when you exported).
7. Untick the setting, **Refresh**, export again and open the new file in the browser: **Expand All** leaves the encoding sections closed.

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
| M25  |                         |               |
| M26  |                         |               |
| M27  |                         |               |
| M28  |                         |               |
| M29  |                         |               |
| M30  |                         |               |
| M31  |                         |               |
| M32  |                         |               |
| M33  |                         |               |
| M34  |                         |               |
| M35  |                         |               |
| M36  |                         |               |
| M37  |                         |               |
| M38  |                         |               |
| M39  |                         |               |
