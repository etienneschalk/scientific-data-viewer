# Viewer screenshots: technical note

`npm run screenshots` takes full-page screenshots of the data viewer in the built-in VS Code themes and saves them in a folder named after the current version. Use it to review a UI change, to compare two releases, or to get images for documentation and release notes.

This note explains how to use the tool, how it works, what is real and what is simulated in the images, and how to extend it.

- [Quick start](#quick-start)
- [Output](#output)
- [Options](#options)
- [Requirements](#requirements)
- [How it works](#how-it-works)
- [What is real, what is simulated](#what-is-real-what-is-simulated)
- [Theme capture](#theme-capture)
- [The screenshot dataset](#the-screenshot-dataset)
- [Comparing versions](#comparing-versions)
- [Extending](#extending)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Design decisions](#design-decisions)
- [Files](#files)

---

## Quick start

```bash
nvm use                  # Node 22
npm run screenshots      # compiles, then 4 themes × 6 scenarios (~20 s)
```

Then open `screenshots/v0.13/index.html` in a browser.

---

## Output

```
screenshots/                       (git-ignored, excluded from the VSIX)
├── .fixture/
│   ├── screenshot_sample.nc       generated dataset (see below)
│   └── not_a_netcdf_file.nc       unreadable file, for the error page
└── v0.13/                         v<major>.<minor> of package.json
    ├── index.html                 gallery: one section per theme
    ├── dark-modern/
    │   ├── 01-overview.png
    │   ├── 02-expanded.png
    │   ├── 03-plots.png
    │   ├── 04-plot-error.png
    │   ├── 05-error-page.png
    │   └── 06-narrow.png
    ├── light-modern/
    ├── high-contrast/
    └── high-contrast-light/
```

- **Folder per version.** The version folder holds the major and minor numbers only, so every 0.13.x run writes to `v0.13/`, and a later run overwrites the files of an earlier one. Copy the folder (or pass `--out`) to keep a set.
- **Full page.** Each PNG holds the whole document, not only the visible part. Its width is the viewport width (1024 px by default, 420 px for `narrow`), multiplied by `--scale`. Its height is the height of the content: about 2,200 px for the overview and about 12,500 px with every section open.
- **Stable names.** A file is numbered by the scenario's position in the full list, so `--scenario plots` still writes `03-plots.png`. The gallery lists every PNG on disk, including those from earlier partial runs.

### Scenarios

| #   | Name         | What the page shows                                                                                                                                                                                                                        |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 01  | `overview`   | The page right after loading: the sections open by default and the first group open.                                                                                                                                                       |
| 02  | `expanded`   | Every `<details>` element open: file information, xarray HTML and text representations (whole file and per group), plot controls, every group, variable and attribute, troubleshooting.                                                    |
| 03  | `plots`      | **Create Plot** clicked on every data variable of every group. The script waits until no plot is loading (180 s at most).                                                                                                                  |
| 04  | `plot-error` | `9999` typed in the first **Dimension Slices** input (the global one, first dimension in alphabetical order), then **Create Plot** on the first variable. The backend fails with an out-of-range `IndexError`, shown in the error callout. |
| 05  | `error-page` | The page the panel shows when a file cannot be opened, with the backend's real error for a file that is not NetCDF.                                                                                                                        |
| 06  | `narrow`     | The overview at 420 px: stacked variable rows, smaller gutters, labels above inputs.                                                                                                                                                       |

### Themes

| Folder                | VS Code theme               | Body classes                                      |
| --------------------- | --------------------------- | ------------------------------------------------- |
| `dark-modern`         | Default Dark Modern         | `vscode-dark`                                     |
| `light-modern`        | Default Light Modern        | `vscode-light`                                    |
| `high-contrast`       | Default High Contrast       | `vscode-high-contrast`                            |
| `high-contrast-light` | Default High Contrast Light | `vscode-high-contrast-light vscode-high-contrast` |

---

## Options

Pass options after `--` with npm: `npm run screenshots -- --theme dark-modern`.

| Option              | Default                               | Effect                                                                                                                                                                                           |
| ------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--theme <id>`      | all four                              | Only this theme. Repeatable. IDs are the folder names above.                                                                                                                                     |
| `--scenario <name>` | all six                               | Only this scenario. Repeatable.                                                                                                                                                                  |
| `--setting <k=v>`   | `package.json` defaults               | Override an extension setting (name without `scientificDataViewer.`). The value is read as JSON when possible (`true`, `5`, `["a"]`), otherwise as text. Unknown names are an error. Repeatable. |
| `--file <path>`     | generated dataset                     | Show this data file instead. Every scenario uses it; `plot-error` assumes the file has at least one dimension.                                                                                   |
| `--python <path>`   | `$SDV_PYTHON`, `.venv`, `python3`     | Interpreter for the backend and the dataset generator.                                                                                                                                           |
| `--chrome <path>`   | `$CHROME_PATH`, then automatic search | Browser used for rendering (see [Requirements](#requirements)).                                                                                                                                  |
| `--width <px>`      | `1024`                                | Viewport width (`narrow` always uses 420).                                                                                                                                                       |
| `--scale <n>`       | `1`                                   | Device pixel ratio. Use `2` for sharp images in documents (files are 4× larger).                                                                                                                 |
| `--out <dir>`       | `screenshots`                         | Root folder, relative to the repository. The version folder and `.fixture/` go inside it.                                                                                                        |
| `--skip-compile`    | off                                   | Do not run `npm run compile` first. Changes to `styles.css` are picked up anyway (it is read from `src/`); TypeScript changes need a compile.                                                    |

Examples:

```bash
# Only the plots, in dark mode, without recompiling
npm run screenshots -- --skip-compile --theme dark-modern --scenario plots

# Features that are off by default
npm run screenshots -- --setting groupDimensionSlices=false

# Sharper and wider images for a blog post, written elsewhere
npm run screenshots -- --scale 2 --width 1280 --out /tmp/sdv-shots

# A real file
npm run screenshots -- --file sample-data/sample_data_multiple_groups.nc
```

The script exits with code 1 if any screenshot failed. The other screenshots are still written, and each failure is printed as `FAILED <theme> / <scenario>: <reason>`.

---

## Requirements

- **Node 22** (`nvm use`). The script needs the built-in `WebSocket`, which older Node versions lack; it says so if it is missing.
- **Python with xarray, netCDF4 and matplotlib**: the repository's `.venv` or the extension's uv environment. The script looks for, in order: `--python`, `$SDV_PYTHON`, `.venv/bin/python` (`.venv\Scripts\python.exe` on Windows), then `python3` (`python` on Windows).
- **A Chromium-based browser**, run headless. The script looks for, in order:
  1. `--chrome`, then `$CHROME_PATH`;
  2. Playwright's Chromium in its cache (`~/.cache/ms-playwright`, `~/Library/Caches/ms-playwright`, `%LOCALAPPDATA%\ms-playwright`), newest build first;
  3. `google-chrome`, `google-chrome-stable`, `chromium`, `chromium-browser`, `microsoft-edge` on `PATH`;
  4. the standard install locations of Chrome / Chromium on macOS and Chrome / Edge on Windows.

  If none is found: `npx playwright install chromium`, or pass `--chrome`.

- **A display is not needed** for screenshots (headless). It is needed for [theme capture](#theme-capture).

---

## How it works

```
take-screenshots.mjs
 ├─ npm run compile                         (unless --skip-compile)
 ├─ load out/src/panel/HTMLGenerator.js     (with a stub `vscode` module)
 ├─ python make_fixture.py                  → screenshots/.fixture/*.nc
 ├─ python get_data_info.py info …          → data for the page
 ├─ python get_data_info.py info <broken>   → data for the error page
 ├─ HTTP server on 127.0.0.1:<random port>
 │    GET  /<theme-id>     the viewer page in that theme
 │    POST /plot           runs get_data_info.py plot …, returns the PNG
 └─ headless Chromium, driven over the DevTools protocol
      for each theme × scenario: open page → run scenario → full-page PNG
 → screenshots/v<major.minor>/<theme>/NN-<scenario>.png, index.html
```

### 1. Building the page

The script loads the compiled extension modules from `out/` with Node's `require`. It replaces the `vscode` module with a small stub and passes `package.json` to `setPackageJson`, so that `getDisplayName()` and `getVersion()` work. It then calls `HTMLGenerator.generateMainHTML(...)`, the same function the panel uses. Without webview options, this function inlines `styles.css` and the webview bundle `out/webview/webview.js` (as the HTML export does), so the page needs no other file.

Three things are added to that HTML for each theme:

- the `--vscode-*` variables, in the `style` attribute of `<html>`, where VS Code puts them;
- the attributes of `<body>` (`class="vscode-dark"`, `data-vscode-theme-kind`, `data-vscode-theme-name`...), which the stylesheet and xarray's HTML representation use;
- VS Code's default webview stylesheet (`<style id="_defaultStyles">`: default fonts, link and `code` colors, scrollbars), plus a fake host script (next section).

### 2. The fake host

In VS Code, the webview script talks to the extension through `acquireVsCodeApi().postMessage(...)` and receives events (`dataLoaded`, `error`) and responses as `message` events. The injected script defines `acquireVsCodeApi()` and plays the extension's role:

- **On load**, it sends the `dataLoaded` event with the same structure as `UIController`. It contains: the backend's `info` result, the file path, the load time (time of the run), the interpreter path (shown under Troubleshooting) and the extension settings (the `package.json` defaults with any `--setting` overrides; the page uses them for feature flags and the plot timeout, and shows them under Troubleshooting). With `?error` in the URL, it sends the `error` event instead (see [What is simulated](#what-is-real-what-is-simulated)).
- **`createPlot` requests** are forwarded to `POST /plot`. The server builds the command line with `buildCreatePlotCliArgs` from the compiled `DataProcessor` (the extension's own function, so every plot control applies), runs the backend, and returns the base64 PNG, or the error as `Data processing error: <message>` (`UIController`'s wording).
- **Other requests** (save, open, notifications, commands) get an empty success answer. No file is written and no command runs.

The matplotlib style follows the extension's logic: `dark_background` when the theme kind is `vscode-dark`, `default` otherwise (High Contrast included), unless the `matplotlibStyle` setting is set. Results are cached by command line for the whole run, so a plot is computed once per theme.

### 3. Driving the browser

The script starts the browser with `--headless --remote-debugging-port=0` and a temporary profile. It reads the DevTools WebSocket address from the browser's output and talks to it with Node's `WebSocket`, through a small DevTools protocol client of about 80 lines (`Browser` class). For each screenshot:

1. Open a new tab, set the viewport (width × 900 px, `--scale` pixel ratio).
2. Load `http://127.0.0.1:<port>/<theme>[?error]` and wait for the `load` event, then for the loading message to disappear (30 s at most).
3. Run the scenario's `action` in the page (`Runtime.evaluate`, awaited), if any.
4. Wait for web fonts and two animation frames, so the layout is final.
5. Measure `document.documentElement.scrollHeight` and resize the viewport to that height (at most 16,000 px; beyond that, Chromium's `captureBeyondViewport` is used), so the whole page is one image and `position: sticky` elements sit at the top as in the real panel.
6. Scroll to the top, capture a PNG, close the tab.

Screenshots are taken one at a time. Plots within a scenario run in parallel, one backend process per variable, like clicking **Create Plot** on several variables in VS Code.

---

## What is real, what is simulated

| Part of the image                                                             | Source                                                                                                                                               |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Markup, stylesheet, webview script                                            | **Real**: the extension's code from `out/` and `src/`, as in the panel                                                                               |
| File information, variables, attributes, xarray HTML and text representations | **Real**: `get_data_info.py info` with the extension's arguments (`buildGetDataInfoCliArgs`, default settings)                                       |
| Plots and plot errors                                                         | **Real**: `get_data_info.py plot` with the extension's arguments (`buildCreatePlotCliArgs`)                                                          |
| Theme colors, fonts, default webview styles                                   | **Recorded** from a real VS Code (see [Theme capture](#theme-capture)); not live from your VS Code                                                   |
| Error page content                                                            | **Real** backend error (message, suggestion, type) for an unreadable file; the event that shows it is sent by the fake host, as `UIController` would |
| Extension settings                                                            | `package.json` defaults plus `--setting`, **not** your user or workspace settings                                                                    |
| Python path under Troubleshooting                                             | The interpreter used by the script                                                                                                                   |
| "Loaded" time, plot creation date                                             | Time of the run                                                                                                                                      |
| VS Code itself (tabs, sidebar, outline)                                       | **Not shown**: only the webview content is captured                                                                                                  |
| Clicks                                                                        | Simulated in the page with `element.click()` and input events, as a user would                                                                       |

---

## Theme capture

The theme variables live in `scripts/screenshots/themes/<id>.json`, which are committed. Each file holds:

| Field           | Content                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------- |
| `id`            | Folder name of the screenshots                                                               |
| `vscodeName`    | Value of `workbench.colorTheme`                                                              |
| `vscodeVersion` | VS Code version it was recorded with (1.144.0 for the files committed with v0.13)            |
| `htmlStyle`     | The `style` attribute of the webview's `<html>`: every `--vscode-*` variable, fonts included |
| `body`          | Every attribute of the webview's `<body>`                                                    |
| `defaultStyles` | Text of VS Code's `<style id="_defaultStyles">`                                              |

To record them again (after a VS Code update that changes the default themes, or to add a theme):

```bash
node scripts/screenshots/capture-themes.mjs [--vscode-version 1.150.0]
```

The script starts a real VS Code with `@vscode/test-electron`, the package `npm test` uses, which also caches VS Code in `.vscode-test/`. It runs a throwaway extension (`theme-capture-extension/`) as that VS Code's test suite. For each theme of `themes.mjs`, the extension sets `workbench.colorTheme` in the test instance's own profile (never yours), waits for the theme to apply, opens a webview, and writes what the webview received to the JSON file. JSON is written with 4-space indentation, so the files pass prettier unchanged and a new capture only shows real differences in `git diff`.

It needs a display, like `npm test` (Linux CI: `xvfb-run`). From a VS Code terminal it unsets `ELECTRON_RUN_AS_NODE` itself. It takes about a minute.

The fonts are part of the recording: `--vscode-font-family` is `system-ui, "Ubuntu", "Droid Sans", sans-serif` when recorded on Linux. A browser on macOS or Windows falls back to its own fonts for names it does not have, so text metrics, and therefore page heights, differ slightly between operating systems.

---

## The screenshot dataset

`scripts/screenshots/make_fixture.py` writes `screenshot_sample.nc`, a NetCDF4 file of about 270 kB. It is built with a fixed random seed, so it is the same at every run and in every version:

| Group    | Variable                  | Dimensions       | Plot type                    |
| -------- | ------------------------- | ---------------- | ---------------------------- |
| `/`      | `temperature`             | (time, lat, lon) | Faceted maps (one per month) |
| `/`      | `elevation`               | (lat, lon)       | Map with diverging colors    |
| `/`      | `global_mean_temperature` | (time)           | Line                         |
| `/ocean` | `sea_surface_temperature` | (time, lat, lon) | Faceted maps                 |

Coordinates: `time` (12 months of 2025, `datetime64`), `lat` (36), `lon` (72), with CF attributes and units. Global attributes include a title, an institution, a source and `Conventions = CF-1.8`.

It covers every part of the viewer: groups, coordinates, 1D / 2D / 3D variables, attributes, datetime variables, and plots that take one or two seconds each. Next to it, `not_a_netcdf_file.nc` is a text file, for the error page.

---

## Comparing versions

1. On the old version, run `npm run screenshots` and keep `screenshots/v0.13/` (the folder is ignored by git, so it survives checkouts).
2. On the new version (with the `package.json` version raised), run it again: it writes `screenshots/v0.14/`.
3. Compare the two folders: open both `index.html` files, or use an image diff tool on files with the same name.

Some differences are expected and do not come from the UI: the load time, the plot creation date and the interpreter path change at every run. A different Python environment (matplotlib version) can change plots slightly.

---

## Extending

**Add a scenario**: add an entry to `SCENARIOS` in `take-screenshots.mjs`.

```js
{
    name: 'variable-attributes',        // file: 07-variable-attributes.png
    width: 800,                         // optional, default --width
    query: '',                          // optional, page URL query ('error' = error page)
    action: async () => {               // optional, runs inside the page
        document.querySelector('.variable-details').open = true;
        document.querySelector('[data-action="create-plot"]').click();
        await waitFor(() => !document.querySelector('.plot-loading'), 60000);
    },
},
```

`action` is converted to text and run in the page, so it can only use what the page has: the DOM and the injected `waitFor(condition, timeoutMs)` helper. It cannot use variables of the script. Add new scenarios at the end of the list: inserting one in the middle renumbers the files after it, and comparing with older folders gets harder.

**Add a theme**: add `{ id, vscodeName }` to `THEMES` in `themes.mjs`, using the exact name in VS Code's theme picker. Then run `capture-themes.mjs`. Only themes shipped with VS Code can be captured, because the test instance runs with `--disable-extensions`.

**Change the dataset**: edit `make_fixture.py`. Every later screenshot changes, so do it at the start of a release, not in the middle of a comparison.

---

## Troubleshooting

| Message                                              | Cause and fix                                                                                                                                                                                                                |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Node v… has no WebSocket: use Node 22`              | `nvm use`                                                                                                                                                                                                                    |
| `out/ is missing: run npm run compile`               | Run without `--skip-compile`                                                                                                                                                                                                 |
| `no Chrome / Chromium found`                         | `npx playwright install chromium`, or `--chrome <path>`                                                                                                                                                                      |
| `Chrome did not start` / `Chrome exited`             | The browser's output is printed. On Linux as root, the browser may refuse to start; the script already passes `--no-sandbox` on Linux. A Snap Chromium cannot always use `/tmp` profiles: use Playwright's Chromium instead. |
| `the backend could not read …`                       | The interpreter lacks xarray / netCDF4: pass `--python` (for example the extension's uv environment)                                                                                                                         |
| `themes/<id>.json is missing`                        | Run `capture-themes.mjs`                                                                                                                                                                                                     |
| `FAILED <theme> / plots: timeout`                    | A plot took more than 180 s (large `--file`): use the default dataset, or fewer scenarios                                                                                                                                    |
| `FAILED <theme> / plot-error: …`                     | With `--file`, the file has no dimension slice input (no dimensions) or no data variable                                                                                                                                     |
| Plots missing, error callout "Data processing error" | matplotlib is missing in the interpreter                                                                                                                                                                                     |

---

## Limitations

- The screenshots show the webview only, not VS Code around it: no tab bar, sidebar, outline or notifications.
- Settings are the defaults (plus `--setting`), not the user's.
- `plot-error` relies on the first dimension slice input of the page and on the first **Create Plot** button. It depends on the dataset (default: first dimension alphabetically, of size < 9999).
- The theme files are a recording. A theme change in a newer VS Code shows up only after `capture-themes.mjs` runs again.
- Chromium applies `@media (prefers-color-scheme)` and native form controls (date picker icon, select arrow) its own way. VS Code's Electron is also Chromium, so they match in practice, but the Chromium versions differ.
- The xarray HTML representation brings its own styles. They are keyed on `body.vscode-dark`, and in high-contrast themes they keep xarray's colors.
- `--file` with a very large file is slow: `plots` plots every data variable with the auto plot type, without slicing.

---

## Design decisions

- **No new npm dependency.** Puppeteer or Playwright would add a large dev dependency and a browser download to `npm install`. The DevTools protocol calls needed here (new tab, viewport, navigate, evaluate, screenshot) take about 80 lines over Node 22's built-in `WebSocket`, and any installed Chromium-based browser works.
- **Real page, real backend.** Mock data would drift from the backend's JSON. Building the page with `HTMLGenerator` and calling the backend with the extension's own `buildGetDataInfoCliArgs` / `buildCreatePlotCliArgs` means the screenshots break when the viewer breaks, and only then.
- **Recorded themes.** Screenshotting the webview inside VS Code would need to attach to Electron's webview iframes, which is fragile and needs a display at every run. Recording the variables once in a real VS Code gives exact theme colors, and the screenshots then run headless anywhere, including in CI.
- **Generated dataset.** The files in `sample-data/` are optional, machine-specific and partly very large (a 3D variable of 365 × 180 × 360 takes minutes to plot). A seeded dataset of 270 kB plots in a couple of seconds and stays the same across versions, which is what comparisons need.
- **Version folder `v<major>.<minor>`** matches the `docs/v0.13/` convention: one set per release line, overwritten by patch releases.

---

## Files

| File                                           | Role                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `scripts/screenshots/take-screenshots.mjs`     | The tool (`npm run screenshots`): page building, fake host, HTTP server, browser driver, gallery  |
| `scripts/screenshots/themes.mjs`               | List of themes (`id`, VS Code name) and the location of the theme files                           |
| `scripts/screenshots/themes/*.json`            | Recorded theme variables, committed                                                               |
| `scripts/screenshots/capture-themes.mjs`       | Records the theme files from a real VS Code                                                       |
| `scripts/screenshots/theme-capture-extension/` | Throwaway extension run inside that VS Code (CommonJS, as VS Code requires)                       |
| `scripts/screenshots/make_fixture.py`          | Generates the screenshot dataset and the unreadable file                                          |
| `package.json`                                 | `screenshots` npm script                                                                          |
| `.gitignore`, `.vscodeignore`                  | Keep `screenshots/` out of git and out of the VSIX (`scripts/` is already excluded from the VSIX) |
