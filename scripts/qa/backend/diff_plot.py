"""Differential `plot` test: every variable, baseline vs current backend.

Usage: python scripts/qa/backend/diff_plot.py [--python PY] [--baseline DIR]
           [--out DIR] [--max-per-file N] [--timeout S] [-- extra plot flags]

Reads the variables from the `info` results of diff_info.py (run it first).
Images are compared pixel by pixel below the title (which holds the creation
time). Exit code 1 when a plot that worked in the baseline fails now.

Each line starts with SAME, DIFF (both plot, images differ), FIXED? (fails in
the baseline only), REGRESSION? (fails now only) or BOTH-ERR.
"""

import argparse
import base64
import hashlib
import io
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image
from qa_common import NEW_SCRIPT, QA_OUT, baseline_script, default_python, plot_argv

TITLE_ROWS = 60


def run(py: str, script: Path, args: list[str], timeout: int) -> dict:
    try:
        p = subprocess.run(
            [py, str(script), *args], capture_output=True, text=True, timeout=timeout
        )
    except subprocess.TimeoutExpired:
        return {"status": "TIMEOUT"}
    lines = [line for line in p.stdout.splitlines() if line.strip().startswith("{")]
    if not lines:
        return {"status": "NOJSON", "rc": p.returncode, "stderr": p.stderr[-600:]}
    js = json.loads(lines[-1])
    if "result" in js and js["result"].get("plot_data"):
        raw = base64.b64decode(js["result"]["plot_data"])
        img = np.asarray(Image.open(io.BytesIO(raw)).convert("RGBA"))[TITLE_ROWS:]
        return {
            "status": "OK",
            "shape": img.shape,
            "px": hashlib.sha1(img.tobytes()).hexdigest()[:12],
            "img": img,
        }
    err = js.get("error")
    if isinstance(err, dict):
        err = err.get("error")
    return {"status": "ERR", "err": str(err)[:300], "rc": p.returncode}


def job(py, old_script, file, var, flags, timeout, save=None):
    """Plot `var` of `file` with both backends; `save` is a path prefix for the images."""
    old = run(py, old_script, [*plot_argv(py, old_script, file, var), *flags], timeout)
    new = run(py, NEW_SCRIPT, [*plot_argv(py, NEW_SCRIPT, file, var), *flags], timeout)
    same = None
    if old["status"] == new["status"] == "OK":
        same = old["shape"] == new["shape"] and bool(
            np.array_equal(old["img"], new["img"])
        )
        if not same and old["shape"] == new["shape"]:
            same = f"pixeldiff={np.mean(np.any(old['img'] != new['img'], axis=-1)):.4f}"
    for tag, d in (("old", old), ("new", new)):
        img = d.pop("img", None)
        if save is not None and img is not None:
            Image.fromarray(img).save(f"{save}.{tag}.png")
    return old, new, same


def classify(old: dict, new: dict, same) -> str:
    if same is True:
        return "SAME"
    if old["status"] == "OK" and new["status"] != "OK":
        return "REGRESSION?"
    if new["status"] == "OK" and old["status"] != "OK":
        return "FIXED?"
    if old["status"] != "OK":
        return "BOTH-ERR"
    return f"DIFF {same}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--python", default=default_python())
    parser.add_argument("--baseline", default=None)
    parser.add_argument("--out", type=Path, default=QA_OUT / "backend")
    parser.add_argument("--max-per-file", type=int, default=12)
    parser.add_argument("--timeout", type=int, default=90)
    parser.add_argument("flags", nargs="*", help="extra plot flags, after --")
    args = parser.parse_args()
    old_script = baseline_script(args.baseline)

    jobs = []
    for p in sorted((args.out / "info").glob("*.new.json")):
        res = json.loads(p.read_text())
        js = res["json"]
        if not js or "result" not in js:
            continue
        variables = [
            "/" + it["name"] if g == "/" else f"{g.rstrip('/')}/{it['name']}"
            for g, items in (js["result"].get("variables_flattened") or {}).items()
            for it in items
        ]
        jobs += [(res["path"], v) for v in variables[: args.max_per_file]]
    if not jobs:
        raise SystemExit(
            f"no info results in {args.out / 'info'}: run diff_info.py first"
        )

    results = []
    with ThreadPoolExecutor(10) as ex:
        runs = ex.map(
            lambda j: (
                j,
                job(args.python, old_script, j[0], j[1], args.flags, args.timeout),
            ),
            jobs,
        )
        for (file, var), (old, new, same) in runs:
            tag = classify(old, new, same)
            results.append(
                {
                    "file": file,
                    "var": var,
                    "old": old,
                    "new": new,
                    "same": same,
                    "tag": tag,
                }
            )
            print(
                f"{tag:12} {Path(file).name} :: {var} | old={old['status']} {old.get('err', '')[:100]} | new={new['status']} {new.get('err', '')[:160]}",
                flush=True,
            )
    (args.out / "plots.json").write_text(json.dumps(results, indent=1, default=str))
    counts = {}
    for r in results:
        key = r["tag"].split()[0]
        counts[key] = counts.get(key, 0) + 1
    print("\n", counts)
    return 1 if counts.get("REGRESSION?") else 0


if __name__ == "__main__":
    raise SystemExit(main())
