# Scientific Data Viewer v0.12.0 Release Notes

**TL;DR** — Faster file opens ([#131](https://github.com/etienneschalk/scientific-data-viewer/issues/131)): persistent Python worker, lazy xarray repr loading, optional outline, metadata LRU cache, external webview assets, loading status, incremental group rendering, timing logs, and more efficient datetime bounds. **Refresh** ([#139](https://github.com/etienneschalk/scientific-data-viewer/issues/139)) fully reloads the webview; refresh and export buttons are disabled while their operation runs. NetCDF `.nc` opens fixed when the worker emitted bare `NaN` in JSON.

## Why this release?

Opening a scientific file used to pay repeatedly for:

| Stage                              | Typical cost                        | What v0.12.0 does                                  |
| ---------------------------------- | ----------------------------------- | -------------------------------------------------- |
| Python cold start                  | **0.5–3 s** per open                | Persistent worker amortizes imports                |
| xarray HTML/text reprs             | **File-dependent** (often dominant) | Lazy load on section expand (`--skip-reprs`)       |
| Outline tree build                 | **Proportional to structure**       | Off by default (`outlineEnabled`)                  |
| Full webview HTML rebuild          | **~50–200 ms** + script parse       | External JS/CSS via `asWebviewUri` (browser cache) |
| Re-open unchanged file             | Full Python round-trip              | LRU metadata cache                                 |
| Datetime min/max for time controls | Full `.values` load                 | xarray `.min()` / `.max()` reductions              |

**Goal:** minimize **time until structure and variables are visible** — dimensions, coordinates, variables, and attributes — not necessarily every repr string or sidebar node.

---

## Performance ([#131](https://github.com/etienneschalk/scientific-data-viewer/issues/131))

### Timing instrumentation

Stage timings are logged with the `⏱️` prefix via `PerformanceTimer`:

| Location                                                   | Stages logged                                                                                             |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Extension host** (Scientific Data Viewer output channel) | `setHtml`, Python init, `getDataInfo` (args → Python → cache hit), worker execute vs spawn, `postMessage` |
| **Webview console** (DevTools)                             | `displayAll` total time, per lazy-repr fetch                                                              |

Use these logs to see which stage dominates for your files and environment before toggling settings.

---

### Persistent Python worker (default: **on**)

**Setting:** `scientificDataViewer.persistentPythonWorker`

Each file open used to `spawn` a fresh Python process and re-import numpy, xarray, pandas, etc. A long-lived `python/python_worker.py` process now handles `get_data_info.py` calls over **JSON-lines RPC** on stdin/stdout.

| Behaviour                | Detail                                                               |
| ------------------------ | -------------------------------------------------------------------- |
| **What uses the worker** | `info` and `repr` modes (metadata and lazy repr fetches)             |
| **What still spawns**    | **Plots** — one-shot `spawn` keeps abort/timeout support             |
| **Fallback**             | If the worker fails, the extension falls back to spawn automatically |
| **Shutdown**             | Worker stops on extension deactivate or Python environment refresh   |

**When to disable:** rare worker stability issues; debugging Python import problems in isolation.

---

### Lazy repr loading (default: **on**)

**Setting:** `scientificDataViewer.lazyReprLoading`

**Initial load** runs `info` with `--skip-reprs`: dimensions, coordinates, variables, and attributes appear **without** generating xarray HTML/text repr strings (often the slowest part for large or multi-group files).

**Repr sections** load only when you expand the corresponding `<details>` block:

1. Webview sends a `getRepr` request (scope: `root` or `group`).
2. Python runs `repr` CLI mode for that scope only.
3. The section is filled in place.

The root **Xarray HTML Representation** section is **collapsed by default** so repr work is not triggered until you expand it.

Set `lazyReprLoading` to `false` to restore pre-0.12 behaviour (all reprs generated on first load).

#### Per-group repr sections (“for each group”) — what changed and why

Previously, both **root** repr sections and **“Xarray HTML/Text Representation (for each group)”** sections were filled immediately on load.

With lazy loading, behaviour depends on file structure:

| File shape                                               | “For each group” sections | Where to get reprs                                                                         |
| -------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| **Single root group** (`/` only) — typical `.nc` dataset | **Hidden** (on purpose)   | Use **root** “Xarray HTML/Text Representation”; expanding those loads the same repr lazily |
| **Multiple groups** — DataTree, multi-group NetCDF, etc. | **Still present**         | Each group is a nested `<details>`; expand a group to load **only that group’s** repr      |
| `lazyReprLoading: false`                                 | Same as before            | All reprs loaded up front; per-group blocks populated immediately                          |

**Why hide per-group reprs for a single `/` group?**

For a standard single-dataset file, the per-group repr for `/` is **the same content** as the root repr. Showing both duplicated Python work, JSON size, and UI. Hiding the redundant “for each group” blocks for that case keeps the common path simpler while preserving root repr access.

**Why lazy instead of immediate for multi-group files?**

Per-group repr generation runs `str(xds)` and `_repr_html_()` **once per group**. Deferring until expand avoids paying that cost for groups you never open.

**Manual tests**

- Single group: `sample-data/sample_data.nc` — root repr sections only; no “for each group” blocks
- Multi group: `sample-data/sample_data_multiple_groups.nc` — “for each group” sections visible; expand a group name to load its repr
- Many groups, lightweight: `sample-data/sample_data_many_groups_light.nc` — 28 small `sector_XX` groups (3×4×4 grid, 2 vars each); exercises incremental group rendering and multi-group metadata without a large file
- Many groups, lightweight (5×): `sample-data/sample_data_many_groups_light_x5.nc` — 140 groups (`sector_001` … `sector_140`), same tiny grid per group

---

### Outline build toggle (default: **off**)

**Setting:** `scientificDataViewer.outlineEnabled`

When **off** (new default):

- Skips `HeaderExtractor` / `OutlineProvider` work during load.
- The **Scientific Data Structure** Explorer pane is **hidden** via a `when` clause on `config.scientificDataViewer.outlineEnabled` — no empty view or “no data provider” error.

When **on:**

- Set `outlineEnabled` to `true`.
- **Reload the window** (`Developer: Reload Window`) — the sidebar pane and tree provider register at activation.

---

### Metadata cache (default: **8** entries)

**Setting:** `scientificDataViewer.dataInfoCacheMaxEntries`

`DataInfoCache` is an in-memory **LRU cache** for `getDataInfo` results. Re-opening an **unchanged** file (same path, modification time, and relevant settings) skips the Python round-trip.

| Detail                 | Behaviour                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Cache key**          | `(file path, mtime, config fingerprint)`                                                                          |
| **Config fingerprint** | `convertBandsToVariables`, `lazyReprLoading`, `smallVariableBytes`, `smallValueDisplayMaxLen`                     |
| **Default size**       | **8** entries                                                                                                     |
| **Disable cache**      | Set to **0**                                                                                                      |
| **Bypass cache**       | Click **Refresh** in the webview header (`forceRefresh`)                                                          |
| **Clear cache**        | Python environment refresh (`Refresh Python Environment`)                                                         |
| **Logging**            | Each store logs payload size at INFO, e.g. `[DataInfoCache] stored /path/file.nc (1.24 MB, mtime=…, entries=3/8)` |

Size is estimated from the UTF-8 byte length of the cached JSON payload (MB with two decimals; KB/B for smaller items). Useful for spotting unexpectedly large metadata responses.

**When to set `0`:** debugging stale metadata, memory constraints on very large files, or when you always want a fresh Python read.

---

### External webview assets

Previously, every new panel inlined ~**174 KB** of JS and CSS into the HTML document. The browser had to parse and execute the full inline script on each panel open (even though the source file was cached in production).

v0.12.0 serves assets from `src/panel/webview/` via **`asWebviewUri`**:

```html
<link rel="stylesheet" href="…/styles.css" />
<script src="…/webview-script.js"></script>
```

| Detail                   | Behaviour                                                               |
| ------------------------ | ----------------------------------------------------------------------- |
| **Benefit**              | Browser can cache script/styles across panel opens in the same session  |
| **Dev mode**             | Appends a cache-buster query param (`?v=…`) so edits reload immediately |
| **Fallback**             | Inline JS/CSS when `asWebviewUri` is unavailable (e.g. unit tests)      |
| **`localResourceRoots`** | Includes `src/panel/webview`                                            |

`setHtml()` is still called once per panel lifetime; data updates arrive via `postMessage` only (unchanged from pre-0.12).

---

### Efficient datetime bounds

Time variables (for Global / Group Time Controls) need min/max ISO timestamps. Previously the code used `coord.values.min()` / `.max()`, which loads the full coordinate array into memory.

New helper **`datetime_min_max_iso()`** uses xarray **`.min()` / `.max()`** on the `DataArray` directly. For chunked or dask-backed time dimensions, this can stay lazy instead of materializing the entire axis.

---

### Loading status while fetching

While Python fetches metadata, the webview shows **“Loading data…”** or **“Refreshing data…”** (and the filename when known), instead of leaving the panel blank.

- Triggered when the extension sets `isLoading` (initial open and refresh).
- The extension sets `currentFile` at the start of `getDataInfo` so the filename can appear immediately.
- Hidden when `displayAll` completes or on error.

---

### Incremental group rendering

For files with **more than 4 groups**, dimension/variable sections are inserted in batches of 2 per animation frame instead of one large `innerHTML` assignment. This keeps the UI thread responsive on multi-group DataTree and multi-group NetCDF files.

**Sample files for manual testing:** `sample_data_many_groups_light.nc` (28 groups) and `sample_data_many_groups_light_x5.nc` (140 groups), generated by `python/create_sample_data.py` or `./setup.sh`.

---

### Refresh button fix ([#139](https://github.com/etienneschalk/scientific-data-viewer/issues/139))

**Refresh** (🔄) now performs a **full reload** of the webview state:

| What happens   | Detail                                                                                |
| -------------- | ------------------------------------------------------------------------------------- |
| **View reset** | Clears groups, repr sections, plots, and global plot controls before new data arrives |
| **Cache**      | Invalidates and bypasses the metadata cache (`forceRefresh`)                          |
| **Plots**      | Cancels in-flight plot requests                                                       |
| **Lazy reprs** | Rebinds expand listeners once (no duplicate handlers on repeated refresh)             |

**Header button guards:** While a refresh or webview export is in progress, the corresponding header button is **disabled and grayed out**. Repeated clicks (or repeated Command Palette export invocations) are ignored until the operation completes. This prevents duplicate reloads or overlapping exports when users click rapidly.

---

## Bug fix: NetCDF files not opening with worker

Worker responses initially used plain `json.dumps`. NetCDF metadata often includes `__xarray_encoding._FillValue: NaN`. Python emits the bare token `NaN`, which **`JSON.parse` in Node rejects** (unlike Python’s `json.loads`). File opens failed with `Invalid JSON line` in the logs.

Worker stdout now uses **`to_json_best_effort`** — the same serializer as the spawn/CLI path — so NaN and similar values are safe for the extension host.

---

## New settings (summary)

| Setting                   | Default | Effect                                                                    |
| ------------------------- | ------- | ------------------------------------------------------------------------- |
| `persistentPythonWorker`  | `true`  | Reuse Python process across opens                                         |
| `lazyReprLoading`         | `true`  | Structure first; reprs on section expand                                  |
| `outlineEnabled`          | `false` | Skip Scientific Data Structure sidebar build (reload window after toggle) |
| `dataInfoCacheMaxEntries` | `8`     | LRU metadata cache size; **0** = disabled                                 |

All performance settings are under **Settings → Scientific Data Viewer** (orders 1009–1012).

---

## Upgrade notes

- **Defaults changed:** `outlineEnabled` is now **off**; `lazyReprLoading` and `persistentPythonWorker` are **on**. Existing workflows that rely on the outline sidebar should set `outlineEnabled: true` and reload the window.
- **No breaking API changes** to plot JSON/CLI or webview message contracts.
- **Refresh** always fetches fresh metadata (cache bypass). Toggling `lazyReprLoading`, `convertBandsToVariables`, or small-value display settings produces a new cache fingerprint automatically.
- **Dev mode** (`scientificDataViewer.devMode`): still re-reads webview assets from disk (with cache-buster); useful when editing `webview-script.js` or `styles.css`.

---

## What is not in v0.12.0

These were identified during the [#131](https://github.com/etienneschalk/scientific-data-viewer/issues/131) investigation but deferred:

| Item                               | Notes                                                               |
| ---------------------------------- | ------------------------------------------------------------------- |
| **Dynamic outline registration**   | Toggle `outlineEnabled` without a window reload                     |
| **Persistent cross-session cache** | Extension-side LRU only (not saved to disk)                         |
| **Full incremental DOM**           | Per-variable virtualization for extremely large single-group tables |

---

## Summary of changes

| Area              | Change                                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Python**        | Persistent worker, `repr` CLI mode, `--skip-reprs`, `datetime_min_max_iso`, `to_json_best_effort` in worker                                           |
| **Extension**     | `PerformanceTimer`, `DataInfoCache`, `PythonWorkerClient`, config getters, external webview assets                                                    |
| **Webview**       | Lazy repr fetch on expand, collapsed root repr, per-group repr rules, loading status, incremental group render, refresh/export button guards          |
| **UI / Explorer** | Outline hidden when disabled; no data-provider error                                                                                                  |
| **Tests**         | `PerformanceTimer`, `DataInfoCache`, cache hit/bypass, `test_performance_features.py`, `test_datetime_min_max.py`, `test_many_groups_light_sample.py` |
| **Sample data**   | `sample_data_many_groups_light.nc` (28 groups), `sample_data_many_groups_light_x5.nc` (140 groups) for load/UI testing                                |
