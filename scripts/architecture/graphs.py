"""Graphviz figures: module graphs (from the import graph) and two flowcharts.

The import edges are computed; only the placement of host modules into layers
and the package descriptions are written by hand. ``coverage_problems`` reports
modules that exist in the code but are not placed, so a new module cannot be
dropped from the diagrams silently.
"""

from __future__ import annotations

import re
import shutil
import subprocess

from codebase import Facts, py_import_graph, ts_import_graph

FONT = 'fontname="DejaVu Sans Mono"'
BASE = f"""
  graph [{FONT}, fontsize=11, bgcolor="transparent", pad=0.15, nodesep=0.22, ranksep=0.45];
  node  [{FONT}, fontsize=10.5, shape=box, style="rounded,filled", margin="0.12,0.05", height=0.3, penwidth=1.1];
  edge  [{FONT}, fontsize=9.5, arrowsize=0.6, penwidth=0.9];
"""
DECISION = 'shape=diamond, style="filled", class="decision", margin="0.04,0.02"'

# ---------------------------------------------------------------- extension host

# Imported nearly everywhere: left out of the host graph (the page says so)
TS_UBIQUITOUS = {
    "common/Logger",
    "common/config",
    "common/vscodeutils",
    "common/utils",
    "types",
    "package-types",
}
WEBVIEW_PREFIX = "panel/webview/"

# Host modules by dependency layer, top (activation) to bottom (leaves)
HOST_LAYERS = [
    ["extension"],
    [
        "ScientificDataEditorProvider",
        "StatusBarItem",
        "python/ExtensionVirtualEnvironmentManagerUI",
        "common/HealthcheckManager",
    ],
    ["DataViewerPanel"],
    ["panel/UIController", "outline/OutlineProvider", "outline/HeaderExtractor"],
    [
        "panel/communication/MessageBus",
        "panel/HTMLGenerator",
        "panel/ThemeManager",
        "python/DataProcessor",
    ],
    [
        "panel/communication/MessageTypes",
        "panel/WebviewAssets",
        "python/PythonManager",
        "common/ErrorBoundary",
    ],
    [
        "python/ExtensionVirtualEnvironmentManager",
        "python/officialPythonExtensionApiUtils",
        "common/PerformanceTimer",
    ],
    [
        "common/runProcess",
        "shared/ids",
        "shared/icons",
        "shared/time",
        "shared/plotLayout",
    ],
]
# The main request path, drawn with a thick border
HOST_KEY = {
    "DataViewerPanel",
    "panel/UIController",
    "python/DataProcessor",
    "python/PythonManager",
}
FOLDER_CLASS = {
    "panel": "f-panel",
    "outline": "f-outline",
    "python": "f-python",
    "common": "f-common",
    "shared": "f-shared",
}
WEBVIEW_KEY = {"main", "bus", "plotParams"}

# ---------------------------------------------------------------- python backend

# Top-level backend packages / modules: (title, description). Packages without a
# description list their modules instead.
PY_PACKAGES = {
    "cli": ("cli.py", "argparse: info | plot → InfoOptions / PlotOptions"),
    "serialization": ("serialization.py", "JSON, best effort"),
    "info": ("info/", None),
    "plotting": ("plotting/", None),
    "opening": ("opening.py", "OpenedData · engine + decode_cf fallback"),
    "formats": ("formats/", None),
    "environment": ("environment/", None),
}
PY_KEY = {"info", "plotting", "opening"}
# Imported by every package: one node, no edges
PY_FOUNDATION = {
    "results": "JSON result dataclasses",
    "types": "type aliases",
    "_bootstrap": "logger + xarray display options",
}


def _ts_folder_class(module: str) -> str:
    return (
        FOLDER_CLASS.get(module.split("/")[0], "f-entry")
        if "/" in module
        else "f-entry"
    )


def label(module: str) -> str:
    """Last path segment; long camelCase names wrap onto two lines near the middle."""
    base = module.split("/")[-1]
    if len(base) <= 18:
        return base
    cuts = [i for i in range(1, len(base)) if base[i].isupper()]
    cut = min(cuts, key=lambda i: abs(i - len(base) / 2))
    return base[:cut] + "\\n" + base[cut:]


def coverage_problems() -> list[str]:
    """Modules present in the code but missing from the diagrams, and the reverse."""
    problems = []
    placed = {m for layer in HOST_LAYERS for m in layer}
    host = {
        m
        for m in ts_import_graph()
        if not m.startswith(WEBVIEW_PREFIX) and m not in TS_UBIQUITOUS
    }
    problems += [
        f"src/{m}.ts is not placed in graphs.HOST_LAYERS" for m in sorted(host - placed)
    ]
    problems += [
        f"graphs.HOST_LAYERS lists src/{m}.ts, which does not exist"
        for m in sorted(placed - host)
    ]
    for module in py_import_graph():
        top = module.split(".")[0]
        if top not in PY_PACKAGES and top not in PY_FOUNDATION:
            problems.append(
                f"python/sdv_backend/{module.replace('.', '/')}.py: add '{top}' to graphs.PY_PACKAGES"
            )
    return problems


def webview_host_imports() -> list[str]:
    """Modules outside the webview bundle that the webview imports."""
    graph = ts_import_graph()
    return sorted(
        {
            d
            for m, deps in graph.items()
            if m.startswith(WEBVIEW_PREFIX)
            for d in deps
            if not d.startswith(WEBVIEW_PREFIX)
        }
    )


def host_dot() -> str:
    graph = ts_import_graph()
    placed = {m for layer in HOST_LAYERS for m in layer}
    lines = [
        "digraph host {",
        BASE,
        "  rankdir=TB; newrank=true; ranksep=0.38; nodesep=0.25;",
    ]
    for layer in HOST_LAYERS:
        lines.append("  { rank=same;")
        for module in layer:
            key = " key" if module in HOST_KEY else ""
            lines.append(
                f'    "{module}" [label="{label(module)}", class="{_ts_folder_class(module)}{key}"];'
            )
        lines.append("  }")
    for module, deps in graph.items():
        if module not in placed:
            continue
        for dep in deps:
            if dep in placed:
                # extension.ts wires everything: its edges are drawn faint
                edge_class = "e-faint" if module == "extension" else "e-host"
                lines.append(f'  "{module}" -> "{dep}" [class="{edge_class}"];')
    lines.append("}")
    return "\n".join(lines)


def webview_dot() -> str:
    graph = ts_import_graph()
    modules = [m for m in graph if m.startswith(WEBVIEW_PREFIX)]
    lines = ["digraph webview {", BASE, "  rankdir=LR; ranksep=0.5; nodesep=0.14;"]
    for module in modules:
        name = module.removeprefix(WEBVIEW_PREFIX)
        key = " key" if name in WEBVIEW_KEY else ""
        lines.append(f'  "{module}" [label="{name}", class="f-web{key}"];')
    for module in webview_host_imports():
        lines.append(
            f'  "{module}" [label="{module}", class="{_ts_folder_class(module)}"];'
        )
    for module in modules:
        lines += [f'  "{module}" -> "{dep}" [class="e-host"];' for dep in graph[module]]
    lines.append("}")
    return "\n".join(lines)


def py_dot() -> str:
    """Backend at package level, edges labelled with the modules imported."""
    graph = py_import_graph()
    members: dict[str, list[str]] = {}
    for module in graph:
        top, _, rest = module.partition(".")
        if rest:
            members.setdefault(top, []).append(rest)
    edges: dict[tuple[str, str], set[str]] = {}
    for module, deps in graph.items():
        for dep in deps:
            a, b = module.split(".")[0], dep.split(".")[0]
            if a != b and a in PY_PACKAGES and b in PY_PACKAGES:
                edges.setdefault((a, b), set()).add(dep.split(".")[-1])
    lines = [
        "digraph backend {",
        BASE,
        "  rankdir=TB; ranksep=0.5; nodesep=0.5;",
        '  node [margin="0.16,0.08"];',
    ]
    for name, (title, description) in PY_PACKAGES.items():
        sub = description or " · ".join(sorted(members.get(name, [])))
        key = " key" if name in PY_KEY else ""
        lines.append(
            f'  "{name}" [label=<<B>{title}</B><BR/><FONT POINT-SIZE="9">{_html(sub)}</FONT>>, class="py{key}"];'
        )
    lines.append('  { rank=same; "info"; "plotting"; }')
    lines.append('  { rank=same; "cli"; "serialization"; }')
    for (a, b), modules in sorted(edges.items()):
        # A single-module target needs no label
        text = "" if PY_PACKAGES[b][0].endswith(".py") else ", ".join(sorted(modules))
        lines.append(f'  "{a}" -> "{b}" [label=" {text} ", class="e-host"];')
    title = " · ".join(PY_FOUNDATION)
    sub = " · ".join(PY_FOUNDATION.values())
    lines.append(
        f'  foundation [label=<<B>{_html(title)}</B><BR/><FONT POINT-SIZE="9">{_html(sub)}'
        '<BR/>imported by every package above</FONT>>, class="f-shared", width=6];'
    )
    lines.append('  "environment" -> foundation [style=invis];')
    lines.append("}")
    return "\n".join(lines)


def _html(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ---------------------------------------------------------------- flowcharts

INTERPRETER_REFS = {
    "src/python/PythonManager.ts": [
        "forceInitialize",
        "selectInterpreter",
        "prepareOwnEnvironment",
        "ownEnvironmentIssue",
        "uvMissing",
        "corePackagesIssue",
        "notReadyReason",
        "getOverridePythonInterpreter",
        "getUseExtensionOwnEnvironment",
        "getPythonInterpreterFromPythonExtension",
        "'own-uv-env'",
        "'python-extension'",
    ],
}


def interpreter_dot() -> str:
    return f"""digraph interpreter {{{BASE}
  rankdir=TB; ranksep=0.32; nodesep=0.3;
  start [label="forceInitialize()\\nsingle flight: requests made during a run\\nare coalesced into one more run", class="host key"];
  ovr [label="overridePythonInterpreter\\nset?", {DECISION}];
  own [label="useExtensionOwnEnvironment\\non?", {DECISION}];
  prep [label="prepareOwnEnvironment()\\nexisting env → prepareExisting()\\nmissing → create() with uv", class="host"];
  ownok [label="env python path?", {DECISION}];
  issue [label="record ownEnvironmentIssue\\n(uvMissing, message)\\nwarn the user, do not fall back silently", class="warn"];
  pyext [label="Python extension\\nactive interpreter?", {DECISION}];
  common [label="first of python3, python,\\n/usr/bin/python3, … that runs", {DECISION}];
  s_ovr [label="source: override", class="ext pick"];
  s_own [label="source: own-uv-env", class="py pick"];
  s_ext [label="source: python-extension", class="ext pick"];
  s_sys [label="source: system", class="ext pick"];
  none [label="no interpreter\\n(viewer shows setup error)", class="warn"];
  core [label="corePackagesIssue()\\nimport xarray → ready, else notReadyReason\\n(missing packages, Python too old…)", class="host key"];

  start -> ovr;
  ovr -> s_ovr [label=" yes"];
  ovr -> own [label=" no"];
  own -> prep [label=" yes"];
  own -> pyext [label=" no"];
  prep -> ownok;
  ownok -> s_own [label=" yes"];
  ownok -> issue [label=" no / threw"];
  issue -> pyext;
  pyext -> s_ext [label=" yes"];
  pyext -> common [label=" no"];
  common -> s_sys [label=" found"];
  common -> none [label=" none"];
  {{ rank=same; s_ovr; own; }}
  {{ rank=same; s_own; issue; }}
  s_ovr -> core [class="e-faint"];
  s_own -> core [class="e-faint"];
  s_ext -> core [class="e-faint"];
  s_sys -> core [class="e-faint"];
}}"""


ENVIRONMENT_REFS = {
    "src/python/ExtensionVirtualEnvironmentManager.ts": [
        "restoreInterruptedRecreation",
        "getUpdateReason",
        "recreate",
        "create",
        "ENVIRONMENT_REVISION",
        "ALL_REQUIREMENTS",
        "ENVIRONMENT_CONSTRAINTS",
        "'python-environment'",
        "'sdv-environment.json'",
        "'.previous'",
    ],
    "src/python/PythonManager.ts": ["withProgress"],
}


def environment_dot(facts: Facts) -> str:
    return f"""digraph environment {{{BASE}
  rankdir=TB; ranksep=0.34; nodesep=0.4;
  start [label="extension starts\\nExtensionVirtualEnvironmentManager constructor", class="host key"];
  leftover [label=".previous folder\\nleft over?", {DECISION}];
  fix [label="restoreInterruptedRecreation()\\nnew env has state file → delete .previous\\nno state file → put .previous back", class="state"];
  exists [label="env folder\\nexists?", {DECISION}];
  reason [label="getUpdateReason()", {DECISION}];
  reuse [label="reuse as is", class="state"];
  move [label="recreate(), with progress notification\\nrename python-environment → .previous", class="warn"];
  build [label="create()\\nuv python install {facts.uv_python_version} · uv venv\\nuv pip install ALL_REQUIREMENTS + ENVIRONMENT_CONSTRAINTS", class="state"];
  ok [label="ready\\nsdv-environment.json records revision + requirements\\n.previous deleted", class="py key"];
  fail [label="previous env restored (if any)\\nused if it imports xarray, else fall back\\nrebuild retried at next start", class="warn"];

  start -> leftover;
  leftover -> fix [label=" yes"];
  leftover -> exists [label=" no"];
  fix -> exists;
  exists -> build [label=" no"];
  exists -> reason [label=" yes"];
  reason -> reuse [label=" none"];
  reason -> move [label=" revision < ENVIRONMENT_REVISION,\\n requirements changed,\\n or no state file"];
  move -> build;
  reuse -> ok [class="e-faint"];
  build -> ok [label=" success"];
  build -> fail [label=" failure\\n (offline, uv missing)"];
  {{ rank=same; leftover; fix; }}
  {{ rank=same; ok; fail; }}
}}"""


PLOT_PARAMETERS_REFS = {
    "src/panel/webview/plotActions.ts": [
        "createVariablePlot",
        "invalidPlotOptions",
        "resolvePlotOptions",
        "compactPlotPayload",
        "showPlotLayout",
    ],
    "src/panel/webview/plotParams.ts": ["readPlotControls", "mergePlotControls"],
    "src/panel/webview/changedFields.ts": [
        "refreshChangedFields",
        "handleChangedFieldEvent",
        "plot-field--changed",
        "data-inherit",
    ],
    "src/panel/webview/render/plotLayout.ts": ["renderPlotLayout"],
    "src/panel/UIController.ts": ["handleCreatePlot", "plot_layout"],
    "src/python/DataProcessor.ts": ["buildCreatePlotCliArgs"],
    "src/shared/plotLayout.ts": ["CreatePlotResponse", "appliedSlices"],
    "python/sdv_backend/plotting/api.py": [
        "create_plot",
        "resolve_layout",
        "draw_plot",
        "plot_layout",
    ],
}


def plot_parameters_dot() -> str:
    return f"""digraph plot_parameters {{{BASE}
  rankdir=TB; ranksep=0.3; nodesep=0.35;
  node [margin="0.2,0.07"];
  click [label="Create Plot\\ncreateVariablePlot()", class="f-web key"];
  valid [label="a number\\ntyped wrong?", {DECISION}];
  stop [label="message under the plot,\\nnothing is sent", class="warn"];
  read [label="readPlotControls(global) · readPlotControls(group)", class="f-web"];
  merge [label="mergePlotControls()\\neach field: the group's value if set, else the global one\\nslices: the group's replace the global ones if it has any", class="f-web"];
  compact [label="compactPlotPayload()\\nfields left empty are not sent:\\nthe backend chooses them", class="f-web key"];
  cue [label="changedFields.ts\\na field that differs from its default is outlined\\n(empty · checkbox default · group checkbox = global)", class="f-web"];
  host [label="UIController → DataProcessor\\nbuildCreatePlotCliArgs(): one flag per field sent", class="host"];
  py [label="create_plot()\\nslices · time filter → resolve_layout() → draw_plot()", class="py key"];
  back [label="CreatePlotResponse\\nplotData · layout (plot_layout) · appliedSlices", class="host"];
  line [label="showPlotLayout() → renderPlotLayout()\\nplot kind, then each choice: outlined if set by you\\nnotes: choices that could not be used", class="f-web"];

  click -> valid;
  valid -> stop [label=" yes"];
  valid -> read [label=" no"];
  read -> merge -> compact -> host -> py -> back -> line;
  cue -> read [label=" same defaults ", class="e-faint", style=dashed, arrowhead=none];
  {{ rank=same; valid; stop; }}
  {{ rank=same; read; cue; }}
}}"""


PLOT_LAYOUT_REFS = {
    "python/sdv_backend/plotting/layout.py": [
        "resolve_layout",
        "_user_pins",
        "_histogram",
        "_col_wrap",
        "_figure_size",
        "squeezed",
        "notes",
        "against_datetime",
        "AUTO_COL_WRAP",
        "AUTO_FACET_SIZE",
        "AUTO_FACET_ASPECT",
        "to_json",
    ],
    "python/sdv_backend/plotting/selection.py": [
        "apply_dimension_slices",
        "apply_datetime_filter",
    ],
    "python/sdv_backend/plotting/draw.py": [
        "draw_plot",
        "imshow",
        "pcolormesh",
        "_equal_aspect_if_map",
    ],
    "python/sdv_backend/plotting/kwargs.py": ["for_kind", "COLOR_MESH_KEYS"],
}


def plot_layout_dot() -> str:
    return f"""digraph plot_layout {{{BASE}
  rankdir=TB; ranksep=0.28; nodesep=0.3;
  node [margin="0.2,0.07"];
  sel [label="apply_dimension_slices() · apply_datetime_filter()\\nselect data only: they never change the mode", class="py"];
  pins [label="_user_pins(): x, y, hue, col, row (that order)\\nkept if on the variable and not used by an earlier role,\\nelse dropped with a note", class="py key"];
  bins [label="bins set?", {DECISION}];
  hist_user [label="histogram of all values\\nx / y / hue / facets: note “not used”", class="state"];
  fix [label="hue with x and y → y dropped\\nhue with no other dimension → hue dropped\\nsize-1 dimensions not chosen → index 0 (squeezed)", class="py"];
  kind [label="what is left\\nfor the axes?", {DECISION}];
  line_hue [label="line, colored by hue\\nx = last free dimension\\nunless x or y is set", class="py pick"];
  image [label="image\\nx = last free dimension, y = the one before\\n(each only if not set)", class="py pick"];
  line [label="line\\nx = the free dimension", class="py pick"];
  hist_none [label="histogram\\n(single value, or nothing left inside a panel)", class="state"];
  facets [label="dimensions still free?", {DECISION}];
  none [label="no facets", class="py"];
  one [label="col (row if col is set)", class="py"];
  two [label="row, col", class="py"];
  many [label="histogram + hint\\n“slice one of them to an index”", class="warn"];
  wrap [label="_col_wrap(): column facets only\\nyours, else min(AUTO_COL_WRAP, size)\\n_figure_size(): facets 4 in high, aspect 1 unless set;\\na single plot keeps yours (size added for aspect)", class="py"];
  dt [label="1D line, x automatic, datetime variable selected\\n→ x = that variable (against_datetime)", class="py"];
  draw [label="draw_plot(): hist · line · imshow (dimension axes)\\n· pcolormesh (coordinate axes); single map → equal axes\\nstyle kwargs filtered by for_kind()", class="py key"];
  out [label="PlotLayout.to_json() → plot_layout\\nkind · choices (role, value, user | auto) · squeezed · notes", class="host"];

  sel -> pins -> bins;
  bins -> hist_user [label=" yes"];
  bins -> fix [label=" no"];
  fix -> kind;
  kind -> line_hue [label=" hue set"];
  kind -> image [label=" ≥ 2 dimensions"];
  kind -> line [label=" 1"];
  kind -> hist_none [label=" 0"];
  line_hue -> facets;
  image -> facets;
  line -> facets;
  facets -> none [label=" 0"];
  facets -> one [label=" 1"];
  facets -> two [label=" 2, no row / col set"];
  facets -> many [label=" more than\\n row / col left"];
  none -> wrap;
  one -> wrap;
  two -> wrap;
  wrap -> dt -> draw -> out;
  hist_user -> draw [class="e-faint"];
  hist_none -> draw [class="e-faint"];
  many -> draw [class="e-faint"];
  {{ rank=same; bins; hist_user; }}
}}"""


# ---------------------------------------------------------------- rendering


def dot_available() -> bool:
    return shutil.which("dot") is not None


def render(dot_source: str, aria: str) -> str:
    """Run Graphviz and return the SVG element, classed for the shared CSS."""
    svg = subprocess.run(
        ["dot", "-Tsvg"], input=dot_source, capture_output=True, text=True, check=True
    ).stdout
    svg = svg[svg.index("<svg") :]
    svg = re.sub(r"<!--.*?-->", "", svg, flags=re.DOTALL)
    svg = re.sub(
        r'<svg width="([\d.]+)pt" height="[^"]+"',
        lambda m: f'<svg class="gv" role="img" aria-label="{aria}" data-width="{float(m.group(1)):.0f}"',
        svg,
    )
    # The graph name is a useless tooltip; node titles stay (hover shows the module path)
    svg = re.sub(
        r'(<g id="graph0" class="graph"[^>]*>)\s*<title>[^<]*</title>', r"\1", svg
    )
    return svg.strip()
