# Pull Request: Release 0.13.0 — xarray 2026 / Zarr 3 alignment

## Summary

Technology alignment release for **xarray 2026.4+** and **zarr-python 3**. Improves Zarr discovery (unsuffixed directories, ZIP archives, v3 encoding metadata), NetCDF/DataTree quality (engine order, HDF5 filters, inherited coordinates), experimental **Kerchunk** virtual Zarr references, **COG** labelling, and plot extras (`col_wrap='auto'`, `facetgridFigsize`). Removes stale **Sentinel-1 SAFE** claims from the UI. Restructures the Python backend into the **`sdv_backend`** package and the sample generators into **`sample_data`** (behaviour preserved, verified with golden snapshots). A codebase review pass (tracked in [`docs/v0.13/CODE_REVIEW_TODO.md`](./CODE_REVIEW_TODO.md)) fixes a webview **HTML injection → arbitrary command** issue, uv installs that dropped version pins, broken **Open as Kerchunk**, Windows save paths and backend crashes, and removes dead / duplicated code (message bus, state store, 4,000-line webview script → bundled TypeScript modules).

**Version:** `0.13.0` in `package.json` / `package-lock.json`

**Planning docs:** [`docs/v0.13/`](./README.md) (what shipped vs deferred)

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
| Safety net    | Golden snapshot harness `python/tools/golden_snapshots.py` (68 info/plot cases recorded before any move, 83 with the v0.13 samples; frozen clock)                                                   |
| Package split | `python/get_data_info.py` (3,700 lines) → `python/sdv_backend/`; `get_data_info.py` kept as entry point                                                                                             |
| Decomposition | `create_plot` ~540 → ~110 lines (`selection.py`, `render.py`, `PlotOptions`); `get_file_info` split into steps (`InfoOptions`); shared `OpenedData`; CLI `build_parser`                             |
| Fixes         | Unsupported `plot_type` crash; empty selection `ZeroDivisionError`; files left open on plot errors; Kerchunk relative references unreachable when plotting                                          |
| Sample data   | `create_sample_data.py` (6,000 lines) → `python/sample_data/`; table-driven `main`; reproducible; `--overwrite`, `--disposable`; `.geotiff` generator fix (all v0.13 fixtures were never generated) |
| Tests         | Moved to `python/tests/`; `python/pyproject.toml`; new `test_empty_selection.py`                                                                                                                    |

### Phase 6 — Automatic uv environment update

| Work          | Detail                                                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Revision mark | `ENVIRONMENT_REVISION` in `ExtensionVirtualEnvironmentManager` (1 = v0.13 pins, 2 = `eccodeslib<2.48`); requirement-list change also triggers        |
| State file    | `sdv-environment.json` in the env folder records revision + requirements on create / update                                                          |
| Startup       | Existing env reused; deleted and rebuilt once (progress notification) when outdated; on failure the old env is restored and kept, retried next start |
| Fix           | Env was rebuilt (`uv venv --clear` + full reinstall) at every start                                                                                  |
| Scope         | Python-extension / override interpreters untouched (user's responsibility)                                                                           |

### Phase 7 — Code review fixes

| Area             | Work                                                                                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security         | Escape all file-derived values in the webview; CSP (no inline scripts / handlers); `executeCommand` allowlist (3 commands); plot file names validated (relative, no `..`)                      |
| Extension host   | `runProcess` (no shell) fixes uv version pins; single-flight init + serialised env operations; uv-based package install; accurate uv / override messages; Global config target                 |
| Error handling   | No `uncaughtException` hook in the shared host; per-panel handlers unregistered on dispose; backend errors keep suggestion / type                                                              |
| Panel            | `MessageBus` → `handle` / `emit` with typed `Requests` / `Events`; `StateManager` removed (1 message per load instead of ~9); `PlotOptions` object end to end; `DataProcessor` not a singleton |
| Bugs             | Kerchunk URI kept; "File too large" MB; Windows paths; save no longer awaits the notification; outline ids in nested view; outline cleared on close                                            |
| Webview          | `webview-script.js` (4,000 lines) → `src/panel/webview/*.ts` bundled by esbuild; one plot-parameter table; display bugs (no groups, group time inputs, stale time variable after Refresh)      |
| Healthcheck      | 1,184 → ~700 lines, plain functions, one package check                                                                                                                                         |
| Python backend   | Always JSON (corrupt files, `inf`); numpy values as numbers; time filter / NaT / cftime; equal aspect only for spatial plots; no `h5py` engine; strategies → `plotting/draw.py`                |
| eccodeslib crash | `eccodeslib` ≥ 2.48 aborts Python at exit with pyproj loaded (GRIB / TIFF errors); `ENVIRONMENT_CONSTRAINTS = ['eccodeslib<2.48']`, revision 2                                                 |
| Dead code        | Unused types, helpers, handlers, CSS, Python branches; `axios` dependency; `jsdom` → devDependencies                                                                                           |

### Phase 8 — Upgrade safety (v0.12 → v0.13)

| Work                 | Detail                                                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rebuild, not upgrade | Outdated uv env deleted and created again from scratch (an in-place `--upgrade` keeps leftovers of older versions); old env moved to `python-environment.previous` and restored if the rebuild fails or VS Code is closed mid-rebuild |
| Recreate action      | **Manage Extension Virtual Environment → Recreate**                                                                                                                                                                                   |
| No silent fallback   | At startup, an error says why the extension's own environment is not used                                                                                                                                                             |
| Old xarray           | xarray < 2024.10 gets a JSON error with the `pip install` command instead of an `AttributeError` (v0.12 crashed the same way)                                                                                                         |
| Upgrade test         | `scripts/upgrade-sandbox.sh`: real v0.12.1 → v0.13.0 update in a throw-away VS Code profile; scenarios `normal`, `offline`, `interrupted`                                                                                             |
| Docs                 | `docs/v0.13/GETTING_STARTED.md` (hub), `docs/v0.13/UPGRADE_TEST_PLAN.md` (profiles, results, support playbook); README troubleshooting entry; v0.13 working docs moved to `docs/v0.13/`; stale developer docs fixed                   |

### Phase 9 — Viewer styling refresh

| Area       | Work                                                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stylesheet | `styles.css` rewritten around design tokens (spacing, radii, derived surfaces) on top of `--vscode-*` theme variables                                                                      |
| Layout     | Centred 960 px column, 24 px gutters; content aligned under section titles; sticky header + section titles                                                                                 |
| Components | Rounded variable cards (summary, attributes, plot controls, plot); control panels; callouts for errors; twisties; uppercase pane headers                                                   |
| Controls   | One style for all inputs / selects / checkboxes (fixes white inputs in dark themes); secondary plot-action buttons; focus rings                                                            |
| Markup     | Every emoji of the viewer → inline SVG line icons (`src/shared/icons.ts`, shared by host and webview; `aria-label`s on icon buttons); copy buttons read **Copy** / **Copied** / **Failed** |
| Fix        | Error-page rules scoped to `#error` (they matched plot errors too: 16 px gap under the callout)                                                                                            |
| Fallbacks  | `color-mix()` behind `@supports` (VS Code < 1.77: flat surfaces); `:has()` only for a corner radius; high-contrast borders                                                                 |
| Docs       | Export-button wording in `docs/documentation.json` / README; release notes § Viewer styling refresh and manual step §21                                                                    |

### Sample data & docs

- `python/sample_data/` generators for v0.13 fixtures (unsuffixed Zarr v3, sharded Zarr, Zarr ZIP, gzip NetCDF, COG, Kerchunk ref)
- `docs/RELEASE_NOTES_0.13.0.md` with manual verification checklist
- README regenerated from `docs/documentation.json` + `package.json`
- GitHub issue templates (`.github/ISSUE_TEMPLATE/`): all fields optional, to lower the barrier to reporting

---

## Not shipped (deferred)

See [`docs/v0.13/OUT_OF_SCOPE.md`](./OUT_OF_SCOPE.md): pyfive (P1.4), OME-Zarr (P2.1), Sentinel SAFE re-implementation (P2.2), HDF4 `.hdf` (P2.4), NWB/FITS, STAC/OPeNDAP, Icechunk UX.

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
- **Extension uv environment:** upgraded automatically once at first start (`ENVIRONMENT_REVISION` = 2: v0.13 pins, then `eccodeslib<2.48` against an exit crash with pyproj); Python-extension / override interpreters must be upgraded by the user.
- **Kerchunk** is opt-in (`pip install kerchunk`); not in default uv bundle.
- Webview protocol: `getDataInfo` / `getCurrentFilePath` / `updateHeaders` requests and `uiStateChanged` / `pythonEnvironmentChanged` events removed; `executeCommand` allowlisted. New Python CLI flags are additive.
- JSON output: numeric attributes are numbers / arrays; `datetime_variables` only lists datetime / cftime variables; no `h5py` engine.
- Group plot overrides apply field by field (empty group field → global value).
- `npm run compile` also bundles the webview (esbuild); run `npm install` first.

---

## Key files

| Area      | Files                                                                                                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Python    | `python/sdv_backend/` (entry `python/get_data_info.py`), `python/sample_data/` (entry `python/create_sample_data.py`), `python/tests/`, `python/tools/golden_snapshots.py`                                             |
| Extension | `src/common/config.ts`, `src/python/DataProcessor.ts`, `src/extension.ts`, `src/python/ExtensionVirtualEnvironmentManager.ts`, `src/python/PythonManager.ts`, `package.json`                                           |
| Webview   | `src/panel/webview/*.ts` (bundled to `out/webview/webview.js` by `scripts/build-webview.mjs`), `src/panel/webview/styles.css`, `src/shared/icons.ts`, `src/panel/HTMLGenerator.ts` (CSP), `src/panel/WebviewAssets.ts` |
| Panel     | `src/panel/UIController.ts`, `src/panel/communication/MessageBus.ts`, `src/panel/communication/MessageTypes.ts`, `src/DataViewerPanel.ts`, `src/common/runProcess.ts`                                                  |
| Docs      | `CHANGELOG.md`, `docs/RELEASE_NOTES_0.13.0.md`, `docs/v0.13/`, `README.md`                                                                                                                                             |

---

## Testing

**Automated:**

```bash
source .venv/bin/activate   # or extension interpreter
python -m pytest python/tests -q
python python/tools/golden_snapshots.py check   # after `record` on a known-good commit
npm run compile && npm test       # 290 passing (VS Code integration + webview bundle in jsdom)
npm run typecheck                 # extension host + webview
pre-commit run --all-files
npm run package && scripts/upgrade-sandbox.sh [--scenario offline|interrupted]   # upgrade from v0.12.1
```

Results after the viewer styling refresh: `npm test` 290 passing; `npm run typecheck` and pre-commit clean; visual check in headless Chromium (dark, light, narrow, scrolled, plots, plot error, error page).

Results after the upgrade-safety work: `npm test` 290 passing; `pytest python/tests` 165 passing; golden snapshots 83 / 0 failing; `upgrade-sandbox.sh` normal, offline and interrupted passing (see [`UPGRADE_TEST_PLAN.md`](./UPGRADE_TEST_PLAN.md#results-2026-10-29-linux-vs-code-1144-uv-0102)).

Results at the end of the code review pass: `npm test` 284 passing / 0 failing; `pytest python/tests` 159 passing (was 112); golden snapshots 83 cases, 0 failing (re-recorded after reviewing the 27 intended info diffs); non-regression plot gallery byte-identical.

**Sample data** (written under `sample-data/`):

```bash
python python/create_sample_data.py --overwrite   # from the repository root
```

**Manual:** Follow [`docs/v0.13/MANUAL_TEST_PLAN_0.13.0.md`](./MANUAL_TEST_PLAN_0.13.0.md) (step by step, results sheet to paste here); technical details in [`docs/RELEASE_NOTES_0.13.0.md`](../RELEASE_NOTES_0.13.0.md) §0–§21 (§16–§19: code review fixes, §20: eccodeslib pin, §21: viewer styling).

---

## Documentation checklist

- [x] `CHANGELOG.md` — [0.13.0] entry
- [x] `docs/RELEASE_NOTES_0.13.0.md` — release notes + verification guide
- [x] `docs/v0.13/PR_SUMMARY_0.13.0.md` — this file (MR description)
- [x] `docs/v0.13/MANUAL_TEST_PLAN_0.13.0.md` — click-by-click manual test plan with results sheet
- [ ] Manual test plan executed, results sheet pasted in the MR
- [x] `docs/v0.13/` — planning docs (shipped vs deferred)
- [x] `README.md` — regenerated (`python scripts/generate_readme.py --no-timestamp`)
- [x] `docs/documentation.json` — prose, format table, troubleshooting
- [x] Version `0.13.0` in `package.json`
- [x] `docs/DEVELOPMENT.md` — backend package layout, sample data commands
- [x] `CLAUDE.md` — commands and architecture for AI-assisted development
- [x] `docs/TECHNICAL_ARCHITECTURE.md` — rewritten for the actual architecture (code review)
- [x] `docs/v0.13/CODE_REVIEW_TODO.md` — code review items, all checked
- [x] `docs/v0.13/GETTING_STARTED.md` — hub: reading order, risks, review and release plan
- [x] `docs/v0.13/UPGRADE_TEST_PLAN.md` — upgrade from v0.12: profiles, script, compatibility, support playbook
- [ ] Release date set in `CHANGELOG.md` / release notes, README regenerated (at release time)

---

## Commits (oldest → newest)

1. docs: plan v0.13 technology updates
2. feat: drop stale Sentinel-1 SAFE support claims
3. feat: require zarr 3 and pin the xarray 2026 stack
4. feat: detect Zarr stores that are not named *.zarr
5. feat: identify Zarr codecs and format version in metadata
6. feat: open Zarr stores packaged as ZIP archives
7. feat: support xarray col_wrap=auto in plot controls
8. feat: add NetCDF engine order, HDF5 filters, and inherited DataTree coords
9. feat: open Kerchunk virtual Zarr references experimentally
10. feat: label Cloud Optimized GeoTIFF files in file info
11. feat: add facetgridFigsize setting for faceted xarray plots
12. chore: release v0.13.0 with changelog and release notes
13. feat: add v0.13 sample data generators for new formats
14. docs: complete v0.13.0 release and MR documentation

Backend restructuring:

15. test: add golden snapshot harness for Python backend refactoring
16. refactor: split get_data_info.py into the sdv_backend package
17. fix: return a JSON error instead of crashing on unsupported plot types
18. refactor: decompose create_plot into a selection/render pipeline
19. refactor: decompose get_file_info and the CLI; share OpenedData
20. docs: describe the sdv_backend package layout
21. fix: explain empty plot selections instead of failing in xarray
22. refactor: make helpers shared across backend modules public
23. refactor: split create_sample_data.py into the sample_data package
24. fix(sample-data): write sample_data.geotiff with an explicit GTiff driver
25. docs: mention the sample_data package
26. feat(sample-data): reproducible generation; table-driven main
27. test: cover v0.13 sample formats in the golden snapshot harness
28. feat(sample-data): add --overwrite and --disposable flags
29. docs: add CLAUDE.md with project commands and architecture
30. docs: document the backend restructuring in the v0.13.0 release docs
31. fix: resolve relative Kerchunk reference paths from the reference folder
32. docs: add a step-by-step manual test plan for v0.13.0
33. chore: make all GitHub issue template fields optional
34. feat: update the extension's uv environment automatically on new versions
35. docs: update the v0.13.0 manual test plan
36. chore: say all fields are optional in the question issue form intro

Code review pass (items in `docs/v0.13/CODE_REVIEW_TODO.md`):

37. fix(backend): always return JSON errors, fix serialization and time handling
38. fix(host): spawn without a shell, serialise Python init, clean up host code
39. refactor(panel): simplify message bus and panel state; fix Kerchunk and save paths
40. refactor(webview): TypeScript modules bundled with esbuild; escape data, add CSP
41. docs: document the code review pass for v0.13.0
42. docs: list the code review commits in the v0.13.0 PR summary
43. fix(env): pin eccodeslib<2.48 to stop a crash at exit with pyproj
44. chore(vscode): run the compile task with nvm's Node
45. chmoding ensure.sh

Upgrade safety (v0.12 → v0.13):

46. feat(env): delete and rebuild the uv environment when a version needs it
47. fix(backend): explain when xarray is too old instead of crashing
48. test: add an upgrade test running v0.12 -> v0.13 in a sandbox profile
49. docs: add the v0.13 getting-started hub and upgrade test plan
50. docs: fix stale developer docs
51. docs: list the upgrade-safety commits in the v0.13.0 PR summary
