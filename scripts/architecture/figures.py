"""Hand-placed SVG figures: the process overview, two sequence diagrams and the
backend pipelines.

These follow code paths rather than the import graph, so they are written by
hand. Each figure lists the symbols it names in ``*_REFS``; ``generate.py
--check`` fails when one of them disappears from its file, which is the cue to
update the figure. Colors and fonts come from ``diagram.css`` classes.
"""

from __future__ import annotations

import sys
from html import escape
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from codebase import Facts

MONO_EM = 0.6  # advance of a monospace glyph, in em
SANS_EM = 0.53  # rough average advance of a sans glyph, in em


def _n(value: float) -> str:
    """Coordinate with at most one decimal, for stable and compact SVG."""
    return f"{value:.1f}".rstrip("0").rstrip(".")


def _warn(message: str) -> None:
    print(f"warning: {message}", file=sys.stderr)


def svg_open(width: float, height: float, aria: str, css_class: str = "hand") -> str:
    return (
        f'<svg viewBox="0 0 {_n(width)} {_n(height)}" class="{css_class}" role="img" '
        f'aria-label="{escape(aria)}" data-width="{_n(width)}">'
    )


def defs(prefix: str) -> str:
    """Arrowhead markers (ids prefixed per figure, so figures can share a page)."""
    markers = "".join(
        f'<marker id="{prefix}-{kind}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" '
        f'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="ah ah-{kind}"/></marker>'
        for kind in ("edge", "web", "py", "warn")
    )
    return f"<defs>{markers}</defs>"


def box(x, y, w, h, title, sub=(), cls="host", key=False, title_size=12.0) -> str:
    """Rounded box with monospace title line(s) and sans subtitle line(s), centered."""
    titles = title.split("\n")
    subs = [sub] if isinstance(sub, str) else list(sub)
    text_height = len(titles) * (title_size + 2) + len(subs) * 13
    ty = y + (h - text_height) / 2 + title_size - 1
    cx = _n(x + w / 2)
    parts = [
        f'<rect x="{_n(x)}" y="{_n(y)}" width="{_n(w)}" height="{_n(h)}" rx="7" class="bx {cls}{" key" if key else ""}"/>'
    ]
    for line in titles:
        parts.append(
            f'<text x="{cx}" y="{_n(ty)}" text-anchor="middle" class="t" font-size="{_n(title_size)}">{escape(line)}</text>'
        )
        if len(line) * title_size * MONO_EM > w - 8:
            _warn(f"title overflows its box: {line!r}")
        ty += title_size + 2
    ty += 1
    for line in subs:
        parts.append(
            f'<text x="{cx}" y="{_n(ty)}" text-anchor="middle" class="s">{escape(line)}</text>'
        )
        if len(line) * 10.5 * SANS_EM > w - 6:
            _warn(f"subtitle overflows its box: {line!r}")
        ty += 13
    return "".join(parts)


def arrow(points, prefix, kind="edge", dashed=False, both=False) -> str:
    coords = " ".join(f"{_n(x)},{_n(y)}" for x, y in points)
    markers = f'marker-end="url(#{prefix}-{kind})"'
    if both:
        markers += f' marker-start="url(#{prefix}-{kind})"'
    return f'<polyline points="{coords}" class="ln ln-{kind}{" dash" if dashed else ""}" fill="none" {markers}/>'


def label(x, y, text, anchor="middle", cls="lbl", rotate=None, halo=True) -> str:
    transform = (
        f' transform="rotate({rotate} {_n(x)} {_n(y)})"' if rotate is not None else ""
    )
    classes = f"{cls} halo" if halo else cls
    return f'<text x="{_n(x)}" y="{_n(y)}" text-anchor="{anchor}" class="{classes}"{transform}>{escape(text)}</text>'


class Sequence:
    """Sequence diagram: lifelines left to right, numbered messages top to bottom."""

    def __init__(self, prefix, participants, width, margin=80):
        self.prefix = prefix
        self.participants = participants  # (key, title, subtitle, class)
        self.width = width
        self.step = (width - 2 * margin) / (len(participants) - 1)
        self.x = {
            key: margin + i * self.step for i, (key, *_) in enumerate(participants)
        }
        self.y = 92
        self.items: list[str] = []
        self.frames: list[str] = []
        self.open_frames: list[tuple[float, str, list[tuple[float, str]]]] = []
        self.count = 0

    def _badge(self, x, y) -> str:
        self.count += 1
        return (
            f'<circle cx="{_n(x)}" cy="{_n(y)}" r="8" class="num"/>'
            f'<text x="{_n(x)}" y="{_n(y + 3.5)}" text-anchor="middle" class="numt">{self.count}</text>'
        )

    def msg(self, a, b, text, kind="call"):
        """Numbered message from lifeline a to b: call, return (dashed), event or kill."""
        xa, xb = self.x[a], self.x[b]
        y = self.y + 12
        direction = 1 if xb > xa else -1
        marker = {"call": "edge", "return": "edge", "event": "web", "kill": "warn"}[
            kind
        ]
        self.items.append(
            arrow(
                [(xa + direction * 4, y), (xb - direction * 4, y)],
                self.prefix,
                marker,
                dashed=kind == "return",
            )
        )
        if len(text) * 11 * MONO_EM > abs(xb - xa) - 24:
            # Too long for the span: start next to the source and run past the target
            lx, anchor = xa + direction * 22, "start" if direction > 0 else "end"
        else:
            lx, anchor = (xa + xb) / 2 + direction * 6, "middle"
        self.items.append(label(lx, y - 6, text, anchor=anchor, cls=f"mlbl m-{kind}"))
        self.items.append(self._badge(xa, y))
        self.y += 34

    def self_msg(self, a, text):
        """Unnumbered step a participant does on its own."""
        x, y = self.x[a], self.y + 6
        self.items.append(
            f'<polyline points="{_n(x + 4)},{_n(y)} {_n(x + 26)},{_n(y)} {_n(x + 26)},{_n(y + 16)} {_n(x + 6)},{_n(y + 16)}" '
            f'class="ln ln-edge" fill="none" marker-end="url(#{self.prefix}-edge)"/>'
        )
        self.items.append(
            label(x + 32, y + 12, text, anchor="start", cls="mlbl m-self")
        )
        self.y += 34

    def note(self, a, b, text, cls="note"):
        xa, xb = sorted((self.x[a], self.x[b]))
        y = self.y + 2
        self.items.append(
            f'<rect x="{_n(xa - 40)}" y="{_n(y)}" width="{_n(xb - xa + 80)}" height="24" rx="4" class="{cls}"/>'
        )
        self.items.append(label((xa + xb) / 2, y + 16, text, cls="notet", halo=False))
        self.y += 34

    def frame(self, text):
        self.open_frames.append((self.y, text, []))
        self.y += 26

    def divider(self, text):
        self.open_frames[-1][2].append((self.y, text))
        self.y += 32

    def end_frame(self):
        y0, text, dividers = self.open_frames.pop()
        x0, x1, y1 = 14, self.width - 14, self.y + 4
        tab = len(text) * 10.5 * SANS_EM + 18
        out = [
            f'<rect x="{x0}" y="{_n(y0)}" width="{_n(x1 - x0)}" height="{_n(y1 - y0)}" rx="6" class="frame"/>',
            f'<path d="M{x0 + 6},{_n(y0)} L{_n(x0 + tab + 8)},{_n(y0)} L{_n(x0 + tab + 8)},{_n(y0 + 10)} '
            f'L{_n(x0 + tab)},{_n(y0 + 18)} L{x0},{_n(y0 + 18)} L{x0},{_n(y0 + 6)} Q{x0},{_n(y0)} {x0 + 6},{_n(y0)} Z" '
            'class="frametab"/>',
            label(x0 + 8, y0 + 13, text, anchor="start", cls="framet", halo=False),
        ]
        for dy, dtext in dividers:
            out.append(
                f'<line x1="{x0}" y1="{_n(dy + 4)}" x2="{_n(x1)}" y2="{_n(dy + 4)}" class="framediv"/>'
            )
            out.append(label(x0 + 8, dy + 19, dtext, anchor="start", cls="framet"))
        self.frames.append("".join(out))
        self.y += 14

    def render(self, aria) -> str:
        height = self.y + 24
        out = [
            svg_open(self.width, height, aria, "hand seq"),
            defs(self.prefix),
            *self.frames,
        ]
        box_width = min(self.step - 14, 168)
        for key, title, sub, cls in self.participants:
            x = self.x[key]
            out.append(
                f'<line x1="{_n(x)}" y1="62" x2="{_n(x)}" y2="{_n(height - 10)}" class="life"/>'
            )
            out.append(
                box(
                    x - box_width / 2,
                    14,
                    box_width,
                    48,
                    title,
                    sub,
                    cls=cls,
                    title_size=11.5,
                )
            )
        out += [*self.items, "</svg>"]
        return "".join(out)


# ---------------------------------------------------------------- 1. processes

PROCESSES_REFS = {
    "src/extension.ts": ["activate"],
    "src/ScientificDataEditorProvider.ts": ["resolveCustomEditor"],
    "src/panel/communication/MessageBus.ts": ["handle", "emit"],
    "src/panel/webview/bus.ts": ["WebviewMessageBus", "sendRequest"],
    "src/panel/webview/render/dataInfo.ts": ["displayAll"],
    "src/panel/UIController.ts": ["getDataInfo"],
    "src/python/DataProcessor.ts": ["executePythonFile"],
    "src/common/runProcess.ts": ["spawn"],
    "python/sdv_backend/info/extract.py": ["get_file_info"],
    "python/sdv_backend/plotting/api.py": ["create_plot"],
    "python/sdv_backend/formats/detect.py": ["detect_file_format"],
    "python/sdv_backend/opening.py": ["OpenedData", "open_datatree"],
}


def processes(facts: Facts) -> str:
    p = "ov"
    o = [
        svg_open(
            1180,
            560,
            "The extension runs in three processes: a sandboxed webview, the Node extension host, and one short-lived "
            "Python subprocess per request. The webview talks to the host only through postMessage; the host talks to "
            "Python only through argv and one JSON line on stdout.",
        ),
        defs(p),
    ]
    zones = [
        (16, 280, "web", "WEBVIEW", "sandboxed iframe · CSP · no Node"),
        (376, 428, "host", "EXTENSION HOST", "Node.js · one process, all panels"),
        (884, 280, "py", "PYTHON SUBPROCESS", "one per request, then exits"),
    ]
    for x, w, cls, title, sub in zones:
        o.append(
            f'<rect x="{x}" y="20" width="{w}" height="440" rx="12" class="zone {cls}"/>'
        )
        o.append(f'<text x="{x + 16}" y="44" class="zt {cls}">{title}</text>')
        o.append(
            f'<text x="{x + 16}" y="58" class="s" text-anchor="start">{escape(sub)}</text>'
        )
    rows, h = [138, 216, 294, 372], 52

    # webview
    wx, ww = 32, 248
    wc = wx + ww / 2
    o.append(
        box(wx, 70, ww, 46, "main.ts", ["entry · one delegated click listener"], "web")
    )
    o.append(
        box(
            wx,
            rows[0],
            ww,
            h,
            "plotActions · plotParams",
            ["plot controls, Create / Cancel / Save"],
            "web",
        )
    )
    o.append(
        box(
            wx,
            rows[1],
            ww,
            h,
            "bus.ts",
            ["WebviewMessageBus · pending requests"],
            "web",
            key=True,
        )
    )
    o.append(
        box(
            wx,
            rows[2],
            ww,
            h,
            "render/",
            ["dataInfo · variables · representations"],
            "web",
        )
    )
    o.append(
        box(
            wx,
            rows[3],
            ww,
            h,
            "state · errors · export",
            ["globals, error banner, HTML export"],
            "web",
        )
    )
    o.append(arrow([(wc, 116), (wc, rows[0] - 2)], p))
    o.append(arrow([(wc, rows[0] + h), (wc, rows[1] - 2)], p))
    o.append(label(wc + 8, rows[0] + h + 17, "sendRequest()", anchor="start"))
    o.append(arrow([(wc, rows[1] + h), (wc, rows[2] - 2)], p, "web"))
    o.append(
        label(wc + 8, rows[1] + h + 17, "dataLoaded → displayAll()", anchor="start")
    )

    # extension host
    lx, rx, cw = 392, 600, 188
    rc = rx + cw / 2
    o.append(
        box(
            lx,
            70,
            396,
            46,
            "extension.ts  activate()",
            [
                f"builds managers · registers {facts.custom_editors} editors, {facts.commands} commands, outline"
            ],
            "host",
        )
    )
    o.append(
        box(
            lx,
            rows[0],
            cw,
            h,
            "ScientificData\nEditorProvider",
            ["resolveCustomEditor"],
            "host",
            title_size=11,
        )
    )
    o.append(
        box(
            lx,
            rows[1],
            cw,
            h,
            "MessageBus",
            ["handle(request) · emit(event)"],
            "host",
            key=True,
        )
    )
    o.append(
        box(
            lx,
            rows[2],
            cw,
            h,
            "OutlineProvider",
            ["+ HeaderExtractor · tree view"],
            "host",
        )
    )
    o.append(
        box(
            lx,
            rows[3],
            cw,
            h,
            "ExtensionVirtual\nEnvironmentManager",
            ["uv env · ENVIRONMENT_REVISION"],
            "host",
            title_size=11,
        )
    )
    o.append(
        box(
            rx,
            rows[0],
            cw,
            h,
            "DataViewerPanel",
            ["one per tab · static registry"],
            "host",
        )
    )
    o.append(
        box(
            rx,
            rows[1],
            cw,
            h,
            "UIController",
            ["per panel · answers requests"],
            "host",
            key=True,
        )
    )
    o.append(box(rx, rows[2], cw, h, "DataProcessor", ["settings → CLI argv"], "host"))
    o.append(
        box(
            rx,
            rows[3],
            cw,
            h,
            "PythonManager",
            ["interpreter · spawn · abort"],
            "host",
            key=True,
        )
    )
    o.append(arrow([(lx + 94, 116), (lx + 94, rows[0] - 2)], p))
    o.append(arrow([(lx + cw, rows[0] + 26), (rx - 2, rows[0] + 26)], p))
    o.append(arrow([(rc, rows[0] + h), (rc, rows[1] - 2)], p))
    o.append(label(rc - 8, rows[0] + h + 17, "owns", anchor="end"))
    o.append(arrow([(rx, rows[1] + 26), (lx + cw + 2, rows[1] + 26)], p, both=True))
    o.append(arrow([(rc, rows[1] + h), (rc, rows[2] - 2)], p))
    o.append(
        label(rc - 8, rows[1] + h + 17, "getDataInfo() · createPlot()", anchor="end")
    )
    o.append(arrow([(rc, rows[2] + h), (rc, rows[3] - 2)], p))
    o.append(label(rc - 8, rows[2] + h + 17, "executePythonFile()", anchor="end"))
    o.append(arrow([(rx, rows[3] + 26), (lx + cw + 2, rows[3] + 26)], p))

    # webview <-> host
    mid = (wx + ww + lx) / 2
    o.append(arrow([(wx + ww, rows[1] + 18), (lx - 2, rows[1] + 18)], p, "web"))
    o.append(
        arrow([(lx, rows[1] + 36), (wx + ww + 2, rows[1] + 36)], p, "web", dashed=True)
    )
    o.append(label(mid, rows[1] + 12, "request", cls="lbl web"))
    o.append(label(mid, rows[1] + 52, "response · event", cls="lbl web"))
    o.append(label(mid, rows[1] + 27, "postMessage", cls="lbl tiny", halo=False))

    # python
    px, pw = 900, 248
    pc = px + pw / 2
    o.append(
        box(px, 70, pw, 46, "get_data_info.py → cli", ["argparse: info | plot"], "py")
    )
    o.append(box(px, rows[0], 118, h, "info/", ["get_file_info"], "py"))
    o.append(box(px + 130, rows[0], 118, h, "plotting/", ["create_plot"], "py"))
    o.append(
        box(px, rows[1], pw, h, "formats/", ["detect_file_format → engines"], "py")
    )
    o.append(
        box(
            px,
            rows[2],
            pw,
            h,
            "opening.py  OpenedData",
            ["engine fallback · decode_cf fallback"],
            "py",
            key=True,
        )
    )
    o.append(
        box(
            px,
            rows[3],
            pw,
            h,
            "xarray backends",
            ["netCDF4 · h5netcdf · zarr · cfgrib", "rasterio · cdflib · kerchunk"],
            "ext",
        )
    )
    for x in (px + 59, px + 189):
        o.append(arrow([(x, 116), (x, rows[0] - 2)], p))
        o.append(arrow([(x, rows[0] + h), (x, rows[1] - 2)], p))
    o.append(arrow([(pc, rows[1] + h), (pc, rows[2] - 2)], p))
    o.append(arrow([(pc, rows[2] + h), (pc, rows[3] - 2)], p))
    o.append(
        label(pc + 8, rows[2] + h + 17, "open_datatree / open_dataset", anchor="start")
    )

    # host <-> python
    o.append(
        arrow(
            [(rx + cw, rows[3] + 16), (830, rows[3] + 16), (830, 86), (px - 2, 86)],
            p,
            "py",
        )
    )
    o.append(
        arrow(
            [(px, 102), (852, 102), (852, rows[3] + 34), (rx + cw + 2, rows[3] + 34)],
            p,
            "py",
            dashed=True,
        )
    )
    o.append(label(822, 250, "spawn · argv, no shell", rotate=-90, cls="lbl py"))
    o.append(
        label(
            866, 250, "stdout: one JSON line · stderr: logs", rotate=-90, cls="lbl py"
        )
    )

    # outside the three processes
    o.append(
        box(
            lx,
            490,
            cw,
            52,
            "uv",
            [f"python {facts.uv_python_version} · venv · pip install"],
            "ext",
        )
    )
    o.append(
        box(rx, 490, cw, 52, "Python extension", ["active interpreter API"], "ext")
    )
    o.append(
        box(
            px,
            490,
            pw,
            52,
            "data file on disk",
            [".nc .h5 .zarr(.zip) .grib .tif .jp2 .cdf"],
            "ext",
        )
    )
    for x, text in ((lx + 94, "runs"), (rc, "asks"), (pc, "reads")):
        o.append(arrow([(x, rows[3] + h), (x, 488)], p))
        o.append(label(x + 8, 470, text, anchor="start"))
    o.append("</svg>")
    return "".join(o)


# ---------------------------------------------------------------- 5. opening a file

OPEN_FILE_REFS = {
    "src/ScientificDataEditorProvider.ts": [
        "resolveCustomEditor",
        "waitForInitialization",
    ],
    "src/DataViewerPanel.ts": [
        "createFromWebviewPanel",
        "createOrReveal",
        "updateHeaders",
    ],
    "src/panel/UIController.ts": [
        "setHtml",
        "loadFile",
        "getMaxSize",
        "BackendLoadError",
        "'dataLoaded'",
    ],
    "src/python/DataProcessor.ts": ["getDataInfo", "DATA_INFO_TIMEOUT_MS"],
    "src/panel/webview/render/dataInfo.ts": ["displayAll"],
    "src/panel/webview/errors.ts": ["displayGlobalError"],
    "src/outline/HeaderExtractor.ts": ["createDynamicDataViewerHeaders"],
}


def open_file(facts: Facts) -> str:
    s = Sequence(
        "so",
        [
            ("vs", "VS Code", ["custom editor"], "ext"),
            ("ed", "EditorProvider", ["ScientificData…"], "host"),
            ("dvp", "DataViewerPanel", ["one per tab"], "host"),
            ("ui", "UIController", ["+ MessageBus"], "host"),
            ("pm", "DataProcessor", ["+ PythonManager"], "host"),
            ("py", "Python", ["sdv_backend"], "py"),
            ("wv", "Webview", ["bus.ts · render/"], "web"),
            ("ol", "OutlineProvider", ["tree view"], "host"),
        ],
        1180,
        margin=78,
    )
    minutes = facts.data_info_timeout_ms // 60000
    s.msg("vs", "ed", "resolveCustomEditor()")
    s.msg("ed", "pm", "waitForInitialization()")
    s.msg("ed", "dvp", "createFromWebviewPanel()")
    s.msg("dvp", "ui", "new UIController()")
    s.msg("ui", "wv", "setHtml(): skeleton + CSP + webview.js")
    s.msg("dvp", "ui", "loadFile(uri)")
    s.self_msg("ui", "stat: size ≤ maxSize setting, else error")
    s.msg("ui", "pm", "getDataInfo(uri)")
    s.msg("pm", "py", f"spawn get_data_info.py info <file> …  ({minutes} min timeout)")
    s.self_msg("py", "detect → OpenedData.open → get_file_info")
    s.msg("py", "pm", '{"result": FileInfoResult}  or  {"error": …}', kind="return")
    s.msg("pm", "ui", "DataInfoResult", kind="return")
    s.msg("ui", "wv", "event dataLoaded {dataInfo, pythonPath, config}", kind="event")
    s.self_msg("wv", "displayAll()")
    s.msg("ui", "dvp", "onOutlineUpdate()", kind="return")
    s.msg("dvp", "ol", "updateHeaders(panelId, HeaderExtractor…)")
    s.note(
        "ui",
        "wv",
        "on error: BackendLoadError → ErrorBoundary → event error → displayGlobalError()",
        cls="note warn",
    )
    return s.render(
        "Sequence of opening a file: VS Code resolves the custom editor, the panel waits for Python, spawns the info "
        "command, and the result reaches the webview as a dataLoaded event and the outline as headers."
    )


# ---------------------------------------------------------------- 6. plot and cancel

PLOT_REFS = {
    "src/panel/webview/plotActions.ts": ["createVariablePlot"],
    "src/panel/webview/bus.ts": ["createPlot", "abortPlot", "onTimeout"],
    "src/panel/webview/util.ts": ["clampPlotTimeout"],
    "src/panel/UIController.ts": ["handleCreatePlot", "handleAbortPlot"],
    "src/python/DataProcessor.ts": ["createPlot"],
    "src/python/PythonManager.ts": [
        "executePythonFile",
        "_activeProcesses",
        "AbortController",
        "abortProcess",
        "parseScriptResult",
        "Process was aborted",
    ],
    "src/common/runProcess.ts": ["runProcess", "SIGKILL", "timedOut"],
    "src/common/config.ts": ["plotTimeoutMs"],
    "python/sdv_backend/plotting/api.py": ["CreatePlotResult"],
}


def plot(facts: Facts) -> str:
    s = Sequence(
        "sp",
        [
            ("pa", "plotActions", ["webview"], "web"),
            ("bus", "bus.ts", ["webview"], "web"),
            ("ui", "UIController", ["+ MessageBus"], "host"),
            ("dp", "DataProcessor", ["host"], "host"),
            ("pm", "PythonManager", ["_activeProcesses"], "host"),
            ("rp", "runProcess", ["common/"], "host"),
            ("py", "Python", ["create_plot"], "py"),
        ],
        1180,
        margin=84,
    )
    kill = f"SIGTERM, SIGKILL after {_seconds(facts.kill_grace_ms)}"
    s.msg("pa", "bus", "createPlot(payload, plotTimeoutMs)")
    s.self_msg("bus", "start webview timer")
    s.msg("bus", "ui", "request createPlot {operationId, …}")
    s.msg("ui", "dp", "createPlot(uri, plot)")
    s.msg("dp", "pm", "executePythonFile(…, operationId, timeoutMs)")
    s.self_msg("pm", "register AbortController")
    s.msg("pm", "rp", "runProcess(signal, timeoutMs)")
    s.msg("rp", "py", "spawn … plot <file> <var>")
    s.frame("alt  the plot finishes")
    s.msg("py", "rp", "stdout: CreatePlotResult, exit 0", kind="return")
    s.msg("rp", "pm", "{code, stdout, stderr}", kind="return")
    s.msg("pm", "ui", "parseScriptResult() → plot_data", kind="return")
    s.msg("ui", "bus", "response {success: true}", kind="return")
    s.msg("bus", "pa", "<img> base64 PNG", kind="return")
    s.divider("else  user clicks Cancel, or the webview timer fires (onTimeout)")
    s.msg("pa", "bus", "abortPlot(operationId)")
    s.msg("bus", "ui", "request abortPlot")
    s.msg("ui", "pm", "abortProcess(operationId)")
    s.msg("pm", "rp", "controller.abort()")
    s.msg("rp", "py", kill, kind="kill")
    s.msg("pm", "ui", 'throws "Process was aborted"', kind="return")
    s.msg("ui", "bus", "response {success: false}", kind="return")
    s.divider("else  host timeoutMs elapses (also when the webview was closed)")
    s.msg("rp", "py", kill, kind="kill")
    s.msg("rp", "pm", '{timedOut} → "timed out and was stopped"', kind="return")
    s.end_frame()
    return s.render(
        "Sequence of creating a plot: a request carries an operationId down to PythonManager, which registers an "
        "AbortController; the plot returns as base64 PNG, or is killed by cancel, the webview timer, or the host timeout."
    )


def _seconds(ms: int) -> str:
    return f"{ms / 1000:g} s"


# ---------------------------------------------------------------- 10. backend pipelines

PIPELINES_REFS = {
    "python/sdv_backend/cli.py": ["InfoOptions", "PlotOptions"],
    "python/sdv_backend/formats/detect.py": ["detect_file_format"],
    "python/sdv_backend/opening.py": ["OpenedData", "cdflib", "decode_cf_degraded"],
    "python/sdv_backend/info/extract.py": [
        "_whole_file_reprs",
        "_flatten_groups",
        "_add_group_info",
        "FileInfoError",
    ],
    "python/sdv_backend/plotting/api.py": [
        "split_variable_path",
        "apply_dimension_slices",
        "apply_datetime_filter",
        "ensure_not_empty",
        "resolve_layout",
        "draw_plot",
        "setup_pyplot",
        "CreatePlotError",
    ],
}


def pipelines() -> str:
    p = "pl"
    o = [
        svg_open(
            1180,
            400,
            "Both backend commands share format detection and opening, then diverge: info walks every group to "
            "describe it, plot selects one variable, subsets it and draws it.",
        ),
        defs(p),
    ]
    lanes = {"info": 72, "plot": 236}
    lane_h = 84
    o.append(label(20, 54, "info", anchor="start", cls="lane", halo=False))
    o.append(
        label(
            62,
            54,
            "get_data_info.py info <file> [flags]",
            anchor="start",
            cls="lbl mono",
            halo=False,
        )
    )
    o.append(label(20, 218, "plot", anchor="start", cls="lane", halo=False))
    cols = [20, 182, 358, 534, 694, 854, 1014]
    widths = [142, 156, 156, 140, 140, 140, 146]
    top, bottom = lanes["info"], lanes["plot"] + lane_h
    detect = [
        "",
        "ZIP: Zarr store inside?",
        "Kerchunk JSON / Parquet?",
        "Zarr directory, v2 or v3",
        "",
    ]
    detect += ["→ engines, in netcdf", "engine order setting", "→ missing packages"]
    o.append(
        box(
            cols[1],
            top,
            widths[1],
            bottom - top,
            "detect_file_format()",
            detect,
            "py",
            key=True,
        )
    )
    opening = [
        "",
        "try each engine in order",
        "cdflib: its own reader",
        "groups → open_datatree",
        'else {"/": Dataset}',
        "",
    ]
    opening += [
        "time decode error →",
        "retry with decode_cf=False",
        "(decode_cf_degraded)",
    ]
    o.append(
        box(
            cols[2],
            top,
            widths[2],
            bottom - top,
            "OpenedData.open()",
            opening,
            "py",
            key=True,
        )
    )
    steps = {
        "info": [
            ("InfoOptions", ["display settings", "as CLI flags"]),
            ("reprs", ["text + HTML repr", "xr.show_versions()"]),
            ("flatten groups", ["tree → Dataset per", "group, inherited coords"]),
            ("per group", ["dims, coords, variables,", "attrs, datetime ranges"]),
            ("FileInfoResult", ['{"result": …}', "on stdout"]),
        ],
        "plot": [
            ("PlotOptions", ["layout flags +", "dimension slices JSON"]),
            ("select", ["group path →", "DataArray"]),
            ("subset", ["isel slices, datetime", "filter, not empty"]),
            ("draw_plot()", ["resolve_layout(): yours,", "the rest automatic"]),
            ("CreatePlotResult", ["base64 PNG +", "layout, kwargs"]),
        ],
    }
    for name, y in lanes.items():
        for col, (title, sub) in zip([0, 3, 4, 5, 6], steps[name], strict=True):
            o.append(
                box(
                    cols[col], y, widths[col], lane_h, title, sub, "py", title_size=11.5
                )
            )
        cy = y + lane_h / 2
        for col in range(6):
            o.append(arrow([(cols[col] + widths[col], cy), (cols[col + 1] - 2, cy)], p))
    o.append(
        label(
            20,
            340,
            "get_data_info.py plot <file> <variable> [flags]",
            anchor="start",
            cls="lbl mono",
            halo=False,
        )
    )
    o.append(
        label(
            cols[2] + 6,
            340,
            "↖ plot only, before opening: matplotlib check + setup_pyplot(style)",
            anchor="start",
            halo=False,
        )
    )
    o.append('<line x1="20" y1="356" x2="1160" y2="356" class="ln ln-warn dash"/>')
    o.append(
        label(
            20,
            378,
            "Expected failures (unsupported format, missing engine, unreadable file, bad selection) become "
            'FileInfoError / CreatePlotError: still JSON, exit 0. Only unexpected crashes exit 1 with {"error": …}.',
            anchor="start",
            halo=False,
        )
    )
    o.append("</svg>")
    return "".join(o)
