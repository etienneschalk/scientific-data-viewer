# Scientific Data Viewer v0.10.1 Release Notes

**TL;DR** — **Issue #128 fixed**: The colormap (cmap) you select in **Group Plot Controls** or **Global Plot Controls** is now applied to 2D+ plots. **Issue #126**: Plot timeout is configurable so you can wait longer for expensive plots. Logging was improved so extension and Python logs accurately report which colormap is sent and used.

## Configurable plot timeout (Issue #126)

The timeout for matplotlib plot generation was previously hardcoded. You can now set **Plot Timeout (ms)** in extension settings to wait longer for heavy plots (e.g. large datasets) without having to slice the data first.

- **Setting:** `scientificDataViewer.plotTimeoutMs`
- **Default:** 20000 (20 seconds)
- **Range:** 1000 (1 s) to 600000 (10 minutes)
- **Where:** VS Code Settings → Scientific Data Viewer → **Plot Timeout (ms)**

The same value is used for the client (when the UI shows "timed out" and triggers abort) and the server (when the backend kills the Python process), so behaviour stays consistent. Example: set to **120000** for 2 minutes when you want a quicklook on huge data without manually slicing.

## Colormap (cmap) now applied (Issue #128)

When you set a **cmap** in the Dimension Slices / Plot Controls (e.g. `plasma`, `magma`, or any valid Matplotlib colormap name), the extension sends it to the Python backend and the backend was already receiving it. The bug was in the **plot path**: when you also use dimension slices, facet row/col, or other plot parameters (the “user-provided” branch), the backend used a helper that strips `cmap` and called generic `var.plot()`, which never applied your colormap. Only the “auto” plot path used `var.plot.imshow()` with cmap.

### What changed

- **User-provided branch**: For 2D+ variables, when a cmap is set, the backend now uses `var.plot.imshow()` with your cmap (and aspect, size, col_wrap as needed) instead of generic `var.plot()`, so the selected colormap is applied in all cases.
- **Logging**: Python logs when cmap is applied via `plot.imshow()` and which colormap is used in the auto branch; the extension logs the colormap it sends when creating a plot, so logs match what actually happens.

### Where to set cmap

- **Global Plot Controls** → Dimension Slices section → **cmap** text input.
- **Group Plot Controls** (per group) → **cmap** text input (group value overrides global when set).

Valid values are Matplotlib colormap names (e.g. `viridis`, `plasma`, `magma`, `cividis`). See [Matplotlib colormaps](https://matplotlib.org/stable/users/explain/colors/colormaps.html).

## Upgrading

No breaking changes. After updating to 0.10.1, any cmap you set in plot controls will be applied to 2D+ plots. The plot timeout is configurable (default 20s); increase it in settings if you need longer runs.

## Summary of changes

| Area        | Change                                                                 |
| ----------- | ---------------------------------------------------------------------- |
| **Added**   | Issue #126: Configurable plot timeout (`scientificDataViewer.plotTimeoutMs`) |
| **Fixed**   | Issue #128: cmap from Group/Global Plot Controls now applied to plots  |
| **Backend** | User-provided plot branch uses `plot.imshow()` with cmap when 2D+      |
| **Logging** | Python and extension logs reflect actual cmap sent and used            |
