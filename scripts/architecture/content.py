"""Text of the architecture document: one entry per section, shared by the HTML
page and the Markdown index. Inline code is written between backticks.

Numbers and module lists come from ``codebase.Facts`` and the import graph;
the symbols the text names are listed in each section's ``refs`` and checked.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from codebase import Facts

TITLE = "Scientific Data Viewer architecture"
LEDE = (
    "How the VS Code extension is put together: three processes, two message boundaries, and the modules on each "
    "side. The module graphs are computed from the import statements in `src/` and `python/sdv_backend/`; the "
    "flows follow the code paths they name."
)
LEGEND = [
    ("sw web", "Webview"),
    ("sw host", "Extension host (Node)"),
    ("sw py", "Python backend"),
    ("sw ext", "External: VS Code, uv, files, xarray"),
    ("sw warn", "Failure path"),
    ("ls", "call"),
    ("ls dash", "return / response"),
    ("ls web", "webview message"),
    ("ls warn", "kill signal"),
]
HOST_LEGEND = [
    ("sw host", "src/ (entry)"),
    ("sw web", "src/panel/"),
    ("sw ext", "src/outline/"),
    ("sw py", "src/python/"),
    ("sw common", "src/common/"),
    ("sw shared", "src/shared/"),
]

# What the host does with each request / when it emits each event. Keys must
# match the Requests and Events maps of MessageTypes.ts.
REQUEST_NOTES = {
    "createPlot": "`DataProcessor.createPlot`",
    "abortPlot": "`PythonManager.abortProcess`",
    "savePlot": "writes next to the data file",
    "savePlotAs": "save dialog",
    "openPlot": "writes to the temp folder, opens it",
    "refresh": "`loadFile` again",
    "showNotification": "info / warning / error toast",
    "executeCommand": "only the commands in `WEBVIEW_ALLOWED_COMMANDS`",
    "exportWebview": "saves the captured page",
}
EVENT_NOTES = {
    "dataLoaded": "each successful load or refresh",
    "error": "`ErrorBoundary` handler of the panel",
    "scrollToHeaderCommandEvent": "an outline entry is clicked",
    "exportWebviewCommandEvent": "Export command from the palette",
}


@dataclass
class Section:
    id: str
    title: str
    intro: str
    caption: str = ""
    read: list[str] = field(default_factory=list)
    legend: list[tuple[str, str]] = field(default_factory=list)
    refs: dict[str, list[str]] = field(default_factory=dict)
    figure: bool = True  # False: the section is the protocol tables


def _code_list(items: list[str]) -> str:
    quoted = [f"`{item}`" for item in items]
    return (
        quoted[0] if len(quoted) == 1 else ", ".join(quoted[:-1]) + " and " + quoted[-1]
    )


def sections(facts: Facts, webview_host_imports: list[str]) -> list[Section]:
    plot_timeout = f"{facts.default_plot_timeout_ms / 1000:g} s"
    grace = f"{facts.kill_grace_ms / 1000:g} s"
    shared = _code_list([f"src/{m}.ts" for m in webview_host_imports])
    return [
        Section(
            "processes",
            "Three processes, two boundaries",
            "Each viewer tab is a sandboxed webview that can only post messages. The extension host owns the VS Code "
            "APIs and every panel's state. Python never stays resident: each info or plot request spawns "
            "`get_data_info.py`, which prints exactly one JSON line and exits.",
            "Teal arrows cross the webview boundary (postMessage); green arrows cross the process boundary (argv in, "
            "one JSON line out, logs on stderr forwarded to the Logger). The `common/` utilities used by every module "
            "(Logger, config, ErrorBoundary, runProcess), the status bar item and the healthcheck are left out.",
            read=[
                "src/extension.ts",
                "src/DataViewerPanel.ts",
                "src/panel/UIController.ts",
                "src/python/PythonManager.ts",
                "python/sdv_backend/cli.py",
            ],
        ),
        Section(
            "protocol",
            "The webview protocol",
            "The webview sends requests and gets one response per request id; the host only emits events. Both maps "
            "are typed in `MessageTypes.ts` (the tables below are read from it) and mirrored by the webview's "
            "`bus.ts`. File names coming from the webview are resolved with `resolveWebviewFileName`, which rejects "
            "absolute paths and `..` segments.",
            read=[
                "src/panel/communication/MessageTypes.ts",
                "src/panel/communication/MessageBus.ts",
                "src/panel/webview/bus.ts",
            ],
            refs={
                "src/panel/UIController.ts": [
                    "resolveWebviewFileName",
                    "WEBVIEW_ALLOWED_COMMANDS",
                    "loadFile",
                ],
                "src/python/DataProcessor.ts": ["createPlot"],
                "src/python/PythonManager.ts": ["abortProcess"],
            },
            figure=False,
        ),
        Section(
            "host-modules",
            "Extension host modules",
            "Dependencies run top to bottom, from activation to leaf utilities. Edges out of `extension.ts` are faint "
            "because it wires everything. `Logger`, `config`, `vscodeutils` and `types` are imported almost "
            "everywhere and are left out.",
            "Thick borders mark the four classes on the main request path: DataViewerPanel, UIController, "
            "DataProcessor, PythonManager. Hover a box in the HTML page for its full path.",
            legend=HOST_LEGEND,
        ),
        Section(
            "webview-modules",
            "Webview bundle",
            "Built separately by esbuild into `out/webview/webview.js`, with its own `tsconfig.json` and DOM types. "
            f"Outside its own folder it imports only {shared}, so the message protocol is the only runtime contract "
            "between the two sides. `plotParams.ts` is the single table of plot controls.",
            "`main.ts` installs one delegated click listener (the CSP forbids inline handlers) and dispatches on "
            "element ids and `data-action` attributes. Without a VS Code API (exported HTML opened in a browser) the "
            "bus runs in degraded mode and rejects every request.",
            refs={
                "src/panel/webview/plotParams.ts": ["PLOT_PARAMETERS"],
                "src/panel/webview/main.ts": ["data-action"],
                "src/panel/webview/bus.ts": ["isDegradedMode"],
                "scripts/build-webview.mjs": ["esbuild"],
            },
        ),
        Section(
            "open-file",
            "Opening a file",
            "The custom editor path, from double-clicking a `.nc` in the Explorer to a filled page and outline. "
            "Opening through a command goes through `DataViewerPanel.createOrReveal` instead of the provider, and "
            "joins this flow at `loadFile`.",
            "Step 2 is why panels never race the interpreter selection: the provider waits for `PythonManager`'s "
            "initialization promise before creating the panel. The outline caches headers per panel id and switches "
            "trees when another panel becomes visible.",
            refs={
                "src/outline/OutlineProvider.ts": [
                    "switchToPanel",
                    "getHeadersForPanel",
                ]
            },
        ),
        Section(
            "plot",
            "Creating and cancelling a plot",
            "The webview generates an `operationId` that travels down to `PythonManager`, which keeps one "
            "`AbortController` per running operation. Two timers read the same `plotTimeoutMs` setting (default "
            f"{plot_timeout}): the webview's sends `abortPlot` when it fires, and the host's kills the process even "
            "when the panel is already gone.",
            "“Create all plots” runs these requests with a concurrency limit so that cancel requests still get "
            "through. Steps 16 and 19 are the same `runProcess` stop routine: SIGTERM, then SIGKILL after a "
            f"{grace} grace period.",
            read=[
                "src/panel/webview/plotActions.ts",
                "src/python/PythonManager.ts (runPythonScript, abortProcess, parseScriptResult)",
                "src/common/runProcess.ts",
            ],
            refs={
                "src/panel/webview/plotActions.ts": [
                    "handleCreateAllPlots",
                    "concurrency",
                ],
                "src/python/PythonManager.ts": ["runPythonScript"],
            },
        ),
        Section(
            "interpreter",
            "Choosing the Python interpreter",
            "Runs at activation and again when an interpreter-related setting changes, when workspace folders "
            "change, or when the Python extension reports a new active environment. Runs are single-flight: a "
            "request made during a run queues one more run, and only the latest run commits its result.",
            "When the extension's own environment is enabled but unusable, the reason is kept in "
            "`ownEnvironmentIssue` and shown to the user (for example “uv is not installed”) instead of switching "
            "interpreters silently.",
            read=[
                "src/python/PythonManager.ts (forceInitialize, selectInterpreter, prepareOwnEnvironment)",
                "src/python/officialPythonExtensionApiUtils.ts",
            ],
            refs={
                "src/extension.ts": [
                    "onDidChangeConfiguration",
                    "onDidChangeWorkspaceFolders",
                    "setupOfficialPythonExtensionChangeListeners",
                    "reportOwnEnvironmentNotUsed",
                ],
                "src/python/PythonManager.ts": ["_reinitializeRequested"],
            },
        ),
        Section(
            "environment",
            "The extension-owned uv environment",
            "Applies only with `useExtensionOwnEnvironment` on; override and Python-extension interpreters are never "
            "modified. Bumping `ENVIRONMENT_REVISION`, or changing `ALL_REQUIREMENTS` or `ENVIRONMENT_CONSTRAINTS`, "
            "makes every existing environment rebuild once at the next start. All operations on the folder go "
            "through one promise queue, so startup, a settings change and the Manage command never install at the "
            "same time.",
            "The environment lives in the extension's globalStorage as `python-environment/`, with "
            "`sdv-environment.json` recording the revision and requirements it was built with. A rebuild interrupted "
            "by closing VS Code is repaired by the first check at the next start.",
            read=[
                "src/python/ExtensionVirtualEnvironmentManager.ts",
                "src/python/ExtensionVirtualEnvironmentManagerUI.ts",
                "scripts/upgrade-sandbox.sh",
            ],
            refs={
                "src/python/ExtensionVirtualEnvironmentManager.ts": [
                    "serialize",
                    "operationQueue",
                ],
                "src/common/config.ts": ["useExtensionOwnEnvironment"],
            },
        ),
        Section(
            "backend-packages",
            "Python backend packages",
            "At package level, with each edge labelled by the modules it imports. Dependencies only flow downward, "
            "from `cli` through `info` / `plotting` and `opening` to `formats` and `environment`. The one sideways "
            "edge is `plotting → info`, which reuses the DataTree inheritance mode and the monotonicity check.",
            "`cli → formats` is `resolve_store_path`: opening a Zarr metadata file opens the store that contains it. "
            "`python/get_data_info.py` only puts the package on `sys.path` and calls `cli.main`.",
            refs={
                "python/sdv_backend/plotting/selection.py": [
                    "datatree_inherit_mode",
                    "check_monotonicity",
                ],
                "python/sdv_backend/cli.py": ["resolve_store_path"],
                "python/get_data_info.py": ["sys.path", "main"],
            },
        ),
        Section(
            "backend-pipelines",
            "Backend pipelines",
            "Both subcommands share format detection and opening, then diverge. Info walks every group to describe "
            "it; plot selects one variable, subsets it and draws it with xarray's plotting on the Agg backend.",
            "The extension builds both command lines in `DataProcessor` (`buildGetDataInfoCliArgs`, "
            "`buildCreatePlotCliArgs`) from the user's settings; nothing is passed through a shell.",
            read=[
                "python/sdv_backend/info/extract.py",
                "python/sdv_backend/plotting/api.py",
                "python/sdv_backend/opening.py",
                "python/sdv_backend/formats/detect.py",
            ],
            refs={
                "src/python/DataProcessor.ts": [
                    "buildGetDataInfoCliArgs",
                    "buildCreatePlotCliArgs",
                ],
                "python/sdv_backend/plotting/render.py": ['"Agg"'],
            },
        ),
    ]
