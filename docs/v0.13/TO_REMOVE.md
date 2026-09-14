# v0.13 — features and surface area to remove

Remove **dead claims** and **leftover wiring** from formats that are not actually supported. Do not remove working NetCDF/Zarr/HDF5/GRIB/GeoTIFF/JP2/CDF paths.

If P2.2 (xarray-sentinel) is implemented in the same release, **re-add** SAFE properly instead of only deleting leftovers. Until that lands, deletion wins: the product must not look like `.safe` works.

---

## R1 — Sentinel-1 SAFE leftovers (required)

**History.** v0.5.0 changelog: *Removed untested Sentinel-1 SAFE (.safe) format support*. The webview already comments out `'.safe'`. Explorer menus and Python types were not fully cleaned.

### R1.1 `package.json` explorer context menus

**Where.** `contributes.menus` `when` clauses (currently two, around the Open Viewer / Open Viewer for Selection items):

```
… || resourceExtname == .safe || resourceExtname == .nc4 || …
```

**Do.** Delete `resourceExtname == .safe` from every `when` clause. There is no `safe` language id, no custom editor, no folder contribution — the menu item currently appears on `*.safe` **files** and then cannot open a Sentinel product (SAFE is a **directory** layout).

**Acceptance.** Context menu on a dummy `foo.safe` file does not show Scientific Data Viewer commands. Tests in `test/suite/extension.test.ts` (if they snapshot `when` strings) updated.

### R1.2 Keyword `sentinel`

**Where.** `package.json` `"keywords"` includes `"sentinel"`.

**Do.** Remove the keyword until SAFE is a real feature. Marketplace search should not advertise Sentinel.

### R1.3 Python `SupportedExtensionType` includes `.safe` without an engine

**Where.** `python/get_data_info.py`:

- `SupportedExtensionType` Literal lists `".safe"`
- `FORMAT_ENGINE_MAP` has **no** `".safe"` entry
- `FORMAT_DISPLAY_NAMES` has **no** `".safe"` entry

Opening a `.safe` path (if it ever reached the CLI) would not map to an engine cleanly.

**Do.** Remove `".safe"` from the Literal. Grep `get_data_info.py` for other `.safe` branches and delete them.

### R1.4 Sample-data generator empty `.safe` directories

**Where.** `python/create_sample_data.py` — `file_extensions` includes `".safe"` and creates an empty directory “for zarr/safe”.

**Do.** Stop creating `.safe` placeholders. Keep Zarr directory creation as-is.

### R1.5 Webview commented extension list

**Where.** `src/panel/webview/webview-script.js` — `// '.safe',` in a hardcoded extension array.

**Do.** Remove the commented line (noise). If that array is a duplicate of `package.json` extensions, prefer a single source of truth in a follow-up; not required for v0.13 beyond deleting the SAFE comment.

### R1.6 Docs / wiki

**Do.** Confirm README / `docs/documentation.json` / wiki do **not** list Sentinel-1 or `.safe`. v0.5.0 already dropped it from user-facing format tables; do not reintroduce in v0.13 marketing unless P2.2 ships.

---

## R2 — Do not keep zarr-python 2 as a supported dependency

**Why.** xarray 2026.04+ does not support zarr-python 2. “Support both zarr 2 and 3 as packages” is not a v0.13 goal.

**Do.**

- Remove any docs that say `pip install zarr` without a version and imply zarr 2 is fine.
- Do not add compatibility shims for the zarr 2 Python API (`zarr.open_consolidated` path differences, `numcodecs` as the only compressor story).
- Keep **reading Zarr v2 format data** via zarr-python 3 (not the same as depending on the zarr 2 package).

**Not a code delete** so much as a **policy delete**: drop “zarr 2.x environment” from troubleshooting as a valid setup.

---

## R3 — Timedelta-from-units as a first-class decode path

**Why.** xarray finalized removal of timedelta decoding via units (2026.04.0).

**Do.**

- Do not add UI to “decode timedeltas from units”.
- Do not treat remaining timedelta-unit failures as regressions to restore old xarray behaviour.
- Keep the existing **`decode_cf=False` retry** (issue #136) for invalid CF **time** units; that is a different problem.

Grep comments/docs that promise timedelta unit decoding and delete or rewrite them if any exist.

---

## R4 — Misleading `.jpeg2000` as if it were a common extension (optional cleanup)

**Status.** JPEG-2000 **is supported** via rasterio (`*.jp2`, `*.jpeg2000`). The alias `*.jpeg2000` is unusual (real files are almost always `.jp2` / `.j2k` / `.jpx`).

**Do (optional, low priority).**

- Keep `.jp2`.
- Either keep `.jpeg2000` for backward compatibility or add `.j2k` if GDAL users need it.
- **Do not remove** JP2 support. This is not “remove JPEG-2000”.

Only remove `.jpeg2000` if tests and docs agree it was never used; otherwise leave it.

---

## R5 — Duplicate / stale format lists

Several lists of extensions exist (`package.json` languages + menus, `get_data_info.py` Literal, webview-script.js array, `create_sample_data.py`). Drift caused the SAFE bug.

**Do.**

- After R1, grep the repo (excluding `node_modules`, `CHANGELOG` history, `docs/v0.13`) for `resourceExtname == .safe`, `".safe"`, `'sentinel'`.
- Add a short comment in `get_data_info.py` next to `SupportedExtensionType`: must stay aligned with `package.json` custom editors **or** document why a type exists only on the Python side (e.g. inferred Zarr directories with no suffix — those should **not** be fake extensions).

Not a user-facing feature removal; it prevents the next ghost format.

---

## R6 — What **not** to remove

Do **not** delete in v0.13:

| Item | Reason |
| ---- | ------ |
| NASA CDF / `cdflib` | Distinct from NetCDF; working dedicated path |
| `open_dataset` fallback for cfgrib / rasterio | DataTree is not implemented there |
| Nested attributes view / encoding attributes settings | Still valid; v0.13 extends encoding, does not replace it |
| Isolated uv env / Python 3.13 | Unrelated to format watch |
| Custom editors for `.zarr` folders | Still the main Zarr UX; P0.2 **adds** detection, does not replace `*.zarr` |
| Experimental plotting | v0.13 extends `col_wrap`; does not remove the plot GUI |
| `.safe` mentions in **CHANGELOG** / old **RELEASE_NOTES_0.5.0** | Historical; leave them |

---

## Acceptance for the remove track

1. Grep of current sources (not historical changelog) has **no** user-facing `.safe` / Sentinel claim except `docs/v0.13` planning and optional P2.2 specs.
2. Opening workflows for supported formats are unchanged.
3. Marketplace keywords match actual formats.
