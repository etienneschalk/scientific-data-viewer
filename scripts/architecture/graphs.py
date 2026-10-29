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
    ["common/runProcess", "shared/ids", "shared/icons", "shared/time"],
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
        "hasCorePackages",
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
  core [label="hasCorePackages()\\nimport xarray → ready", class="host key"];

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
