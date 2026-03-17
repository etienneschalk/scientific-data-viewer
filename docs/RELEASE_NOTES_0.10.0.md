# Scientific Data Viewer v0.10.0 Release Notes

**TL;DR** — **Collapsible nested attributes view** (Issue #120): optional tree view for Zarr (and other formats) that store attributes as nested JSON. Enable via **Nested Attributes View** setting (off by default). Test data script now generates a Zarr store with deeply nested `.zattrs` for QA. Version bump to **0.10.0**.

## Collapsible nested attributes view (Issue #120)

Formats such as **Zarr** store group attributes in JSON (e.g. `.zattrs`). The previous UI showed only one level of attributes; nested structures were hard to read. This release adds an optional **tree view** so you can expand and collapse the full attribute hierarchy.

### Feature flag (opt-in)

- **Setting:** `scientificDataViewer.nestedAttributesView`
- **Default:** `false` (opt-in for initial release)
- **Location:** VS Code Settings → Scientific Data Viewer (or `.vscode/settings.json`)

When enabled, the **Attributes** section for each group is rendered as an expandable/collapsible tree instead of a flat list. Nested objects and arrays are shown as nodes you can open to inspect deeper levels. This is especially useful for Zarr datasets with complex metadata (e.g. CF conventions, producer-specific `.zattrs`).

### Use cases

- **Zarr users:** Open a Zarr dataset with complex `.zattrs` and expand the tree to see the full nested structure without copying JSON elsewhere.
- **Metadata inspection:** Browse the attribute tree in-context while viewing dimensions and variables.
- **Gradual rollout:** The feature is off by default so it can be validated with a subset of users before potentially becoming the default.

### Technical notes

- The backend already exposes nested attribute structures (e.g. from xarray/Zarr); the change is in the SDV webview, which now renders them as a tree when the flag is on.
- For very large attribute trees, only visible nodes are expanded; consider lazy expansion or virtualization in a future release if needed.
- Tree styling uses VS Code theme variables and follows the same patterns as other collapsible sections (e.g. `details`/`summary`).

## Test data: Zarr with deeply nested attributes

The sample data script (`python/create_sample_data.py`) now creates a Zarr store with **extremely nested** group attributes for testing this feature:

- **File:** `sample_zarr_deeply_nested_attrs.zarr`
- **Content:** Minimal array plus root `.zattrs` with 5–10 levels of nested dicts and mixed arrays/objects.
- **Purpose:** Regression testing and manual QA of the collapsible nested-attributes UI.

Run the script (e.g. from the repo root) to generate all sample files, including this one. Open the generated Zarr in the viewer and enable **Nested Attributes View** to see the tree.

## xarray and nested attributes (upstream)

The current xarray and SDV text/HTML representations show attributes in a limited way; nested structures are not always easy to read. Improving the representation of nested attributes in xarray’s APIs or built-in reprs would benefit both the library and downstream tools like SDV. Consider opening or supporting a feature request on the [xarray GitHub repository](https://github.com/pydata/xarray) if you need better first-class support for nested attributes in xarray itself. SDV’s collapsible tree view works with the nested structures that xarray already returns when reading Zarr (and similar) stores.

## Upgrading

After updating to 0.10.0, the nested attributes tree is **off by default**. To use it, enable **Nested Attributes View** in extension settings. No other breaking changes in this release.

## Summary of changes

| Area          | Change                                                                   |
| ------------- | ------------------------------------------------------------------------ |
| **UI**        | Optional collapsible tree for group attributes (Zarr and others)         |
| **Settings**  | New `scientificDataViewer.nestedAttributesView` (boolean, default false) |
| **Test data** | New Zarr sample with deeply nested `.zattrs` for Issue #120              |
| **Config**    | Webview receives a plain config object including `nestedAttributesView`  |
| **Docs**      | Release notes, CHANGELOG, README updated; xarray upstream noted          |
