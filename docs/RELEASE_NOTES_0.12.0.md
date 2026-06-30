# Scientific Data Viewer v0.12.0 Release Notes

**TL;DR** — Focused [#131](https://github.com/etienneschalk/scientific-data-viewer/issues/131) improvements with minimal architectural change: **performance logging**, **outline toggle** (hide pane when disabled), and **external webview assets** via `asWebviewUri`.

## Why this release?

v0.12.0 ships a small set of changes that improve observability and default load behaviour without introducing a persistent Python worker, lazy repr loading, or metadata caching.

| Area                | What v0.12.0 does                                                          |
| ------------------- | -------------------------------------------------------------------------- |
| **Observability**   | `PerformanceTimer` logs stage timings (`⏱️`) across the load path          |
| **Outline sidebar** | On by default; can be disabled via `outlineEnabled` (pane hidden when off) |
| **Webview assets**  | JS/CSS served via `asWebviewUri` instead of inlined on every panel open    |

**Goal:** make it easier to see where time is spent when opening files, reduce default sidebar work, and let the webview browser cache script/styles across panel opens.

---

## Performance logging

Stage timings are logged with the `⏱️` prefix via `PerformanceTimer`:

| Location                                                   | Stages logged                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| **Extension host** (Scientific Data Viewer output channel) | `setHtml`, Python init, `getDataInfo`, `python-exec`, `postMessage` |
| **Webview console** (DevTools)                             | Available when the webview script logs timings                      |

Use these logs to see which stage dominates for your files before considering larger architectural changes.

---

## Outline toggle

**Setting:** `scientificDataViewer.outlineEnabled` (default: **true**)

When enabled (default):

- Builds the **Scientific Data Structure** tree in the Explorer sidebar during load.

When disabled:

- Skips `HeaderExtractor` / `OutlineProvider` work during load.
- The Explorer pane is **hidden** via a `when` clause on `config.scientificDataViewer.outlineEnabled` — no empty view or “no data provider” error.

**After changing this setting**, **reload the window** (`Developer: Reload Window`) — the sidebar pane and tree provider register at activation.

---

## Order groups alphabetically ([#140](https://github.com/etienneschalk/scientific-data-viewer/issues/140))

**Setting:** `scientificDataViewer.orderGroupsAlphabetically` (default: **true**)

Multi-group NetCDF / DataTree files are flattened for display in the viewer. When enabled (**default**), group paths are sorted alphabetically. Disable to preserve the order from the file.

---

## Show xarray encoding attributes

**Setting:** `scientificDataViewer.showXarrayEncodingAttributes` (default: **true**)

When enabled (**default**), group, coordinate, and variable attribute tables include xarray encoding metadata as `__xarray_encoding.*` keys (for example `_FillValue`, `dtype`, chunking). Disable to hide these entries.

---

## External webview assets

Previously, every new panel inlined ~**174 KB** of JS and CSS into the HTML document.

v0.12.0 serves assets from `src/panel/webview/` via **`asWebviewUri`**:

```html
<link rel="stylesheet" href="…/styles.css" />
<script src="…/webview-script.js"></script>
```

| Detail                   | Behaviour                                                          |
| ------------------------ | ------------------------------------------------------------------ |
| **Browser cache**        | Script and styles can be reused across panel opens                 |
| **Dev mode**             | Cache-buster query param when `scientificDataViewer.devMode` is on |
| **Fallback**             | Inline JS/CSS when `asWebviewUri` is unavailable (e.g. unit tests) |
| **`localResourceRoots`** | Includes `src/panel/webview/`                                      |

---

## New settings (summary)

| Setting                        | Default | Effect                                                                                                                                         |
| ------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `outlineEnabled`               | `true`  | Build Scientific Data Structure sidebar; set `false` to skip for faster loads (reload window after toggle)                                     |
| `orderGroupsAlphabetically`    | `true`  | Sort multi-group paths alphabetically; set `false` for file order ([#140](https://github.com/etienneschalk/scientific-data-viewer/issues/140)) |
| `showXarrayEncodingAttributes` | `true`  | Show `__xarray_encoding.*` in attribute tables; set `false` to hide encoding metadata                                                          |

Performance logging has no user-facing setting — it is always on in the extension host for instrumented stages.

---

## Upgrade notes

- **Default:** `outlineEnabled` remains **on** (same as pre-0.12). Set to `false` and reload the window if you want to skip outline build for faster loads.
- **No breaking API changes** to plot JSON/CLI or webview message contracts.
- **Dev mode** (`scientificDataViewer.devMode`): still re-reads webview assets from disk (with cache-buster); useful when editing `webview-script.js` or `styles.css`.

---

## Deferred from this release

Larger [#131](https://github.com/etienneschalk/scientific-data-viewer/issues/131) items explored during development but **not** shipped in v0.12.0 include:

- Persistent Python worker
- Lazy xarray repr loading
- In-memory metadata cache (`DataInfoCache`)
- Incremental DOM / loading-status UX experiments

These can be revisited once timing logs show where time is spent for real workloads.

---

## Summary of changes

| Area              | Change                                                                                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Extension**     | `PerformanceTimer`, external webview assets, outline toggle, group order and encoding attribute flags ([#140](https://github.com/etienneschalk/scientific-data-viewer/issues/140)) |
| **Webview**       | External JS/CSS via `asWebviewUri`                                                                                                                                                 |
| **UI / Explorer** | Outline hidden when disabled; no data-provider error                                                                                                                               |
| **Tests**         | `PerformanceTimer`, `config.test.ts`, `python/test_display_feature_flags.py`                                                                                                       |
