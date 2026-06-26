# Scientific Data Viewer v0.12.0 Release Notes

**TL;DR** — Faster file opens ([#131](https://github.com/etienneschalk/scientific-data-viewer/issues/131)): persistent Python worker, lazy xarray repr loading, optional outline, timing logs. NetCDF `.nc` opens fixed when worker emitted bare `NaN` in JSON.

## Performance ([#131](https://github.com/etienneschalk/scientific-data-viewer/issues/131))

Opening a scientific file used to pay repeatedly for Python cold start, full xarray HTML/text repr generation, outline tree building, and large JSON payloads. v0.12.0 targets **time until structure and variables are visible**.

### Timing instrumentation

Stage timings are logged with the `⏱️` prefix:

- **Extension host**: `setHtml`, Python init, `getDataInfo`, `postMessage`, worker execute vs spawn
- **Webview console**: `displayAll` total time, per lazy-repr fetch

Check the **Scientific Data Viewer** output channel and webview DevTools.

### Persistent Python worker (default: **on**)

`scientificDataViewer.persistentPythonWorker`

A long-lived `python/python_worker.py` process handles `get_data_info.py` calls over JSON-lines on stdin/stdout, so numpy/xarray import cost is paid once per session instead of on every file open.

- **Plots** still use a one-shot `spawn` so abort/timeout keeps working.
- **Fallback**: if the worker fails, the extension falls back to spawn automatically.
- **Shutdown**: worker stops on extension deactivate or Python environment refresh.

### Outline build toggle (default: **off**)

`scientificDataViewer.outlineEnabled`

When **off** (new default), the extension skips building the **Scientific Data Structure** sidebar tree (`HeaderExtractor` / `OutlineProvider`) and does not register the outline view at activation. The Explorer pane is hidden entirely via a `when` clause on `config.scientificDataViewer.outlineEnabled` (no empty view or data-provider error).

Set to `true` and **reload the window** to register the tree provider and show the sidebar.

### Lazy repr loading (default: **on**)

`scientificDataViewer.lazyReprLoading`

**Initial load** runs `info` with `--skip-reprs`: dimensions, coordinates, variables, and attributes appear **without** generating xarray HTML/text repr strings (often the slowest part for large or multi-group files).

**Repr sections** load only when you expand the corresponding `<details>` block. The webview sends a `getRepr` request; Python runs `repr` mode for that scope (root or group).

The root **Xarray HTML Representation** section is **collapsed by default** so repr work is not triggered until you expand it.

Set `lazyReprLoading` to `false` to restore the pre-0.12 behaviour (all reprs generated on first load).

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

## Bug fix: NetCDF files not opening with worker

Worker responses initially used plain `json.dumps`. NetCDF metadata often includes `__xarray_encoding._FillValue: NaN`. Python emits the bare token `NaN`, which **`JSON.parse` in Node rejects** (unlike Python’s `json.loads`). File opens failed with `Invalid JSON line` in the logs.

Worker stdout now uses `to_json_best_effort` — the same serializer as the spawn/CLI path — so NaN and similar values are safe for the extension host.

## New settings (summary)

| Setting                  | Default | Effect                                       |
| ------------------------ | ------- | -------------------------------------------- |
| `persistentPythonWorker` | `true`  | Reuse Python process across opens            |
| `lazyReprLoading`        | `true`  | Structure first; reprs on section expand     |
| `outlineEnabled`         | `false` | Skip Scientific Data Structure sidebar build |
