# Pull Request: Release 0.13.0 — xarray 2026 / Zarr 3 alignment

## Summary

Technology alignment release for **xarray 2026.4+** and **zarr-python 3**. Improves Zarr discovery (unsuffixed directories, ZIP archives, v3 encoding metadata), NetCDF/DataTree quality (engine order, HDF5 filters, inherited coordinates), experimental **Kerchunk** virtual Zarr references, **COG** labelling, and plot extras (`col_wrap='auto'`, `facetgridFigsize`). Removes stale **Sentinel-1 SAFE** claims from the UI.

**Version:** `0.13.0` in `package.json` / `package-lock.json`

**Planning docs:** [`docs/v0.13/`](./v0.13/README.md) (what shipped vs deferred)

---

## Shipped (by phase)

### Phase 0 — Remove stale format claims

| ID  | Work                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------- |
| R1  | Strip `.safe` from menus, keywords, Python `SupportedExtensionType`, sample generator, webview comments |

### Phase 1 — Xarray 2026 / Zarr 3 (P0)

| ID   | Feature                                                                                                   |
| ---- | --------------------------------------------------------------------------------------------------------- |
| P0.1 | Pin `xarray>=2026.4.0`, `zarr>=3`, `h5netcdf>=1.8` in uv env; reject zarr 2.x as too old                  |
| P0.2 | Detect Zarr stores without `.zarr` suffix (`zarr.json`, `.zgroup`, …); folder open + `resolve_store_path` |
| P0.3 | Open `.zip` / `.zarr.zip` via `zarr.storage.ZipStore`                                                     |
| P0.4 | Zarr v2/v3 format label; v3 codecs/shards in `__xarray_encoding.*`                                        |
| P0.5 | Plot `col_wrap='auto'` checkbox in Global/Group plot controls                                             |

### Phase 2 — NetCDF / DataTree quality (P1)

| ID   | Feature                                                                                               |
| ---- | ----------------------------------------------------------------------------------------------------- |
| P1.1 | Setting `scientificDataViewer.netcdfEngineOrder`                                                      |
| P1.2 | HDF5 filter metadata as `__xarray_encoding.filters.*`                                                 |
| P1.3 | Setting `scientificDataViewer.showInheritedCoordinates` + `DataTree.to_dataset(inherit='all_coords')` |

### Phase 3 — Virtual Zarr (P1.5)

| ID   | Feature                                                                                               |
| ---- | ----------------------------------------------------------------------------------------------------- |
| P1.5 | Kerchunk custom editor (`*.kerchunk.json`, `*.ref.json`); **Open as Kerchunk / virtual Zarr** command |

### Phase 4 — Stretch (P2)

| ID   | Feature                                                     |
| ---- | ----------------------------------------------------------- |
| P2.3 | **Cloud Optimized GeoTIFF (COG)** label in File Information |
| P2.7 | Setting `scientificDataViewer.facetgridFigsize`             |

### Sample data & docs

- `python/create_sample_data.py` generators for v0.13 fixtures (unsuffixed Zarr v3, sharded Zarr, Zarr ZIP, gzip NetCDF, COG, Kerchunk ref)
- `docs/RELEASE_NOTES_0.13.0.md` with manual verification checklist
- README regenerated from `docs/documentation.json` + `package.json`

---

## Not shipped (deferred)

See [`docs/v0.13/OUT_OF_SCOPE.md`](./v0.13/OUT_OF_SCOPE.md): pyfive (P1.4), OME-Zarr (P2.1), Sentinel SAFE re-implementation (P2.2), HDF4 `.hdf` (P2.4), NWB/FITS, STAC/OPeNDAP, Icechunk UX.

---

## New settings

| Setting                    | Default                          | Effect                                                             |
| -------------------------- | -------------------------------- | ------------------------------------------------------------------ |
| `netcdfEngineOrder`        | `["netcdf4","h5netcdf","scipy"]` | Try-order for `.nc` / `.nc4` / `.netcdf` only                      |
| `showInheritedCoordinates` | `true`                           | Parent DataTree coords on child groups; `inherited_from` attribute |
| `facetgridFigsize`         | `[]`                             | Optional `[width, height]` inches for faceted plots                |

Existing v0.12 settings unchanged (`orderGroupsAlphabetically`, `showXarrayEncodingAttributes`, plot controls, …).

---

## Upgrade / breaking notes

- **xarray ≥ 2026.4.0 requires zarr-python ≥ 3.** Users on zarr 2.x see `zarr>=3` in missing-package messages.
- **Extension uv environment:** run **Manage Extension Virtual Environment → Update** after upgrade.
- **Kerchunk** is opt-in (`pip install kerchunk`); not in default uv bundle.
- No webview message contract breaks; new Python CLI flags are additive.

---

## Key files

| Area      | Files                                                                                     |
| --------- | ----------------------------------------------------------------------------------------- |
| Python    | `python/get_data_info.py`, `python/create_sample_data.py`, tests under `python/test_*.py` |
| Extension | `src/common/config.ts`, `src/python/DataProcessor.ts`, `src/extension.ts`, `package.json` |
| Webview   | `src/panel/webview/webview-script.js` (col_wrap auto)                                     |
| Docs      | `CHANGELOG.md`, `docs/RELEASE_NOTES_0.13.0.md`, `docs/v0.13/`, `README.md`                |

---

## Testing

**Automated:**

```bash
source .venv/bin/activate   # or extension interpreter
python -m pytest python/ -q
npm run compile && npm test
```

**Sample data** (written under `sample-data/`):

```bash
cd python && python create_sample_data.py
```

**Manual:** See [`docs/RELEASE_NOTES_0.13.0.md`](./RELEASE_NOTES_0.13.0.md) §0–§12.

---

## Documentation checklist

- [x] `CHANGELOG.md` — [0.13.0] entry
- [x] `docs/RELEASE_NOTES_0.13.0.md` — release notes + verification guide
- [x] `docs/PR_SUMMARY_0.13.0.md` — this file (MR description)
- [x] `docs/v0.13/` — planning docs (shipped vs deferred)
- [x] `README.md` — regenerated (`python scripts/generate_readme.py --no-timestamp`)
- [x] `docs/documentation.json` — prose, format table, troubleshooting
- [x] Version `0.13.0` in `package.json`

---

## Commits (oldest → newest)

1. `e581e1e` — docs: plan v0.13 technology updates
2. `ccd8b41` — feat: drop stale Sentinel-1 SAFE support claims
3. `994013d` — feat: require zarr 3 and pin the xarray 2026 stack
4. `21a277d` — feat: detect Zarr stores that are not named *.zarr
5. `44f2465` — feat: identify Zarr codecs and format version in metadata
6. `82e8925` — feat: open Zarr stores packaged as ZIP archives
7. `3db54b1` — feat: support xarray col_wrap=auto in plot controls
8. `76a15bf` — feat: add NetCDF engine order, HDF5 filters, and inherited DataTree coords
9. `7960d27` — feat: open Kerchunk virtual Zarr references experimentally
10. `bc1cb5e` — feat: label Cloud Optimized GeoTIFF files in file info
11. `6acf9cb` — feat: add facetgridFigsize setting for faceted xarray plots
12. `ad77254` — chore: release v0.13.0 with changelog and release notes
13. `4fdd8d0` — feat: add v0.13 sample data generators for new formats
