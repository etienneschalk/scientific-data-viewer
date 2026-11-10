# QA harnesses

Tools used for the v0.13.0 QA campaign ([`docs/v0.13/REVIEWS_0.13.0.md` § QA pass](../../docs/v0.13/REVIEWS_0.13.0.md#2-qa-pass)), kept to run again before a release. They complement `npm test` and `pytest`: they compare two versions of the backend, drive the real webview page with real input, and drive the extension inside a real VS Code. Nothing here ships in the `.vsix` (`scripts/**` is excluded).

Outputs go to `artefacts/qa/` (gitignored), or `$SDV_QA_OUT`.

## Setup

```bash
source ~/.nvm/nvm.sh && nvm use      # Node 22
npm run compile                      # the harnesses load out/
.venv/bin/python scripts/qa/fixtures/make_fixtures.py   # hostile / degenerate files -> artefacts/qa/fixtures/
```

`make_fixtures.py` needs xarray, netCDF4, h5netcdf, h5py, zarr, rasterio and kerchunk (the repository `.venv` has them). The harnesses also use `artefacts/sample-data/` (`python python/create_sample_data.py`).

| Variable                 | Default                                                                                                                                                                                           | Used by                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `SDV_QA_OUT`             | `<repo>/artefacts/qa`                                                                                                                                                                             | all                                                               |
| `SDV_PYTHON`             | the extension's uv environment if it exists, else `.venv/bin/python` (`paranoia.sh` builds `artefacts/backend-env` instead, like the extension's)                                                 | all (backend interpreter)                                         |
| `SDV_KERCHUNK_PYTHON`    | `.venv/bin/python`                                                                                                                                                                                | e2e (Kerchunk suites)                                             |
| `SDV_NO_KERCHUNK_PYTHON` | `$SDV_PYTHON`; `paranoia.sh` passes `artefacts/backend-env` (built like the extension's environment, never with `kerchunk`) when `$SDV_PYTHON` has `kerchunk`, e.g. installed from the error page | e2e (S2: clean error without `kerchunk`, then interpreter switch) |
| `SDV_QA_BASELINE`        | `$SDV_QA_OUT/baseline`                                                                                                                                                                            | backend                                                           |
| `CHROME_PATH`            | newest Playwright Chromium, else Chrome / Chromium / Edge on the PATH (`scripts/lib/chrome.mjs`, as for the screenshots)                                                                          | webview                                                           |
| `SDV_VSCODE_VERSION`     | `1.144.0`                                                                                                                                                                                         | e2e                                                               |

## Fixtures — `fixtures/make_fixtures.py`

HTML / script payloads in every name and value that reaches the page (NetCDF, nested groups, Zarr JSON attributes, GeoTIFF band descriptions), unicode / RTL / long names, names starting with `-`, file names with `#` `%25` `?` `;$(…)` quotes; `inf` / `nan` / huge attributes; odd dtypes and shapes; cftime calendars; empty, truncated and fake files; Zarr v2 / v3, unsuffixed, in ZIP (root, prefixed, two stores, corrupt, empty); Kerchunk inline, invalid, relative / absolute references; a slow dataset (`slow.nc`, ~20 s per plot) for cancel scenarios.

## Backend differential tests — `backend/`

Run the backend of a baseline checkout and of the working tree with the **same interpreter**, so differences come from the code.

```bash
scripts/qa/backend/make_baseline.sh v0.12.1       # git worktree in artefacts/qa/baseline
.venv/bin/python scripts/qa/backend/diff_info.py  # every sample + fixture: structural diff of `info`
.venv/bin/python scripts/qa/backend/diff_plot.py  # every variable: plot status + pixel comparison, report in artefacts/qa/backend/plots/plots.md
.venv/bin/python scripts/qa/backend/diff_scen.py  # ~100 plot-option scenarios (incl. the issue #117 gallery cases `i117_*`), report in artefacts/qa/backend/scenarios/scenarios.md
scripts/qa/backend/make_baseline.sh --remove
```

Each line says `SAME`, `DIFF` (images differ: check that the change is intended), `FIXED?`, `REGRESSION?`, `FLAKY?` or `BOTH-ERR`. `diff_plot.py` and `diff_scen.py` exit with 1 when a plot that worked in the baseline fails now. The scripts are run with any Python that has numpy and Pillow; `--python` (default `$SDV_PYTHON`) is the interpreter of the backend.

### Reading the results of `diff_plot.py` and `diff_scen.py`

Each case (a variable for `diff_plot.py`; a file, a variable and plot options for `diff_scen.py`) is plotted twice, by the **old** backend (the baseline) and the **new** one, and the two images are compared pixel by pixel below the title (the top 60 rows, which hold the creation time).

**Start with the report**, a Markdown file next to the images (open it with the Markdown preview): `scenarios/scenarios.md` and `plots/plots.md` in the output folder (`<run>/backend/` in a `paranoia.sh` run). One section per tag, the most worrying first; each case with its options, both statuses, image sizes, full error messages and the two images side by side. Identical cases are only listed (`diff_plot.py` keeps no image of them). A run of 20 or more times the same character, as in the names of the hostile fixtures, is shown as its start and length: `xxxxxxxx…[300 times 'x']`. The images themselves are `<name>.old.png` and `<name>.new.png`; `scenarios.json` / `plots.json` hold the same data.

The log (`qa-scen.log`, `qa-plot.log` in a `paranoia.sh` run) is an index of the same results. `diff_scen.py` writes two lines per scenario, the error message quoted (`''`: no error):

```text
TAG          name                       old=STATUS  'error message of the baseline'
                                        new=STATUS  'error message now'
```

`diff_plot.py` writes one line: `TAG file :: variable | old=STATUS message | new=STATUS message`.

**Status**, what one backend gave:

| Status    | Meaning                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------- |
| `OK`      | a plot image                                                                                        |
| `ERR`     | a clean error message (in the JSON)                                                                 |
| `NOJSON`  | no JSON at all: a crash, or the baseline rejects an option it does not know (argparse, exit code 2) |
| `TIMEOUT` | longer than `--timeout` (90 s)                                                                      |

**Tag**, the comparison (`classify` in `diff_plot.py`):

| Tag                     | Meaning                                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SAME`                  | both plot, pixel-identical images                                                                                                                              |
| `DIFF pixeldiff=0.0118` | both plot, images of the same size, 1.18 % of the pixels differ: something is drawn differently                                                                |
| `DIFF False`            | both plot, but the **images have different sizes** (figure size, layout, facets), so pixels cannot be compared: `False` is that comparison. Look at the images |
| `FIXED?`                | the baseline fails, the plot works now; also a new option, which the baseline rejects (`old=NOJSON`)                                                           |
| `REGRESSION?`           | the plot worked in the baseline and fails now: the only tag that fails the step (exit code 1)                                                                  |
| `FLAKY?`                | first `REGRESSION?` or `FIXED?`, but one of 4 runs again gave other statuses: a backend is random on this case (a warning, not a failure)                      |
| `BOTH-ERR`              | both fail, with the same message (first 60 characters)                                                                                                         |
| `ERR-CHANGED`           | both fail, with another message (`diff_scen.py` only): check that the new one is at least as clear                                                             |

Some cases are random: `unicode_names.nc` has a variable name of 300 characters, which the netcdf4 engine reads past netCDF-C's 256-byte limit (release notes, Known limitations), so both versions find the variable or not at random. Hence `FLAKY?`: a case tagged `REGRESSION?` or `FIXED?` is run 4 more times (`RETRIES` in `diff_plot.py`), and if any run gives other statuses it is `FLAKY?`. A random case can still come out `SAME` or `BOTH-ERR` (only `REGRESSION?` / `FIXED?` are run again), or, rarely, keep its first statuses 4 times.

`paranoia.sh` counts these tags: `DIFF`, `ERR-CHANGED` and `FLAKY?` make the step a warning (look at the report), `REGRESSION?` a failure.

## Webview scenarios — `webview/`

`harness.mjs` serves the page exactly as the panel builds it (HTMLGenerator markup, Content-Security-Policy, compiled `out/webview/webview.js`, `styles.css`, the VS Code theme variables recorded for `npm run screenshots`) to headless Chromium over the DevTools protocol, with a host shim on a CDP binding. Plot, refresh and load requests run the backend through the extension's compiled `buildCreatePlotCliArgs`, `runProcess` and `parseScriptResult`; abort really stops the process. Scenarios type with the keyboard and drag with the mouse, and record alerts, CSP violations and script errors.

```bash
node scripts/qa/webview/run-all.mjs            # render, controls, cancel (~5 min)
node scripts/qa/webview/cancel.mjs             # one file
```

| File           | Covers                                                                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `render.mjs`   | injection through every hostile fixture (live page and exported HTML), error pages, cards, narrow widths, refresh, **Empty** size of 0-byte variables, big files |
| `controls.mjs` | dimension slices (typing, pasting, slider drags), Reset per block, plot parameters, group overrides, load time in time zones                                     |
| `cancel.mjs`   | Cancel, Cancel All, Plot All, cancel races (uses `slow.nc`)                                                                                                      |

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

### Getting Started walkthrough — `e2e/walkthrough.cjs`

Every path a new user can take from installing the extension to a first plot of the walkthrough's sample, each in a **fresh VS Code profile** (`runner.cjs --fresh`: no interpreter preset, empty global storage, so no extension environment). Unlike the suites above, these scenarios **assert**: a scenario fails when the user would not get a plot, or when a walkthrough step would be checked before its goal is reached.

```bash
env -u ELECTRON_RUN_AS_NODE node scripts/qa/e2e/walkthrough.cjs          # every scenario (~5 min with a warm uv cache)
env -u ELECTRON_RUN_AS_NODE node scripts/qa/e2e/walkthrough.cjs w3 w5    # some of them
```

| Scenario | Fresh VS Code with                                   | The user                                                                                                                                                                                                                                                                                                                      |
| -------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1       | no Python extension, uv                              | opens the sample before setting up Python (the viewer explains), clicks _Let the Extension Manage Python (uv)_ (the open viewer recovers by itself), explores and plots, clicks it again (reused), then _Use My Own Interpreter_ (own environment turned off, override typed in the setting), and again with the override set |
| W2       | no Python extension, an interpreter with no packages | clicks _Use My Own Interpreter_, sets a bare `uv venv`, opens the sample and follows the viewer's **Install** buttons (xarray, NetCDF engines, matplotlib) until the plot works                                                                                                                                               |
| W3       | uv hidden from `PATH` (`--hide-uv`)                  | clicks _Let the Extension Manage Python (uv)_ (clean error, nothing turned on), then uses their own interpreter                                                                                                                                                                                                               |
| W4       | the Python extension installed before start          | clicks _Use My Own Interpreter_: **Python: Select Interpreter** opens; picks an interpreter there                                                                                                                                                                                                                             |
| W5       | other extensions allowed, none installed             | clicks _Use My Own Interpreter_ (setting), installs the Python extension in the same window, clicks again: **Python: Select Interpreter**; the interpreter picked is used without a restart                                                                                                                                   |

How a user action is simulated: a walkthrough button runs its command; **Create Plot** and an **Install** button send the webview request their button sends, through the panel's real message bus; typing a path in the settings is a settings update; picking in **Python: Select Interpreter** (a quick pick, closed by the scenario) is the Python extension's API `environments.updateActiveEnvironmentPath`. Walkthrough checkmarks are context keys (`completionEvents` `onContext:`), recorded from `setContextKey`. Each scenario ends with the plots of the "Explore and plot" step (every variable, slices, one line per station) and a **Save** next to the sample copy.

`runner.cjs` options used: `--fresh`, `--with-extensions` (no `--disable-extensions`), `--install-extension <id>` (CLI of the test VS Code, in the run's profile; exit 4 when it fails, reported as "could not run"), `--hide-uv` (the extension host's `PATH` without the folders holding `uv`). Needs uv (W1, W2: environment creation, bare venv, installs), network (packages, Python extension; a warm uv cache makes W1 fast) and `$SDV_PYTHON` as the "own interpreter" (Python ≥ 3.10 with xarray, netCDF4, matplotlib). Report: `artefacts/qa/e2e/walkthrough/REPORT.md` (`summary.json`); each run in `artefacts/qa/e2e/runs/walkthrough-<id>/`. `paranoia.sh --full` runs it as the `walkthrough` step.

**No window is left open.** A scenario stops at its first failure (mocha `bail`; the next steps depend on it) and every webview request has a time limit, so VS Code closes as soon as the scenario is over. If a run still goes past its limit (`SDV_WALKTHROUGH_LIMIT_S`, default 1200 s), the driver kills its process group and every process whose command line holds the run's folder (its VS Code, helpers, Python processes), and reports the scenario `TIMEOUT` (a failure). `extension.log` is written every 5 s, so a stopped run keeps its logs.
