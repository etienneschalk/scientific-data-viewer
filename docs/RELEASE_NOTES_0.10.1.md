# Scientific Data Viewer v0.10.1 Release Notes

**TL;DR** — **Issue #128 fixed**: The colormap (cmap) you select in **Group Plot Controls** or **Global Plot Controls** is now applied to 2D+ plots. Previously it was ignored and the default (e.g. viridis) was used. Logging was improved so extension and Python logs accurately report which colormap is sent and used.

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

No breaking changes. After updating to 0.10.1, any cmap you set in plot controls will be applied to 2D+ plots.

## Summary of changes

| Area       | Change                                                                 |
| ---------- | ---------------------------------------------------------------------- |
| **Fixed**  | Issue #128: cmap from Group/Global Plot Controls now applied to plots  |
| **Backend**| User-provided plot branch uses `plot.imshow()` with cmap when 2D+      |
| **Logging**| Python and extension logs reflect actual cmap sent and used             |
