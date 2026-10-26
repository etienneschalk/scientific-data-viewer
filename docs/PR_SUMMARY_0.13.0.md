# Pull Request: Release 0.13.0 — xarray 2026 / Zarr 3 alignment

## Summary

Technology alignment release for **xarray 2026.4+** and **zarr-python 3**. Improves Zarr discovery (unsuffixed directories, ZIP archives, v3 encoding metadata), NetCDF/DataTree quality (engine order, HDF5 filters, inherited coordinates), experimental **Kerchunk** virtual Zarr references, **COG** labelling, and plot extras (`col_wrap='auto'`, `facetgridFigsize`). Removes stale **Sentinel-1 SAFE** claims from the UI. Restructures the Python backend into the **`sdv_backend`** package and the sample generators into **`sample_data`** (behaviour preserved, verified with golden snapshots).

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

### Phase 5 — Backend restructuring (maintainability)

| Work          | Detail                                                                                                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Safety net    | Golden snapshot harness `python/tools/golden_snapshots.py` (82 info/plot cases, frozen clock) recorded before any move                                                                              |
| Package split | `python/get_data_info.py` (3,700 lines) → `python/sdv_backend/`; `get_data_info.py` kept as entry point                                                                                             |
| Decomposition | `create_plot` ~540 → ~110 lines (`selection.py`, `render.py`, `PlotOptions`); `get_file_info` split into steps (`InfoOptions`); shared `OpenedData`; CLI `build_parser`                             |
| Fixes         | Unsupported `plot_type` crash; empty selection `ZeroDivisionError`; files left open on plot errors; Kerchunk relative references unreachable when plotting                                          |
| Sample data   | `create_sample_data.py` (6,000 lines) → `python/sample_data/`; table-driven `main`; reproducible; `--overwrite`, `--disposable`; `.geotiff` generator fix (all v0.13 fixtures were never generated) |
| Tests         | Moved to `python/tests/`; `python/pyproject.toml`; new `test_empty_selection.py`                                                                                                                    |

### Sample data & docs

- `python/sample_data/` generators for v0.13 fixtures (unsuffixed Zarr v3, sharded Zarr, Zarr ZIP, gzip NetCDF, COG, Kerchunk ref)
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

| Area      | Files                                                                                                                                                                      |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Python    | `python/sdv_backend/` (entry `python/get_data_info.py`), `python/sample_data/` (entry `python/create_sample_data.py`), `python/tests/`, `python/tools/golden_snapshots.py` |
| Extension | `src/common/config.ts`, `src/python/DataProcessor.ts`, `src/extension.ts`, `package.json`                                                                                  |
| Webview   | `src/panel/webview/webview-script.js` (col_wrap auto)                                                                                                                      |
| Docs      | `CHANGELOG.md`, `docs/RELEASE_NOTES_0.13.0.md`, `docs/v0.13/`, `README.md`                                                                                                 |

---

## Testing

**Automated:**

```bash
source .venv/bin/activate   # or extension interpreter
python -m pytest python/tests -q
python python/tools/golden_snapshots.py check   # after `record` on a known-good commit
npm run compile && npm test
```

**Sample data** (written under `sample-data/`):

```bash
python python/create_sample_data.py --overwrite   # from the repository root
```

**Manual:** Follow [`docs/MANUAL_TEST_PLAN_0.13.0.md`](./MANUAL_TEST_PLAN_0.13.0.md) (step by step, results sheet to paste here); technical details in [`docs/RELEASE_NOTES_0.13.0.md`](./RELEASE_NOTES_0.13.0.md) §0–§13.

---

## Documentation checklist

- [x] `CHANGELOG.md` — [0.13.0] entry
- [x] `docs/RELEASE_NOTES_0.13.0.md` — release notes + verification guide
- [x] `docs/PR_SUMMARY_0.13.0.md` — this file (MR description)
- [x] `docs/MANUAL_TEST_PLAN_0.13.0.md` — click-by-click manual test plan with results sheet
- [ ] Manual test plan executed, results sheet pasted in the MR
- [x] `docs/v0.13/` — planning docs (shipped vs deferred)
- [x] `README.md` — regenerated (`python scripts/generate_readme.py --no-timestamp`)
- [x] `docs/documentation.json` — prose, format table, troubleshooting
- [x] Version `0.13.0` in `package.json`
- [x] `docs/DEVELOPMENT.md` — backend package layout, sample data commands
- [x] `CLAUDE.md` — commands and architecture for AI-assisted development

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
14. `0d885bf` — docs: complete v0.13.0 release and MR documentation

Backend restructuring (branch `eschalk/backend-package`):

15. `cb4ad47` — test: add golden snapshot harness for Python backend refactoring
16. `104e1c3` — refactor: split get_data_info.py into the sdv_backend package
17. `f7a6001` — fix: return a JSON error instead of crashing on unsupported plot types
18. `89d0808` — refactor: decompose create_plot into a selection/render pipeline
19. `ebaef98` — refactor: decompose get_file_info and the CLI; share OpenedData
20. `b7b38c5` — docs: describe the sdv_backend package layout
21. `81c482f` — fix: explain empty plot selections instead of failing in xarray
22. `0b083ee` — refactor: make helpers shared across backend modules public
23. `6fcaef2` — refactor: split create_sample_data.py into the sample_data package
24. `e375411` — fix(sample-data): write sample_data.geotiff with an explicit GTiff driver
25. `02d6246` — docs: mention the sample_data package
26. `d2a6211` — feat(sample-data): reproducible generation; table-driven main
27. `f0a8ff7` — test: cover v0.13 sample formats in the golden snapshot harness
28. `111d674` — feat(sample-data): add --overwrite and --disposable flags
29. `c4bb9c5` — docs: add CLAUDE.md with project commands and architecture
