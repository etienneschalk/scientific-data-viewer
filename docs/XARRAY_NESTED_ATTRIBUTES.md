# xarray and nested attributes

This document records the Scientific Data Viewer’s need for better handling of **nested attributes** in scientific datasets, and how that relates to the [xarray](https://github.com/pydata/xarray) project.

## Context

Formats such as **Zarr** store group attributes in JSON (e.g. `.zattrs`). Those attributes can be deeply nested (objects and arrays). The current xarray APIs and built-in representations (e.g. HTML or text repr) typically expose attributes in a flat or single-level way, which makes it hard to inspect or document complex metadata in the IDE or in notebooks.

## SDV approach (Issue #120)

The Scientific Data Viewer addresses this on the **viewer side** by adding an optional **collapsible tree view** for group attributes (see [Issue #120](https://github.com/etienneschalk/scientific-data-viewer/issues/120)). When the user enables **Nested Attributes View**, the extension renders the full nested structure (as returned by xarray/Zarr) in an expandable/collapsible tree. No change to xarray is required for this.

## Upstream (xarray)

Improving the **representation of nested attributes** inside xarray itself (e.g. in `repr()`, HTML repr, or public APIs) would benefit:

- Users who work in Jupyter or other environments that rely on xarray’s built-in repr
- Downstream tools (including SDV) that might align with xarray’s representation
- Consistency when the same dataset is opened in xarray and in SDV

If you need first-class support for nested attributes in xarray’s APIs or reprs, consider opening or supporting a feature request on the xarray repository:

- **xarray GitHub:** <https://github.com/pydata/xarray>
- **xarray issue tracker:** <https://github.com/pydata/xarray/issues>

At the time of writing (v0.10.0), SDV does not maintain an open xarray issue for this; the above is for reference and for anyone who wants to drive an upstream improvement.
