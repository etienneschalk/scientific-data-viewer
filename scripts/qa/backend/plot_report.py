"""Markdown report of a baseline vs current plot comparison, for visual review.

Written by diff_plot.py and diff_scen.py next to the images they save
(``<name>.old.png`` / ``<name>.new.png``): one section per tag, most worrying
first, each case with its options, both statuses, image sizes, error messages
and the two images side by side. How to read it: scripts/qa/README.md.
"""

import re
import subprocess
from pathlib import Path

# 20 times the same character or more: hostile fixtures have names of hundreds
_RUN_RE = re.compile(r"(.)\1{19,}")

# (tag prefix, heading, what it means), in the order of the report
GROUPS = [
    ("REGRESSION?", "Regressions", "worked in the baseline, fails now"),
    ("FLAKY?", "Flaky", "the statuses change when the case is run again"),
    ("DIFF pixeldiff", "Drawn differently", "both plot, same size, some pixels differ"),
    ("DIFF False", "Different image size", "both plot, the images have other sizes"),
    ("ERR-CHANGED", "Error message changed", "both fail, with another message"),
    ("FIXED?", "Fixed?", "failed in the baseline, plots now (or a new option)"),
    ("BOTH-ERR", "Same error", "both fail with the same message"),
    ("SAME", "Identical", "both plot, pixel-identical below the title"),
]


def baseline_label(script: Path) -> str:
    """Tag (or commit) of the baseline checkout holding ``script``."""
    try:
        out = subprocess.run(
            ["git", "-C", str(script.parent), "describe", "--tags", "--always"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return out.stdout.strip() or "baseline"
    except (OSError, subprocess.SubprocessError):
        return "baseline"


def _status(side: dict) -> str:
    shape = side.get("shape")
    if side["status"] == "OK" and shape:
        return f"OK, {shape[1]} x {shape[0]} px"
    if side["status"] == "NOJSON":
        return f"NOJSON (exit code {side.get('rc')})"
    return side["status"]


def _short(text: str) -> str:
    """``text`` with each run of one character shown as its start and length."""
    return _RUN_RE.sub(
        lambda m: f"{m.group(1) * 8}…[{len(m.group(0))} times {m.group(1)!r}]", text
    )


def _message(side: dict) -> str:
    if side.get("err"):
        return _short(side["err"])
    # The last stderr line of a run without JSON: argparse error, traceback end
    stderr = (side.get("stderr") or "").strip().splitlines()
    return _short(stderr[-1]) if side["status"] == "NOJSON" and stderr else ""


def _group(tag: str) -> int:
    for i, (prefix, _, _) in enumerate(GROUPS):
        if tag.startswith(prefix):
            return i
    return len(GROUPS)


def _pixeldiff(tag: str) -> float:
    return float(tag.split("=")[1]) if "pixeldiff=" in tag else 0.0


def _where(row: dict) -> str:
    return f"{Path(row['file']).name} :: {row['var']}"


def _same_table(group: list[dict]) -> list[str]:
    """Identical cases: one row each, columns that say something only."""
    where = any(r["name"] != _where(r) for r in group)
    options = any(r.get("flags") for r in group)
    image = any(r.get("image") for r in group)
    header = ["Case", *(["File :: variable"] * where), *(["Options"] * options)]
    header += ["Image"] * image
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    for r in group:
        cells = [f"`{_short(r['name'])}`"]
        if where:
            cells.append(f"`{Path(r['file']).name}` :: `{_short(r['var'])}`")
        if options:
            cells.append(f"`{' '.join(r['flags'])}`" if r.get("flags") else "")
        if image:
            cells.append(f"[new]({r['image']}.new.png)" if r.get("image") else "")
        lines.append("| " + " | ".join(cells) + " |")
    return [*lines, ""]


def _case(row: dict, old_name: str, new_name: str) -> list[str]:
    old, new = row["old"], row["new"]
    lines = [f"### `{_short(row['name'])}`", ""]
    if row["name"] != _where(row):
        lines.append(f"`{Path(row['file']).name}` :: `{_short(row['var'])}`")
    if row.get("flags"):
        lines.append(f"— options `{' '.join(row['flags'])}`")
    if "pixeldiff=" in row["tag"]:
        lines.append(f"— {_pixeldiff(row['tag']):.1%} of the pixels differ")
    lines += ["", f"| {old_name} | {new_name} |", "|---|---|"]
    images = [
        f"![{side}]({row['image']}.{side}.png)" if row[side]["status"] == "OK" else ""
        for side in ("old", "new")
    ]
    if any(images) and not row["tag"].startswith("SAME"):
        lines.append(f"| {images[0]} | {images[1]} |")
    lines.append(f"| {_status(old)} | {_status(new)} |")
    for label, side in ((old_name, old), (new_name, new)):
        message = _message(side)
        if message:
            lines += ["", f"{label}:", "", "```text", message, "```"]
    return [*lines, ""]


def write_report(
    rows: list[dict], path: Path, title: str, old_name: str, log_name: str
) -> None:
    """Write ``rows`` (name, file, var, flags, old, new, tag, image) to ``path``.

    ``image`` is the image path prefix relative to ``path`` (None: no image
    kept); identical cases get a table row only.
    """
    new_name = "current"
    rows = sorted(
        rows, key=lambda r: (_group(r["tag"]), -_pixeldiff(r["tag"]), r["name"])
    )
    counts = [sum(_group(r["tag"]) == i for r in rows) for i in range(len(GROUPS))]
    out = [
        f"# {title}: {old_name} vs {new_name}",
        "",
        f"{len(rows)} cases, plotted by both backends with the same interpreter; images",
        "are compared below the title (60 rows, it holds the creation time). Same data",
        f"as `{log_name}`, whose tags are in brackets. How to read it:",
        "`scripts/qa/README.md` § Reading the results.",
        "",
        "| Section | Cases | Meaning |",
        "|---|---|---|",
    ]
    for (prefix, heading, meaning), n in zip(GROUPS, counts, strict=True):
        anchor = heading.lower().replace(" ", "-").replace("?", "")
        out.append(f"| [{heading}](#{anchor}) (`{prefix}`) | {n} | {meaning} |")
    out.append("")
    for i, (prefix, heading, meaning) in enumerate(GROUPS):
        group = [r for r in rows if _group(r["tag"]) == i]
        out += [
            f"## {heading}",
            "",
            f"`{prefix}`: {meaning}. {len(group)} case(s).",
            "",
        ]
        if prefix == "SAME" and group:
            out += _same_table(group)
            continue
        for r in group:
            out += _case(r, old_name, new_name)
    path.write_text("\n".join(out), encoding="utf-8")
