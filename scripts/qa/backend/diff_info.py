"""Differential `info` test: baseline backend vs current backend, same interpreter.

Usage: python scripts/qa/backend/diff_info.py [--python PY] [--baseline DIR]
           [--out DIR] [paths...]

Without paths: every data file of artefacts/sample-data/ plus the QA fixtures. Writes
<out>/info/<name>.{old,new}.json (read by diff_plot.py) and prints, per file, a
structural diff of what the viewer shows (groups, dims, variables, dtypes,
shapes, attributes, time selector). Attribute values are compared as numbers
when one side is numpy text, and the xarray encoding is ignored (it moved out
of the attributes in v0.13).
"""

import argparse
import json
import re
import subprocess
import time
from pathlib import Path

from qa_common import (
    FIXTURES,
    NEW_SCRIPT,
    QA_OUT,
    SAMPLES,
    baseline_script,
    default_python,
)

SKIP = re.compile(r"_webview_|_report_|\.png$|\.idx$|\.aux\.xml$")
SKIP_DIRS = {
    "disposable",
    "sdv-plots",
    "non_regression_test_plot",
    "temporal-datasets",
    "sample-data",
    "nested",
}


def default_paths() -> list[Path]:
    paths = [
        p
        for p in sorted(SAMPLES.iterdir())
        if not SKIP.search(p.name)
        and p.name not in SKIP_DIRS
        and not p.name.startswith(".")
    ]
    if FIXTURES.exists():
        paths += sorted(FIXTURES.iterdir())
    return paths


def run(py: str, script: Path, args: list[str], timeout: int = 300) -> dict:
    t = time.time()
    p = subprocess.run(
        [py, str(script), *args], capture_output=True, text=True, timeout=timeout
    )
    lines = [line for line in p.stdout.splitlines() if line.strip().startswith("{")]
    try:
        js = json.loads(lines[-1]) if lines else None
    except json.JSONDecodeError as e:
        js = {"__unparseable__": str(e), "raw": lines[-1][:500]}
    return {
        "rc": p.returncode,
        "json": js,
        "stderr_tail": p.stderr[-1500:],
        "secs": round(time.time() - t, 2),
    }


NUMPY_ARRAY = re.compile(r"^\[[\d\.\-\se\+naif,]*\]$")


def canon(v):
    """Canonicalise attribute values so number-vs-numpy-text is not a diff."""
    if isinstance(v, str):
        s = v.strip()
        try:
            return float(s)
        except ValueError:
            pass
        if NUMPY_ARRAY.match(s):
            try:
                return [float(x) for x in s.strip("[]").replace(",", " ").split()]
            except ValueError:
                return s
        return s
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, list):
        return [canon(x) for x in v]
    return v


def summarize(js):
    if js is None:
        return {"NO_JSON": True}
    if "error" in js:
        e = js["error"]
        return {
            "ERROR": e
            if isinstance(e, str)
            else {k: e.get(k) for k in ("error", "error_type", "format_info")}
        }
    r = js.get("result", {})
    out = {
        "format": (r.get("format_info") or {}).get("display_name"),
        "engine": r.get("used_engine"),
    }
    for key in ("dimensions_flattened", "datetime_variables"):
        if key in r:
            out[key] = r[key]
    for kind in ("coordinates_flattened", "variables_flattened"):
        groups = {}
        for g, items in (r.get(kind) or {}).items():
            groups[g] = {
                it["name"]: {
                    "dims": it.get("dimensions"),
                    "dtype": it.get("dtype"),
                    "shape": it.get("shape"),
                    "attrs": {
                        k: canon(v)
                        for k, v in (it.get("attributes") or {}).items()
                        if not k.startswith("__xarray_encoding")
                    },
                    "display_value": (it.get("display_value") or "")[:80],
                }
                for it in items
            }
        out[kind] = groups
    out["group_attrs"] = {
        g: {
            k: canon(v)
            for k, v in attrs.items()
            if not k.startswith("__xarray_encoding")
        }
        for g, attrs in (r.get("attributes_flattened") or {}).items()
    }
    out["group_order"] = list((r.get("variables_flattened") or {}).keys())
    return out


def diff(a, b, path=""):
    res = []
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b), key=str):
            if k not in a:
                res.append(f"+ {path}/{k} = {json.dumps(b[k])[:200]}")
            elif k not in b:
                res.append(f"- {path}/{k} = {json.dumps(a[k])[:200]}")
            else:
                res += diff(a[k], b[k], f"{path}/{k}")
    elif a != b:
        res.append(f"~ {path}: {json.dumps(a)[:200]} -> {json.dumps(b)[:200]}")
    return res


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("paths", nargs="*", type=Path)
    parser.add_argument("--python", default=default_python())
    parser.add_argument(
        "--baseline",
        default=None,
        help="baseline checkout (default $SDV_QA_OUT/baseline)",
    )
    parser.add_argument("--out", type=Path, default=QA_OUT / "backend")
    args = parser.parse_args()
    old_script = baseline_script(args.baseline)
    out = args.out / "info"
    out.mkdir(parents=True, exist_ok=True)
    print(f"baseline {old_script}\ncurrent  {NEW_SCRIPT}\npython   {args.python}")
    for f in args.paths or default_paths():
        old = run(args.python, old_script, ["info", str(f)])
        new = run(args.python, NEW_SCRIPT, ["info", str(f)])
        for tag, res in (("old", old), ("new", new)):
            res["path"] = str(f)
            (out / f"{f.name}.{tag}.json").write_text(
                json.dumps(res, indent=1, default=str)
            )
        d = diff(summarize(old["json"]), summarize(new["json"]))
        status = "SAME" if not d else f"{len(d)} DIFFS"
        print(
            f"=== {f.name}: old rc={old['rc']} {old['secs']}s new rc={new['rc']} {new['secs']}s -> {status}"
        )
        for line in d[:40]:
            print("   ", line)
        if len(d) > 40:
            print(f"    ... {len(d) - 40} more")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
