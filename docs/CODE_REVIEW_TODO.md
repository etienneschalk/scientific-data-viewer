# Code review follow-up (v0.13.0)

Tracking list for the fixes found in the October 2026 codebase review.
A box is checked once the fix is implemented and the relevant tests pass.

Baseline before the work: `npm test` 294 passing, `pytest python/tests` 112 passing.

## 1. Security

- [x] **S1** Escape file-derived names (variables, coordinates, dimensions, groups, dims strings, error messages) inserted with `innerHTML` in the webview
- [x] **S2** Escape names used in `querySelector` attribute selectors (`CSS.escape`)
- [x] **S3** Allowlist the commands the webview may run through `executeCommand` (show logs, install packages, show settings)
- [x] **S4** Validate the `fileName` sent by the webview for `savePlot` / `openPlot` (no path separators / traversal)
- [x] **S5** Add a Content-Security-Policy to the webview (replace inline `onclick=` handlers first)

## 2. Extension host bugs

- [x] **H1** Drop `shell: true` from `uv` / Python spawns (version pins like `xarray>=2026.4.0` were shell redirects) and drop `quoteIfNeeded` for spawn args
- [x] **H2** "Open as Kerchunk / virtual Zarr" loses the `openAs=kerchunk` flag (URI rebuilt from `fsPath`)
- [x] **H3** `ErrorBoundary` hooks `process.on('uncaughtException')` in the shared extension host — remove
- [x] **H4** `ErrorBoundary` component handlers are never unregistered (closed panels leak)
- [x] **H5** "File too large" message prints the limit in bytes with an `MB` suffix
- [x] **H6** Plot save / save-as / webview export split paths on `/` (broken on Windows)
- [x] **H7** Save plot / Save as await the "file saved" notification → false timeout in webview, "Save All" stops
- [x] **H8** Concurrent Python (re)initialisation: single-flight init, serialise env create/upgrade, debounce `onDidEnvironmentsChanged`
- [x] **H9** "Install packages" uses `python -m pip`, which fails in the extension's own uv env
- [x] **H10** False "uv is not installed" error after enabling `useExtensionOwnEnvironment` when an override interpreter is set
- [x] **H11** Manage-environment UI writes `useExtensionOwnEnvironment` at Workspace level (fails with no folder open)
- [x] **H12** Subprocess robustness: no timeout on `getDataInfo` / init package check; non-JSON stdout resolved as raw string; `getDataInfo` swallows mapped errors into "file might be corrupted"
- [x] **H13** Stale interpreter state kept when no interpreter is found; `prepareExisting` marks env initialised when install failed
- [x] **H14** Outline: `treeView.reveal()` rejections uncaught; TreeView / emitter not disposed; outline not cleared when current panel closes
- [x] **H15** `openHealthcheckReport` opens the document twice; `forEach(async …)` fire-and-forget in open commands and `refreshPanelsWithErrors`
- [x] **H16** Outline links to group attributes don't match webview ids in nested attributes view (`attribute` vs `attributes`/`attr`)

## 3. Python backend bugs

- [x] **P1** Unexpected exceptions (corrupt / missing file) produce no JSON — catch-all in `extract.py` and `cli.main`
- [x] **P2** `inf` (and NaN inside tuples) in attributes crashes JSON serialisation
- [x] **P3** `ComplexEncoder.default` shadowed by `default=str` → numpy numbers / arrays serialised as strings
- [x] **P4** Global datetime filter applied to variables that don't have that dimension → `KeyError`
- [x] **P5** Time-variable name heuristic flags e.g. temperature `t` (units K); ranges computed from non-datetime values
- [x] **P6** One NaT in a time coordinate makes min/max `"NaT"`
- [x] **P7** cftime calendars: detection and min/max
- [x] **P8** `set_aspect("equal")` forced on every 2D plot
- [x] **P9** `h5py` listed as an xarray engine
- [x] **P10** Broken `NotImplementedError` fallback in `opening.py`
- [x] **P11** Unknown extensions reported as "Missing dependencies for Unknown files"
- [x] **P12** Root datetime variable (`"time"`, parent `"."`) resolved against the plotted variable's group

## 4. Webview bugs

- [x] **W1** `displayDataInfo` references undefined `contentContainer`, reads `dimensions_flattened` before the null guard, throws with no groups
- [x] **W2** Group time-control text inputs ignored; group datetime select not prefilled
- [x] **W3** Stale `globalTimeControlsState.datetimeVariableName` after Refresh
- [x] **W4** HTML strings assigned to `textContent`; stray `</div>`
- [x] **W5** `createPlot` timeout leaves the `pendingRequests` entry behind

## 5. Message bus and panel state (simplification)

- [x] **M1** Replace `MessageBus` with a small typed channel (request handlers + event emission only); remove the unused host-side request/response/event-listener path and convenience methods
- [x] **M2** Remove unused payload interfaces, `COMMANDS`, `isEventMessage`; type the protocol with one requests map and one events map
- [x] **M3** Remove unused request handlers (`getDataInfo`, `getCurrentFilePath`, `updateHeaders`) and the unused `pythonEnvironmentChanged` / `uiStateChanged` events
- [x] **M4** Replace `StateManager` (undo history, validation, unused actions) with plain fields; stop posting the full state on every change
- [x] **M5** One error path for load failures (drop the raw `{command:'error'}` post)
- [x] **M6** Pass plot options as one object end to end (webview → `UIController` → `DataProcessor` → CLI args builder) instead of 24 positional arguments
- [x] **M7** Remove redundant `try { … } catch (e) { throw e }`, dead `|| {}` on promises, and double `ErrorBoundary` wrapping
- [x] **M8** Rewrite `MessageBus` tests for the new channel

## 6. Dead code

- [x] **D1** `types.ts`: duplicate `DataInfoResult` / `DataInfoError`; `format_info.is_supported` and `format` never sent by Python
- [x] **D2** `package-types.ts`: unused types
- [x] **D3** `getCustomEditorViewTypes` unused while `extension.ts` hard-codes the list
- [x] **D4** Unused helpers: `isPlotOperationActive`, `getActiveOperations`, `ATTEMPT_CREATING_EXTENSION_OWN_UV_ENVIRONMENT`, unreachable `showErrorMessage`, `DEFAULT_PLOT_TIMEOUT_MS` comment, `HeaderExtractor.extractHeaders` (test-only, needs `DOMParser`), unreachable `'$(plus) Create'` case, `Logger.getThreadId` fallback, unused env `packages` field, uncertain Python-extension API fallbacks
- [x] **D5** Merge `CSSGenerator` / `JavaScriptGenerator` into one asset reader
- [x] **D6** Webview: "enable buttons" loop, `handlePlotTypeSelect`, `exportHtmlButton`, `sendRequest` logging monkey-patch, `getDataInfo`, `getActiveOperationIds`, outdated `SUPPORTED_EXTENSIONS_HARDOCDED`
- [x] **D7** CSS: `.variable-item`, `.dimension-item`, `.variable-row`, `.plot-progress`, ineffective 480px media query, commented-out CSS
- [x] **D8** Python: pre-DataTree group-listing branches, `is_spatial_dimension`, unreachable 2D/3D cmap branches, `ComplexEncoder` dead branches / unused `encoder` param, duplicate `XR_OPTIONS`, stray comments

- [x] **D9** `package.json`: unused runtime dependency `axios`; `jsdom` (tests only) moved to `devDependencies`

## 7. Over-engineering / structure

- [x] **O1** `HealthcheckManager`: merge overlapping checks, single Python package check, reuse package lists and uv detection, drop tautological checks
- [x] **O2** One `runProcess(cmd, args, { timeout })` helper instead of ~9 spawn-and-collect wrappers
- [x] **O3** `HealthcheckManager` / `DataProcessor` singletons → simpler ownership
- [x] **O4** Python plot strategies: replace ABC + registries + dispatcher with plain functions; collapse identical `*_imshow_merged_kw`; simplify engine tables
- [x] **O5** Webview: one plot-parameter table for global and group controls (render / read / reset / merge)
- [x] **O6** Webview: `resolvePlotOptions(variable)` shared by single and "all" plots; drop `globalTimeControlsState` DOM mirror; `sendRequest` timeout hook instead of the duplicated one in `createPlot`; shared CSS input class
- [x] **O7** Split `webview-script.js` into TypeScript modules bundled into one script with esbuild

## 8. Documentation

- [x] **Doc1** `CHANGELOG.md`, `docs/RELEASE_NOTES_0.13.0.md`, `docs/PR_SUMMARY_0.13.0.md`, and developer docs made stale by the changes (`CLAUDE.md`, `docs/DEVELOPMENT.md`, `docs/TECHNICAL_ARCHITECTURE.md`)
