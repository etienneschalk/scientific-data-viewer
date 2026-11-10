# Manual Test Plan — v0.13.0

A step-by-step checklist to confirm v0.13.0 is ready to ship. You do **not** need to know the file formats: every step says exactly what to click and what you should see.

- **Time needed:** about 2 h for everything (Part A ≈ 20 min, Part B ≈ 1 h 45, Part C ≈ 10 min). Part D is done later, after the merge. Part E is the technical verification guide for reviewers (optional for testers).
- **How to use it:** do the steps in order. After each test, tick ✅ or ❌ in the [results sheet](#results-sheet) at the end. If something fails, see [When a test fails](#when-a-test-fails).
- For the technical background of each feature, see [`RELEASE_NOTES_0.13.0.md`](../RELEASE_NOTES_0.13.0.md).

---

## The formats in plain words

You will open files of these kinds. You don't need more than this:

| Name                            | What it is                                                                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NetCDF** (`.nc`)              | The classic file for climate/ocean data: a table of numbers along time, latitude, longitude… One file.                                              |
| **Zarr**                        | Same kind of data, but stored as a **folder** full of small files. Version 2 and version 3 exist; v0.13 tells you which one it is.                  |
| **Zarr in a ZIP**               | A Zarr folder packed into a single `.zip` file.                                                                                                     |
| **Sharded Zarr**                | A Zarr v3 store that groups many small pieces into bigger files ("shards"). Opens like any Zarr.                                                    |
| **Kerchunk** (`.kerchunk.json`) | A small text file that **points to** data inside another file (here, `sample_data.nc`). Opening it shows that other file's data without copying it. |
| **GeoTIFF** (`.tif`)            | A satellite/map image with geographic coordinates.                                                                                                  |
| **COG**                         | "Cloud Optimized GeoTIFF": a GeoTIFF organised for fast partial reading. v0.13 labels it as such.                                                   |
| **Groups**                      | Some files contain folders-inside-the-file ("groups"), e.g. `/root/humidity`. Child groups can reuse their parent's coordinates.                    |

Words used in the viewer:

- **Variable** — one dataset inside the file (e.g. `temperature`).
- **Coordinates** — the axes of the data (e.g. `time`, `lat`, `lon`).
- **Attributes** — the little "label: value" details listed for each variable.

---

## Part A — Preparation (do once)

### A1. Open a terminal in the project folder

In VS Code: **Terminal → New Terminal**. All commands below are typed there, from the project folder (`scientific-data-viewer`).

### A2. Use the right Node.js version

```bash
nvm use
node --version
```

✅ You see `v22.…` (any v22 is fine).

### A3. Run the automated checks

Copy-paste these lines one by one and wait for each to finish:

```bash
source .venv/bin/activate
python -m pytest python/tests -q
python python/tools/golden_snapshots.py check
npm install
npm run compile
npm test
```

✅ Expected:

- pytest ends with `… passed` and **no** `failed`.
- golden check ends with `… cases, 0 failing`. The snapshots (`artefacts/golden/`) are local, not in git: they compare against whatever was recorded last on your machine. If it says `NEW … run record` for every case, the folder is empty: run `python python/tools/golden_snapshots.py record` on a known-good commit first, or skip this line. Snapshots recorded before the end of v0.13 fail on every `info` case (the xarray encoding moved out of the attributes, `NaN` reads `nan`): check that the diffs are only these, then `record` again.
- `npm test` ends with `… passing` and no `failing`.

> If `npm test` fails immediately with `bad option: --extensionDevelopmentPath`, you are inside VS Code's own terminal: run `env -u ELECTRON_RUN_AS_NODE npm test` instead.

### A4. Create the test files

```bash
python python/create_sample_data.py --overwrite
```

✅ The last lines say `Sample data files created successfully!` and there is **no** line starting with `❌`.

Then create four extra files used by some tests (copy-paste the whole block):

```bash
python - <<'EOF'
import shutil, zipfile
import numpy as np, xarray as xr
# 1. A Zarr *version 2* store (all samples are version 3)
xr.Dataset({"temperature": (("y", "x"), np.random.rand(20, 30).astype("float32"))}).to_zarr(
    "artefacts/sample-data/my_v2_store", zarr_format=2, mode="w")
# 2. An ordinary ZIP that is NOT a Zarr store
with zipfile.ZipFile("artefacts/sample-data/not_zarr.zip", "w") as z:
    z.writestr("hello.txt", "just a text file")
# 3. A copy of the Kerchunk file with an ordinary .json name
shutil.copy("artefacts/sample-data/sample_data.kerchunk.json", "artefacts/sample-data/my_refs.json")
# 4. An empty file with the old Sentinel ".safe" extension
open("artefacts/sample-data/fake.safe", "w").close()
print("done")
EOF
```

✅ It prints `done`.

### A5. Build and install the extension (the real package users get)

```bash
npm run package
```

✅ A file `scientific-data-viewer-0.13.0.vsix` appears in the `artefacts/vsix-releases/` folder of the project.

Install it:

1. Open the Extensions panel (**Ctrl+Shift+X**).
2. Click the **`…`** menu at the top of the panel → **Install from VSIX…**
3. Choose `artefacts/vsix-releases/scientific-data-viewer-0.13.0.vsix`.
4. When asked, click **Reload** (or press **Ctrl+Shift+P**, type `Reload Window`, press Enter).

✅ In the Extensions panel, **Scientific Data Viewer** shows version **0.13.0**.

### A6. Tell the extension which Python to use

1. Press **Ctrl+Shift+P**, type `Preferences: Open User Settings (JSON)`, press Enter.
2. Add this line inside the `{ … }` (replace the path with your project path; keep the comma rules of JSON):

   ```json
   "scientificDataViewer.python.overridePythonInterpreter": "/home/eschalk/work/scientific-data-viewer/.venv/bin/python",
   ```

3. Save (**Ctrl+S**), then **Ctrl+Shift+P** → `Reload Window`.

> Keep this settings file open in a tab: several tests ask you to add or change a line there. After changing a setting, **always press the 🔄 Refresh button** at the top of the viewer (or close and reopen the file).

### A7. Know where errors are shown

**Ctrl+Shift+P** → `Scientific Data Viewer: Show Extension Logs` opens the log panel. If a test fails, the reason is usually there.

---

## Part B — Test the new features

In all tests, files are in the **`artefacts/sample-data`** folder of the Explorer (left sidebar, **Ctrl+Shift+E**). "Open a file" means **click it once**; it opens in the Scientific Data Viewer. "Right-click" means right-click it in the Explorer.

At the top of the viewer, the **File Information** section shows **Format:** and **Used Engine:**. You will check those often.

### B1. Python packages are recent enough

1. **Ctrl+Shift+P** → `Scientific Data Viewer: Run Healthcheck`.

✅ No warning about `zarr` or `xarray` being too old. (The release requires xarray 2026.4 or newer and zarr 3 or newer; the healthcheck would name `zarr>=3` if not.)

### B2. Zarr version 3 is recognised

1. Right-click the folder **`sample_zarr_single_group_from_dataset.zarr`** → **Open Scientific Data Viewer (Folder)**.

✅ **Format:** `Zarr v3`. Variables `salinity` and `temperature` are listed.

### B3. Zarr version 2 is recognised

1. Right-click the folder **`my_v2_store`** (created in A4) → **Open Scientific Data Viewer (Folder)**.

✅ **Format:** `Zarr v2`. Variable `temperature` is listed.

### B4. A Zarr folder without ".zarr" in its name opens

1. Right-click the folder **`sample_ocean_grid_v3`** → **Open Scientific Data Viewer (Folder)**.

✅ **Format:** `Zarr v3`. Variable `sea_surface_temperature` is listed.

### B5. Zarr inside a ZIP file opens

1. Right-click **`sample_zarr_v3.zarr.zip`** → **Open Scientific Data Viewer**.

✅ **Format:** `Zarr v3 (ZIP)`. Variable `chlorophyll` is listed.

2. Close the tab, then **double-click** **`sample_zarr_v3.zarr.zip`** in the Explorer.

✅ It opens directly in the viewer (tab of the **Zarr Data Viewer**), same content. (The Explorer still shows a zip icon with the default icon theme: expected, see the release notes.)

3. Double-click **`sample_zarr_v3.zip`** (same archive, bare `.zip` name).

✅ It does **not** open in the viewer (VS Code's usual handling of a `.zip`: a "binary file" notice). Right-click it → **Open Scientific Data Viewer**: ✅ same content as step 1.

4. Double-click **`sample_zarr_v2_root.zarr.zip`**, then right-click **`sample_zarr_v2_root.zip`** → **Open Scientific Data Viewer**.

✅ Both show **Format:** `Zarr v2 (ZIP)` with variable `wind_speed`; **Create Plot** draws a map.

### B6. A normal ZIP gives a clear message

1. Right-click **`not_zarr.zip`** → **Open Scientific Data Viewer**.

✅ An error says the archive **is not a Zarr store** (mentions `zarr.json` / `.zgroup`). ❌ if it talks about "missing dependencies" with an empty list.

### B7. Sharded Zarr shows its compression details

1. Right-click the folder **`sample_zarr_v3_sharded.zarr`** → **Open Scientific Data Viewer (Folder)**.
2. Find the variable **`reflectance`**, click it to expand it, then click its **Xarray Encoding** section (closed at first).

✅ You see **`shards`** = `[32, 32]` and **`compressors`** mentioning `zstd`.

### B8. Turning off the encoding details hides them

1. In your settings JSON add: `"scientificDataViewer.showXarrayEncodingAttributes": false,` → save.
2. Back in the viewer of B7, press **🔄 Refresh**.

✅ The **Xarray Encoding** sections are gone (the attributes stay).

3. Remove that line from the settings (or set it to `true`), save, **🔄 Refresh** → the sections come back.

### B9. Compressed NetCDF shows its compression ("filters")

1. Open **`sample_netcdf_gzip.nc`**.
2. Expand the variable **`air_temperature`**, then its **Xarray Encoding** section.

✅ You see **`zlib`** = `true` and **`complevel`** = `4`.

### B10. Choosing which NetCDF reader is used

1. Open **`sample_data.nc4`**. ✅ **Used Engine:** `netcdf4`.
2. In settings add: `"scientificDataViewer.netcdfEngineOrder": ["h5netcdf", "netcdf4", "scipy"],` → save → **🔄 Refresh**.

✅ **Used Engine:** `h5netcdf`.

3. Open **`sample_data.cdf`** (a NASA CDF file, a different format).

✅ **Used Engine:** `cdflib` — the setting does **not** affect `.cdf` files.

4. Remove the `netcdfEngineOrder` line, save.

### B11. Child groups show their parent's coordinates

1. Right-click the folder **`sample_zarr_inherited_coords.zarr`** → **Open Scientific Data Viewer (Folder)**.
2. Go to the group **`/root/humidity`** and look at its **Coordinates**.

✅ `lat`, `lon` and `time` are listed. Clicking one shows an attribute **`inherited_from`** = `/root`.

3. Click **Create Plot** on variable **`humidity`** (in `/root/humidity`).

✅ A plot appears (no error about missing coordinates).

4. In settings add: `"scientificDataViewer.showInheritedCoordinates": false,` → save → **🔄 Refresh**.

✅ `/root/humidity` now shows **no** `lat` / `lon` / `time` coordinates.

5. Remove that line, save.

### B12. Kerchunk file opens and plots

1. Open **`sample_data.kerchunk.json`**.

✅ The viewer opens (title mentions **Kerchunk (virtual Zarr) Data Viewer**). **Format:** `Kerchunk (virtual Zarr)`. Variables `pressure` and `temperature` are listed.

2. Open **Global Plot Controls** and, under **Dimension slices**, type `0` in the **start** box of **time** (one time step; the full file is too big to plot within the time limit).
3. Click **Create Plot** on **`temperature`**.

✅ A map appears within a few seconds. (This reads real data from `sample_data.nc`, next to the `.json` file.)

4. Clear the **time** box again.

5. Open the folder **`kerchunk/`** and double-click **`sst_3days.kerchunk.json`**.

✅ **Format:** `Kerchunk (virtual Zarr)`; variable `sst` has **12** time steps (2024-01-01 00:00 to 2024-01-03 18:00), although each `sst_2024-01-0N.nc` file holds only 4: the reference combines the three files.

6. Under **Dimension slices**, type `11` in the **start** box of **time**, then **Create Plot** on **`sst`**.

✅ A world map appears (this time step is read from `sst_2024-01-03.nc`). Do the same with **`sst_3days.ref.json`**: ✅ same result.

7. Copy **`sst_2024-01-01_inline.kerchunk.json`** to another folder (e.g. your home folder) and open the copy.

✅ It opens and plots without the NetCDF files: every chunk is inside the JSON.

### B13. An ordinary-named JSON opens only on request

1. Click **`my_refs.json`** (created in A4).

✅ It opens as **normal text**, not in the viewer.

2. Right-click **`my_refs.json`** → **Open as Kerchunk / virtual Zarr**.

✅ The viewer opens with the same variables as B12.

3. In the Explorer, go to the project root, right-click **`package.json`** → **Open as Kerchunk / virtual Zarr**.

✅ An error says it is **not a Kerchunk / virtual Zarr reference**. Nothing else breaks.

4. Click **`kerchunk/sst_3days_refs.json`**: ✅ it opens as text. Right-click it → **Open as Kerchunk / virtual Zarr**: ✅ the viewer opens with the 12 time steps of B12 step 5.

### B14. Cloud Optimized GeoTIFF is labelled

1. Open **`sample_data_cog.tif`**. ✅ **Format:** `Cloud Optimized GeoTIFF (COG)`.
2. Open **`sample_data.tif`**. ✅ **Format:** `GeoTIFF` (a normal one).

### B15. Plot grids: automatic number of columns

This uses a file with 24 time steps; we plot several time steps side by side ("facets").

1. Open **`hs-issue-0117.nc`** (if you don't have it, use `sample_data.nc4` and its variable `temperature`).
2. Open the **Global Plot Controls** section.
3. Under **Dimension slices**, type `0:6` in the **start** box of **time** (it fills start `0` and stop `6`: time steps 0 to 5).
4. Under **Plot parameters → Facets**, set **col** to `time`.
5. Under **col_wrap**, tick **auto**.

✅ The number box next to col_wrap becomes greyed out.

6. Click **Create Plot** on variable **`hs`**.

✅ A grid of 6 small maps appears, arranged on several rows automatically. No error.

7. Untick **auto**, type `2` in the col_wrap box, **Create Plot** again.

✅ The maps are now arranged **2 per row**.

### B16. Plot grids: panel size setting

1. In settings add: `"scientificDataViewer.facetgridFigsize": [6, 2],` → save.
2. Repeat B15 steps 3–6 (time `0:6`, col `time`, Create Plot).

✅ The maps look **wide and flat** compared with B15.

3. Remove that line, save.

### B17. Empty selection gives a clear message (bug fixed during the refactor)

1. Open **`sample_data.netcdf`**, open **Global Plot Controls**.
2. In **Dimension slices**, type `5` in the **start** box of `time` and `2` in its **stop** box (the stop box turns red: nothing is selected).
3. **Create Plot** on **`precipitation`**.

✅ The error reads **"No data to plot: dimension(s) time are empty after selection. Check the dimension slices …"** ❌ if it says `ZeroDivisionError`.

4. Click **Reset** next to **Dimension slices**.

### B18. Sentinel ".safe" is no longer offered

1. Right-click the file **`fake.safe`** (created in A4) in `artefacts/sample-data`.

✅ There is **no** "Open Scientific Data Viewer" entry for it. (Folders, such as `broken_file.safe`, always offer "Open Scientific Data Viewer (Folder)" — that is expected.)

### B19. The extension's own Python environment rebuilds itself

The extension can manage its own Python installation (the "uv environment"). When a new version needs other packages, v0.13 deletes that installation and builds it again from scratch, by itself, once, instead of asking the user to do it. If the rebuild fails, the old installation is put back. (People who chose their own Python must still update it themselves; the extension never touches it.)

1. In your settings JSON, **temporarily remove** the `overridePythonInterpreter` line (from A6) and add:
   `"scientificDataViewer.python.useExtensionOwnEnvironment": true,` → save → **Reload Window**.
2. Wait until the extension has finished setting up. One of two things happens, both are fine:
   - **No environment yet on this computer:** it is created (a few minutes the first time; **Show Extension Logs** says when it is ready).
   - **An environment from an older version already exists:** you already see the notification of step 4 below. That is the feature working; note ✅ for step 4 and go on.

   Then open any `.nc` file to check it works.

3. Pretend this environment comes from an older version: in the terminal run

   ```bash
   ENV=~/.config/Code/User/globalStorage/eschalk0.scientific-data-viewer/python-environment
   rm "$ENV/sdv-environment.json"; touch "$ENV/left-by-old-version.txt"
   ```

4. **Reload Window**.

✅ A notification says **"Scientific Data Viewer: rebuilding its Python environment for this new version (this can take a few minutes)…"**, then **"Scientific Data Viewer: Python environment rebuilt for this new version."**

✅ `ls "$ENV"` no longer shows `left-by-old-version.txt` (the folder was rebuilt from scratch), and `ls "$ENV.previous"` says it does not exist.

5. **Reload Window** once more.

✅ **No** rebuild notification this time, and files open immediately (the logs say `Extension virtual environment is up to date`).

**When the rebuild cannot run** (e.g. no internet). We simulate it by hiding the `uv` program for a moment:

6. In the terminal (keep the same terminal open until step 9):

   ```bash
   rm "$ENV/sdv-environment.json"; touch "$ENV/left-by-old-version.txt"
   UV="$(which uv)"; mv "$UV" "$UV.off"; echo "uv hidden: $UV.off"
   ```

7. **Reload Window**.

✅ A **warning** says the Python environment **could not be rebuilt** and that the previous environment is used for now.

8. Open any `.nc` file.

✅ It still opens normally, and `ls "$ENV"` still shows `left-by-old-version.txt` (the old environment was put back, not deleted).

9. Put `uv` back, in the same terminal:

   ```bash
   mv "$UV.off" "$UV"; uv --version
   ```

   ✅ It prints a uv version. Then **Reload Window**.

✅ The rebuild now runs: the **"rebuilding…"** then **"rebuilt"** notifications appear (the retry happens by itself).

10. **Ctrl+Shift+P** → `Scientific Data Viewer: Manage Extension Virtual Environment` → **Recreate**.

✅ A progress notification, then **"Extension virtual environment recreated successfully!"**; files still open.

11. Put back your settings from A6 (re-add `overridePythonInterpreter`, remove `useExtensionOwnEnvironment`), save, **Reload Window**.

### B20. (Optional, recommended) Real upgrade from v0.12, like a user

This repeats B19 the way users will live it: they have v0.12 with its own environment, and the Marketplace updates them to v0.13. `scripts/upgrade-sandbox.sh` does the same automatically in a throw-away VS Code profile (see [UPGRADE_TEST_PLAN.md](./UPGRADE_TEST_PLAN.md)); this by-hand version also checks what the user sees.

1. In the Extensions panel, click **Scientific Data Viewer** → the gear ⚙ → **Install Specific Version…** (called **Install Another Version…** in some VS Code versions) → choose **0.12.1** → **Reload**.
2. In settings: remove `overridePythonInterpreter`, add `"scientificDataViewer.python.useExtensionOwnEnvironment": true,` → save → **Reload Window**. Wait until the environment is ready (logs), and open a `.nc` file.
3. Install the v0.13 package again, exactly as in **A5** (Install from VSIX… → `artefacts/vsix-releases/scientific-data-viewer-0.13.0.vsix` → Reload).

✅ At the first start of v0.13, the **"rebuilding its Python environment for this new version…"** notification appears once, then **"rebuilt"**. Files open; B1 (Healthcheck) shows no "too old" warning.

4. **Reload Window**. ✅ No notification any more.
5. Put back your settings from A6, save, **Reload Window**.

### B21. GRIB and TIFF files with the extension's own environment

These files used to crash the extension's own environment (`free(): invalid pointer`, `double free or corruption` in the logs).

1. As in B19 step 1, use `useExtensionOwnEnvironment` (no `overridePythonInterpreter`), **Reload Window**, wait until ready.
2. Open `sample_data.grib`, `sample_data.grib2`, `sample_data_cog.tif` and `sample_multiband.tif`; click **Create Plot** on one variable of each.

✅ All open and plot; **Show Extension Logs** contains no `free()` / `double free` / `exit code 134`.

3. Put back your settings from A6, **Reload Window**.

### B22. Fixes from the code review

Quick checks of the review fixes (details in [T16–T19](#t16-code-review-security-escaping-csp-commands)):

1. **No stray files**: in the project folder, `ls` shows **no** files named `=2026.4.0`, `=3` or `=1.8`.
2. **Big-file message**: set `"scientificDataViewer.maxFileSize": 0.001`, open `sample_data.nc` ✅ the error says `Maximum allowed: 0.001MB` (not a byte count). Remove the setting.
3. **Kerchunk in a second tab**: open `sample_data.nc`, then right-click `my_refs.json` (from A4) → **Open as Kerchunk / virtual Zarr** ✅ a second tab opens and shows the data.
4. **Save plot**: plot a variable, click **Save** ✅ a PNG appears under `artefacts/sample-data/sdv-plots/`, with no "timeout" message.
5. **Corrupt file**: open `broken_file.h5` ✅ a clear error message, with its error type, not a blank page.
6. **GRIB time selector**: open `sample_data.grib` ✅ the time selector does not list `t` (temperature).
7. **Outline**: in the **Scientific Data Structure** panel, click an attribute of a group of `sample_data_multiple_groups.nc` ✅ the viewer scrolls to it.

### B23. Too-old xarray gives a clear message

Only if you have (or can make) a Python with an old xarray, e.g. `uv venv /tmp/oldx --python 3.10 && uv pip install --python /tmp/oldx/bin/python "xarray==2024.6.0" netCDF4 matplotlib`.

1. Set `"scientificDataViewer.python.overridePythonInterpreter": "/tmp/oldx/bin/python"`, **Reload Window**, open `sample_data.nc`.

✅ The error says **"xarray 2024.6.0 is too old for Scientific Data Viewer"** with a `pip install` command (v0.12 showed `module 'xarray' has no attribute 'DataTree'`).

2. Put back your settings from A6, **Reload Window**.

### B24. No plot type drop-down

1. Open `sample_data.nc` and expand a group.

✅ Under each variable there is only the **Create Plot** button: the "Auto (Recommended)" drop-down is gone.

2. Click **Create Plot** on `temperature`.

✅ The plot appears, as before.

### B25. Variable sections and the Xarray Encoding section

1. Open `sample_data.nc` and expand a group.

✅ Each variable is a single line. Section titles show a number (e.g. **VARIABLES 3**). After **ATTRIBUTES** there is a closed **XARRAY ENCODING** section.

2. Click a variable's line.

✅ Three parts appear: **ATTRIBUTES** (open), **XARRAY ENCODING** (closed) and **PLOT** (with **Create Plot**). No text starting with `__xarray_encoding.` anywhere.

3. Close **Attributes**, open **Xarray Encoding**, then click the variable's line twice.

✅ Everything hides, then comes back as you left it (Attributes closed, Encoding open).

4. Click the line of every variable to close them, then open **Global Plot Controls** and press **Plot All**.

✅ Each variable opens by itself on its plot.

5. Look at a whole group, then scroll down through it.

✅ The group is one box: its title line shows counts (e.g. "3 dimensions · 3 coordinates · 3 variables"), and its parts (Group Plot Controls, Dimensions, … Xarray Encoding) are separated by thin lines inside the same border. While you scroll, the title line stays at the top until the group ends.

### B26. Cancel one plot

1. Open `sample_data.nc`, open a variable and click **Create Plot**, then quickly click the red **Cancel** button that appears next to it. (If the plot is too fast to catch, use a bigger file.)

✅ While the plot runs, **Create Plot** is greyed out and **Cancel** is shown. After **Cancel**, the plot area says **Plot cancelled.** (not a red error), **Cancel** disappears and **Create Plot** can be clicked again.

2. Click **Create Plot** again and let it finish.

✅ The plot appears as usual; no **Cancel** button left.

3. Start a plot, then open **Global Plot Controls** and click **Cancel All**.

✅ The variable says **Plot cancelled.**, as with its own **Cancel** button.

### B27. Load time in local time

1. Open `sample_data.nc` and look at the top right of the viewer.

✅ It shows `Loaded:` followed by the time of your clock and your time zone offset, e.g. `2026-10-29T14:03:12.345+01:00`.

2. In the settings, turn off **Show Load Time In Local Time**, then click **Refresh** (🔄).

✅ The time now ends with `Z` and is in UTC.

3. Turn the setting back on and click **Refresh**.

✅ Local time again.

### B26. Plot controls are easy to read

1. Open `sample_data.nc`, open **Global Plot Controls**.

✅ One box with two parts, each with a bold title and a **Reset** button on the right: **Dimension slices**, **Plot parameters** (the former **Time range** part is removed in v0.13, and **Settings** no longer lists **Time Controls**). Under Plot parameters, the settings are sorted in four small groups (**Facets**, **Axes**, **Color**, **Figure**); each one shows its name above its box, and the boxes line up in columns from one group to the next.

2. Type `0` in a dimension slice and `20` in **bins**, then click **Reset** next to **Dimension slices**.

✅ Only the slice is cleared; `bins` stays. **Reset** next to **Plot parameters** clears `bins`.

3. Open a group's **Group Plot Controls**.

✅ Same layout, without an extra box inside the group.

4. Back in **Global Plot Controls**, type `0` in the **start** box of `time`, then **vmin** `10` and **vmax** `12`. **Create Plot** on `temperature`.

✅ The colorbar goes from 10 to 12 and most of the map is at one of the two end colors. Untick **add_colorbar**, **Create Plot** again → no colorbar.

### B27. Dimension slices: boxes and slider

1. Open `sample_data.nc` → **Global Plot Controls** → **Dimension slices**.

✅ Each dimension has three small boxes `start : stop : step` and a slider under them.

2. Drag the right handle of the `time` slider to the left.

✅ The **stop** box fills with a number and follows the handle.

3. Type `1` in **start** and empty **stop**.

✅ Both handles go to position 1 (one single time step).

4. Paste `0:6:2` in **start**.

✅ The three boxes show `0`, `6`, `2`.

5. Click **Reset** next to **Dimension slices**.

✅ The boxes are empty and the handles are back at both ends.

6. Type `1:3` in the **start** box of `time`, then export the webview (download icon at the top) and open the HTML file in a browser.

✅ The `time` boxes show `1` and `3` and the handles are at the same place. You cannot type in the boxes or move the handles, and there is no **Reset** button.

### B28. Changing one plot setting keeps the rest automatic

1. Open `sample_data_multiple_groups.nc`, find the variable `root_data` and click **Create Plot**.

✅ One small map per day, 4 per row. Under the plot, a line starts with `image` and lists `col time`, `col_wrap 4`, `y lat`, `x lon`; none of them has a colored border.

2. In **Global Plot Controls** → **Dimension slices**, type `5:15` in the **start** box of `lat`.

✅ The `lat` field gets a colored border and a dot after its name. The other fields have no border.

3. Click **Create Plot** on `root_data` again.

✅ Still one map per day (before this version: a bar chart, called a histogram). The maps are shorter (10 latitudes). Under the plot, `lat 5:15` has a colored border.

4. In **Plot parameters**, type `5` in **col_wrap**, then **Create Plot**.

✅ 5 maps per row. `col_wrap 5` has a colored border under the plot; `col time` does not (it was chosen automatically).

5. Tick **robust**, then untick it.

✅ The border of **robust** appears, then goes away.

6. Click **Reset** next to **Plot parameters** and next to **Dimension slices**.

✅ No field has a border any more.

7. Type `20` in **bins** and choose `time` in **col**, then **Create Plot**.

✅ A histogram. Under it, a note says `col not used: bins draws a histogram of all values`.

---

## Part C — Quick check that old features still work

The Python code behind the viewer was reorganised in v0.13. Open each file below and click **Create Plot** on any one variable.

| File                             | What to check                                                  |
| -------------------------------- | -------------------------------------------------------------- |
| `sample_data_multiple_groups.nc` | Several groups listed (`/atmosphere`, `/ocean`, …); plot works |
| `sample_data.h5`                 | Opens (HDF5); plot works                                       |
| `sample_data.grib`               | Opens (GRIB weather file); plot works                          |
| `sample_multiband.tif`           | Opens; bands shown as variables                                |
| `sample_data.jp2`                | Opens (JPEG-2000 image)                                        |
| `sample data with spaces.nc`     | Opens although the name has spaces                             |
| `broken_file.nc`                 | Shows a clear error, no crash                                  |

Also:

1. With any file open, **Ctrl+Shift+P** → `Scientific Data Viewer: Export Webview Content` → the exported HTML opens in a browser and looks styled (colours, not plain black-on-white).
2. The **Scientific Data Structure** panel (in the Explorer sidebar, below the file list) lists the file's groups and variables; clicking one scrolls the viewer to it.

✅ All of the above behave as in v0.12.

---

## Part D — After the merge (repository side)

These checks are about the GitHub repository, not the extension. GitHub only reads issue forms from the **default branch**, so do them once the merge request is merged (or on a fork whose default branch contains this work).

### D1. Issue forms have no required fields

1. On GitHub, click **Issues → New issue**.
2. Open each form in turn: **Bug Report**, **Feature Request**, **Question / Discussion**.

✅ Each form's introduction says that **every field is optional**, and no field has a red asterisk (`*`).

3. On a fork (to avoid noise in the real project), submit a Bug Report with **only a title**.

✅ The issue is created.

---

## Part E — Technical verification guide

For reviewers and contributors who have **not** reviewed every commit on the branch (moved here from the release notes). Parts A–C above are the click-by-click version for testers. Each section states **what to expect**, **how to test**, and **common failure modes**.

### T0. Environment setup

1. **Node 22** (extension host / hooks): `nvm use` in the repo (see `.nvmrc`).
2. **Python:** Activate the interpreter the extension uses (workspace Python or extension uv env).
3. **Reload window** after installing packages or changing **Use Extension Own Environment**: `Developer: Reload Window`.
4. **Output channel:** View → Output → **Scientific Data Viewer** for Python errors and `used_engine` logs.

**Quick package check** (same interpreter as the extension):

```bash
python -c "import xarray, zarr; print('xarray', xarray.__version__, 'zarr', zarr.__version__)"
```

Expect **xarray ≥ 2026.4** and **zarr ≥ 3** for full v0.13 behaviour.

**Automated tests** (optional sanity):

```bash
source .venv/bin/activate   # or your interpreter
python -m pytest python/tests -q
npm run compile && npm test
```

**Regenerate v0.13 sample files** (written under `artefacts/sample-data/`, run from the repository root):

```bash
python python/create_sample_data.py --overwrite
```

New fixtures include `sample_ocean_grid_v3/` (unsuffixed Zarr v3), `sample_zarr_v3_sharded.zarr`, `sample_zarr_v3.zarr.zip`, `sample_netcdf_gzip.nc`, `sample_data_cog.tif`, `sample_data.kerchunk.json` and the `kerchunk/` folder (require `pip install kerchunk`); zipped Zarr also as `sample_zarr_v3.zip`, `sample_zarr_v2_root.zarr.zip` and `sample_zarr_v2_root.zip`.

---

### T1. Zarr 3 / dependency pins (P0.1)

**Expect:** Healthcheck / missing-package messages mention `zarr>=3` and `xarray>=2026.4.0` when versions are too old.

**Test:**

1. With a **current** env, open any existing `.zarr` sample (generate samples with `python python/create_sample_data.py` from the repository root).
2. File Information should show format **Zarr v2** or **Zarr v3** (see T4).
3. _(Optional)_ In a throwaway venv with `zarr==2.18`, confirm `.zarr` is reported as missing **`zarr>=3`**.

---

### T2. Zarr store without `.zarr` suffix (P0.2)

**Expect:** A directory containing `zarr.json` (v3) or `.zgroup` (v2) opens from **Open Scientific Data Viewer (Folder)** even when the folder name is **not** `something.zarr`.

**Test:**

1. Copy or create a small Zarr store as a plain directory name (e.g. `my_dataset/` with `zarr.json` inside).
2. Right-click the folder → **Open Scientific Data Viewer (Folder)** (available on **all folders** in the explorer).
3. Viewer should load variables/coordinates like a normal Zarr file.
4. A directory named `scene.tif` that happens to contain Zarr metadata should still be treated as **GeoTIFF** if `.tif` suffix wins (edge case covered by tests).

---

### T3. Zarr in ZIP archives (P0.3)

**Expect:** `.zip` files that contain a Zarr store (at root or nested prefix) open; arbitrary ZIPs show a clear **not a Zarr store** error.

**Test:**

1. Zip an existing `.zarr` directory (store at archive root) or use a sample generator if you add one locally.
2. Context menu on `.zip` → **Open Scientific Data Viewer**.
3. File Information format should mention **Zarr** and **(ZIP)**.
4. Open a normal ZIP (no `zarr.json` / `.zgroup`) → error message should **not** claim missing scientific packages with an empty list.

---

### T4. Zarr v3 encoding metadata (P0.4)

**Expect:** With **`showXarrayEncodingAttributes`** on (default), the **Xarray Encoding** section of variables/coordinates includes Zarr v3 **codecs**, **shards**, etc.; format string distinguishes **Zarr v2** vs **Zarr v3**.

**Test:**

1. Open a **v3** store (directory with `zarr.json`).
2. Expand a variable, then its **Xarray Encoding** section → keys like `compressors` / `shards` (exact keys depend on the store).
3. Toggle **`showXarrayEncodingAttributes`** off → refresh → the **Xarray Encoding** sections disappear.
4. Open a **v2** store (`.zgroup`) → label should say **Zarr v2**.

---

### T5. Plot `col_wrap='auto'` (P0.5)

**Expect:** In Global / Group plot controls, an **auto** checkbox next to **col_wrap** sets xarray `col_wrap='auto'` (xarray 2026.04+). Integer col_wrap still works when auto is unchecked.

**Test:**

1. Open a multi-panel-friendly dataset (3D+ variable).
2. Set **Facet col** to a dimension with many labels; check **auto** for col_wrap.
3. Create Plot (experimental) → should not error; on older xarray Python would warn and omit the kwarg.
4. Uncheck **auto**, enter `2` → plot uses numeric col_wrap.

---

### T6. NetCDF engine order (P1.1)

**Setting:** `scientificDataViewer.netcdfEngineOrder` (default: netcdf4 → h5netcdf → scipy)

**Expect:** File Information **engine** field reflects the first **installed** engine in your configured order. **Does not apply** to NASA `.cdf` (always cdflib).

**Test:**

1. Open `sample_data.nc` (or any `.nc` with both netCDF4 and h5netcdf available).
2. Note **used engine** in File Information (default: `netcdf4`).
3. Change setting to `["h5netcdf","netcdf4","scipy"]` → **Refresh** → engine should become `h5netcdf`.
4. Open a `.cdf` NASA file → engine remains **`cdflib`** regardless of setting.

---

### T7. HDF5 / NetCDF compression filters (P1.2)

**Expect:** gzip (or other) compressed NetCDF4 variables show `zlib`, `complevel` (and `shuffle`, `fletcher32`) in their **Xarray Encoding** section when the encoding is enabled, with the netcdf4 and the h5netcdf engine.

**Test:**

1. Create a small gzip NetCDF locally:

   ```python
   import xarray as xr, numpy as np
   ds = xr.Dataset({"temp": ("x", np.arange(8, dtype="float32"))})
   ds.to_netcdf("gzip.nc", encoding={"temp": {"zlib": True, "complevel": 4}})
   ```

2. Open in viewer → expand `temp`, then **Xarray Encoding** → `zlib : true`, `complevel : 4`. Set `netcdfEngineOrder` to `["h5netcdf"]`, **Refresh** → same keys.
3. Requires **h5netcdf ≥ 1.8** in env for best metadata parity (pinned in extension uv env).

---

### T8. Inherited DataTree coordinates (P1.3)

**Setting:** `scientificDataViewer.showInheritedCoordinates` (default: **true**)

**Expect:** Child groups list parent coordinates (time, lat, lon, …). Inherited coords have attribute **`inherited_from`** with the defining group path (e.g. `/`).

**Test:**

1. Generate samples (from the repository root): `python python/create_sample_data.py`.
2. Open **`artefacts/sample-data/sample_zarr_inherited_coords.zarr`** as a folder.
3. Navigate to a child group (e.g. under `root/temperature`) → **Coordinates** should include inherited dims.
4. Click a coordinate → attributes show `inherited_from`.
5. Set **`showInheritedCoordinates`** to `false` → Refresh → child groups show **only** locally defined coordinates.
6. **Plot check:** Plot a child variable that uses inherited dims → should still resolve coordinates (no “missing coord” plot error).

---

### T9. Kerchunk / virtual Zarr (P1.5, experimental)

**Expect:**

- `*.kerchunk.json` and `*.ref.json` open in **Kerchunk (virtual Zarr) Data Viewer**.
- Other `.json` / `.parquet` → only via **Open as Kerchunk / virtual Zarr** (context menu or command palette).
- Invalid JSON or non-reference JSON → **ValueError** with a clear message (not a generic ImportError).

**Test:**

1. `pip install kerchunk` in the active interpreter.
2. Generate a reference pointing at a local NetCDF:

   ```python
   import json, numpy as np, xarray as xr
   from pathlib import Path
   from kerchunk.hdf import SingleHdf5ToZarr

   nc = Path("src.nc")
   xr.Dataset({"temp": ("x", np.arange(6, dtype="float32"))}).to_netcdf(nc)
   refs = SingleHdf5ToZarr(str(nc), str(nc), inline_threshold=200).translate()
   Path("src.kerchunk.json").write_text(json.dumps(refs))
   ```

3. Click **`src.kerchunk.json`** → opens; File Information format **Kerchunk (virtual Zarr)**; variable **`temp`** visible without copying the NetCDF.
4. Rename to `refs.json` → does **not** auto-open; right-click → **Open as Kerchunk / virtual Zarr**.
5. Open `package.json` with the Kerchunk command → should **fail** with “not a Kerchunk reference” (ordinary JSON not hijacked).

---

### T10. Cloud Optimized GeoTIFF label (P2.3)

**Expect:** True COGs show **Cloud Optimized GeoTIFF (COG)** in File Information; plain GeoTIFF stays **GeoTIFF**.

**Test:**

1. Create a COG with rasterio:

   ```python
   import numpy as np, rasterio
   from rasterio.transform import from_origin
   data = np.arange(100, dtype="uint8").reshape(10, 10)
   with rasterio.open("test_cog.tif", "w", driver="COG", height=10, width=10,
                      count=1, dtype="uint8", transform=from_origin(0, 10, 1, 1),
                      crs="EPSG:4326", compress="deflate") as dst:
       dst.write(data, 1)
   ```

2. Open → format **Cloud Optimized GeoTIFF (COG)**.
3. Open a plain striped TIFF (`sample_data.tif` from sample generator) → **GeoTIFF**.

---

### T11. FacetGrid figure size (P2.7)

**Setting:** `scientificDataViewer.facetgridFigsize` — e.g. `[4, 3]` (width, height in inches)

**Expect:** Faceted plots (when facet row/col used) honor xarray `facetgrid_figsize`; single-panel plots unchanged.

**Test:**

1. Set `facetgridFigsize` to `[6, 2]`.
2. Open a faceted-capable variable; set facet row/col; create plot.
3. Panel layout should differ vs unset (subjective visual check); no Python error in Output channel.
4. Clear setting (empty array) → xarray defaults restored.

---

### T12. Sentinel SAFE claims removed (Phase 0)

**Expect:** Explorer context menus and keywords **no longer** mention `.safe` / Sentinel SAFE.

**Test:**

1. Inspect **package.json** contributions or right-click files in explorer — no SAFE-specific open entry.
2. Extension test suite includes regression for this (`test/suite/extension.test.ts`).

---

### T13. Python backend restructuring (no behaviour change expected)

**Expect:** Every viewer feature behaves exactly as before; only the two error messages below are new.

**Test:**

1. Run the snapshot check (needs `artefacts/sample-data/`; record a baseline first if `artefacts/golden/` is empty):

   ```bash
   python python/tools/golden_snapshots.py record   # on a known-good commit
   python python/tools/golden_snapshots.py check    # after changes: expect "0 failing"
   ```

2. Open a few files of different formats (NetCDF with groups, Zarr, GeoTIFF, Kerchunk) and create plots with facets and dimension slices: results should match v0.13 before the restructuring.
3. Plot with a dimension slice that selects nothing (`time` start `5`, stop `2`) → clear _"No data to plot"_ error instead of a `ZeroDivisionError`.
4. `python python/create_sample_data.py --overwrite` completes with exit code 0 and rewrites the generated files; running it twice yields the same snapshots.

### T14. Issue templates (repository)

1. On GitHub, **New issue** → pick each of _Bug Report_, _Feature Request_, _Question / Discussion_.
2. The intro says all fields are optional; no field is marked with a red asterisk.
3. Submit with only a title → the issue is created (try on a fork to avoid noise).

---

### T15. Automatic rebuild of the extension uv environment

**Expect:** with **`useExtensionOwnEnvironment`** on, an environment created by an older version (or recorded with a lower `ENVIRONMENT_REVISION`) is deleted and created again from scratch once at startup; later starts reuse it without reinstalling. If the rebuild fails, the previous environment is restored.

**Automated:** `scripts/upgrade-sandbox.sh` runs a real update in a throw-away VS Code profile (v0.12.1 → v0.13.0 by default, any pair with `--old` / `--new`), with the scenarios `normal`, `offline` and `interrupted`; `./paranoia.sh --full` runs it from every older release, and checks that the same release keeps the environment and that a raised revision rebuilds it; see [`UPGRADE_TEST_PLAN.md`](./UPGRADE_TEST_PLAN.md).

**Test by hand:** [manual test plan B19](#b19-the-extensions-own-python-environment-rebuilds-itself) (simulated old environment, failed rebuild with `uv` hidden, Recreate) and [B20](#b20-optional-recommended-real-upgrade-from-v012-like-a-user) (real upgrade from v0.12.1).

### T16. Code review: security (escaping, CSP, commands)

**Expect:** names from files are shown as text; nothing is executed.

**Test:**

1. In Python, create a file whose variable name contains HTML:
   ```python
   import xarray as xr
   xr.Dataset({'<img src=x onerror=alert(1)>': ('x', [1, 2])}).to_netcdf('xss.nc')
   ```
2. Open `xss.nc` → the variable list shows the literal text `<img src=x onerror=alert(1)>`; no broken image, no alert.
3. **Developer: Open Webview Developer Tools** → Console: no CSP violation errors during normal use (loading, plotting, collapsing sections, error page links).
4. On the error page (open an unsupported file, e.g. a `.txt` renamed to `.nc` with garbage content), click **🎮 Extension Settings**, **🎮 Check VSCode Output panel**, **🎮 Install xarray** → each still works.

### T17. Code review: uv environment and interpreters

**Test:**

1. With `useExtensionOwnEnvironment` on, **Manage Extension Virtual Environment → Update Packages** → the log shows `uv pip install … xarray>=2026.4.0 … zarr>=3` (pins quoted in the log) and **no** files named `=2026.4.0` / `=3` appear in the opened workspace folder.
2. From the error page, click **🎮 Install matplotlib** with the extension environment active → installs with uv (no "pip is not available").
3. Set `overridePythonInterpreter`, then enable `useExtensionOwnEnvironment` → the message says the override takes precedence (not "uv is not installed").
4. With **no folder open**, create the environment from **Manage Extension Virtual Environment** → success message, no "Failed to create" error.

### T18. Code review: panel and plots

**Test:**

1. Right-click a Kerchunk reference saved as plain `refs.json` → **Open as Kerchunk / virtual Zarr** → File Information shows the Kerchunk engine (not a JSON error); opening it normally as well gives a second tab.
2. Set `maxFileSize` to `1` and open a file > 1 MB → message says `Maximum allowed: 1MB`. Reset the setting.
3. Create a plot, click **Save** and ignore the "Plot saved" notification for > 60 s → no "Request timeout" error; **Save All Plots** saves every plot.
4. _(Windows)_ Save a plot → the file lands in `sdv-plots/` next to the data file; **Save As** proposes that folder.
5. Select a global time variable, then plot a variable without a time dimension → the plot is created (warning in the logs) instead of `KeyError`.
6. In a group, set only **cmap** in the Group Plot Controls → the group plot uses that cmap and the **global** checkbox values (e.g. robust).
7. Plot a 2D `(time, station)` variable → not squeezed into a sliver.
8. Outline (Explorer → Data Structure): click a group attribute → the viewer scrolls to it. Close the viewer → the outline is cleared.

### T19. Code review: backend errors and attributes

**Test:**

1. Open a corrupt `.nc` (e.g. `echo garbage > bad.nc`) → error page with an error type and suggestion (not the generic "file might be corrupted").
2. Open a file with a `valid_max = inf` attribute → opens; the attribute shows `inf`.
3. Attributes such as `_FillValue` / `valid_range` show numbers / arrays (`-999`, `[0.0, 2.0]`).
4. GRIB sample with temperature `t` → `t` is **not** offered in the time selector.

### T20. eccodeslib pin (GRIB / TIFF crash)

**Expect:** GRIB and GeoTIFF files open with the extension's uv environment, with no `free(): invalid pointer` / `double free or corruption` in the logs.

**Test:**

1. With `useExtensionOwnEnvironment` on and an environment recorded as `"revision": 1` (or with `eccodeslib` ≥ 2.48: check with `uv pip list --python <env>/bin/python`), reload the window → the rebuild notification appears once; afterwards `uv pip list` shows `eccodeslib 2.47.3.23`.
2. Open `artefacts/sample-data/sample_data.grib`, `sample_data.grib2`, `sample_data.tif`, `sample_data_cog.tif` → each loads; plot a variable of each.
3. Command line check: `<env>/bin/python -c "import eccodes, pyproj"` exits with code 0.

### T21. Viewer styling refresh

**Expect:** the viewer looks like a native VS Code page in every theme, with no unreadable control.

**Test:**

1. Open `artefacts/sample-data/sample_data.nc` with **Dark Modern**, then **Light Modern**, then a **High Contrast** theme (Preferences: Color Theme) → header toolbar shows four line icons (export, collapse all, expand all, refresh) whose tooltips match; every input / select is readable (no white input in dark themes); high contrast shows visible borders around cards and panels.
2. Scroll down → the header and the current section title stay at the top, with no gap between them.
3. Click **Collapse all** then **Expand all** → twisties rotate; nested content lines up under its title.
4. Expand a variable → the card shows its attributes; **Create Plot** → the plot appears inside the same card. Plot a variable that fails → red callout with a **Copy** button in its corner; click it → **Copied** for 2 s.
5. **Xarray Text Representation** → the **Copy** button floats in the top-right corner of the code block and does not hide the first line.
6. Narrow the editor to ~400 px → variable rows stack, time-control labels go above their inputs, no horizontal scroll.
7. Explorer → Data Structure: click a variable → the viewer scrolls to it and highlights it with the focus color.
8. Export the webview (download icon) and open the HTML in a browser → same look as in VS Code.
9. Open `artefacts/sample-data/broken_file.nc` → the error page is a red-accented callout; the troubleshooting steps show `Ctrl`+`Shift`+`P` as keybinding labels and the install links as small outlined buttons.
10. No emoji is left: **Plot All** shows a warning line icon (a stop icon on **Cancel All** while plotting), and the error page uses line icons for its title, the troubleshooting heading, the install / settings / logs links and after external links.
11. _(Contributors)_ `npm run screenshots` → 24 PNG files in `artefacts/screenshots/v0.13/<theme>/` and `artefacts/screenshots/v0.13/index.html`; open the gallery and compare it with the steps above.
12. Make the editor wider than 1000 px and open `artefacts/sample-data/sample_data.nc` → while **Loading** shows there is no scrollbar; when the content appears and the scrollbar shows up, the header and the content do not move sideways.

### T22. Plot type selector removed

**Expect:** each variable's plot row shows only the **Create Plot** button; plots look as before.

**Test:**

1. Open `artefacts/sample-data/sample_data.nc`, expand a group → under each variable there is a **Create Plot** button and no "Auto (Recommended)" drop-down.
2. **Create Plot** on `temperature` and on a 1-D variable → both plots appear, same as v0.12 with "Auto" selected.
3. Make a plot fail (e.g. a dimension slice on a dimension that does not exist, in the group plot controls) → the error text ends with `(file_path=… variable_path=…)`, without `plot_type=`.
4. _(Contributors)_ `.venv/bin/python python/get_data_info.py plot artefacts/sample-data/sample_data.nc /precipitation` → one JSON line with `plot_data`; `pytest python/tests` and `python python/tools/golden_snapshots.py check` pass (re-`record` once: error snapshots lose `plot_type='auto'`, and `plot__histogram` no longer exists).

### T23. Architecture diagrams (contributors)

**Expect:** the diagrams in `docs/architecture/` are regenerated from the code and match it.

**Test:**

1. `.venv/bin/python scripts/architecture/generate.py --check` → "every module is placed and every referenced symbol exists", exit code 0.
2. With Graphviz installed (`dot -V`): `.venv/bin/python scripts/architecture/generate.py` → "Wrote 9 SVG figures, architecture.html and README.md"; `git status docs/architecture` shows no change on a clean checkout.
3. Open `docs/architecture/README.md` on GitHub (or in the VS Code Markdown preview) → 10 sections, 9 figures readable in the light and the dark theme, two protocol tables.
4. Open `docs/architecture/architecture.html` in a browser → same content on one page; hovering a box of the module graphs shows its path.
5. Add an empty `src/common/Example.ts`, run step 1 again → it fails with `src/common/Example.ts is not placed in graphs.HOST_LAYERS`; delete the file.

### T24. Xarray Encoding section and variable card sections

**Expect:** the encoding has its own collapsed section; a variable's sections collapse one by one or all at once from its row.

**Test:**

1. Open `artefacts/sample-data/sample_data.nc` → under **Variables**, each variable is one collapsed line; the section headers of the group show counts (e.g. **VARIABLES 3**); a collapsed **XARRAY ENCODING** section follows **ATTRIBUTES**.
2. Click a data variable's row → **ATTRIBUTES n** (open), **XARRAY ENCODING n** (collapsed), **PLOT** (open, **Create Plot**). No `__xarray_encoding.` text anywhere.
3. Open **Xarray Encoding** → `dtype`, `_FillValue`, `source`… Collapse **Attributes**. Click the variable's row → everything hides; click again → Attributes still collapsed, Encoding still open.
4. Click a coordinate → **Attributes** and **Xarray Encoding**, no Plot section. A coordinate with neither (and no small value) shows a plain row, without twistie.
5. Collapse all variables, press **Plot All** → each plotted variable opens on its Plot section; collapsed groups stay collapsed.
6. Explorer → Data Structure: expand a variable → **Xarray Encoding (n)**; click an entry → the viewer opens the card and the section and highlights the line.
7. Set `"scientificDataViewer.showXarrayEncodingAttributes": false`, **Refresh** → no Xarray Encoding section (groups, coordinates, variables, outline); attributes unchanged.
8. Export the webview → open the HTML in a browser → sections open / closed as at export time, and they still collapse.
9. Each group is one card: its header shows the group name and its counts (e.g. "3 dimensions · 3 coordinates · 3 variables"); its sections (Group Plot Controls … Xarray Encoding) are separated by thin lines inside the same border. Scroll down inside an open group → its header stays under the toolbar until the end of the group, and the content passes under it. Collapse the group → only the header row is left, with its counts.
10. Expand the group **Attributes** section → each `:` sits right after the attribute name, as in a variable's **Attributes** and in the **Xarray Encoding** sections (it used to sit next to the value).

### T25. Cancel a single plot

**Expect:** a running plot can be stopped from its own Plot section.

**Test:**

1. Open a large file (or set `"scientificDataViewer.plotTimeoutMs": 60000` and plot a large variable without slices) → click **Create Plot** → **Create Plot** is greyed out and a red **Cancel** button appears next to it; **Cancel All (1)** appears in the Global Plot Controls.
2. Click **Cancel** → the plot area shows **Plot cancelled.** (no red error), **Cancel** disappears, **Create Plot** works again, **Cancel All** is hidden. **Show Logs**: `Aborting process for operation: plot-…`.
3. Start two plots, cancel one → only that one shows **Plot cancelled.**; the other finishes and **Cancel All** shows (1) meanwhile.
4. Start a plot and click **Cancel All** → the variable shows **Plot cancelled.**, not the "Process was aborted" error.
5. Press **Plot All**, then **Cancel** on one running variable → the final notification counts it as cancelled, not failed.

### T26. Load time in local time

**Expect:** the **Loaded:** time at the top right is in local time by default.

**Test:**

1. Open any sample file → the top right shows `Loaded: <date>T<time>.<ms>+HH:MM` (or `-HH:MM`), with the time of your clock and your time zone offset (`+00:00` in UTC).
2. Set `"scientificDataViewer.showLoadTimeInLocalTime": false` → **Refresh** (🔄) → `Loaded: …Z`, in UTC (same instant).
3. Set it back to `true` (or remove it) → **Refresh** → local time again.

### T27. Plot controls layout

**Expect:** plot controls read as aligned fields in titled blocks.

**Test:**

1. Open `artefacts/sample-data/sample_data.nc` → **Global Plot Controls** → one card: **Dimension slices** and **Plot parameters**, each with a bold title, a hint and **Reset** on the right.
2. Plot parameters show four captions (**Facets**, **Axes**, **Color**, **Figure**); every field has its name above its control, and the controls line up in columns across captions. Checkboxes sit in the same columns as the inputs.
3. Type `0` in a dimension slice and `20` in **bins** → **Reset** of Dimension slices clears the slice only → **Reset** of Plot parameters clears `bins` and restores the default checkboxes.
4. Expand a group → **Group Plot Controls** has the same layout, without a box of its own. A group value still overrides the global one (`bins` 10 in the group, 30 globally → the group's variable uses 10).
5. Narrow the editor to ~400 px → two columns of fields, no horizontal scroll.
6. Type `0` in the **start** box of `time` and set **vmin** / **vmax** to a narrow range (e.g. `10` / `12` for `temperature`) → **Create Plot**: the colors saturate and the colorbar runs from 10 to 12 (before the fix, the plot ignored them unless a cmap was set). Uncheck **add_colorbar** → no colorbar. On a 1D variable, check **robust** → the line plot is drawn (no `robust` error).

### T28. Dimension slices: boxes and slider

**Expect:** a slice can be typed in three boxes or set with a slider, and both stay in sync.

**Test:**

1. Open `artefacts/sample-data/sample_data.nc` → **Global Plot Controls** → **Dimension slices**: each dimension shows `start : stop : step` boxes and a slider with both handles at the ends.
2. Type `2` in **start** of `time` → both handles jump to 2. Type `5` in **stop** → the second handle moves to 4 (stop excluded), the track between them is highlighted.
3. Drag the right handle → only **stop** follows (handle index + 1), **start** is not rewritten (type `-10` in start first: it stays `-10`). Drag it over the left one and beyond → the handles swap roles, both boxes change and show lower : higher.
4. Put the two handles on the same position → **stop** empties: a single index. With a **step** typed, stop empties too and the step is struck through (ignored); pull the handles apart → the step counts again.
5. Drag the handles back to both ends → start and stop empty (no selection); the step box is never changed by the slider.
6. Paste `0:24:2` in **start** → the three boxes fill and the focus goes to **step**. Paste `5::2` → stop becomes the dimension size (to the end). Type `abc` in a box, or start `8` stop `3` → outlined in red. Type step `-1` → the slider greys out.
7. **Create Plot** with `time` start `0`, stop `2` → the plot uses two time steps; with start `1` only → one time step (no time dimension left).
8. **Reset** next to **Dimension slices** → boxes empty, handles back at both ends. Same in a group's **Group Plot Controls** (group values still override the global ones).
9. Set `time` to start `1` stop `3` step `2`, type start `2` stop `1` in another dimension, then export the webview and open the HTML in a browser → the boxes show the same values, the handles and highlight are where they were, the empty selection is still outlined in red; the boxes cannot be edited, the handles do not move and there is no **Reset** button.

### T29. QA pass fixes

**Expect:** the [fixes of the QA pass](./REVIEWS_0.13.0.md#fixes) hold.

**Test:**

1. Open `artefacts/sample-data/sample_data.netcdf`, slice `time` start `0`, **vmin** `-0.0000001` → **Create Plot** → the plot appears (no `expected one argument` error).
2. Type **vmin** `1,5` → the box turns red, its tooltip says to use a dot; **Create Plot** → "Invalid plot parameters, nothing was plotted: Global Plot Controls: vmin …". Fix it to `1.5` → the plot is made.
3. Uncheck **add_colorbar** in the Global Plot Controls; in the group's **Group Plot Controls**, the add_colorbar box shows a dash → **Create Plot** → no colorbar. Click the group box (checked) → colorbar. **Reset** of the group's Plot parameters → dash again.
4. Open `artefacts/sample-data/sample_data.nc`, expand a coordinate → **Xarray Encoding** → `_FillValue : nan` (not `np.float64(nan)`).
5. Open `artefacts/sample-data/sample_data_multiple_groups.nc` and close the tab at once → once the load would have finished, the **Data Structure** outline is empty. Open `artefacts/sample-data/broken_file.nc` and close it at once → no error notification.
6. Set `plotTimeoutMs` to `600000`, start a plot of `/temperature` in `artefacts/sample-data/sample_data.nc`, close the tab → no `get_data_info.py plot` process left after a few seconds (`ps`).
7. Open two viewers side by side, focus the right one, run **Export Webview Content** → the proposed file name is the right one's.
8. Start a slow plot, press **Plot All**, then **Cancel** on that variable → "Plot cancelled." stays.
9. Narrow the editor to 320 px → the four toolbar buttons are separate from the title (the version badge is hidden).
10. Select a Python 3.8 interpreter (`overridePythonInterpreter`) and open a file → the error says Python 3.10 or newer is required; select a venv without xarray → the error names the missing package and the `pip install` command.

### T30. Progressive plot layout and changed outlines

**Expect:** changing one plot control keeps the automatic choice of the others; changed controls are outlined; the line under the plot tells what was set and what was chosen.

**Test:**

1. Open `artefacts/sample-data/sample_data_multiple_groups.nc` → **Create Plot** on `root_data` → one map per time step, 4 per row. Under the plot: `image col time col_wrap 4 y lat x lon size 4 aspect 1`, no item outlined.
2. **Global Plot Controls** → **Dimension slices** → `lat` start `5`, stop `15` → the `lat` field is outlined, with a dot after its name. **Create Plot** → still one map per time step, latitudes −5 to 5 only (before: a histogram). Under the plot, `lat 5:15` is outlined.
3. Set **col_wrap** `5` → outlined → **Create Plot** → 5 maps per row; `col_wrap 5` outlined, the other items not.
4. Clear the slice, set **x** to `time` → **Create Plot** → time on the x-axis, `lon` on y, one panel per latitude.
5. Keep **x** `time` and also set **col** `time` → **Create Plot** → same plot, and a note under it: `col=time ignored: already used as x`.
6. Open `artefacts/sample-data/sample_data_many_vars.nc` → plot `temperature_00` (time, depth, lat, lon) → rows by `time`, columns by `depth`. Set **col** `time` → columns by `time` (outlined in the layout line), rows by `depth` (automatic).
7. Set **bins** `20` with **col** `time` → a histogram; the note says `col not used: bins draws a histogram of all values`.
8. Click **robust** twice → the outline appears then goes (back to its default). In a group's **Group Plot Controls**, click a checkbox showing a dash → outlined; **Reset** → dash, no outline.
9. Export the webview and open the HTML in a browser → the outlines and the layout line are kept.
10. `sample_data_multiple_groups.nc`: set **vmin** `5`, **vmax** `1`, slice `time` `0` → **Create Plot** on `root_data` → colour scale from 1 to 5, note `vmin=5 is above vmax=1: the two are swapped`.
11. Set the setting `scientificDataViewer.matplotlibStyle` to `doesnotexist` → **Create Plot** → default (light) style, note `Style 'doesnotexist' not found: default style used …`. Clear the setting.

### T31. Time Controls removed

**Expect:** no time range control anywhere; old settings are harmless.

**Test:**

1. Open `artefacts/sample-data/sample_data.nc` (it has a `time` coordinate) → **Global Plot Controls** and a group's **Group Plot Controls** show **Dimension slices** and **Plot parameters** only, no **Time range**.
2. Settings UI → search `Time Controls` → no Scientific Data Viewer result.
3. Add `"scientificDataViewer.globalTimeControls": true` to `settings.json` → the key is greyed out (_Unknown Configuration Setting_), no error notification; **Reload Window** → the viewer opens and plots as before. Remove the line.
4. Type `0` : `24` : `2` in the `time` slice → **Create Plot** → every other time step, as the time range used to allow by date.

### T32. Paranoia (contributors)

**Expect:** one command reports whether the branch can be published, and leaves the working tree as it was.

**Test:**

1. `./paranoia.sh --list` → 27 steps with their profile.
2. `./paranoia.sh --quick` → one line per step, then `VERDICT: NOT FULLY VERIFIED` at best (not a full run); `artefacts/paranoia/latest/REPORT.md` has the table of checks, each linked to its log.
3. `git status` → unchanged by the run. If pre-commit would reformat files, `pre-commit.patch` is in the run folder and the `pre-commit` row is `FAIL`.
4. Change one word of `README.md`, `./paranoia.sh --only readme` → `FAIL`, exit code 1, the report shows the diff; `git checkout README.md`.
5. `./paranoia.sh --full` before publishing (opens VS Code windows; needs uv; the v0.12.1 `.vsix` is rebuilt from its tag into `artefacts/vsix-releases/` when missing) → `READY` or `READY AFTER REVIEW`; read each warning.
6. Migration of a single pair, like a user: `scripts/upgrade-sandbox.sh --old artefacts/vsix-releases/scientific-data-viewer-0.13.0.vsix --new artefacts/vsix-releases/scientific-data-viewer-0.13.0.vsix --expect keep` (after `npm run package`) → _Expected: keep: same revision 2 and same requirements_, the environment is kept and the viewer shows the file; the same command with `--bump-new --expect rebuild` → _Expected: rebuild: environment revision 2 < 3_, the environment is deleted and recreated; `settings.json` unchanged in both.
7. On GitHub: create the label once (`gh label create paranoia`), push the branch, add the label **`paranoia`** to its pull request → a **Paranoia (publication readiness)** run starts (about 75 min); at the end its summary page shows the verdict and the report, and the artifact `paranoia-full-<n>` holds the logs, plot differences, screenshots and the `.vsix`. Remove the label to stop the runs on later pushes.
8. `./paranoia.sh --list` → a `LIMIT` column. Interrupted rebuild alone: `scripts/upgrade-sandbox.sh --scenario interrupted` (after `npm run package`) → _previous environment moved aside during the rebuild_ **PASS**, then _All checks passed_ in about 2 min.

### T33. GRIB with `ECCODES_DEFINITION_PATH` set

**Expect:** GRIB files open with the extension's own environment whatever `ECCODES_DEFINITION_PATH` says; your own interpreters still get it.

**Test:**

1. Point the variable at definitions eccodes 2.47 cannot use: those of an old system install (2.31 in the case found), or a folder with an empty `boot.def` (`mkdir /tmp/bad-definitions && touch /tmp/bad-definitions/boot.def`), and start VS Code from that shell: `ECCODES_DEFINITION_PATH=/tmp/bad-definitions code .`
2. With `useExtensionOwnEnvironment` on, open `artefacts/sample-data/sample_data.grib` → it loads (variable `t`, 4 times); the output channel shows `ECCODES_DEFINITION_PATH (/tmp/bad-definitions) is not passed to the extension's own environment`.
3. Set `scientificDataViewer.python.overridePythonInterpreter` to the same environment's `bin/python` and **Refresh** → an error again (your interpreter, your variables): `No valid message found` with old definitions; with the empty `boot.def`, eccodes aborts the Python process (exit code 134). Remove the setting.

### T34. High contrast themes

**Expect:** code blocks readable and the xarray repr dark in High Contrast Dark, readable in High Contrast Light.

**Test:**

1. **Preferences: Color Theme** → **Light High Contrast**, open `artefacts/sample-data/sample_data.nc` → the **File Path** and the **Xarray Text Representation** are black text on light gray.
2. Switch to **Dark High Contrast** (viewer left open) → the **Xarray HTML Representation** turns dark (light text, dark gray rows) without **Refresh**; the file path and text representation are white on black.
3. **Create Plot** on a variable → dark plot (`dark_background`), unless `scientificDataViewer.matplotlibStyle` is set.
4. Switch back to **Light High Contrast** → the xarray repr turns light again.
5. In **Dark High Contrast**, set `scientificDataViewer.webviewExportTheme` to `Default Light+` and export the webview → in the browser, the xarray repr is light.

### T35. Variables of 0 bytes (empty dimension)

**Expect:** a variable over a dimension of length 0 shows **Empty** in its size column, and its row lines up with the others.

**Test:**

1. Run `python python/create_sample_data.py` if `artefacts/sample-data/sample_data_empty_dimension.nc` is missing, then open it.
2. In **Group: /** → **Dimensions**: `obs: 0, time: 4`.
3. **Coordinates**: `obs` reads `(0)` then **Empty**; `time` reads `32 B`.
4. **Variables**: `measurement` (`(0)`) and `flag` (`(4, 0)`) read **Empty**, `temperature` reads `32 B`; the dims, dtype, shape and size columns are aligned on all five rows.

**Failure mode:** the size column missing on the 0-byte rows, the dtype and shape shifted to the right compared with `temperature`.

### T36. Release review fixes

**Expect:** the fixes of the [release review](./REVIEWS_0.13.0.md#3-release-review) hold.

**Test:**

1. Open `sample_data.nc`, click **Export** (header), wait more than 60 s in the save dialog, then save: the file is written and no "Request timeout" error appears. Do the same with **Save As** on a plot.
2. Click **Export** and close the dialog with **Cancel**: no error in the viewer.
3. Copy `artefacts/sample-data/sample_zarr_v3.zarr.zip` to `/tmp/gone.zip`, open the copy, delete it, click **Refresh**: the error says `No such file or directory`, not "not a Zarr store".
4. In `settings.json`, add `"scientificDataViewer.defaultView": "default"`: VS Code greys it out as an unknown setting; nothing else changes.
5. With `useExtensionOwnEnvironment` on, run **Manage Extension Virtual Environment → Recreate**, and while it runs click an **Install** button of a missing optional package (e.g. open `sample_data.kerchunk.json` without `kerchunk`): the install starts after the recreate ends (**Show Extension Logs**), and both succeed.
6. In `settings.json`, change `overridePythonInterpreter` and `python.useExtensionOwnEnvironment` in one save: the logs show both `SDV configuration updated` lines.
7. Open a file that takes several seconds to load (e.g. a large GRIB or a remote-mounted NetCDF) and close its tab while it loads: `ps aux | grep get_data_info` shows no process left, and the logs say `Aborting operation: info-…`.

**Failure mode:** "Request timeout" while the dialog was still open; an error for a cancelled dialog; the install running during the recreate (uv errors on a missing folder); a `get_data_info.py info` process still running after its tab was closed.

---

### T37. Marketplace listing

**Expect:** the new display name appears only where the Marketplace shows it; the UI keeps `Scientific Data Viewer`.

**Test:**

1. Install the `.vsix` (`npm run package`). In the **Extensions** view, the extension reads `Scientific Data Viewer – NetCDF, Zarr, HDF5, GRIB, GeoTIFF`, with the new description; its details page shows the new README with the large plot image at the top (images load from GitHub once the branch is merged on `main`).
2. Open `sample_data.nc`: the viewer title and the **Outline** top entry read `Scientific Data Viewer`, not the long name.
3. **Show Extension Logs**: the output channel is still named `Scientific Data Viewer` in the dropdown.
4. Hover the status bar item: the tooltip starts with `Scientific Data Viewer - State`.
5. **Run Healthcheck**: the report names `Scientific Data Viewer`.
6. After publishing: search "netcdf" on the Marketplace website and in the Extensions view; note the rank (was 11th) in the growth plan (`docs/GROWTH_PLAN.md`, branch `eschalk/growth-plan`).

**Failure mode:** the long name in the viewer title, outline, output channel or error messages; broken images on the README.

---

### T38. Zipped Zarr on click, Kerchunk install link, new samples

**Expect:** `*.zarr.zip` opens in the viewer on a double click (Zarr editor) while a bare `.zip` is not claimed; the error page offers **Install kerchunk**; `python/create_sample_data.py` writes the `kerchunk/` folder and the `.zip` variants.

**Test:**

1. `python python/create_sample_data.py` (with `kerchunk` installed): `artefacts/sample-data/kerchunk/` holds 3 `.nc` files and 5 references; `sample_zarr_v3.zip`, `sample_zarr_v2_root.zarr.zip`, `sample_zarr_v2_root.zip` exist.
2. Manual test plan B5 steps 2–4, B12 steps 5–7, B13 step 4.
3. **Open Scientific Data Viewer** from the command palette: the file picker lists `*.zarr.zip` files under **Scientific Data Files** and **Zarr (ZIP)**.
4. Select an interpreter without `kerchunk` (e.g. the extension's own environment) and open `sample_data.kerchunk.json`: the error page lists **Kerchunk / virtual Zarr: Install kerchunk** under "Install additional packages for format"; clicking it installs `kerchunk` (**Show Extension Logs**), then **Refresh** opens the file.
5. Automated: `env -u ELECTRON_RUN_AS_NODE node scripts/qa/e2e/runner.cjs zip-kerchunk scripts/qa/e2e/suite/s1_open.test.cjs scripts/qa/e2e/suite/s2_kerchunk.test.cjs` (the `default editor of …` cases check the association in a real VS Code).

**Failure mode:** a double click on any `.zip` opening the viewer (ordinary archives hijacked); `*.zarr.zip` opening as binary; the combined Kerchunk reference showing 4 time steps instead of 12 (time units differing between the files).

---

### T39. Getting Started walkthrough

**Expect:** a new user can go from install to a first plot with the walkthrough alone.

**Test:**

1. Build the `.vsix` from the current commit and check that it has the walkthrough (a `.vsix` left in `artefacts/vsix-releases/` by an older `npm run package` does not; `paranoia.sh` builds its own in `artefacts/paranoia/<run>/` and leaves that folder alone):

   ```bash
   npm run package
   unzip -p artefacts/vsix-releases/scientific-data-viewer-0.13.0.vsix extension/package.json | grep -c '"gettingStarted"'   # 1, not 0
   ```

   Then start a clean VS Code with it (delete the folders first if an earlier test used them, else the old extension stays installed):

   ```bash
   rm -rf /tmp/sdv-clean /tmp/sdv-clean-ext
   code --user-data-dir /tmp/sdv-clean --extensions-dir /tmp/sdv-clean-ext --install-extension artefacts/vsix-releases/scientific-data-viewer-0.13.0.vsix
   code --user-data-dir /tmp/sdv-clean --extensions-dir /tmp/sdv-clean-ext
   ```

   The Welcome page lists **Get Started with Scientific Data Viewer** under _Walkthroughs_ (click _More…_ if only the built-in ones show). It also opens with _Help: Welcome_ → _Walkthroughs_, or **Scientific Data Viewer: Open Getting Started Walkthrough**.

2. Each of the four steps shows its page (headings, tables, code block render) and its buttons.
3. **Open Sample File**: `sample_climate.nc` opens in the viewer, from `…/globalStorage/eschalk0.scientific-data-viewer/samples/`. **Create Plot** on `tas_global_mean`, `sftlf` and `tas` (one map per month → 12 panels); `/stations/tas` draws a station × time image (x = `time`, hue = `station` gives lines). The step gets its checkmark.
4. **Save** a plot: the PNG lands next to the copy in global storage, not in the extensions folder.
5. **Let the Extension Manage Python (uv)** with no extension environment: a progress notification, then `useExtensionOwnEnvironment` is on and the sample opens with that environment. Run it again: the environment is reused. With `uv` not on the PATH: an error with the uv installation link.
6. **Use My Own Interpreter**: with the Python extension, _Python: Select Interpreter_ opens; without it (`--disable-extension ms-python.python`), the `overridePythonInterpreter` setting opens.
7. **Manage Extension Virtual Environment → Create** (after **Delete**): a progress notification while it runs.

**Failure mode:** a step page empty or a broken image; a button that does nothing ("command not found"); the sample opened from the extensions folder; the checkmark never appears.

---

## Cleaning up after testing

- **VS Code:** remove the lines you added to your user settings JSON (at least `overridePythonInterpreter` if you don't want it). Keep or uninstall the VSIX as you like.
- **Test files:** the extra files from A4 can be deleted:

  ```bash
  rm -rf artefacts/sample-data/my_v2_store artefacts/sample-data/not_zarr.zip artefacts/sample-data/my_refs.json artefacts/sample-data/fake.safe
  ```

---

## When a test fails

1. Note the test number (e.g. **B12**).
2. Open the logs: **Ctrl+Shift+P** → `Scientific Data Viewer: Show Extension Logs`.
3. Copy the last red/`ERROR` lines and the exact message shown in the viewer.
4. Write them in the results sheet "Notes" column. That is enough for a developer to reproduce.

Tip: the logs contain a line `Full command (copy-paste): …`. Running that line in the terminal reproduces the problem without VS Code.

---

## Results sheet

Copy this table into your notes or the merge request and fill it in.

| Test                                       | Result | Notes |
| ------------------------------------------ | ------ | ----- |
| A3 Automated checks                        |        |       |
| A4 Test files created                      |        |       |
| A5 VSIX built and installed (0.13.0)       |        |       |
| B1 Healthcheck                             |        |       |
| B2 Zarr v3 label                           |        |       |
| B3 Zarr v2 label                           |        |       |
| B4 Zarr folder without `.zarr`             |        |       |
| B5 Zarr in ZIP                             |        |       |
| B5 `.zarr.zip` on click, `.zip` from menu  |        |       |
| B6 Normal ZIP error                        |        |       |
| B7 Sharded Zarr encoding                   |        |       |
| B8 Encoding setting off/on                 |        |       |
| B9 NetCDF filters                          |        |       |
| B10 NetCDF engine order                    |        |       |
| B11 Inherited coordinates                  |        |       |
| B12 Kerchunk open + plot                   |        |       |
| B12 `kerchunk/` combined + inline samples  |        |       |
| B13 Open as Kerchunk                       |        |       |
| B14 COG label                              |        |       |
| B15 col_wrap auto / number                 |        |       |
| B16 facetgridFigsize                       |        |       |
| B17 Empty selection message                |        |       |
| B18 No `.safe` menu                        |        |       |
| B19 uv environment auto-rebuild            |        |       |
| B19 failed rebuild keeps old env, retries  |        |       |
| B19 Recreate action                        |        |       |
| B20 Real upgrade 0.12.1 → 0.13 (optional)  |        |       |
| B21 GRIB / TIFF with own environment       |        |       |
| B22 Code review fixes                      |        |       |
| B23 Old xarray message (optional)          |        |       |
| B24 No plot type drop-down                 |        |       |
| B25 Variable sections, Xarray Encoding     |        |       |
| B26 Plot controls layout                   |        |       |
| B27 Dimension slices boxes and slider      |        |       |
| B28 One setting changed, rest automatic    |        |       |
| B26 Cancel one plot                        |        |       |
| B27 Load time in local time                |        |       |
| Upgrade sandbox script (UPGRADE_TEST_PLAN) |        |       |
| C Old formats, export, outline             |        |       |
| D1 Issue forms optional (after merge)      |        |       |

**Ready to ship** when every line of Parts A–C is ✅ (B20 is optional but recommended). **D1** is checked right after the merge.
