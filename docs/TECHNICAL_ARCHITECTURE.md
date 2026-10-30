# Technical Architecture

How the extension is put together, for contributors. Commands and setup are in
`docs/DEVELOPMENT.md`; the Python backend modules are described there too.

Diagrams of everything below (module graphs, webview protocol, file-opening and
plot sequences, interpreter choice, uv environment, backend pipelines), generated
from the code: [`docs/architecture/`](./architecture/README.md).

## Overview

```
VS Code ──▶ extension.ts ──▶ DataViewerPanel ──▶ UIController ──▶ DataProcessor ──▶ PythonManager ──▶ python/get_data_info.py
                │                  │                  │                                                   (sdv_backend, one JSON line)
                │                  │                  └── MessageBus ◀──postMessage──▶ webview (out/webview/webview.js)
                │                  └── OutlineProvider / HeaderExtractor (outline tree)
                └── PythonManager + ExtensionVirtualEnvironmentManager (interpreter, uv env)
```

The extension host never parses data files itself: every load or plot spawns
`python/get_data_info.py` (`info` or `plot` mode) and reads one JSON line from stdout.

## Extension host (`src/`)

| Path                                                            | Responsibility                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extension.ts`                                                  | Activation, command registration, custom editors, creates the managers and hands the `DataProcessor` to `DataViewerPanel`.                                                                                                                                                                                                                                                  |
| `ScientificDataEditorProvider.ts`                               | Custom read-only editor: wraps the editor's webview panel in a `DataViewerPanel`.                                                                                                                                                                                                                                                                                           |
| `DataViewerPanel.ts`                                            | One per open viewer tab: panel lifecycle, de-duplication by URI (an `openAs=kerchunk` query makes a distinct view), outline updates.                                                                                                                                                                                                                                        |
| `panel/UIController.ts`                                         | Per-panel logic: loads the file, answers webview requests (plot, save, open, export, notifications, allowlisted commands), keeps the current file URI and data info.                                                                                                                                                                                                        |
| `panel/communication/`                                          | `MessageTypes.ts`: the wire protocol (`Requests` map: command → payload/result; `Events` map). `MessageBus.ts`: host side of the channel (`handle(command, fn)`, `emit(event, payload)`).                                                                                                                                                                                   |
| `panel/HTMLGenerator.ts`, `ThemeManager.ts`, `WebviewAssets.ts` | Page skeleton (with Content-Security-Policy), theme overrides for HTML export, reading the bundled script / CSS (cached, re-read in dev mode).                                                                                                                                                                                                                              |
| `panel/webview/`                                                | Webview front-end in TypeScript (DOM types, own `tsconfig.json`), bundled by `scripts/build-webview.mjs` (esbuild) into `out/webview/webview.js`. Entry `main.ts`; `bus.ts` (requests/events), `render/`, `plotParams.ts` (one table for global and group plot controls), `changedFields.ts` (outline of the changed controls), `plotActions.ts`, `export.ts`, `errors.ts`. |
| `shared/ids.ts`                                                 | `joinId`: element ids used by both the webview and the outline.                                                                                                                                                                                                                                                                                                             |
| `python/DataProcessor.ts`                                       | Builds the `info` / `plot` CLI arguments (`buildGetDataInfoCliArgs`, `buildCreatePlotCliArgs`) and runs the backend.                                                                                                                                                                                                                                                        |
| `python/PythonManager.ts`                                       | Interpreter selection (override → extension uv env → Python extension), single-flight (re)initialisation, package checks, subprocess execution with timeout and abort.                                                                                                                                                                                                      |
| `python/ExtensionVirtualEnvironmentManager*.ts`                 | Extension-owned uv environment: `ALL_REQUIREMENTS`, `ENVIRONMENT_CONSTRAINTS`, `ENVIRONMENT_REVISION` (outdated env deleted and rebuilt, previous one restored on failure), serialised create / recreate / update / delete, management UI.                                                                                                                                  |
| `common/`                                                       | `config.ts` (all settings), `Logger`, `ErrorBoundary` (per-component error handlers + history), `runProcess` (spawn without shell), `PerformanceTimer`, `HealthcheckManager.ts` (healthcheck report functions).                                                                                                                                                             |
| `outline/`                                                      | Outline tree of the viewer sections (`HeaderExtractor` builds the headers from the data info, `OutlineProvider` shows them).                                                                                                                                                                                                                                                |

## Webview protocol

All messages are plain JSON posted through `webview.postMessage` / `vscode.postMessage`:

- **webview → host**: `{ type: 'request', id, command, payload }`, answered by
  `{ type: 'response', requestId, success, payload?, error? }`. A handler that throws
  produces `success: false` with the error message; the webview shows it locally.
- **host → webview**: `{ type: 'event', event, payload }` — `dataLoaded`, `error`,
  `scrollToHeaderCommandEvent`, `exportWebviewCommandEvent`.

To add a message: add it to `Requests` or `Events` in `MessageTypes.ts`, register the
handler in `UIController.setupMessageHandlers` (or call `messageBus.emit`), and use it from
`src/panel/webview/`.

Security rules: everything that comes from a data file is escaped before it is inserted as
HTML (xarray's own HTML repr is the only raw HTML); the page has a CSP without inline
scripts; the host only runs the commands in `WEBVIEW_ALLOWED_COMMANDS` and only writes plot
files below the data file's folder (or the temp folder) — see `resolveWebviewFileName`.

## Error handling

- Load errors: `UIController.loadFile` catches everything and routes it through
  `ErrorBoundary.handleError`, whose per-panel handler emits an `error` event; backend errors
  keep their suggestion and type.
- Request errors (plot, save…) become failed responses and are shown next to the variable.
- Errors without a component handler fall back to the global handler (VS Code notification).
- Each `UIController` registers its handler on creation and unregisters it on dispose.

## Python backend (`python/sdv_backend/`)

See the module table in `docs/DEVELOPMENT.md`. Dependencies point one way:
`cli → info / plotting → opening → formats → environment`. Unexpected exceptions still
produce JSON (`{"error": ...}`), so the extension can always show a message.

## Testing

- `npm test`: VS Code integration tests (`test/suite/`, mirroring `src/`). The webview bundle is
  tested in jsdom (`test/suite/ui/webviewScript.test.ts`).
- `pytest python/tests` and `python python/tools/golden_snapshots.py check` for the backend.
