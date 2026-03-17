# Scientific Data Viewer v0.10.0 Release Notes

**TL;DR** — **Collapsible nested attributes view** (Issue #120): tree view for Zarr (and other formats) that store attributes as nested JSON. **On by default**; you can opt out via **Nested Attributes View** setting to use a flat list. Test data script now generates a Zarr store with deeply nested `.zattrs` for QA. Version bump to **0.10.0**.

## Collapsible nested attributes view (Issue #120)

Formats such as **Zarr** store group attributes in JSON (e.g. `.zattrs`). The previous UI showed only one level of attributes; nested structures were hard to read. This release adds a **tree view** (on by default) so you can expand and collapse the full attribute hierarchy.

### Feature flag (on by default, opt-out)

- **Setting:** `scientificDataViewer.nestedAttributesView`
- **Default:** `true` (tree view on; set to `false` to use a flat list)
- **Location:** VS Code Settings → Scientific Data Viewer (or `.vscode/settings.json`)

When on (default), the **Attributes** section for each group is rendered as an expandable/collapsible tree instead of a flat list. Nested objects and arrays are shown as nodes you can open to inspect deeper levels. This is especially useful for Zarr datasets with complex metadata (e.g. CF conventions, producer-specific `.zattrs`). Set the setting to `false` if you prefer the previous flat attribute list.

### Use cases

- **Zarr users:** Open a Zarr dataset with complex `.zattrs` and expand the tree to see the full nested structure without copying JSON elsewhere.
- **Metadata inspection:** Browse the attribute tree in-context while viewing dimensions and variables.
- **Opt-out:** The feature is on by default; disable **Nested Attributes View** in settings to use the flat list instead.

### Technical notes

- The backend already exposes nested attribute structures (e.g. from xarray/Zarr); the change is in the SDV webview, which now renders them as a tree when the flag is on.
- For very large attribute trees, only visible nodes are expanded; consider lazy expansion or virtualization in a future release if needed.
- Tree styling uses VS Code theme variables and follows the same patterns as other collapsible sections (e.g. `details`/`summary`).

## Test data: Zarr with deeply nested attributes

The sample data script (`python/create_sample_data.py`) now creates a Zarr store with **extremely nested** group attributes for testing this feature:

- **File:** `sample_zarr_deeply_nested_attrs.zarr`
- **Content:** Minimal array plus root `.zattrs` with 5–10 levels of nested dicts and mixed arrays/objects.
- **Purpose:** Regression testing and manual QA of the collapsible nested-attributes UI.

Run the script (e.g. from the repo root) to generate all sample files, including this one. Open the generated Zarr in the viewer; the tree is shown by default (disable **Nested Attributes View** in settings to use the flat list).

## xarray and nested attributes (upstream)

The current xarray and SDV text/HTML representations show attributes in a limited way; nested structures are not always easy to read. Improving the representation of nested attributes in xarray’s APIs or built-in reprs would benefit both the library and downstream tools like SDV. Consider opening or supporting a feature request on the [xarray GitHub repository](https://github.com/pydata/xarray) if you need better first-class support for nested attributes in xarray itself. SDV’s collapsible tree view works with the nested structures that xarray already returns when reading Zarr (and similar) stores.

## Upgrading

After updating to 0.10.0, the nested attributes tree is **on by default**. You can opt out by setting **Nested Attributes View** to `false` in extension settings to use the flat list. No other breaking changes in this release.

## Summary of changes

| Area          | Change                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| **UI**        | Collapsible tree for group attributes (Zarr and others), on by default  |
| **Settings**  | New `scientificDataViewer.nestedAttributesView` (boolean, default true) |
| **Test data** | New Zarr sample with deeply nested `.zattrs` for Issue #120             |
| **Config**    | Webview receives a plain config object including `nestedAttributesView` |
| **Docs**      | Release notes, CHANGELOG, README updated; xarray upstream noted         |
