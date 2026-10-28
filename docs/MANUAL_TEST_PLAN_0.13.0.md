# Manual Test Plan — v0.13.0

A step-by-step checklist to confirm v0.13.0 is ready to ship. You do **not** need to know the file formats: every step says exactly what to click and what you should see.

- **Time needed:** about 1 h 45 for everything (Part A ≈ 20 min, Part B ≈ 1 h 30, Part C ≈ 10 min). Part D is done later, after the merge.
- **How to use it:** do the steps in order. After each test, tick ✅ or ❌ in the [results sheet](#results-sheet) at the end. If something fails, see [When a test fails](#when-a-test-fails).
- For the technical background of each feature, see [`RELEASE_NOTES_0.13.0.md`](./RELEASE_NOTES_0.13.0.md).

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
- golden check ends with `… cases, 0 failing`. (If it says `NEW … run record` for every case, your snapshot folder is empty: run `python python/tools/golden_snapshots.py record` on a known-good commit first, or skip this line.)
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
    "sample-data/my_v2_store", zarr_format=2, mode="w")
# 2. An ordinary ZIP that is NOT a Zarr store
with zipfile.ZipFile("sample-data/not_zarr.zip", "w") as z:
    z.writestr("hello.txt", "just a text file")
# 3. A copy of the Kerchunk file with an ordinary .json name
shutil.copy("sample-data/sample_data.kerchunk.json", "sample-data/my_refs.json")
# 4. An empty file with the old Sentinel ".safe" extension
open("sample-data/fake.safe", "w").close()
print("done")
EOF
```

✅ It prints `done`.

### A5. Build and install the extension (the real package users get)

```bash
npm run package
```

✅ A file `scientific-data-viewer-0.13.0.vsix` appears in the project folder.

Install it:

1. Open the Extensions panel (**Ctrl+Shift+X**).
2. Click the **`…`** menu at the top of the panel → **Install from VSIX…**
3. Choose `scientific-data-viewer-0.13.0.vsix`.
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

In all tests, files are in the **`sample-data`** folder of the Explorer (left sidebar, **Ctrl+Shift+E**). "Open a file" means **click it once**; it opens in the Scientific Data Viewer. "Right-click" means right-click it in the Explorer.

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

### B6. A normal ZIP gives a clear message

1. Right-click **`not_zarr.zip`** → **Open Scientific Data Viewer**.

✅ An error says the archive **is not a Zarr store** (mentions `zarr.json` / `.zgroup`). ❌ if it talks about "missing dependencies" with an empty list.

### B7. Sharded Zarr shows its compression details

1. Right-click the folder **`sample_zarr_v3_sharded.zarr`** → **Open Scientific Data Viewer (Folder)**.
2. Find the variable **`reflectance`** and look at its attributes (click it to expand if needed).

✅ You see lines starting with `__xarray_encoding.`, including **`__xarray_encoding.shards`** = `[32, 32]` and **`__xarray_encoding.compressors`** mentioning `zstd`.

### B8. Turning off the encoding details hides them

1. In your settings JSON add: `"scientificDataViewer.showXarrayEncodingAttributes": false,` → save.
2. Back in the viewer of B7, press **🔄 Refresh**.

✅ The `__xarray_encoding.…` lines are gone.

3. Remove that line from the settings (or set it to `true`), save, **🔄 Refresh** → the lines come back.

### B9. Compressed NetCDF shows its compression ("filters")

1. Open **`sample_netcdf_gzip.nc`**.
2. Look at the attributes of variable **`air_temperature`**.

✅ You see **`__xarray_encoding.filters.zlib`** = `True` and **`__xarray_encoding.filters.complevel`** = `4`.

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

2. Open **Global Plot Controls** and, under **Dimension Slices (passed to isel)**, type `0` for **time** (one time step; the full file is too big to plot within the time limit).
3. Click **Create Plot** on **`temperature`**.

✅ A map appears within a few seconds. (This reads real data from `sample_data.nc`, next to the `.json` file.)

4. Clear the **time** box again.

### B13. An ordinary-named JSON opens only on request

1. Click **`my_refs.json`** (created in A4).

✅ It opens as **normal text**, not in the viewer.

2. Right-click **`my_refs.json`** → **Open as Kerchunk / virtual Zarr**.

✅ The viewer opens with the same variables as B12.

3. In the Explorer, go to the project root, right-click **`package.json`** → **Open as Kerchunk / virtual Zarr**.

✅ An error says it is **not a Kerchunk / virtual Zarr reference**. Nothing else breaks.

### B14. Cloud Optimized GeoTIFF is labelled

1. Open **`sample_data_cog.tif`**. ✅ **Format:** `Cloud Optimized GeoTIFF (COG)`.
2. Open **`sample_data.tif`**. ✅ **Format:** `GeoTIFF` (a normal one).

### B15. Plot grids: automatic number of columns

This uses a file with 24 time steps; we plot several time steps side by side ("facets").

1. Open **`hs-issue-0117.nc`** (if you don't have it, use `sample_data.nc4` and its variable `temperature`).
2. Open the **Global Plot Controls** section.
3. Under **Dimension Slices (passed to isel)**, type `0:6` for **time** (this keeps time steps 0 to 5).
4. Under **Plot Parameters (passed to plot)**, set **col:** to `time`.
5. Next to **col_wrap:**, tick **auto**.

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

### B17. Empty time range gives a clear message (bug fixed during the refactor)

1. In settings add: `"scientificDataViewer.globalTimeControls": true,` → save → **Reload Window**.
2. Open **`sample_data.netcdf`**.
3. In **Time Controls**, choose `time` as the datetime variable, **Start Time** `2020-01-02`, **End Time** `2020-01-04`.
4. **Create Plot** on **`precipitation`**.

✅ The error reads **"No data to plot: dimension(s) time are empty after selection. Check the time range …"** ❌ if it says `ZeroDivisionError`.

5. Change to **Start Time** `2020-01-15`, **End Time** `2020-04-15`, **Create Plot**.

✅ A plot appears; its title mentions the start and end times.

6. Click **Clear Time Controls**; remove the `globalTimeControls` line, save.

### B18. Sentinel ".safe" is no longer offered

1. Right-click the file **`fake.safe`** (created in A4) in `sample-data`.

✅ There is **no** "Open Scientific Data Viewer" entry for it. (Folders, such as `broken_file.safe`, always offer "Open Scientific Data Viewer (Folder)" — that is expected.)

### B19. The extension's own Python environment updates itself

The extension can manage its own Python installation (the "uv environment"). When a new version needs newer packages, v0.13 upgrades that installation by itself, once, instead of asking the user to do it. (People who chose their own Python must still update it themselves; the extension never touches it.)

1. In your settings JSON, **temporarily remove** the `overridePythonInterpreter` line (from A6) and add:
   `"scientificDataViewer.python.useExtensionOwnEnvironment": true,` → save → **Reload Window**.
2. Wait until the extension has finished setting up. One of two things happens, both are fine:
   - **No environment yet on this computer:** it is created (a few minutes the first time; **Show Extension Logs** says when it is ready).
   - **An environment from an older version already exists:** you already see the notification of step 4 below. That is the feature working; note ✅ for step 4 and go on.

   Then open any `.nc` file to check it works.

3. Pretend this environment comes from an older version: in the terminal run

   ```bash
   rm ~/.config/Code/User/globalStorage/eschalk0.scientific-data-viewer/python-environment/sdv-environment.json
   ```

4. **Reload Window**.

✅ A notification says **"Scientific Data Viewer: updating its Python environment for this new version…"**, then **"Scientific Data Viewer: Python environment updated for this new version."**

5. **Reload Window** once more.

✅ **No** update notification this time, and files open immediately (the logs say `Extension virtual environment is up to date`).

**When the update cannot run** (e.g. no internet). We simulate it by hiding the `uv` program for a moment:

6. In the terminal (keep the same terminal open until step 9):

   ```bash
   rm ~/.config/Code/User/globalStorage/eschalk0.scientific-data-viewer/python-environment/sdv-environment.json
   UV="$(which uv)"; mv "$UV" "$UV.off"; echo "uv hidden: $UV.off"
   ```

7. **Reload Window**.

✅ A **warning** says the Python environment **could not be updated** and that the previous environment is used for now.

8. Open any `.nc` file.

✅ It still opens normally (the old environment was kept, not deleted).

9. Put `uv` back, in the same terminal:

   ```bash
   mv "$UV.off" "$UV"; uv --version
   ```

   ✅ It prints a uv version. Then **Reload Window**.

✅ The update now runs: the **"updating…"** then **"updated"** notifications appear (the retry happens by itself).

10. Put back your settings from A6 (re-add `overridePythonInterpreter`, remove `useExtensionOwnEnvironment`), save, **Reload Window**.

### B20. (Optional, recommended) Real upgrade from v0.12, like a user

This repeats B19 the way users will live it: they have v0.12 with its own environment, and the Marketplace updates them to v0.13.

1. In the Extensions panel, click **Scientific Data Viewer** → the gear ⚙ → **Install Specific Version…** (called **Install Another Version…** in some VS Code versions) → choose **0.12.1** → **Reload**.
2. In settings: remove `overridePythonInterpreter`, add `"scientificDataViewer.python.useExtensionOwnEnvironment": true,` → save → **Reload Window**. Wait until the environment is ready (logs), and open a `.nc` file.
3. Install the v0.13 package again, exactly as in **A5** (Install from VSIX… → `scientific-data-viewer-0.13.0.vsix` → Reload).

✅ At the first start of v0.13, the **"updating its Python environment for this new version…"** notification appears once, then **"updated"**. Files open; B1 (Healthcheck) shows no "too old" warning.

4. **Reload Window**. ✅ No notification any more.
5. Put back your settings from A6, save, **Reload Window**.

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

## Cleaning up after testing

- **VS Code:** remove the lines you added to your user settings JSON (at least `overridePythonInterpreter` if you don't want it). Keep or uninstall the VSIX as you like.
- **Test files:** the extra files from A4 can be deleted:

  ```bash
  rm -rf sample-data/my_v2_store sample-data/not_zarr.zip sample-data/my_refs.json sample-data/fake.safe
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

| Test                                      | Result | Notes |
| ----------------------------------------- | ------ | ----- |
| A3 Automated checks                       |        |       |
| A4 Test files created                     |        |       |
| A5 VSIX built and installed (0.13.0)      |        |       |
| B1 Healthcheck                            |        |       |
| B2 Zarr v3 label                          |        |       |
| B3 Zarr v2 label                          |        |       |
| B4 Zarr folder without `.zarr`            |        |       |
| B5 Zarr in ZIP                            |        |       |
| B6 Normal ZIP error                       |        |       |
| B7 Sharded Zarr encoding                  |        |       |
| B8 Encoding setting off/on                |        |       |
| B9 NetCDF filters                         |        |       |
| B10 NetCDF engine order                   |        |       |
| B11 Inherited coordinates                 |        |       |
| B12 Kerchunk open + plot                  |        |       |
| B13 Open as Kerchunk                      |        |       |
| B14 COG label                             |        |       |
| B15 col_wrap auto / number                |        |       |
| B16 facetgridFigsize                      |        |       |
| B17 Empty time range message              |        |       |
| B18 No `.safe` menu                       |        |       |
| B19 uv environment auto-update            |        |       |
| B19 failed update keeps old env, retries  |        |       |
| B20 Real upgrade 0.12.1 → 0.13 (optional) |        |       |
| C Old formats, export, outline            |        |       |
| D1 Issue forms optional (after merge)     |        |       |

**Ready to ship** when every line of Parts A–C is ✅ (B20 is optional but recommended). **D1** is checked right after the merge.
