# Performance roadmap (post v0.12.0)

Follow-up work identified during [#131](https://github.com/etienneschalk/scientific-data-viewer/issues/131) (faster file opens). v0.12.0 shipped the first wave; this document tracks **remaining and future optimizations**.

Related: [RELEASE_NOTES_0.12.0.md](./RELEASE_NOTES_0.12.0.md), [CHANGELOG](../CHANGELOG.md).

---

## Goal (unchanged)

Minimize **time until structure and variables are visible** — dimensions, coordinates, variables, and attributes — not necessarily every repr string, sidebar node, or exported snapshot.

Use `⏱️` logs in the **Scientific Data Viewer** output channel and webview DevTools to see which stage dominates for your files before picking work from this list.

---

## Shipped in v0.12.0

| Area              | What was done                                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Python**        | Persistent worker (`persistentPythonWorker`), lazy repr CLI (`--skip-reprs` / `repr` mode), `datetime_min_max_iso`, `to_json_best_effort` in worker                  |
| **Extension**     | `PerformanceTimer`, `DataInfoCache` (in-memory LRU), `PythonWorkerClient`, external webview assets via `asWebviewUri`                                                |
| **Webview**       | Lazy repr on section expand, collapsed root repr, loading status text, incremental **group** rendering (`>4` groups, rAF batches of 2), refresh/export button guards |
| **UI / Explorer** | Outline off by default (`outlineEnabled`); pane hidden when disabled                                                                                                 |
| **Testing**       | `sample_data_many_groups_light.nc` (28 groups), `sample_data_many_groups_light_x5.nc` (140 groups), pytest + `setup.sh` hooks                                        |
| **Fixes**         | Worker JSON NaN parse failure; [#139](https://github.com/etienneschalk/scientific-data-viewer/issues/139) full refresh reload                                        |

---

## Explicitly deferred from v0.12.0

These were called out in release notes as **not** in v0.12.0:

| Item                               | Problem                                                             | Current behaviour                                                                         | Likely direction                                                                             |
| ---------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Dynamic outline registration**   | Toggling `outlineEnabled` requires a window reload                  | Outline tree provider registers at extension activation                                   | Register/unregister outline provider when setting changes                                    |
| **Persistent cross-session cache** | Re-open after VS Code restart always hits Python                    | `DataInfoCache` is in-memory only; cleared on deactivate / Python env refresh             | On-disk cache keyed by `(path, mtime, config fingerprint)` with size limits and invalidation |
| **Full incremental DOM**           | Single group with thousands of variables still blocks the UI thread | Incremental render stops at **group** boundary (`INCREMENTAL_GROUP_RENDER_THRESHOLD = 4`) | Per-variable batching or virtual scrolling within `renderGroup` tables                       |

---

## Partially addressed — next logical steps

### Python / metadata path

| Item                                | Notes                                                                                                                                                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Structure walk on every open**    | `get_file_info()` still iterates every group, coordinate, and data variable even with `--skip-reprs`. Lazy reprs removed the heaviest cost; serialization of structure can still dominate on huge files. |
| **`xr.show_versions()` every open** | Captured on each `getDataInfo`; adds Python work and JSON payload size. Could be optional, cached, or moved behind a “Show versions” expand.                                                             |
| **Small-variable value loading**    | `smallVariableBytes` can still load many coordinate/array values into the metadata blob.                                                                                                                 |
| **Plots use spawn, not worker**     | Intentional today (abort/timeout). First plot may still pay import cost unless matplotlib is already warm. A worker-based plot path would need cancel semantics.                                         |
| **`DataTree.to_dict()` flattening** | Full tree flatten up front; worth profiling on deep DataTree files.                                                                                                                                      |

### Webview / DOM

| Item                                   | Notes                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Within-group tables**                | `renderGroup` still builds one HTML string per group. No rAF batching inside a group.                         |
| **Many lazy-repr expands**             | Each expand is a Python round-trip; fine for typical use, costly if user opens every section on a large file. |
| **Large nested attribute trees**       | v0.10.0 notes mentioned lazy expansion / virtualization for attributes; not implemented.                      |
| **Full metadata in one `postMessage`** | Extension sends the entire `dataInfo` object at once; no paging or progressive `displayDataInfo`.             |

### Outline (when `outlineEnabled: true`)

| Item                          | Notes                                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **`HeaderExtractor` on load** | `OutlineProvider.updateHeaders` runs when data loads. Reintroduces structure-proportional cost if outline is enabled. |

### UX / related (not strictly “open” perf)

| Item                                                                                            | Notes                                                                                                              |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Skeleton loading ([#43](https://github.com/etienneschalk/scientific-data-viewer/issues/43))** | v0.12.0 uses text-only “Loading data…” / “Refreshing data…”. Richer placeholder UX was considered but not shipped. |
| **Webview export**                                                                              | Full DOM capture; can be slow and produce very large HTML. Separate from open path but same webview heaviness.     |

---

## Suggested priority

Rough order if continuing #131 or a follow-up milestone:

| Priority | Item                                                                          | Primary beneficiary                                    |
| -------- | ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| **1**    | Per-variable incremental render or virtualization                             | `sample_data_many_vars.nc`, large single-group tables  |
| **2**    | Cross-session disk cache                                                      | Repeated opens of the same large unchanged file        |
| **3**    | Trim `getDataInfo` payload (defer `show_versions`, optional structure fields) | Large metadata JSON, slow `postMessage` / `displayAll` |
| **4**    | Dynamic outline toggle                                                        | Users who want the sidebar without reload              |
| **5**    | Attribute tree virtualization                                                 | Files with very deep/large attribute dicts             |
| **6**    | Plot worker (with abort design)                                               | First-plot latency after cold worker                   |

---

## Architectural / longer-term

- **Streamed or chunked metadata** — partial results to webview (structure first, details later).
- **Worker plots with cancellation** — reuse warm Python without losing abort UX.
- **True virtualization** — variables, attributes, or outline nodes; only fix for pathological single-table cases.
- **Export optimization** — lighter HTML generation instead of cloning live DOM.

---

## How to validate improvements

1. Open **Scientific Data Viewer** output channel; filter for `⏱️`.
2. Open webview DevTools; check `displayAll` and lazy-repr timings.
3. Manual samples:
   - `sample_data_many_groups_light.nc` / `_x5.nc` — multi-group UI
   - `sample_data_many_vars.nc` — many variables, one group
   - `sample_data_multiple_groups.nc` — typical multi-group
4. Toggle settings (`lazyReprLoading`, `persistentPythonWorker`, `dataInfoCacheMaxEntries`, `outlineEnabled`) and compare stage breakdowns.

---

## Document history

| Date       | Notes                                         |
| ---------- | --------------------------------------------- |
| 2026-06-26 | Initial roadmap after v0.12.0 / #131 delivery |
