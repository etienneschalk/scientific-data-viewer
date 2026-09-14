# v0.13 — implementation phases

Work through phases in order. Later phases may be cut from the release; **Phase 0 + Phase 1** are the intended v0.13 core. Phase 2 items are individually optional (see [TO_IMPLEMENT.md](./TO_IMPLEMENT.md) P2 and [OUT_OF_SCOPE.md](./OUT_OF_SCOPE.md)).

---

## Phase 0 — Stop lying about formats (remove)

**Must ship with any v0.13**, even if no new formats land.

| ID | Work | Doc |
| -- | ---- | --- |
| R1 | Strip `.safe` from menus, keywords, Python Literal, sample generator, webview comment | [TO_REMOVE.md](./TO_REMOVE.md) |
| R5 | Grep alignment of extension lists | TO_REMOVE |
| R2/R3 | Docs: zarr 2 package unsupported; no timedelta-units decode | TO_REMOVE |

**Exit.** Marketplace and context menus match engines that actually run.

---

## Phase 1 — Xarray 2026 / Zarr 3 (implement P0)

| ID | Work | Depends on |
| -- | ---- | ---------- |
| P0.1 | Pin `zarr>=3` (and xarray floor) in uv env + user-facing install strings | — |
| P0.2 | Detect Zarr stores without `.zarr` suffix; folder + `zarr.json` | P0.1 |
| P0.4 | Surface v3 encoding (shards, codecs, fill_value, format) | P0.1; sample v3 store |
| P0.3 | ZipStore / `.zarr.zip` | P0.1, detection helpers from P0.2 |
| P0.5 | Plot `col_wrap="auto"` | Independent; can parallelize |

**Suggested samples** (generate in `python/create_sample_data.py`, do not commit huge binaries):

- Existing v2 `.zarr` (already present)
- Small Zarr v3 directory **without** `.zarr` in the name
- Same store zipped for P0.3
- Optional: one sharded v3 array for P0.4

**Exit.** Isolated env installs zarr 3; v2 and v3 samples open; zip sample opens; encoding table shows v3 fields; Auto col_wrap works on a faceted plot.

---

## Phase 2 — NetCDF / DataTree quality (P1.1–P1.3)

| ID | Work |
| -- | ---- |
| P1.1 | Setting `netcdfEngineOrder` |
| P1.2 | `filters()` in encoding tables (`h5netcdf>=1.8`) |
| P1.3 | Inherited DataTree coordinates |

P1.4 (pyfive) only if P1.2 is done and an extra optional dependency is acceptable.

**Exit.** Engine order is visible in file info; compressed NetCDF shows filters; inherited-coord sample is honest in the UI.

---

## Phase 3 — Virtual Zarr references (P1.5)

Experimental command/menu, **not** a blanket `.json` custom editor.

**Exit.** One local kerchunk fixture opens; random JSON does not hijack the editor.

**Cut this phase** if fsspec/kerchunk in the uv env is too heavy; leave a GitHub issue pointing at this spec.

---

## Phase 4 — One new domain format (pick at most one for v0.13)

Choose **one**:

1. **OME-Zarr** (P2.1) — best overlap with DataTree + Zarr work
2. **COG label** (P2.3) — smallest; can ship even if (1) slips
3. **SAFE** (P2.2) — only if Phase 0 leftover removal is reverted in a controlled way
4. **HDF4 via GDAL** (P2.4) — small if rasterio/GDAL already in env

NWB (P2.5) and FITS (P2.6) should wait unless Phase 4 finishes early.

P2.7 (`facetgrid_figsize`) can land anytime after P0.5.

---

## Dependency pin sketch (Phase 1)

Isolated uv environment (`ALL_PACKAGES`) — **adjust after resolving versions on Python 3.13**:

```
xarray>=2026.04.0
zarr>=3.0
matplotlib
netCDF4
h5netcdf>=1.8
h5py
scipy
cfgrib
rioxarray
cdflib
```

Do **not** add by default: `icechunk`, `kerchunk`, `fsspec` (unless Phase 3), `ngff-zarr` / `ome-zarr`, `xarray-sentinel`, `pynwb`, `astropy`, `pyfive`.

User-managed interpreters: keep prompting for missing engines; add a **zarr major version** check (P0.1).

---

## Testing checklist (per phase)

- [ ] `python/` unit tests for open/flatten/encoding
- [ ] Plot non-regression when plot CLI changes (P0.5)
- [ ] `test/suite/extension.test.ts` contributions (menus, editors)
- [ ] Manual: dark/light webview on a v3 store (encoding table, groups)
- [ ] Manual: zip that is not Zarr → error message
- [ ] README / `docs/documentation.json` regenerated if format table changes

---

## Release notes later

When v0.13 is cut, write `docs/RELEASE_NOTES_0.13.0.md` from **what actually merged**, not from this folder’s full wishlist. Point the changelog at Phase 0+1 for sure, and list Phase 2–4 only if present.
