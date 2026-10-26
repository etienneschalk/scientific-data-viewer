# CLAUDE.md

VSCode extension (`eschalk0.scientific-data-viewer`) for inspecting scientific data files (NetCDF, CDF, HDF5, Zarr incl. zipped, GRIB, GeoTIFF/COG, JPEG-2000, Kerchunk). A TypeScript frontend shells out to Python scripts that use xarray to extract metadata and render plots.

## Commands

```bash
npm install                 # deps (Node >= 22)
npm run compile             # tsc -> out/  (entry: out/src/extension.js)
npm run watch               # incremental compile
npm run lint                # eslint --fix on src/
npm test                    # VSCode integration tests (mocha via @vscode/test-electron, out/test/runTest.js); needs a display (CI uses Xvfb)
npm run package             # build .vsix with vsce
pytest python/tests         # Python-side tests (need xarray etc. installed)
python python/tools/golden_snapshots.py check   # backend JSON vs local snapshots (record first)
pre-commit run --all-files  # prettier, eslint, tsc --noEmit, ruff, ruff-format, detect-secrets...
python python/create_sample_data.py [--overwrite]   # create sample-data/ (generators in python/sample_data/)
python scripts/generate_readme.py     # regenerate README.md
```

## Architecture

- `src/extension.ts` — activation, command registration.
- `src/ScientificDataEditorProvider.ts` — custom editor for supported file types; `src/DataViewerPanel.ts` — webview panel lifecycle.
- `src/panel/` — webview UI: `HTMLGenerator`, `CSSGenerator`, `JavaScriptGenerator` build the page as strings; `UIController` orchestrates; `communication/MessageBus` + `MessageTypes` define extension<->webview messages; `state/AppState`.
- `src/python/` — `PythonManager` (interpreter selection via the official Python extension API, subprocess execution/abort), `ExtensionVirtualEnvironmentManager` (extension-owned uv/venv), `DataProcessor` (singleton calling scripts in `python/`).
- `src/outline/` — document outline (headers) for the viewer.
- `src/common/` — config access, Logger, ErrorBoundary, PerformanceTimer, Healthcheck.
- `python/sdv_backend/` — the Python backend package: `cli` (argparse → `InfoOptions`/`PlotOptions`), `results` (JSON contract), `environment/` (packages, engines), `formats/` (detection), `opening` (`OpenedData`, decode_cf fallback), `info/` (`get_file_info`), `plotting/` (`create_plot`: selection, strategies, render). Dependencies flow `cli → info/plotting → opening → formats → environment`.
- `python/get_data_info.py` — thin entry point the extension spawns (= `python -m sdv_backend`); prints one JSON line consumed by `DataProcessor`.
- `python/tests/` — pytest tests for the Python backend.
- `test/suite/` — TS mocha tests mirroring `src/` layout.

## Conventions / gotchas

- **README.md is auto-generated** from `package.json` + `docs/documentation.json` — edit those and run `scripts/generate_readme.py`, never README.md directly.
- New settings/commands go in `package.json` `contributes` and are read through `src/common/config.ts`.
- Python code: ruff (config in `pyproject.toml`), double quotes, Python 3.13+.
- Releases: bump `package.json` version, update `CHANGELOG.md`, add `docs/RELEASE_NOTES_<ver>.md` (see `docs/PUBLISHING.md`, `publish.sh`).
- **Document every finished task (traceability)**: before ending a task, update the docs of the release in progress — `CHANGELOG.md` (Keep a Changelog sections; bold title + explanation + nested **Files** / **Tests** bullets), `docs/RELEASE_NOTES_<ver>.md` (TL;DR, rationale, upgrade notes, numbered manual verification steps, known limitations, summary table) and `docs/PR_SUMMARY_<ver>.md` (tables, testing commands, commit list) — plus any developer doc whose instructions the change makes stale (`docs/DEVELOPMENT.md`, this file). Leave planning docs (`docs/v0.13/`) and past release entries as historical records.
- Format with `pre-commit run --files <paths>` (pinned ruff/prettier), not tools from PATH; prettier needs Node 22 (`nvm use`).
- More docs: `docs/TECHNICAL_ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `CONTRIBUTING.md`.
