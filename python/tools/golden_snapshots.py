#!/usr/bin/env python3
"""Golden-snapshot safety net for the Python backend refactoring.

Runs the backend CLI (``get_data_info.py``) as a subprocess on local files from
``artefacts/sample-data/`` and stores the normalized JSON output, so that any
behaviour change introduced while restructuring the code is detected.

``artefacts/`` is git-ignored (regenerate the samples with
``create_sample_data.py``), so the snapshots are local too: they live in
``artefacts/golden/``. Paths are written ``<SAMPLES>/...`` (sample folder) and
``<REPO>/...``, so the snapshots do not depend on where the repository is.

Usage:
    python python/tools/golden_snapshots.py record   # capture current behaviour
    python python/tools/golden_snapshots.py check    # compare against capture
    python python/tools/golden_snapshots.py check -k netcdf  # filter case ids

Plot images are compared by SHA-256 of the PNG bytes; pass ``--ignore-png`` to
compare only the JSON metadata (e.g. after a matplotlib upgrade).

Against another commit, with no local snapshots (what ``paranoia.sh`` does in
CI): record with the backend of a checkout of that commit, then check:

    python python/tools/golden_snapshots.py record --golden-dir /tmp/g \
        --entry <checkout>/python/get_data_info.py
    python python/tools/golden_snapshots.py check --golden-dir /tmp/g
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import os
import re
import subprocess
import sys
from base64 import b64decode
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SAMPLE = REPO_ROOT / "artefacts" / "sample-data"
GOLDEN_DIR = REPO_ROOT / "artefacts" / "golden"
# Root of another checkout whose backend is run (--entry), written <REPO> too
ENTRY_ROOT: Path | None = None
FROZEN_CLOCK = Path(__file__).with_name("_frozen_clock_entry.py")
DEFAULT_ENTRY = [str(REPO_ROOT / "python" / "get_data_info.py")]

# Mirrors buildGetDataInfoCliArgs defaults in src/python/DataProcessor.ts
INFO_DEFAULT_FLAGS = [
    "--small-variable-bytes",
    "1000",
    "--small-value-display-max-len",
    "500",
    "--netcdf-engine-order",
    "netcdf4,h5netcdf,scipy",
]

INFO_FILES = [
    "broken_datetime_variable.nc",
    "broken_file.grib",
    "broken_file.h5",
    "broken_file.jp2",
    "broken_file.nc",
    "broken_file.nc4",
    "broken_file.tif",
    "broken_file.zarr",
    "compound_dtype_variable.nc",
    "hs-issue-0117.nc",
    "sample data with spaces.nc",
    "sample_data.cdf",
    "sample_data.geotiff",
    "sample_data.grb",
    "sample_data.grb2",
    "sample_data.grib",
    "sample_data.grib2",
    "sample_data.hdf5",
    "sample_data.jp2",
    "sample_data.jpeg2000",
    "sample_data.nc4",
    "sample_data.netcdf",
    "sample_data.tif",
    "sample_data.tiff",
    "sample_data_complex_long_names.nc",
    "sample_data_long_variable_names.nc",
    "sample_data_many_groups_light.nc",
    "sample_data_many_vars.nc",
    "sample_data_multiple_groups.nc",
    "sample_data_no_attributes.nc",
    "sample_data_unordered_groups.nc",
    "sample_large_4d_data.nc",
    "sample_many_encoding.nc",
    "sample_multiband.tif",
    "sample_zarr_arborescence.zarr",
    "sample_zarr_deeply_nested_attrs.zarr",
    "sample_zarr_inherited_coords.zarr",
    "sample_zarr_nested_groups_from_datatree.zarr",
    # v0.13 formats
    "sample_data_cog.tif",
    "sample_data.kerchunk.json",
    "sample_netcdf_gzip.nc",
    "sample_ocean_grid_v3",
    "sample_zarr_v3_sharded.zarr",
    "sample_zarr_v3.zarr.zip",
    "temporal-datasets/temporal_cdf_datetime_coord.cdf",
    "temporal-datasets/temporal_cdf_datetime_data.cdf",
]

INFO_VARIANTS: dict[str, list[str]] = {
    "bands": ["--convert-bands-to-variables"],
    "noorder": ["--no-order-groups-alphabetically"],
    "noenc": ["--no-show-xarray-encoding-attributes"],
    "noinherit": ["--no-show-inherited-coordinates"],
    "h5first": ["--netcdf-engine-order", "h5netcdf,netcdf4,scipy"],
}
INFO_VARIANT_FILES = {
    "bands": ["sample_multiband.tif", "sample_data.tif"],
    "noorder": ["sample_data_unordered_groups.nc"],
    "noenc": ["sample_many_encoding.nc"],
    "noinherit": [
        "sample_zarr_inherited_coords.zarr",
        "sample_data_multiple_groups.nc",
    ],
    "h5first": ["sample_data_multiple_groups.nc"],
}

HS = "hs-issue-0117.nc"
NC = "sample_data.netcdf"
GRP = "sample_data_multiple_groups.nc"
D4 = "sample_large_4d_data.nc"
CROP = '{"rlat": "200:260", "rlon": "100:150"}'

# (case id, file, variable, extra flags)
PLOT_CASES: list[tuple[str, str, str, list[str]]] = [
    ("auto_3d", NC, "/precipitation", []),
    (
        "slice_4d",
        D4,
        "/temperature_4d",
        ["--dimension-slices", '{"time": 0, "level": 0}'],
    ),
    ("auto_group", GRP, "/atmosphere/wind/u_component", []),
    ("style_dark", NC, "/precipitation", ["--style", "dark_background"]),
    ("slice_map", HS, "/hs", ["--dimension-slices", '{"time": 0}']),
    (
        "slice_point",
        HS,
        "/hs",
        ["--dimension-slices", '{"rlat": 3, "rlon": 4}'],
    ),
    ("hist_bins", HS, "/hs", ["--dimension-slices", CROP, "--bins", "50"]),
    (
        "facet_row",
        HS,
        "/hs",
        [
            "--dimension-slices",
            '{"time": "0:24:12", "rlat": "200:260", "rlon": "100:150"}',
            "--facet-row",
            "time",
        ],
    ),
    (
        "facet_col_wrap",
        HS,
        "/hs",
        [
            "--dimension-slices",
            '{"time": "0:6", "rlat": "200:260", "rlon": "100:150"}',
            "--facet-col",
            "time",
            "--col-wrap",
            "3",
        ],
    ),
    (
        "facet_figsize",
        HS,
        "/hs",
        [
            "--dimension-slices",
            '{"time": "0:4", "rlat": "200:260", "rlon": "100:150"}',
            "--facet-col",
            "time",
            "--facetgrid-figsize",
            "8,4",
        ],
    ),
    (
        "xy_hue",
        HS,
        "/hs",
        [
            "--dimension-slices",
            '{"rlat": "0:3", "rlon": 0}',
            "--plot-x",
            "time",
            "--plot-hue",
            "rlat",
            "--add-legend",
        ],
    ),
    (
        "kwargs_mix",
        HS,
        "/hs",
        [
            "--dimension-slices",
            '{"time": 0}',
            "--cmap",
            "viridis",
            "--vmin",
            "0",
            "--vmax",
            "3",
            "--robust",
            "--xincrease",
            "false",
            "--yincrease",
            "true",
            "--aspect",
            "2",
            "--size",
            "4",
            "--no-add-colorbar",
        ],
    ),
    (
        "bands",
        "sample_multiband.tif",
        "/band_1",
        ["--convert-bands-to-variables"],
    ),
    ("tif_band_data", "sample_data.tif", "/band_data", []),
    (
        "datetime_filter",
        NC,
        "/precipitation",
        [
            "--datetime-variable",
            "time",
            "--start-datetime",
            "2020-01-02",
            "--end-datetime",
            "2020-01-04",
        ],
    ),
    (
        "datetime_range",
        NC,
        "/precipitation",
        [
            "--datetime-variable",
            "time",
            "--start-datetime",
            "2020-01-15",
            "--end-datetime",
            "2020-04-15",
        ],
    ),
    (
        "datetime_start_only",
        NC,
        "/precipitation",
        ["--datetime-variable", "/time", "--start-datetime", "2020-03-15"],
    ),
    (
        "datetime_end_only",
        GRP,
        "/atmosphere/temperature",
        ["--datetime-variable", "/atmosphere/time", "--end-datetime", "2000-01-01"],
    ),
    (
        "datetime_other_group",
        GRP,
        "/atmosphere/temperature",
        ["--datetime-variable", "/time"],
    ),
    (
        "datetime_missing",
        NC,
        "/precipitation",
        ["--datetime-variable", "/nope"],
    ),
    (
        "datetime_bad_ts",
        NC,
        "/precipitation",
        ["--datetime-variable", "time", "--start-datetime", "not-a-date"],
    ),
    ("cog", "sample_data_cog.tif", "/band_data", []),
    ("zarr_v3_zip", "sample_zarr_v3.zarr.zip", "/chlorophyll", []),
    (
        "kerchunk",
        "sample_data.kerchunk.json",
        "/temperature",
        ["--dimension-slices", '{"time": 0}'],
    ),
    ("err_missing_var", NC, "/does_not_exist", []),
    (
        "err_bad_slices",
        NC,
        "/precipitation",
        ["--dimension-slices", "{not json"],
    ),
    (
        "err_bad_dim",
        NC,
        "/precipitation",
        ["--dimension-slices", '{"nope": 0}'],
    ),
    ("err_broken_file", "broken_file.nc", "/x", []),
]

CASE_TIMEOUT_S = 300

_HTML_ID_RE = re.compile(
    r"(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"
)
_ADDR_RE = re.compile(r"0x[0-9a-f]{6,}")


@dataclass
class Case:
    case_id: str
    argv: list[str]


def build_cases() -> list[Case]:
    cases = []
    for rel in INFO_FILES:
        cases.append(
            Case(f"info__{rel}", ["info", str(SAMPLE / rel), *INFO_DEFAULT_FLAGS])
        )
    for variant, files in INFO_VARIANT_FILES.items():
        for rel in files:
            flags = list(INFO_DEFAULT_FLAGS)
            extra = INFO_VARIANTS[variant]
            if extra[0] == "--netcdf-engine-order":
                flags = flags[:-2]
            cases.append(
                Case(
                    f"info_{variant}__{rel}",
                    ["info", str(SAMPLE / rel), *flags, *extra],
                )
            )
    for case_id, rel, var, extra in PLOT_CASES:
        cases.append(Case(f"plot__{case_id}", ["plot", str(SAMPLE / rel), var, *extra]))
    return cases


def _normalize(obj, ignore_png: bool):
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if k == "plot_data" and isinstance(v, str):
                out[k] = (
                    "<png>"
                    if ignore_png
                    else "sha256:" + hashlib.sha256(b64decode(v)).hexdigest()
                )
            else:
                out[k] = _normalize(v, ignore_png)
        return out
    if isinstance(obj, list):
        return [_normalize(v, ignore_png) for v in obj]
    if isinstance(obj, str):
        s = obj.replace(str(SAMPLE), "<SAMPLES>")
        if ENTRY_ROOT is not None:
            s = s.replace(str(ENTRY_ROOT), "<REPO>")
        s = s.replace(str(REPO_ROOT), "<REPO>")
        # cfgrib records the path relative to the current directory (the repository)
        s = s.replace(str(SAMPLE.relative_to(REPO_ROOT)), "<SAMPLES>")
        s = _HTML_ID_RE.sub("<uuid>", s)
        return _ADDR_RE.sub("<addr>", s)
    return obj


def run_case(case: Case, entry: list[str], ignore_png: bool) -> str:
    env = dict(os.environ, MPLBACKEND="Agg", PYTHONHASHSEED="0")
    try:
        proc = subprocess.run(
            [sys.executable, str(FROZEN_CLOCK), *entry, *case.argv],
            capture_output=True,
            text=True,
            env=env,
            timeout=CASE_TIMEOUT_S,
            cwd=REPO_ROOT,
        )
    except subprocess.TimeoutExpired:
        return json.dumps({"timeout": CASE_TIMEOUT_S}) + "\n"
    lines = [ln for ln in proc.stdout.splitlines() if ln.strip()]
    payload = {"returncode": proc.returncode}
    try:
        payload["stdout"] = _normalize(json.loads(lines[-1]), ignore_png)
    except (IndexError, json.JSONDecodeError):
        payload["stdout_raw"] = _normalize(proc.stdout, ignore_png)
    return json.dumps(payload, indent=1, sort_keys=True, ensure_ascii=False) + "\n"


def _golden_path(case: Case) -> Path:
    safe = re.sub(r"[^A-Za-z0-9_.-]+", "_", case.case_id)
    return GOLDEN_DIR / f"{safe}.json"


def main() -> int:
    global GOLDEN_DIR, ENTRY_ROOT
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("mode", choices=["record", "check"])
    parser.add_argument("-k", default="", help="substring filter on case id")
    parser.add_argument("--ignore-png", action="store_true")
    parser.add_argument(
        "--entry",
        default=None,
        help="backend entry as argv, e.g. '-m sdv_backend' (default: get_data_info.py)",
    )
    parser.add_argument(
        "--golden-dir",
        type=Path,
        default=GOLDEN_DIR,
        help="snapshot folder (default: artefacts/golden)",
    )
    parser.add_argument("-j", type=int, default=os.cpu_count() or 4)
    args = parser.parse_args()

    GOLDEN_DIR = args.golden_dir.resolve()
    entry = args.entry.split() if args.entry else DEFAULT_ENTRY
    if entry[0].endswith(".py"):
        # <checkout>/python/get_data_info.py of a reference commit
        ENTRY_ROOT = Path(entry[0]).resolve().parents[1]
    cases = [c for c in build_cases() if args.k in c.case_id]
    missing = [c for c in cases if not Path(c.argv[1]).exists()]
    for c in missing:
        print(f"SKIP {c.case_id} (sample file missing)")
    cases = [c for c in cases if c not in missing]

    GOLDEN_DIR.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=args.j) as pool:
        outputs = list(pool.map(lambda c: run_case(c, entry, args.ignore_png), cases))

    failures = 0
    for case, out in zip(cases, outputs, strict=True):
        path = _golden_path(case)
        if args.mode == "record":
            path.write_text(out, encoding="utf-8")
            print(f"REC  {case.case_id}")
            continue
        if not path.exists():
            print(f"NEW  {case.case_id} (no golden; run record)")
            failures += 1
            continue
        expected = path.read_text(encoding="utf-8")
        if args.ignore_png:
            expected = re.sub(r'"sha256:[0-9a-f]+"', '"<png>"', expected)
        if out == expected:
            print(f"OK   {case.case_id}")
        else:
            failures += 1
            print(f"FAIL {case.case_id}")
            diff = difflib.unified_diff(
                expected.splitlines(), out.splitlines(), "golden", "actual", lineterm=""
            )
            print("\n".join(list(diff)[:60]))
    print(f"\n{len(cases)} cases, {failures} failing")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
