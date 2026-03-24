#!/usr/bin/env python3
"""
Generate a markdown design doc from xarray's dataarray_plot.py.

This script parses Python syntax (AST) to extract:
- plotting methods and overload counts
- method kwargs and defaults
- kwargs common to all methods vs method-specific kwargs
- a kwargs x method matrix

It then writes a markdown document that includes architecture suggestions for
GUI controls based on parsed metadata.
"""

from __future__ import annotations

import argparse
import ast
import datetime as dt
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Set, Tuple

TARGET_METHODS = {
    "plot",
    "line",
    "step",
    "hist",
    "scatter",
    "imshow",
    "contour",
    "contourf",
    "pcolormesh",
    "surface",
}

IGNORE_PARAMS = {
    "darray",
    "xplt",
    "yplt",
    "zplt",
    "x",
    "y",
    "z",
    "ax",
    "args",
    "kwargs",
}

EMPTY_SYMBOL = "∅"


@dataclass(frozen=True)
class ParamInfo:
    name: str
    kind: str
    default: Optional[str]
    annotation: Optional[str]


@dataclass(frozen=True)
class SignatureInfo:
    method: str
    is_overload: bool
    params: Tuple[ParamInfo, ...]
    returns: Optional[str]
    line: int


def _load_source(input_value: str) -> Tuple[str, str]:
    if input_value.startswith("http://") or input_value.startswith("https://"):
        with urllib.request.urlopen(input_value) as resp:
            data = resp.read().decode("utf-8")
        return data, input_value
    p = Path(input_value)
    return p.read_text(encoding="utf-8"), str(p.resolve())


def _node_text(source: str, node: Optional[ast.AST]) -> Optional[str]:
    if node is None:
        return None
    seg = ast.get_source_segment(source, node)
    if seg is None:
        return None
    return " ".join(seg.split())


def _escape_md_pipe(text: str) -> str:
    """Escape `|` so Markdown pipe tables do not split (e.g. `Hashable | None`)."""
    return text.replace("|", "\\|")


def _format_table_cell_code(value: str) -> str:
    """Wrap values in backticks except the empty symbol."""
    escaped = _escape_md_pipe(value)
    if value == EMPTY_SYMBOL:
        return escaped
    return f"`{escaped}`"


def _is_overload(func: ast.FunctionDef) -> bool:
    for dec in func.decorator_list:
        if isinstance(dec, ast.Name) and dec.id == "overload":
            return True
        if isinstance(dec, ast.Attribute) and dec.attr == "overload":
            return True
    return False


def _collect_params(source: str, func: ast.FunctionDef) -> Tuple[ParamInfo, ...]:
    args = func.args
    out: List[ParamInfo] = []

    # positional-only + positional-or-keyword defaults align to the tail
    pos = list(args.posonlyargs) + list(args.args)
    pos_defaults = [None] * (len(pos) - len(args.defaults)) + list(args.defaults)
    for arg_node, default_node in zip(pos, pos_defaults):
        out.append(
            ParamInfo(
                name=arg_node.arg,
                kind="positional",
                default=_node_text(source, default_node),
                annotation=_node_text(source, arg_node.annotation),
            )
        )

    if args.vararg is not None:
        out.append(
            ParamInfo(
                name=args.vararg.arg,
                kind="vararg",
                default=None,
                annotation=_node_text(source, args.vararg.annotation),
            )
        )

    for kwarg_node, default_node in zip(args.kwonlyargs, args.kw_defaults):
        out.append(
            ParamInfo(
                name=kwarg_node.arg,
                kind="kwonly",
                default=_node_text(source, default_node),
                annotation=_node_text(source, kwarg_node.annotation),
            )
        )

    if args.kwarg is not None:
        out.append(
            ParamInfo(
                name=args.kwarg.arg,
                kind="varkw",
                default=None,
                annotation=_node_text(source, args.kwarg.annotation),
            )
        )

    return tuple(out)


def parse_signatures(source: str) -> Dict[str, List[SignatureInfo]]:
    tree = ast.parse(source)
    out: Dict[str, List[SignatureInfo]] = {m: [] for m in TARGET_METHODS}
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name in TARGET_METHODS:
            out[node.name].append(
                SignatureInfo(
                    method=node.name,
                    is_overload=_is_overload(node),
                    params=_collect_params(source, node),
                    returns=_node_text(source, node.returns),
                    line=node.lineno,
                )
            )
    return out


def _method_kwarg_set(sig: SignatureInfo) -> Set[str]:
    names = set()
    for p in sig.params:
        if p.name in IGNORE_PARAMS:
            continue
        if p.kind in {"kwonly", "positional"}:
            names.add(p.name)
    return names


def _best_impl_signature(
    signatures: Sequence[SignatureInfo],
) -> Optional[SignatureInfo]:
    impls = [s for s in signatures if not s.is_overload]
    if not impls:
        return None
    return sorted(impls, key=lambda s: len(s.params), reverse=True)[0]


def _api_kwarg_set(signatures: Sequence[SignatureInfo]) -> Set[str]:
    overloads = [s for s in signatures if s.is_overload]
    if overloads:
        out: Set[str] = set()
        for ov in overloads:
            out.update(_method_kwarg_set(ov))
        return out
    impl = _best_impl_signature(signatures)
    return _method_kwarg_set(impl) if impl else set()


def build_markdown(
    signatures: Dict[str, List[SignatureInfo]],
    source_ref: str,
) -> str:
    methods = [m for m in sorted(TARGET_METHODS) if signatures.get(m)]

    api_kwargs: Dict[str, Set[str]] = {}
    overload_counts: Dict[str, int] = {}
    for m in methods:
        overload_counts[m] = sum(1 for s in signatures[m] if s.is_overload)
        api_kwargs[m] = _api_kwarg_set(signatures[m])

    non_empty_sets = [s for s in api_kwargs.values() if s]
    common_kwargs = set.intersection(*non_empty_sets) if non_empty_sets else set()
    union_kwargs = set.union(*non_empty_sets) if non_empty_sets else set()
    method_specific = {
        m: sorted(api_kwargs[m] - common_kwargs) for m in methods if api_kwargs[m]
    }

    method_coverage: Dict[str, Set[str]] = {}
    for kw in union_kwargs:
        owners = {m for m in methods if kw in api_kwargs[m]}
        method_coverage[kw] = owners

    common_majority = sorted(
        [
            kw
            for kw, owners in method_coverage.items()
            if len(owners) >= max(3, len(methods) // 2)
        ]
    )

    lines: List[str] = []
    ts = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    lines.append("# Xarray Plot API GUI Design (Generated)\n")
    lines.append(f"_Generated: {ts}_  \n")
    lines.append(f"_Source parsed: `{source_ref}`_\n\n")
    lines.append("## Scope\n")
    lines.append(
        "This document is generated from parsed source code only (AST), with no "
        "LLM interpretation or manual GUI recommendations.\n\n"
    )

    lines.append("## Method / Overload Summary\n")
    lines.append("| Method | Overloads | Impl signatures parsed |\n")
    lines.append("|---|---:|---:|\n")
    for m in methods:
        impl_count = sum(1 for s in signatures[m] if not s.is_overload)
        lines.append(f"| `{m}` | {overload_counts[m]} | {impl_count} |\n")
    lines.append("\n")

    lines.append("## Common Kwargs Across Parsed Methods\n")
    if common_kwargs:
        lines.append(", ".join(f"`{k}`" for k in sorted(common_kwargs)) + "\n\n")
    else:
        lines.append(
            "_No universal kwargs found across all parsed method implementations._\n\n"
        )

    lines.append("## Common Kwargs Across Many Methods (Practical Common Controls)\n")
    if common_majority:
        lines.append(", ".join(f"`{k}`" for k in common_majority) + "\n\n")
    else:
        lines.append("_No high-coverage kwargs found with current threshold._\n\n")

    lines.append("## Method-Specific Kwargs (API Signatures)\n")
    for m in methods:
        lines.append(f"### `{m}`\n")
        kws = method_specific.get(m, [])
        if kws:
            lines.append(", ".join(f"`{k}`" for k in kws) + "\n\n")
        else:
            lines.append("_No method-specific kwargs beyond common set._\n\n")

    lines.append("## Kwarg x Method Matrix (API Signatures)\n")
    headers = ["Kwarg", "Methods", *methods]
    lines.append("| " + " | ".join(headers) + " |\n")
    lines.append("|" + "|".join(["---"] * len(headers)) + "|\n")
    for kw in sorted(union_kwargs):
        owners = sorted(method_coverage[kw])
        row = [
            f"`{_escape_md_pipe(kw)}`",
            ", ".join(f"`{_escape_md_pipe(o)}`" for o in owners),
        ]
        row.extend("Y" if m in owners else "" for m in methods)
        lines.append("| " + " | ".join(row) + " |\n")
    lines.append("\n")

    lines.append("## All Parsed Signatures and Params\n")
    for m in methods:
        lines.append(f"### `{m}`\n")
        for sig in sorted(signatures[m], key=lambda s: (not s.is_overload, s.line)):
            kind = "overload" if sig.is_overload else "implementation"
            lines.append(f"#### {kind} (line {sig.line})\n\n")
            # Not a list item: tables must not follow `- ...` or they nest inside the list.
            ret = sig.returns or "None"
            lines.append(f"**Returns:** `{_escape_md_pipe(ret)}`\n\n")
            lines.append("| Param | Kind | Default | Annotation |\n")
            lines.append("|---|---|---|---|\n")
            for p in sig.params:
                default = p.default if p.default is not None else EMPTY_SYMBOL
                ann = p.annotation if p.annotation is not None else EMPTY_SYMBOL
                lines.append(
                    f"| `{_escape_md_pipe(p.name)}` | `{_escape_md_pipe(p.kind)}` | "
                    f"{_format_table_cell_code(default)} | {_format_table_cell_code(ann)} |\n"
                )
            lines.append("\n")

    lines.append("## Parsing Algorithm\n")
    lines.append("1. Load source text (URL or local file).\n")
    lines.append("2. Parse with Python `ast.parse`.\n")
    lines.append(
        "3. Select top-level `FunctionDef` nodes for known plotting methods.\n"
    )
    lines.append("4. Mark overloads by decorator (`@overload`).\n")
    lines.append(
        "5. Extract parameters from `args`, `kwonlyargs`, varargs, kwargs, defaults, annotations.\n"
    )
    lines.append("6. Build per-method implementation kwarg sets.\n")
    lines.append(
        "7. Compute set intersection (common kwargs) and per-method differences.\n"
    )
    lines.append(
        "8. Generate markdown tables: overload summary, kwarg matrix, full signature inventory.\n"
    )
    lines.append("9. Emit architecture suggestions derived from parsed groups.\n")
    lines.append("10. Write output markdown.\n")

    return "".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        required=True,
        help="Path or URL to xarray plot file (e.g. dataarray_plot.py).",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Output markdown path.",
    )
    args = parser.parse_args()

    source, source_ref = _load_source(args.input)
    signatures = parse_signatures(source)
    markdown = build_markdown(signatures, source_ref)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(markdown, encoding="utf-8")
    print(f"Wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
