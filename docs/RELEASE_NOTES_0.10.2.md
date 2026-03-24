# Scientific Data Viewer v0.10.2 Release Notes

**TL;DR** — The **robust** option in Global / Group Plot Controls (xarray: use 2nd/98th percentiles for color limits) is now applied to the actual matplotlib output, not only logged.

## Robust checkbox now affects the plot

When **robust** was enabled, the extension and Python logs correctly showed `robust: True`, but many code paths called `DataArray.plot.imshow()` with kwargs that only included aspect, size, col_wrap, and cmap. The `robust` flag was never forwarded to `imshow`, so color limits did not use the percentile-based scaling you expected.

### What changed

- The backend merges `_kwargs_for_imshow()` into every `var.plot.imshow(...)` call in `create_plot()` (auto strategies, user-provided facets/slices, and cmap-specific branches).
- `_kwargs_for_imshow()` mirrors the usual plot kwargs but omits `cmap` (passed explicitly) and `bins` (histogram-only).

### Where to use it

- **Global Plot Controls** → **robust** checkbox.
- **Group Plot Controls** → **robust** checkbox (inherits per field like other plot options).

No breaking changes. After updating to 0.10.2, enabling **robust** will change color scaling on supported rasters the same way as in [xarray’s plotting API](https://docs.xarray.dev/en/latest/user-guide/plotting.html).

## Summary of changes

| Area        | Change                                                                       |
| ----------- | ---------------------------------------------------------------------------- |
| **Fixed**   | `robust` applied to all `plot.imshow` paths in `create_plot`                 |
| **Backend** | `python/get_data_info.py`: `_kwargs_for_imshow()`, merged into imshow kwargs |
