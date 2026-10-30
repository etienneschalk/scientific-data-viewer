# QA harnesses

Tools used for the v0.13.0 QA campaign ([`docs/v0.13/QA_REPORT_0.13.0.md`](../../docs/v0.13/QA_REPORT_0.13.0.md)), kept to run again before a release. They complement `npm test` and `pytest`: they compare two versions of the backend, drive the real webview page with real input, and drive the extension inside a real VS Code. Nothing here ships in the `.vsix` (`scripts/**` is excluded).

Outputs go to `artefacts/qa/` (gitignored), or `$SDV_QA_OUT`.

## Setup

```bash
source ~/.nvm/nvm.sh && nvm use      # Node 22
npm run compile                      # the harnesses load out/
.venv/bin/python scripts/qa/fixtures/make_fixtures.py   # hostile / degenerate files -> artefacts/qa/fixtures/
```

`make_fixtures.py` needs xarray, netCDF4, h5netcdf, h5py, zarr, rasterio and kerchunk (the repository `.venv` has them). The harnesses also use `artefacts/sample-data/` (`python python/create_sample_data.py`).

| Variable              | Default                                                                                                                                                                                                     | Used by                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `SDV_QA_OUT`          | `<repo>/artefacts/qa`                                                                                                                                                                                       | all                       |
| `SDV_PYTHON`          | the extension's uv environment if it exists, else `.venv/bin/python` (`paranoia.sh` builds `artefacts/backend-env` instead, like the extension's; the e2e suite S2 needs an interpreter without `kerchunk`) | all (backend interpreter) |
| `SDV_KERCHUNK_PYTHON` | `.venv/bin/python`                                                                                                                                                                                          | e2e (Kerchunk suites)     |
| `SDV_QA_BASELINE`     | `$SDV_QA_OUT/baseline`                                                                                                                                                                                      | backend                   |
| `CHROME_PATH`         | newest Playwright Chromium (`npx playwright install chromium`)                                                                                                                                              | webview                   |
| `SDV_VSCODE_VERSION`  | `1.144.0`                                                                                                                                                                                                   | e2e                       |

## Fixtures — `fixtures/make_fixtures.py`

HTML / script payloads in every name and value that reaches the page (NetCDF, nested groups, Zarr JSON attributes, GeoTIFF band descriptions), unicode / RTL / long names, names starting with `-`, file names with `#` `%25` `?` `;$(…)` quotes; `inf` / `nan` / huge attributes; odd dtypes and shapes; cftime calendars; empty, truncated and fake files; Zarr v2 / v3, unsuffixed, in ZIP (root, prefixed, two stores, corrupt, empty); Kerchunk inline, invalid, relative / absolute references; a slow dataset (`slow.nc`, ~20 s per plot) for cancel scenarios.

## Backend differential tests — `backend/`

Run the backend of a baseline checkout and of the working tree with the **same interpreter**, so differences come from the code.

```bash
scripts/qa/backend/make_baseline.sh v0.12.1       # git worktree in artefacts/qa/baseline
.venv/bin/python scripts/qa/backend/diff_info.py  # every sample + fixture: structural diff of `info`
.venv/bin/python scripts/qa/backend/diff_plot.py  # every variable: plot status + pixel comparison
.venv/bin/python scripts/qa/backend/diff_scen.py  # ~80 plot-option scenarios, images in artefacts/qa/backend/scenarios/
scripts/qa/backend/make_baseline.sh --remove
```

Each line says `SAME`, `DIFF` (images differ: check that the change is intended), `FIXED?`, `REGRESSION?` or `BOTH-ERR`. `diff_plot.py` and `diff_scen.py` exit with 1 when a plot that worked in the baseline fails now. The scripts are run with any Python that has numpy and Pillow; `--python` (default `$SDV_PYTHON`) is the interpreter of the backend.

## Webview scenarios — `webview/`

`harness.mjs` serves the page exactly as the panel builds it (HTMLGenerator markup, Content-Security-Policy, compiled `out/webview/webview.js`, `styles.css`, the VS Code theme variables recorded for `npm run screenshots`) to headless Chromium over the DevTools protocol, with a host shim on a CDP binding. Plot, refresh and load requests run the backend through the extension's compiled `buildCreatePlotCliArgs`, `runProcess` and `parseScriptResult`; abort really stops the process. Scenarios type with the keyboard and drag with the mouse, and record alerts, CSP violations and script errors.

```bash
node scripts/qa/webview/run-all.mjs            # render, controls, cancel (~5 min)
node scripts/qa/webview/cancel.mjs             # one file
```

| File           | Covers                                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `render.mjs`   | injection through every hostile fixture (live page and exported HTML), error pages, cards, narrow widths, refresh, big files |
| `controls.mjs` | dimension slices (typing, pasting, slider drags), Reset per block, plot parameters, group overrides, load time in time zones |
| `cancel.mjs`   | Cancel, Cancel All, Plot All, cancel races (uses `slow.nc`)                                                                  |

Each check prints `PASS` / `FAIL` with its evidence; the exit code is 1 when one fails. Screenshots and exported pages go to `artefacts/qa/webview/`.

## Extension host end to end — `e2e/`

Mocha suites run inside a real VS Code by `@vscode/test-electron`, with a scratch user-data folder. They reach the live modules of the extension (`DataViewerPanel`, `UIController`, `MessageBus`), send webview requests through the real message bus, stub the save / open dialogs and check Python processes with `ps`.

```bash
env -u ELECTRON_RUN_AS_NODE node scripts/qa/e2e/runner.cjs all                 # every suite (~10 min)
env -u ELECTRON_RUN_AS_NODE node scripts/qa/e2e/runner.cjs s8 scripts/qa/e2e/suite/s8_multi.test.cjs
```

`ELECTRON_RUN_AS_NODE` must be unset when running from the VS Code terminal. Results: `artefacts/qa/e2e/runs/<run>/results.json` (observations) and `extension.log`. A VS Code window opens on the display.

| Suite                         | Covers                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `s1_open`                     | every format through the custom editors and the open commands; broken files    |
| `s2_kerchunk`, `s9_interp`    | Kerchunk opening and plotting; switching interpreters                          |
| `s3_plots`                    | plot options through the real host, abort, timeouts                            |
| `s4_save_security`            | save / open plot paths, command allowlist, package install arguments           |
| `s6_settings`                 | every setting that changes `info` or `plot`                                    |
| `s7_outline`, `s7b_expand`    | outline tree, clearing, switching panels, Expand All                           |
| `s8_multi`                    | several panels, closing during load, refresh races, rapid open / close         |
| `s10_roundtrip`, `s11_active` | export through the real webview, healthcheck; which panel is active in a split |

Most suites record observations in `results.json` rather than asserting everything; read them when a behaviour changes.
