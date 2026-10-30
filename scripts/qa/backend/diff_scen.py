"""Plot-option scenario matrix: baseline vs current backend, images saved.

Usage: python scripts/qa/backend/diff_scen.py [--python PY] [--baseline DIR]
           [--out DIR] [scenario names...]

Each scenario is (name, sample file, variable, plot flags). Images go to
<out>/scenarios/<name>.{old,new}.png for review. Exit code 1 when a scenario
that worked in the baseline fails now.
"""

import argparse
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from diff_plot import classify, job
from qa_common import QA_OUT, SAMPLES, baseline_script, default_python

NC = "sample_data.netcdf"  # precipitation(time 6, lat 45, lon 90)


def S(d: dict) -> list[str]:
    return ["--dimension-slices", json.dumps(d)]


SCEN = [
    # --- dimension slices
    ("slice_int0", NC, "/precipitation", S({"time": 0})),
    ("slice_range", NC, "/precipitation", S({"time": "0:3"})),
    ("slice_step", NC, "/precipitation", S({"time": "0:6:2"})),
    ("slice_neg_index", NC, "/precipitation", S({"time": -1})),
    ("slice_neg_str", NC, "/precipitation", S({"time": "-1"})),
    ("slice_neg_range", NC, "/precipitation", S({"time": "-2:"})),
    ("slice_open_step", NC, "/precipitation", S({"time": "5::2"})),
    ("slice_empty", NC, "/precipitation", S({"time": "3:1"})),
    ("slice_garbage", NC, "/precipitation", S({"time": "a"})),
    ("slice_float", NC, "/precipitation", S({"time": "1.5"})),
    ("slice_unknown_dim", NC, "/precipitation", S({"nope": 0})),
    ("slice_out_of_range", NC, "/precipitation", S({"time": 100})),
    ("slice_reverse", NC, "/precipitation", S({"time": 0, "lat": "::-1"})),
    (
        "slice_two_dims",
        NC,
        "/precipitation",
        S({"time": 0, "lat": "0:10", "lon": "0:20"}),
    ),
    ("slice_all_scalar", NC, "/precipitation", S({"time": 0, "lat": 0, "lon": 0})),
    ("slice_spaces", NC, "/precipitation", S({"time": " 0 : 3 "})),
    ("slice_colon_only", NC, "/precipitation", S({"time": ":"})),
    ("slice_empty_string", NC, "/precipitation", S({"time": ""})),
    ("slice_bad_json", NC, "/precipitation", ["--dimension-slices", "{time:0}"]),
    ("slice_json_list", NC, "/precipitation", ["--dimension-slices", "[1,2]"]),
    ("slice_zero_step", NC, "/precipitation", S({"time": "0:6:0"})),
    # --- facets
    ("facet_col", NC, "/precipitation", ["--facet-col", "time"]),
    ("facet_row", NC, "/precipitation", ["--facet-row", "time"]),
    (
        "facet_col_wrap2",
        NC,
        "/precipitation",
        ["--facet-col", "time", "--col-wrap", "2"],
    ),
    (
        "facet_col_wrap_auto",
        NC,
        "/precipitation",
        ["--facet-col", "time", "--col-wrap", "auto"],
    ),
    ("col_wrap_no_facet", NC, "/precipitation", [*S({"time": 0}), "--col-wrap", "3"]),
    (
        "facet_row_col",
        "sample_large_4d_data.nc",
        "/temperature_4d",
        [
            *S({"x": "0:50", "y": "0:50", "level": "0:2"}),
            "--facet-row",
            "time",
            "--facet-col",
            "level",
        ],
    ),
    ("facet_bad_dim", NC, "/precipitation", ["--facet-col", "nope"]),
    (
        "facet_figsize",
        NC,
        "/precipitation",
        ["--facet-col", "time", "--facetgrid-figsize", "6,2"],
    ),
    (
        "figsize_no_facet",
        NC,
        "/precipitation",
        [*S({"time": 0}), "--facetgrid-figsize", "6,2"],
    ),
    # --- axes
    (
        "x_lon_y_lat",
        NC,
        "/precipitation",
        [*S({"time": 0}), "--plot-x", "lon", "--plot-y", "lat"],
    ),
    (
        "x_lat_y_lon",
        NC,
        "/precipitation",
        [*S({"time": 0}), "--plot-x", "lat", "--plot-y", "lon"],
    ),
    ("hue_time", NC, "/precipitation", [*S({"lat": 0}), "--plot-hue", "time"]),
    (
        "hue_time_legend",
        NC,
        "/precipitation",
        [*S({"lat": 0}), "--plot-hue", "time", "--add-legend"],
    ),
    ("x_only", NC, "/precipitation", [*S({"time": 0}), "--plot-x", "lat"]),
    ("x_bad", NC, "/precipitation", [*S({"time": 0}), "--plot-x", "nope"]),
    (
        "xincrease_false",
        NC,
        "/precipitation",
        [*S({"time": 0}), "--xincrease", "false"],
    ),
    (
        "yincrease_false",
        NC,
        "/precipitation",
        [*S({"time": 0}), "--yincrease", "false"],
    ),
    # --- colour
    (
        "vmin_vmax_slice",
        NC,
        "/precipitation",
        [*S({"time": 0}), "--vmin", "0", "--vmax", "1"],
    ),
    (
        "vmin_vmax_facet",
        NC,
        "/precipitation",
        ["--facet-col", "time", "--vmin", "0", "--vmax", "1"],
    ),
    (
        "vmin_vmax_xy",
        NC,
        "/precipitation",
        [
            *S({"time": 0}),
            "--plot-x",
            "lon",
            "--plot-y",
            "lat",
            "--vmin",
            "0",
            "--vmax",
            "1",
        ],
    ),
    (
        "vmin_inverted",
        NC,
        "/precipitation",
        [*S({"time": 0}), "--vmin", "5", "--vmax", "1"],
    ),
    ("vmin_negative", NC, "/precipitation", [*S({"time": 0}), "--vmin", "-5"]),
    ("vmin_neg_sci", NC, "/precipitation", [*S({"time": 0}), "--vmin", "-1e-7"]),
    (
        "vmin_only_cmap",
        NC,
        "/precipitation",
        [*S({"time": 0}), "--vmin", "0", "--cmap", "magma"],
    ),
    ("cmap_valid", NC, "/precipitation", [*S({"time": 0}), "--cmap", "viridis_r"]),
    ("cmap_invalid", NC, "/precipitation", [*S({"time": 0}), "--cmap", "notacmap"]),
    ("robust_2d", NC, "/precipitation", [*S({"time": 0}), "--robust"]),
    ("robust_1d", NC, "/precipitation", [*S({"time": 0, "lat": 0}), "--robust"]),
    ("no_colorbar_slice", NC, "/precipitation", [*S({"time": 0}), "--no-add-colorbar"]),
    (
        "no_colorbar_default",
        "sample_data_multiple_groups.nc",
        "/root_data",
        ["--no-add-colorbar"],
    ),
    ("vmin_1d", NC, "/precipitation", [*S({"time": 0, "lat": 0}), "--vmin", "0"]),
    # --- figure
    (
        "size_aspect",
        NC,
        "/precipitation",
        [*S({"time": 0}), "--size", "3", "--aspect", "2"],
    ),
    ("bins_hist", NC, "/precipitation", ["--bins", "7"]),
    ("bins_2d", NC, "/precipitation", [*S({"time": 0}), "--bins", "7"]),
    (
        "style_dark",
        NC,
        "/precipitation",
        [*S({"time": 0}), "--style", "dark_background"],
    ),
    ("style_bad", NC, "/precipitation", [*S({"time": 0}), "--style", "doesnotexist"]),
    # --- time filter
    (
        "time_range",
        NC,
        "/precipitation",
        [
            "--datetime-variable",
            "time",
            "--start-datetime",
            "2020-01-15",
            "--end-datetime",
            "2020-04-01",
        ],
    ),
    (
        "time_range_empty",
        NC,
        "/precipitation",
        [
            "--datetime-variable",
            "time",
            "--start-datetime",
            "1999-01-01",
            "--end-datetime",
            "1999-01-02",
        ],
    ),
    (
        "time_range_reversed",
        NC,
        "/precipitation",
        [
            "--datetime-variable",
            "time",
            "--start-datetime",
            "2020-01-04",
            "--end-datetime",
            "2020-01-02",
        ],
    ),
    (
        "time_bad_ts",
        NC,
        "/precipitation",
        ["--datetime-variable", "time", "--start-datetime", "notadate"],
    ),
    (
        "time_var_missing",
        NC,
        "/precipitation",
        ["--datetime-variable", "nope", "--start-datetime", "2020-01-02"],
    ),
    (
        "time_var_no_time_dim",
        "sample_data_multiple_groups.nc",
        "/atmosphere/temperature",
        ["--datetime-variable", "time"],
    ),
    (
        "time_plus_slice",
        NC,
        "/precipitation",
        [
            *S({"lat": 0, "lon": 0}),
            "--datetime-variable",
            "time",
            "--start-datetime",
            "2020-01-02",
        ],
    ),
    # --- other formats
    ("grib_slice", "sample_data.grib", "/t", S({"time": 0})),
    (
        "grib_facet_time",
        "sample_data.grib",
        "/t",
        [*S({"time": "0:2"}), "--facet-col", "time"],
    ),
    ("tif_bands_facet", "sample_multiband.tif", "/band_data", ["--facet-col", "band"]),
    ("tif_band0", "sample_multiband.tif", "/band_data", S({"band": 0})),
    ("tif_robust", "sample_data_cog.tif", "/band_data", ["--robust"]),
    ("cdf_temp_slice", "sample_data.cdf", "/temperature", S({"time": 0})),
    (
        "zarr_inherited_child",
        "sample_zarr_inherited_coords.zarr",
        "/root/temperature/raw/temperature_raw",
        [],
    ),
    (
        "zarr_inherited_child_noinh",
        "sample_zarr_inherited_coords.zarr",
        "/root/temperature/raw/temperature_raw",
        ["--no-show-inherited-coordinates"],
    ),
    (
        "group_var_time",
        "sample_data_multiple_groups.nc",
        "/atmosphere/temperature",
        ["--datetime-variable", "/time", "--start-datetime", "2020-01-02"],
    ),
    ("missing_var", NC, "/nope", []),
    ("var_no_slash", NC, "precipitation", S({"time": 0})),
    ("var_group_missing", "sample_data_multiple_groups.nc", "/nogroup/x", []),
    ("coord_plot", NC, "/lat", []),
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("only", nargs="*", help="scenario names (default: all)")
    parser.add_argument("--python", default=default_python())
    parser.add_argument("--baseline", default=None)
    parser.add_argument("--out", type=Path, default=QA_OUT / "backend")
    parser.add_argument("--timeout", type=int, default=90)
    args = parser.parse_args()
    old_script = baseline_script(args.baseline)
    out = args.out / "scenarios"
    out.mkdir(parents=True, exist_ok=True)
    scenarios = [s for s in SCEN if not args.only or s[0] in args.only]

    def one(sc):
        name, f, var, flags = sc
        return sc, job(
            args.python,
            old_script,
            str(SAMPLES / f),
            var,
            flags,
            args.timeout,
            save=str(out / name),
        )

    rows = []
    with ThreadPoolExecutor(8) as ex:
        for (name, f, var, flags), (old, new, same) in ex.map(one, scenarios):
            tag = classify(old, new, same)
            if tag == "BOTH-ERR" and old.get("err", "")[:60] != new.get("err", "")[:60]:
                tag = "ERR-CHANGED"
            rows.append(
                {
                    "name": name,
                    "file": f,
                    "var": var,
                    "flags": flags,
                    "old": old,
                    "new": new,
                    "tag": tag,
                }
            )
            print(
                f"{tag:12} {name:26} old={old['status']:7} {old.get('err', '')[:110]!r}\n{'':40}new={new['status']:7} {new.get('err', '')[:220]!r}",
                flush=True,
            )
    (out / "scenarios.json").write_text(json.dumps(rows, indent=1, default=str))
    return 1 if any(r["tag"] == "REGRESSION?" for r in rows) else 0


if __name__ == "__main__":
    raise SystemExit(main())
