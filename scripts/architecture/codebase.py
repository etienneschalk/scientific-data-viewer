"""Facts the diagrams are drawn from, read from the source tree.

Everything here is parsed from the code (imports, the webview protocol,
package.json, a few constants) so that the generated diagrams cannot silently
disagree with it: a fact that cannot be found raises ``CodebaseError``.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
BACKEND = ROOT / "python" / "sdv_backend"


class CodebaseError(Exception):
    """The source tree no longer matches what the diagrams describe."""


def read(rel_path: str) -> str:
    return (ROOT / rel_path).read_text(encoding="utf-8")


# ---------------------------------------------------------------- imports


def ts_import_graph() -> dict[str, list[str]]:
    """Module -> modules it imports, for every ``src/**/*.ts`` (paths relative to
    ``src/``, without extension)."""
    pattern = re.compile(r"""(?:from|import)\s*\(?\s*['"](\.{1,2}/[^'"]+)['"]""")
    graph = {}
    for path in sorted(SRC.rglob("*.ts")):
        module = path.relative_to(SRC).with_suffix("").as_posix()
        deps = set()
        for match in pattern.finditer(path.read_text(encoding="utf-8")):
            target = (path.parent / match.group(1)).resolve().relative_to(SRC.resolve())
            deps.add(target.as_posix())
        graph[module] = sorted(deps)
    return graph


def py_import_graph() -> dict[str, list[str]]:
    """Module -> ``sdv_backend`` modules it imports (dotted, without the package)."""
    pattern = re.compile(r"^\s*from sdv_backend\.([\w.]+) import", re.MULTILINE)
    graph = {}
    for path in sorted(BACKEND.rglob("*.py")):
        module = path.relative_to(BACKEND).with_suffix("").as_posix().replace("/", ".")
        if module.split(".")[-1] in ("__init__", "__main__"):
            continue
        graph[module] = sorted(set(pattern.findall(path.read_text(encoding="utf-8"))))
    return graph


# ---------------------------------------------------------------- protocol


@dataclass(frozen=True)
class Message:
    name: str
    payload: str
    result: str | None = None


def _interface_body(source: str, name: str) -> str:
    match = re.search(rf"export interface {name} \{{", source)
    if not match:
        raise CodebaseError(f"interface {name} not found in MessageTypes.ts")
    depth, start = 1, match.end()
    for i in range(start, len(source)):
        depth += {"{": 1, "}": -1}.get(source[i], 0)
        if depth == 0:
            return source[start:i]
    raise CodebaseError(f"interface {name} is not closed")


def _split_top_level(text: str, separator: str) -> list[str]:
    parts, depth, current = [], 0, []
    for char in text:
        if char in "[{(<":
            depth += 1
        elif char in "]})>":
            depth -= 1
        if char == separator and depth == 0:
            parts.append("".join(current))
            current = []
        else:
            current.append(char)
    parts.append("".join(current))
    return [p.strip() for p in parts if p.strip()]


def _compact(type_text: str) -> str:
    text = re.sub(r"\s+", " ", type_text).strip()
    return re.sub(r"\s*,\s*([}\]])", r" \1", text)


def protocol() -> tuple[list[Message], list[Message]]:
    """Requests (command, payload, result) and events (name, payload) of the
    webview protocol, from ``src/panel/communication/MessageTypes.ts``."""
    source = read("src/panel/communication/MessageTypes.ts")
    source = re.sub(r"/\*.*?\*/|//[^\n]*", "", source, flags=re.DOTALL)
    requests = []
    for entry in _split_top_level(_interface_body(source, "Requests"), ";"):
        name, tuple_text = entry.split(":", 1)
        payload, result = _split_top_level(tuple_text.strip()[1:-1], ",")
        requests.append(Message(name.strip(), _compact(payload), _compact(result)))
    events = []
    for entry in _split_top_level(_interface_body(source, "Events"), ";"):
        name, payload = entry.split(":", 1)
        events.append(Message(name.strip(), _compact(payload)))
    return requests, events


# ---------------------------------------------------------------- manifest and constants


@dataclass(frozen=True)
class Facts:
    version: str
    custom_editors: int
    commands: int
    data_info_timeout_ms: int
    default_plot_timeout_ms: int
    kill_grace_ms: int
    uv_python_version: str


def _constant(rel_path: str, name: str) -> str:
    match = re.search(rf"\b{name}\s*=\s*([^;\n]+);", read(rel_path))
    if not match:
        raise CodebaseError(f"{name} not found in {rel_path}")
    return match.group(1).strip()


def _milliseconds(expression: str) -> int:
    if not re.fullmatch(r"[\d\s*]+", expression):
        raise CodebaseError(f"Unexpected timeout expression: {expression}")
    value = 1
    for factor in expression.split("*"):
        value *= int(factor)
    return value


def facts() -> Facts:
    manifest = json.loads(read("package.json"))
    return Facts(
        version=manifest["version"],
        custom_editors=len(manifest["contributes"]["customEditors"]),
        commands=len(manifest["contributes"]["commands"]),
        data_info_timeout_ms=_milliseconds(
            _constant("src/python/DataProcessor.ts", "DATA_INFO_TIMEOUT_MS")
        ),
        default_plot_timeout_ms=_milliseconds(
            _constant("src/common/config.ts", "DEFAULT_PLOT_TIMEOUT_MS")
        ),
        kill_grace_ms=_milliseconds(
            _constant("src/common/runProcess.ts", "KILL_GRACE_MS")
        ),
        uv_python_version=_constant(
            "src/python/ExtensionVirtualEnvironmentManager.ts", "PYTHON_VERSION"
        ).strip("'\""),
    )


def missing_symbols(refs: dict[str, list[str]]) -> list[str]:
    """``path: symbol`` for each referenced symbol that no longer appears in its file."""
    missing = []
    for rel_path, symbols in refs.items():
        path = ROOT / rel_path
        if not path.exists():
            missing.append(f"{rel_path} (file not found)")
            continue
        source = path.read_text(encoding="utf-8")
        missing += [
            f"{rel_path}: {symbol}"
            for symbol in symbols
            if not re.search(rf"(?<!\w){re.escape(symbol)}(?!\w)", source)
        ]
    return missing
