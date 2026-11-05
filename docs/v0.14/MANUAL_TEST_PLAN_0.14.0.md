# v0.14.0 — Manual test plan

About 30 minutes. Each step says what to do and what you should see. Write the result in the [results sheet](#results-sheet) at the end.

## Before you start

1. Install the build under test: `npm run package`, then **Extensions > … > Install from VSIX** with `artefacts/vsix-releases/scientific-data-viewer-0.14.0.vsix` (or press F5 from the repository).
2. Create the sample files: `python python/create_sample_data.py`. They land in `artefacts/sample-data/`. v0.14 adds `broken_datetime_packed_variable.nc` and `sample_geotiff_time_bands.tif`.
3. Reset the settings this plan touches: `scientificDataViewer.decoding.*` to `default`, `scientificDataViewer.engineBackendKwargs` removed, `scientificDataViewer.convertBandsToVariables` on.

Where to look:

- **File Information** is the first section of the viewer. Its first line ends with **Decoding: …** and a **Reopen raw** / **Reopen decoded** link.
- **How this file was opened** is the first entry of the **Troubleshooting** section, the last section of the viewer.

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
