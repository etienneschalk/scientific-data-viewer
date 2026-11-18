"""Differential `plot` test: every variable, baseline vs current backend.

Usage: python scripts/qa/backend/diff_plot.py [--python PY] [--baseline DIR]
           [--out DIR] [--max-per-file N] [--timeout S] [-- extra plot flags]

Reads the variables from the `info` results of diff_info.py (run it first).
Images are compared pixel by pixel below the title (which holds the creation
time). Exit code 1 when a plot that worked in the baseline fails now.

Each line starts with SAME, DIFF (both plot, images differ), FIXED? (fails in
the baseline only), REGRESSION? (fails now only), FLAKY? (REGRESSION? or
FIXED? once, but the case gives other statuses when run again) or BOTH-ERR. The images of
plots that are not identical go to <out>/plots/<file>__<variable>-<hash>.{old,new}.png,
with plots.md, a report of both side by side grouped by tag (plot_report.py);
results in <out>/plots.json.
"""

import argparse
import base64
import hashlib
import io
import json
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from pathlib import Path

import numpy as np
from PIL import Image
from plot_report import baseline_label, write_report
from qa_common import NEW_SCRIPT, QA_OUT, baseline_script, default_python, plot_argv

TITLE_ROWS = 60


def clip(text: str, limit: int = 2000) -> str:
    """``text``, its middle cut when longer than ``limit``: an error message
    can start with a name of thousands of characters and end with the cause."""
    if len(text) <= limit:
        return text
    half = limit // 2
    return f"{text[:half]} … [{len(text) - limit} characters] … {text[-half:]}"


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
    return {"status": "ERR", "err": clip(str(err)), "rc": p.returncode}


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


# Runs again of a REGRESSION? / FIXED? case before believing it: a case right
# half of the time keeps its first statuses 4 times in ~0.4 % of the runs
RETRIES = 4


def settle(tag: str, old: dict, new: dict, rerun) -> str:
    """``tag``, or FLAKY? when ``rerun()`` (a new ``job``) gives other statuses.

    A backend can be random (a name past netCDF-C's 256-byte limit is read
    with junk bytes, scripts/qa/README.md): such a case is not a regression.
    """
    if tag not in ("REGRESSION?", "FIXED?"):
        return tag
    for _ in range(RETRIES):
        again_old, again_new, _ = rerun()
        if (again_old["status"], again_new["status"]) != (old["status"], new["status"]):
            return "FLAKY?"
    return tag


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

    images = args.out / "plots"
    images.mkdir(parents=True, exist_ok=True)

    def image_name(file: str, var: str) -> str:
        # Readable start, then a hash: fixtures have names of thousands of
        # characters, and files of the same name in two folders
        readable = re.sub(r"[^A-Za-z0-9_.-]+", "_", f"{Path(file).name}__{var}")[:80]
        return f"{readable}-{hashlib.sha1(f'{file}::{var}'.encode()).hexdigest()[:8]}"

    results = []
    with ThreadPoolExecutor(10) as ex:
        runs = ex.map(
            lambda j: (
                j,
                job(
                    args.python,
                    old_script,
                    j[0],
                    j[1],
                    args.flags,
                    args.timeout,
                    save=str(images / image_name(*j)),
                ),
            ),
            jobs,
        )
        for (file, var), (old, new, same) in runs:
            tag = settle(
                classify(old, new, same),
                old,
                new,
                partial(
                    job, args.python, old_script, file, var, args.flags, args.timeout
                ),
            )
            image = image_name(file, var)
            if tag == "SAME":
                # Nothing to look at, and ~200 pairs would weigh ~100 MB
                for side in ("old", "new"):
                    (images / f"{image}.{side}.png").unlink(missing_ok=True)
                image = None
            results.append(
                {
                    "name": f"{Path(file).name} :: {var}",
                    "file": file,
                    "var": var,
                    "flags": args.flags,
                    "old": old,
                    "new": new,
                    "same": same,
                    "tag": tag,
                    "image": image,
                }
            )
            print(
                f"{tag:12} {Path(file).name} :: {var} | old={old['status']} {old.get('err', '')[:100]} | new={new['status']} {new.get('err', '')[:160]}",
                flush=True,
            )
    (args.out / "plots.json").write_text(json.dumps(results, indent=1, default=str))
    report = images / "plots.md"
    title = "Every variable plotted"
    write_report(results, report, title, baseline_label(old_script), "qa-plot.log")
    counts = {}
    for r in results:
        key = r["tag"].split()[0]
        counts[key] = counts.get(key, 0) + 1
    print("\n", counts, f"\nreport: {report}")
    return 1 if counts.get("REGRESSION?") else 0


if __name__ == "__main__":
    raise SystemExit(main())
