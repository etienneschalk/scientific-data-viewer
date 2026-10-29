# CLAUDE.md

VSCode extension (`eschalk0.scientific-data-viewer`) for inspecting scientific data files (NetCDF, CDF, HDF5, Zarr incl. zipped, GRIB, GeoTIFF/COG, JPEG-2000, Kerchunk). A TypeScript frontend shells out to Python scripts that use xarray to extract metadata and render plots.

## Commands

**Always run `source ~/.nvm/nvm.sh && nvm use` (Node 22, from `.nvmrc`) in the same shell command before any Node-related command** (`npm`, `npx`, `node`, `pre-commit`, `git commit` — its hooks run prettier / eslint). The system Node can be too old (e.g. v10): commands then fail with errors like `prettier requires at least version 14 of Node` or `Module.createRequire is not a function`.

```bash
npm install                 # deps (Node >= 22)
npm run compile             # esbuild webview bundle (out/webview/webview.js) + tsc -> out/ (entry: out/src/extension.js)
npm run watch               # incremental webview bundle + tsc
npm run typecheck           # tsc --noEmit for the extension host and the webview
npm run lint                # eslint --fix on src/
npm test                    # VSCode integration tests (mocha via @vscode/test-electron, out/test/runTest.js); needs a display (CI uses Xvfb)
npm run package             # build .vsix with vsce
pytest python/tests         # Python-side tests (need xarray etc. installed)
python python/tools/golden_snapshots.py check   # backend JSON vs local snapshots (record first)
pre-commit run --all-files  # prettier, eslint, tsc --noEmit, ruff, ruff-format, detect-secrets...
npm run screenshots         # full-page viewer screenshots -> screenshots/v<major.minor>/<theme>/ (scripts/screenshots/, docs/SCREENSHOTS.md)
python python/create_sample_data.py [--overwrite]   # create sample-data/ (generators in python/sample_data/)
python scripts/generate_readme.py     # regenerate README.md
.venv/bin/python scripts/architecture/generate.py [--check]   # regenerate docs/architecture/ diagrams (Graphviz) / check they match the code
```

## Architecture

- `src/extension.ts` — activation, command registration.
- `src/ScientificDataEditorProvider.ts` — custom editor for supported file types; `src/DataViewerPanel.ts` — webview panel lifecycle.
- `src/panel/` — `UIController` (per-panel logic, answers webview requests); `communication/MessageTypes` (protocol: `Requests` / `Events` maps) + `MessageBus` (host side: `handle` / `emit`); `HTMLGenerator` (page skeleton with CSP), `WebviewAssets`, `ThemeManager`.
- `src/panel/webview/` — webview front-end in TypeScript (own `tsconfig.json`, DOM types), bundled by `scripts/build-webview.mjs` (esbuild) into `out/webview/webview.js`; `plotParams.ts` is the single table of plot controls; `styles.css` uses only `--vscode-*` theme colors. `src/shared/ids.ts` (`joinId`) is shared with the outline; `src/shared/icons.ts` (inline SVG line icons, no emoji in the UI) with `HTMLGenerator`.
- `src/python/` — `PythonManager` (interpreter selection via the official Python extension API, subprocess execution/abort), `ExtensionVirtualEnvironmentManager` (extension-owned uv/venv; reused across sessions, deleted and rebuilt when `ENVIRONMENT_REVISION` increases), `DataProcessor` (builds CLI args and runs the scripts in `python/`; created in `extension.ts` and passed to `DataViewerPanel`).
- `src/outline/` — document outline (headers) for the viewer.
- `src/common/` — config access, Logger, ErrorBoundary, `runProcess` (spawn without a shell — never use `shell: true`), PerformanceTimer, Healthcheck.
- `python/sdv_backend/` — the Python backend package: `cli` (argparse → `InfoOptions`/`PlotOptions`), `results` (JSON contract), `environment/` (packages, engines), `formats/` (detection), `opening` (`OpenedData`, decode_cf fallback), `info/` (`get_file_info`), `plotting/` (`create_plot`: selection, `draw`, render). Dependencies flow `cli → info/plotting → opening → formats → environment`.
- `python/get_data_info.py` — thin entry point the extension spawns (= `python -m sdv_backend`); prints one JSON line consumed by `DataProcessor`.
- `python/tests/` — pytest tests for the Python backend.
- `test/suite/` — TS mocha tests mirroring `src/` layout.

## Conventions / gotchas

- **README.md is auto-generated** from `package.json` + `docs/documentation.json` — edit those and run `scripts/generate_readme.py`, never README.md directly.
- **`docs/architecture/` is generated** by `scripts/architecture/generate.py` — never edit it by hand. After adding / moving / renaming a module, a webview protocol message or a function named in a flow, run `generate.py --check`, fix what it reports in `scripts/architecture/` (layers, refs, notes, flows), then regenerate and commit (see `docs/DEVELOPMENT.md` § Architecture diagrams).
- New settings/commands go in `package.json` `contributes` and are read through `src/common/config.ts`.
- **`.vscodeignore` allow-lists the runtime files of `src/` and `python/`** (only `src/panel/webview/styles.css`; `python/get_data_info.py`, `check_package_availability.py`, `sdv_backend/**/*.py`). A new file read at runtime from those folders must be added there, else the `.vsix` breaks while F5 still works. vsce applies `!` patterns whatever their order. Check with `npx vsce ls`.
- Python code: ruff (config in `pyproject.toml`), double quotes, Python 3.13+.
- Releases: bump `package.json` version, update `CHANGELOG.md`, add `docs/RELEASE_NOTES_<ver>.md` (stays in `docs/`: `publish.sh` and the README generator read it there; see `docs/PUBLISHING.md`, `publish.sh`). Run `scripts/upgrade-sandbox.sh` before releasing a change to the uv environment.
- **Python requirements of the uv env** live in `ALL_REQUIREMENTS` (`src/python/ExtensionVirtualEnvironmentManager.ts`); pins on indirect dependencies that are not imported (e.g. `eccodeslib<2.48`, exit crash with pyproj) go in `ENVIRONMENT_CONSTRAINTS`. When a release needs existing envs changed, bump `ENVIRONMENT_REVISION` there: users with `useExtensionOwnEnvironment` get their env deleted and rebuilt once at next start (state in `sdv-environment.json` in the env folder; the old env is kept in `python-environment.previous` and restored if the rebuild fails). Python-extension / override interpreters are never modified.
- **Document every finished task (traceability)**: before ending a task, update the docs of the release in progress — `CHANGELOG.md` (Keep a Changelog sections; bold title + explanation + nested **Files** / **Tests** bullets), `docs/RELEASE_NOTES_<ver>.md` (TL;DR, rationale, upgrade notes, numbered manual verification steps, known limitations, summary table) and `docs/v<major.minor>/PR_SUMMARY_<ver>.md` (tables, testing commands, commit list as subjects only — no hashes, they change on rebase; with the other working docs of the release: `GETTING_STARTED.md` hub, manual / upgrade test plans) — plus any developer doc whose instructions the change makes stale (`docs/DEVELOPMENT.md`, this file). Leave the planning docs of `docs/v0.13/` (`README`, `TO_IMPLEMENT`, `TO_REMOVE`, `OUT_OF_SCOPE`, `PHASES`) and past release entries as historical records.
- Format with `pre-commit run --files <paths>` (pinned ruff/prettier), not tools from PATH; prettier needs Node 22 (`nvm use`).
- More docs: `docs/TECHNICAL_ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `CONTRIBUTING.md`.
