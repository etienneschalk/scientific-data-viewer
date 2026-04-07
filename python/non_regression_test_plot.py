#!/usr/bin/env python3
"""
Non-regression plot checks for create_plot (Issue #117 workflows).

Exercises Issue #117 scenarios (cases 00-06), combinations (10-18), and
v0.11+ plot controls (20-25: vmin/vmax maps, colorbar, legend, issue #134) on the same
sample file. See:
https://github.com/etienneschalk/scientific-data-viewer/issues/117#issuecomment-4025666878

Default input: ``sample-data/hs-issue-0117.nc`` (expected to be the ``hs`` array
after ``isel(rlat=slice(200,500), rlon=slice(2000,2250))`` on the original grid).

By default, PNG outputs go under
``sample-data/non_regression_test_plot/v<version>/`` where ``<version>`` is read
from the repository ``package.json`` (e.g. ``v0.11.1``). Pass ``--out-dir`` to
override. ``setup.sh`` runs this after ``create_sample_data.py`` for visual checks.
Also writes ``summary.md`` next to ``summary.txt`` (markdown with embedded PNGs).

Use ``--full-grid`` when the NetCDF is the full domain; the script then applies
the same absolute rlat/rlon slices as the issue comment before each case.
"""

from __future__ import annotations

import argparse
import base64
import datetime
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

# Run from repo: python/python is on path
_SCRIPT_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _SCRIPT_DIR.parent
if str(_SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPT_DIR))

from get_data_info import CreatePlotError, CreatePlotResult, create_plot  # noqa: E402

DEFAULT_DATA_REL = Path("sample-data") / "hs-issue-0117.nc"
DEFAULT_OUT_BASE_REL = Path("sample-data") / "non_regression_test_plot"
DEFAULT_VARIABLE_PATH = "/hs"

ISSUE_117_URL = "https://github.com/etienneschalk/scientific-data-viewer/issues/117"
ISSUE_117_COMMENT_URL = f"{ISSUE_117_URL}#issuecomment-4025666878"


def _default_out_dir(repo_root: Path) -> Path:
    """``sample-data/non_regression_test_plot/v<version>`` from ``package.json``."""
    pkg = repo_root / "package.json"
    if pkg.is_file():
        try:
            data = json.loads(pkg.read_text(encoding="utf-8"))
            ver = str(data.get("version", "")).strip()
            if ver:
                return repo_root / DEFAULT_OUT_BASE_REL / f"v{ver}"
        except (json.JSONDecodeError, OSError):
            pass
    return repo_root / DEFAULT_OUT_BASE_REL


# Spatial subset from the issue (only used with --full-grid)
_FULL_GRID_BASE_SLICES: dict[str, str] = {
    "rlat": "200:500",
    "rlon": "2000:2250",
}


def _merge_slices(base: dict[str, str], extra: dict[str, Any] | None) -> dict[str, Any]:
    out = dict(base)
    if extra:
        out.update(extra)
    return out


@dataclass(frozen=True)
class PlotCase:
    """One non-regression case: core (00-06), combos (10-18), or vlim/legend (20-25)."""

    slug: str
    doc: str
    title: str
    xarray_code: str
    dimension_slices: dict[str, Any] | None = None
    bins: int | None = None
    facet_row: str | None = None
    facet_col: str | None = None
    col_wrap: int | None = None
    plot_x: str | None = None
    plot_y: str | None = None
    plot_hue: str | None = None
    xincrease: bool | None = None
    yincrease: bool | None = None
    aspect: float | None = None
    size: float | None = None
    robust: bool | None = None
    cmap: str | None = None
    vmin: float | None = None
    vmax: float | None = None
    # None = use create_plot default (colorbar on, legend off)
    add_colorbar: bool | None = None
    add_legend: bool | None = None


@dataclass
class CaseRunOutcome:
    """Result of one create_plot call for summary.md."""

    case: PlotCase
    ok: bool
    png_name: str | None = None
    error_filename: str | None = None
    applied_isel: dict[str, Any] = field(default_factory=dict)


def _plot_cases(full_grid: bool) -> list[PlotCase]:
    """Issue #117 (00-06), extended combos (10-18), vmin/vmax/colorbar/legend (20+)."""
    if full_grid:
        core = [
            PlotCase(
                slug="00_auto_no_user_args",
                doc=(
                    "No dimension_slices, facets, bins, cmap, aspect, or size "
                    "(create_plot auto branch)"
                ),
                title="Baseline: automatic plot (no user plot parameters)",
                xarray_code=(
                    "# Same starting point as the GitHub comment after loading hs:\n"
                    "plt.figure()\n"
                    "hs.plot()  # xarray chooses plot type from shape"
                ),
                dimension_slices=None,
            ),
            PlotCase(
                slug="01_histogram_full_hs",
                doc="histogram after rlat/rlon crop (full grid mode)",
                title="Histogram of all values (after spatial crop on full grid)",
                xarray_code=(
                    "ds = xr.open_dataset(...)\n"
                    "# Same subset as hs = ds.isel(rlat=slice(200,500), "
                    "rlon=slice(2000,2250))['hs']\n"
                    "sub = ds.isel(rlat=slice(200, 500), rlon=slice(2000, 2250))['hs']\n"
                    "plt.figure()\n"
                    "sub.plot(bins=100)"
                ),
                dimension_slices=_merge_slices(_FULL_GRID_BASE_SLICES, None),
                bins=100,
            ),
            PlotCase(
                slug="02_histogram_selected",
                doc="time 0:12 and rlat 200:300 on full grid",
                title="Histogram on a smaller index selection",
                xarray_code=(
                    "sub = ds.isel(\n"
                    "    time=slice(0, 12),\n"
                    "    rlat=slice(200, 300),\n"
                    "    rlon=slice(2000, 2250),\n"
                    ")['hs']\n"
                    "plt.figure()\n"
                    "sub.plot(bins=100)"
                ),
                dimension_slices=_merge_slices(
                    _FULL_GRID_BASE_SLICES,
                    {"time": "0:12", "rlat": "200:300"},
                ),
                bins=100,
            ),
            PlotCase(
                slug="03_map_single_time",
                doc="time=0 with base spatial crop on full grid",
                title="2D map at a single time",
                xarray_code=(
                    "sub = ds.isel(time=0, rlat=slice(200, 500), "
                    "rlon=slice(2000, 2250))['hs']\n"
                    "plt.figure()\n"
                    "sub.plot()"
                ),
                dimension_slices=_merge_slices(_FULL_GRID_BASE_SLICES, {"time": 0}),
            ),
            PlotCase(
                slug="04_timeseries_point",
                doc="rlat=300, rlon=2100 on full grid (100,100 in hs space)",
                title="1D timeseries at one grid point",
                xarray_code=(
                    "# hs.isel(rlat=100, rlon=100) on cropped hs == indices "
                    "300, 2100 on full grid\n"
                    "sub = ds.isel(rlat=300, rlon=2100)['hs']\n"
                    "plt.figure()\n"
                    "sub.plot()"
                ),
                dimension_slices={"rlat": 300, "rlon": 2100},
            ),
            PlotCase(
                slug="05_faceted_row_time",
                doc="time 0:24:6 with base spatial crop",
                title="Faceted maps along `time` (row)",
                xarray_code=(
                    "sub = ds.isel(\n"
                    "    time=slice(0, 24, 6),\n"
                    "    rlat=slice(200, 500),\n"
                    "    rlon=slice(2000, 2250),\n"
                    ")['hs']\n"
                    "plt.figure()\n"
                    'sub.plot(row="time")  # four panels, 6 h steps'
                ),
                dimension_slices=_merge_slices(
                    _FULL_GRID_BASE_SLICES,
                    {"time": "0:24:6"},
                ),
                facet_row="time",
            ),
            PlotCase(
                slug="06_faceted_row_col",
                doc="rlon/rlat strided selection on full grid",
                title="Faceted grid: `row=rlat`, `col=rlon`",
                xarray_code=(
                    "sub = ds.isel(\n"
                    "    rlon=slice(2000, 2250, 50),\n"
                    "    rlat=slice(200, 500, 60),\n"
                    ")['hs']\n"
                    "plt.figure()\n"
                    'sub.plot(row="rlat", col="rlon")'
                ),
                dimension_slices={
                    "rlon": "2000:2250:50",
                    "rlat": "200:500:60",
                },
                facet_row="rlat",
                facet_col="rlon",
            ),
        ]
    else:
        core = [
            PlotCase(
                slug="00_auto_no_user_args",
                doc=(
                    "No dimension_slices, facets, bins, cmap, aspect, or size "
                    "(create_plot auto branch)"
                ),
                title="Baseline: automatic plot (no user plot parameters)",
                xarray_code=(
                    "# Same starting point as the GitHub comment after loading hs:\n"
                    "plt.figure()\n"
                    "hs.plot()  # xarray chooses plot type from shape"
                ),
                dimension_slices=None,
            ),
            PlotCase(
                slug="01_histogram_full_hs",
                doc="hs.plot(bins=100) - histogram of all values",
                title="Histogram of all values in `hs`",
                xarray_code=(
                    "plt.figure()\nhs.plot(bins=100)  # histogram of all values"
                ),
                dimension_slices=None,
                bins=100,
            ),
            PlotCase(
                slug="02_histogram_selected",
                doc=("hs.isel(time=slice(0,12), rlat=slice(0,100)).plot(bins=100)"),
                title="Histogram on a selected subset",
                xarray_code=(
                    "plt.figure()\n"
                    "hs.isel(time=slice(0, 12), rlat=slice(0, 100)).plot(bins=100)"
                ),
                dimension_slices={"time": "0:12", "rlat": "0:100"},
                bins=100,
            ),
            PlotCase(
                slug="03_map_single_time",
                doc="hs.isel(time=0).plot() - map single timestamp",
                title="2D map at a single time",
                xarray_code=(
                    "plt.figure()\nhs.isel(time=0).plot()  # map single timestamp"
                ),
                dimension_slices={"time": 0},
            ),
            PlotCase(
                slug="04_timeseries_point",
                doc="hs.isel(rlat=100, rlon=100).plot() - timeseries at one point",
                title="1D timeseries at one point",
                xarray_code=(
                    "plt.figure()\n"
                    "hs.isel(rlat=100, rlon=100).plot()  # timeseries single point"
                ),
                dimension_slices={"rlat": 100, "rlon": 100},
            ),
            PlotCase(
                slug="05_faceted_row_time",
                doc='hs.isel(time=slice(0,24,6)).plot(row="time")',
                title="Faceted maps along `time` (row)",
                xarray_code=(
                    "plt.figure()\n"
                    'hs.isel(time=slice(0, 24, 6)).plot(row="time")  # four maps, 6 h'
                ),
                dimension_slices={"time": "0:24:6"},
                facet_row="time",
            ),
            PlotCase(
                slug="06_faceted_row_col",
                doc=(
                    "hs.isel(rlon=slice(0,250,50), rlat=slice(0,300,60))"
                    '.plot(row="rlat", col="rlon")'
                ),
                title="Faceted grid: `row=rlat`, `col=rlon`",
                xarray_code=(
                    "plt.figure()\n"
                    "hs.isel(rlon=slice(0, 250, 50), rlat=slice(0, 300, 60)).plot(\n"
                    '    row="rlat", col="rlon"\n'
                    ")  # e.g. 5x5 faceted views"
                ),
                dimension_slices={"rlon": "0:250:50", "rlat": "0:300:60"},
                facet_row="rlat",
                facet_col="rlon",
            ),
        ]
    return (
        core
        + _extended_plot_cases(full_grid)
        + _cases_vmin_vmax_colorbar_legend(full_grid)
    )


def _cases_vmin_vmax_colorbar_legend(full_grid: bool) -> list[PlotCase]:
    """Cases 20+: vmin, vmax, add_colorbar, add_legend (create_plot v0.11+); 25 = issue #134."""
    if full_grid:
        b = _FULL_GRID_BASE_SLICES
        return [
            PlotCase(
                slug="20_vmin_vmax_cmap",
                doc="Fixed color limits (vmin/vmax) on a single-time map",
                title="vmin + vmax with colormap",
                xarray_code=(
                    "sub = ds.isel(time=0, rlat=slice(200, 500), "
                    "rlon=slice(2000, 2250))['hs']\n"
                    "plt.figure()\n"
                    "sub.plot.imshow(cmap='cividis', vmin=0.5, vmax=3.0)"
                ),
                dimension_slices=_merge_slices(b, {"time": 0}),
                cmap="cividis",
                vmin=0.5,
                vmax=3.0,
            ),
            PlotCase(
                slug="21_no_colorbar",
                doc="add_colorbar=False (scalar-mappable plot, no colorbar)",
                title="Disable colorbar",
                xarray_code=(
                    "sub = ds.isel(time=0, rlat=slice(200, 500), "
                    "rlon=slice(2000, 2250))['hs']\n"
                    "plt.figure()\n"
                    "sub.plot.imshow(cmap='cividis', add_colorbar=False)"
                ),
                dimension_slices=_merge_slices(b, {"time": 0}),
                cmap="cividis",
                add_colorbar=False,
            ),
            PlotCase(
                slug="22_add_legend_line",
                doc=(
                    "add_legend=True on a single 1D series (expected: no legend, "
                    "because there is only one line and no hue grouping)"
                ),
                title="add_legend on timeseries",
                xarray_code=(
                    "sub = ds.isel(rlat=300, rlon=2100)['hs']\n"
                    "plt.figure()\n"
                    "sub.plot(add_legend=True)"
                ),
                dimension_slices={"rlat": 300, "rlon": 2100},
                add_legend=True,
            ),
            PlotCase(
                slug="23_add_legend_hue",
                doc=(
                    "add_legend=True with plot_hue=rlon on a 2D slice; keep both "
                    "time (x-axis) and rlon (hue groups) varying to ensure "
                    "legend + visible multiple curves (line plot path, not imshow)"
                ),
                title="add_legend with hue (line plot path)",
                xarray_code=(
                    "sub = ds.isel(rlat=300, rlon=slice(2000, 2004))['hs']\n"
                    "plt.figure()\n"
                    'sub.plot(hue="rlon", add_legend=True)'
                ),
                dimension_slices={"rlat": 300, "rlon": "2000:2004"},
                plot_hue="rlon",
                add_legend=True,
            ),
            PlotCase(
                slug="24_vmin_only",
                doc="vmin only (vmax from data / xarray)",
                title="vmin only",
                xarray_code=(
                    "sub = ds.isel(time=0, rlat=slice(200, 500), "
                    "rlon=slice(2000, 2250))['hs']\n"
                    "plt.figure()\n"
                    "sub.plot.imshow(cmap='plasma', vmin=1.0)"
                ),
                dimension_slices=_merge_slices(b, {"time": 0}),
                cmap="plasma",
                vmin=1.0,
            ),
            PlotCase(
                slug="25_add_legend_col_wrap_3d",
                doc=(
                    "Issue #134: col_wrap forces user_provided + slices_only; 3D subcube "
                    "without cmap uses DataArray.plot — add_legend must not reach QuadMesh"
                ),
                title="add_legend + col_wrap on 3D (generic .plot path)",
                xarray_code=(
                    "sub = ds.isel(time=slice(0, 4), rlat=slice(200, 500), "
                    "rlon=slice(2000, 2250))['hs']\n"
                    "plt.figure()\n"
                    "sub.plot(col_wrap=2, add_legend=True)"
                ),
                dimension_slices=_merge_slices(b, {"time": "0:4"}),
                col_wrap=2,
                add_legend=True,
            ),
        ]

    return [
        PlotCase(
            slug="20_vmin_vmax_cmap",
            doc="Fixed color limits (vmin/vmax) on a single-time map",
            title="vmin + vmax with colormap",
            xarray_code=(
                "plt.figure()\n"
                "hs.isel(time=0).plot.imshow(cmap='cividis', vmin=0.5, vmax=3.0)"
            ),
            dimension_slices={"time": 0},
            cmap="cividis",
            vmin=0.5,
            vmax=3.0,
        ),
        PlotCase(
            slug="21_no_colorbar",
            doc="add_colorbar=False (no colorbar next to map)",
            title="Disable colorbar",
            xarray_code=(
                "plt.figure()\n"
                "hs.isel(time=0).plot.imshow(cmap='cividis', add_colorbar=False)"
            ),
            dimension_slices={"time": 0},
            cmap="cividis",
            add_colorbar=False,
        ),
        PlotCase(
            slug="22_add_legend_line",
            doc=(
                "add_legend=True on a single 1D series (expected: no legend, "
                "because there is only one line and no hue grouping)"
            ),
            title="add_legend on 1D line",
            xarray_code=(
                "plt.figure()\nhs.isel(rlat=100, rlon=100).plot(add_legend=True)"
            ),
            dimension_slices={"rlat": 100, "rlon": 100},
            add_legend=True,
        ),
        PlotCase(
            slug="23_add_legend_hue",
            doc=(
                "add_legend=True with plot_hue=rlon on a 2D slice so multiple "
                "curves are visible and legend entries are meaningful"
            ),
            title="add_legend with hue (line plot path)",
            xarray_code=(
                "plt.figure()\n"
                "hs.isel(rlat=100, rlon=slice(0, 4)).plot("
                'hue="rlon", add_legend=True)'
            ),
            dimension_slices={"rlat": 100, "rlon": "0:4"},
            plot_hue="rlon",
            add_legend=True,
        ),
        PlotCase(
            slug="24_vmin_only",
            doc="vmin only",
            title="vmin only",
            xarray_code=(
                "plt.figure()\nhs.isel(time=0).plot.imshow(cmap='plasma', vmin=1.0)"
            ),
            dimension_slices={"time": 0},
            cmap="plasma",
            vmin=1.0,
        ),
        PlotCase(
            slug="25_add_legend_col_wrap_3d",
            doc=(
                "Issue #134: col_wrap + add_legend on 3D slice without cmap "
                "(generic DataArray.plot must not pass add_legend to QuadMesh)"
            ),
            title="add_legend + col_wrap on 3D (generic .plot path)",
            xarray_code=(
                "plt.figure()\n"
                "hs.isel(time=slice(0, 4), rlat=slice(0, 80), "
                "rlon=slice(0, 80)).plot(col_wrap=2, add_legend=True)"
            ),
            dimension_slices={"time": "0:4", "rlat": "0:80", "rlon": "0:80"},
            col_wrap=2,
            add_legend=True,
        ),
    ]


def _extended_plot_cases(full_grid: bool) -> list[PlotCase]:
    """Extra non-regression cases (10+): cmap, robust, layout, facets, axes, histogram."""
    if full_grid:
        b = _FULL_GRID_BASE_SLICES
        return [
            PlotCase(
                slug="10_cmap_imshow_single_time",
                doc="2D map at t=0 with cmap=cividis (explicit imshow path)",
                title="Colormap on a single-time 2D field",
                xarray_code=(
                    "sub = ds.isel(time=0, rlat=slice(200, 500), "
                    "rlon=slice(2000, 2250))['hs']\n"
                    "plt.figure()\n"
                    "sub.plot.imshow(cmap='cividis')"
                ),
                dimension_slices=_merge_slices(b, {"time": 0}),
                cmap="cividis",
            ),
            PlotCase(
                slug="11_robust_color_limits",
                doc="robust=True (2nd/98th percentiles) at t=0",
                title="Robust color limits on a map",
                xarray_code=(
                    "sub = ds.isel(time=0, rlat=slice(200, 500), "
                    "rlon=slice(2000, 2250))['hs']\n"
                    "plt.figure()\n"
                    "sub.plot.imshow(robust=True)"
                ),
                dimension_slices=_merge_slices(b, {"time": 0}),
                robust=True,
            ),
            PlotCase(
                slug="12_aspect_size_panels",
                doc="aspect=1.8, size=4.5 at t=0",
                title="Panel aspect and size",
                xarray_code=(
                    "sub = ds.isel(time=0, rlat=slice(200, 500), "
                    "rlon=slice(2000, 2250))['hs']\n"
                    "plt.figure()\n"
                    "sub.plot.imshow(aspect=1.8, size=4.5)"
                ),
                dimension_slices=_merge_slices(b, {"time": 0}),
                aspect=1.8,
                size=4.5,
            ),
            PlotCase(
                slug="13_facet_col_wrap",
                doc='time 0:9 with col="time", col_wrap=3',
                title="Facet column + col_wrap",
                xarray_code=(
                    "sub = ds.isel(\n"
                    "    time=slice(0, 9),\n"
                    "    rlat=slice(200, 500),\n"
                    "    rlon=slice(2000, 2250),\n"
                    ")['hs']\n"
                    "plt.figure()\n"
                    'sub.plot(col="time", col_wrap=3)'
                ),
                dimension_slices=_merge_slices(b, {"time": "0:9"}),
                facet_col="time",
                col_wrap=3,
            ),
            PlotCase(
                slug="14_facet_row_cmap",
                doc='time 0:12:3 (4 steps) row="time", cmap=plasma',
                title="Faceted maps with colormap",
                xarray_code=(
                    "sub = ds.isel(\n"
                    "    time=slice(0, 12, 3),\n"
                    "    rlat=slice(200, 500),\n"
                    "    rlon=slice(2000, 2250),\n"
                    ")['hs']\n"
                    "plt.figure()\n"
                    'sub.plot(row="time", cmap="plasma")'
                ),
                dimension_slices=_merge_slices(b, {"time": "0:12:3"}),
                facet_row="time",
                cmap="plasma",
            ),
            PlotCase(
                slug="15_plot_x_y_dims",
                doc="Explicit x=rlat, y=rlon at t=0 (reversed lat and lon)",
                title="plot kwargs x / y dimension names",
                xarray_code=(
                    "sub = ds.isel(time=0, rlat=slice(200, 500), "
                    "rlon=slice(2000, 2250))['hs']\n"
                    "plt.figure()\n"
                    'sub.plot(x="rlat", y="rlon")'
                ),
                dimension_slices=_merge_slices(b, {"time": 0}),
                plot_x="rlat",
                plot_y="rlon",
            ),
            PlotCase(
                slug="16_timeseries_y_decrease",
                doc="Point series with yincrease=False",
                title="1D plot axis direction (yincrease)",
                xarray_code=(
                    "sub = ds.isel(rlat=300, rlon=2100)['hs']\n"
                    "plt.figure()\n"
                    "sub.plot(yincrease=False)"
                ),
                dimension_slices={"rlat": 300, "rlon": 2100},
                yincrease=False,
            ),
            PlotCase(
                slug="17_histogram_spatial_crop",
                doc="Smaller spatial window + histogram bins=48",
                title="Histogram after tight spatial isel",
                xarray_code=(
                    "sub = ds.isel(\n"
                    "    rlat=slice(200, 280),\n"
                    "    rlon=slice(2000, 2080),\n"
                    ")['hs']\n"
                    "plt.figure()\n"
                    "sub.plot(bins=48)"
                ),
                dimension_slices=_merge_slices(
                    b,
                    {"rlat": "200:280", "rlon": "2000:2080"},
                ),
                bins=48,
            ),
            PlotCase(
                slug="18_cmap_robust_aspect_combo",
                doc="cmap + robust + aspect + size on one map",
                title="Combined style kwargs (cmap, robust, aspect, size)",
                xarray_code=(
                    "sub = ds.isel(time=0, rlat=slice(200, 500), "
                    "rlon=slice(2000, 2250))['hs']\n"
                    "plt.figure()\n"
                    "sub.plot.imshow("
                    "cmap='inferno', robust=True, aspect=1.2, size=4)"
                ),
                dimension_slices=_merge_slices(b, {"time": 0}),
                cmap="inferno",
                robust=True,
                aspect=1.2,
                size=4.0,
            ),
        ]

    return [
        PlotCase(
            slug="10_cmap_imshow_single_time",
            doc="2D map at t=0 with cmap=cividis (explicit imshow path)",
            title="Colormap on a single-time 2D field",
            xarray_code=("plt.figure()\nhs.isel(time=0).plot.imshow(cmap='cividis')"),
            dimension_slices={"time": 0},
            cmap="cividis",
        ),
        PlotCase(
            slug="11_robust_color_limits",
            doc="robust=True (2nd/98th percentiles) at t=0",
            title="Robust color limits on a map",
            xarray_code=("plt.figure()\nhs.isel(time=0).plot.imshow(robust=True)"),
            dimension_slices={"time": 0},
            robust=True,
        ),
        PlotCase(
            slug="12_aspect_size_panels",
            doc="aspect=1.8, size=4.5 at t=0",
            title="Panel aspect and size",
            xarray_code=(
                "plt.figure()\nhs.isel(time=0).plot.imshow(aspect=1.8, size=4.5)"
            ),
            dimension_slices={"time": 0},
            aspect=1.8,
            size=4.5,
        ),
        PlotCase(
            slug="13_facet_col_wrap",
            doc='time 0:9 with col="time", col_wrap=3',
            title="Facet column + col_wrap",
            xarray_code=(
                'plt.figure()\nhs.isel(time=slice(0, 9)).plot(col="time", col_wrap=3)'
            ),
            dimension_slices={"time": "0:9"},
            facet_col="time",
            col_wrap=3,
        ),
        PlotCase(
            slug="14_facet_row_cmap",
            doc='time 0:12:3 (4 steps) row="time", cmap=plasma',
            title="Faceted maps with colormap",
            xarray_code=(
                "plt.figure()\n"
                'hs.isel(time=slice(0, 12, 3)).plot(row="time", cmap="plasma")'
            ),
            dimension_slices={"time": "0:12:3"},
            facet_row="time",
            cmap="plasma",
        ),
        PlotCase(
            slug="15_plot_x_y_dims",
            doc="Explicit x=rlat, y=rlon at t=0 (reversed lat and lon)",
            title="plot kwargs x / y dimension names",
            xarray_code=('plt.figure()\nhs.isel(time=0).plot(x="rlat", y="rlon")'),
            dimension_slices={"time": 0},
            plot_x="rlat",
            plot_y="rlon",
        ),
        PlotCase(
            slug="16_timeseries_y_decrease",
            doc="Point series with yincrease=False",
            title="1D plot axis direction (yincrease)",
            xarray_code=(
                "plt.figure()\nhs.isel(rlat=100, rlon=100).plot(yincrease=False)"
            ),
            dimension_slices={"rlat": 100, "rlon": 100},
            yincrease=False,
        ),
        PlotCase(
            slug="17_histogram_spatial_crop",
            doc="Smaller spatial window + histogram bins=48",
            title="Histogram after tight spatial isel",
            xarray_code=(
                "plt.figure()\n"
                "hs.isel(rlat=slice(0, 80), rlon=slice(0, 80)).plot(bins=48)"
            ),
            dimension_slices={"rlat": "0:80", "rlon": "0:80"},
            bins=48,
        ),
        PlotCase(
            slug="18_cmap_robust_aspect_combo",
            doc="cmap + robust + aspect + size on one map",
            title="Combined style kwargs (cmap, robust, aspect, size)",
            xarray_code=(
                "plt.figure()\n"
                "hs.isel(time=0).plot.imshow("
                "cmap='inferno', robust=True, aspect=1.2, size=4)"
            ),
            dimension_slices={"time": 0},
            cmap="inferno",
            robust=True,
            aspect=1.2,
            size=4.0,
        ),
    ]


def _case_extra_create_plot_kwargs(case: PlotCase) -> str:
    """Markdown lines for style/layout kwargs (facets/bins are usually in the snippet)."""
    lines: list[str] = []
    if case.col_wrap is not None:
        lines.append(f"- `col_wrap={case.col_wrap}`")
    if case.plot_x is not None:
        lines.append(f"- `plot_x={case.plot_x!r}`")
    if case.plot_y is not None:
        lines.append(f"- `plot_y={case.plot_y!r}`")
    if case.plot_hue is not None:
        lines.append(f"- `plot_hue={case.plot_hue!r}`")
    if case.xincrease is not None:
        lines.append(f"- `xincrease={case.xincrease}`")
    if case.yincrease is not None:
        lines.append(f"- `yincrease={case.yincrease}`")
    if case.aspect is not None:
        lines.append(f"- `aspect={case.aspect}`")
    if case.size is not None:
        lines.append(f"- `size={case.size}`")
    if case.robust is not None:
        lines.append(f"- `robust={case.robust}`")
    if case.cmap is not None:
        lines.append(f"- `cmap={case.cmap!r}`")
    if case.vmin is not None:
        lines.append(f"- `vmin={case.vmin}`")
    if case.vmax is not None:
        lines.append(f"- `vmax={case.vmax}`")
    if case.add_colorbar is not None:
        lines.append(f"- `add_colorbar={case.add_colorbar}`")
    if case.add_legend is not None:
        lines.append(f"- `add_legend={case.add_legend}`")
    if not lines:
        return ""
    return "**Also passed to `create_plot`:**\n\n" + "\n".join(lines) + "\n\n"


def _write_summary_md(
    *,
    out_dir: Path,
    data_path: Path,
    variable_path: str,
    full_grid: bool,
    style: str,
    outcomes: list[CaseRunOutcome],
) -> None:
    """Write human-readable report with embedded PNGs (same folder as summary.txt)."""
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    mode = (
        "full-grid (`dimension_slices` on the original domain)"
        if full_grid
        else ("pre-cropped `hs` file (`hs-issue-0117.nc`)")
    )
    parts: list[str] = [
        "# Non-regression plot report (Issue #117)\n\n",
        f"_Generated {now} with `create_plot` from `get_data_info.py`._\n\n",
        "## Background\n\n",
        "This report mirrors the workflows discussed in "
        f"[Issue #117]({ISSUE_117_URL}) "
        f"([comment with examples]({ISSUE_117_COMMENT_URL})): "
        "slice dimensions by index (like `.isel()`), then plot with optional "
        "`bins`, `row`, and `col`, staying close to the xarray API.\n\n",
        "Typical UI mapping (from the issue):\n\n",
        "| Dimension | Index (example) | Meaning |\n",
        "|-------------|-----------------|----------|\n",
        "| time | `0:24:2` | `.isel(time=slice(0, 24, 2))` |\n",
        "| rlat | `100:120` | `.isel(rlat=slice(100, 120))` |\n",
        "| rlon | `130` | `.isel(rlon=130)` |\n\n",
        "Preparation used in the original comment (xarray):\n\n",
        "```python\n",
        'ds = xr.open_dataset("https://thredds.met.no/thredds/dodsC/...")\n',
        "hs = ds.isel(rlat=slice(200, 500), rlon=slice(2000, 2250))['hs'].load()\n",
        "```\n\n",
        f"This run: **{mode}**.\n\n",
        f"Case **00** is the baseline `hs.plot()` with no extra UI/plot kwargs; "
        f"**01-06** follow the [issue comment]({ISSUE_117_COMMENT_URL}); "
        "**10-18** add mixed `create_plot` options (cmap, robust, layout, facets, "
        "axes); **20-25** cover `vmin`/`vmax`, `add_colorbar`, `add_legend` "
        "(**25** = issue #134).\n\n",
        "## Run parameters\n\n",
        f"- **Data file:** `{data_path}`\n",
        f"- **Variable path:** `{variable_path}`\n",
        f"- **Matplotlib style:** `{style}`\n",
        f"- **Output directory:** `{out_dir}`\n\n",
        "## Cases\n\n",
    ]
    for i, outcome in enumerate(outcomes, start=1):
        c = outcome.case
        parts.append(f"### {i}. {c.title}\n\n")
        parts.append(f"_`{c.slug}`_\n\n")
        parts.append("**Reference (xarray, from the issue):**\n\n")
        parts.append("```python\n")
        parts.append(c.xarray_code.rstrip() + "\n")
        parts.append("```\n\n")
        parts.append(f"**One-line summary:** {c.doc}\n\n")
        parts.append(_case_extra_create_plot_kwargs(c))
        if outcome.ok and outcome.png_name:
            parts.append(f"![{c.slug}]({outcome.png_name})\n\n")
            if outcome.applied_isel:
                parts.append(
                    f"**Applied `isel` (from `create_plot`):** "
                    f"`{outcome.applied_isel!r}`\n\n"
                )
        else:
            parts.append("**Status:** failed (no PNG).\n\n")
            if outcome.error_filename:
                parts.append(
                    f"See `{outcome.error_filename}` in this folder for the error text.\n\n"
                )
    parts.append("---\nMachine-readable details: [`summary.txt`](summary.txt).\n")
    (out_dir / "summary.md").write_text("".join(parts), encoding="utf-8")


def _write_png(plot_data_b64: str, path: Path) -> None:
    path.write_bytes(base64.b64decode(plot_data_b64))


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Generate PNGs for Issue #117 plot workflows via create_plot "
            "(see module docstring)."
        )
    )
    parser.add_argument(
        "--data-file",
        type=Path,
        default=_REPO_ROOT / DEFAULT_DATA_REL,
        help=f"NetCDF path (default: {DEFAULT_DATA_REL})",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=None,
        help=(
            "Output directory for PNGs (default: "
            f"{DEFAULT_OUT_BASE_REL}/v<version> from package.json)"
        ),
    )
    parser.add_argument(
        "--variable-path",
        default=DEFAULT_VARIABLE_PATH,
        help=f"Variable path for create_plot (default: {DEFAULT_VARIABLE_PATH!r})",
    )
    parser.add_argument(
        "--style",
        default="default",
        help="Matplotlib style passed to create_plot",
    )
    parser.add_argument(
        "--full-grid",
        action="store_true",
        help=(
            "Data file is the full domain: apply absolute rlat/rlon slices "
            "from the issue instead of assuming a pre-cropped ``hs`` file."
        ),
    )
    args = parser.parse_args()

    data_path: Path = args.data_file.resolve()
    out_dir: Path = (
        args.out_dir.resolve()
        if args.out_dir is not None
        else _default_out_dir(_REPO_ROOT).resolve()
    )

    if not data_path.is_file():
        print(
            f"error: data file not found: {data_path}\n"
            f"Place hs-issue-0117.nc under sample-data/ or pass --data-file.",
            file=sys.stderr,
        )
        return 1

    cases = _plot_cases(args.full_grid)
    out_dir.mkdir(parents=True, exist_ok=True)

    summary_path = out_dir / "summary.txt"
    lines: list[str] = [
        f"data_file={data_path}",
        f"variable_path={args.variable_path!r}",
        f"full_grid={args.full_grid}",
        "",
    ]
    outcomes: list[CaseRunOutcome] = []

    failures = 0
    for case in cases:
        png_name = f"{case.slug}.png"
        png_path = out_dir / png_name
        lines.append(f"=== {case.slug} ===")
        lines.append(case.doc)
        lines.append(f"title={case.title!r}")
        lines.append(f"dimension_slices={case.dimension_slices!r}")
        lines.append(
            f"bins={case.bins!r} row={case.facet_row!r} col={case.facet_col!r}"
        )
        lines.append(
            f"col_wrap={case.col_wrap!r} plot_x={case.plot_x!r} "
            f"plot_y={case.plot_y!r} plot_hue={case.plot_hue!r}"
        )
        lines.append(
            f"xincrease={case.xincrease!r} yincrease={case.yincrease!r} "
            f"aspect={case.aspect!r} size={case.size!r} robust={case.robust!r} "
            f"cmap={case.cmap!r}"
        )
        lines.append(
            f"vmin={case.vmin!r} vmax={case.vmax!r} "
            f"add_colorbar={case.add_colorbar!r} add_legend={case.add_legend!r}"
        )

        result = create_plot(
            data_path,
            args.variable_path,
            plot_type="auto",
            style=args.style,
            dimension_slices=case.dimension_slices,
            facet_row=case.facet_row,
            facet_col=case.facet_col,
            col_wrap=case.col_wrap,
            plot_x=case.plot_x,
            plot_y=case.plot_y,
            plot_hue=case.plot_hue,
            xincrease=case.xincrease,
            yincrease=case.yincrease,
            aspect=case.aspect,
            size=case.size,
            robust=case.robust,
            cmap=case.cmap,
            bins=case.bins,
            vmin=case.vmin,
            vmax=case.vmax,
            add_colorbar=(True if case.add_colorbar is None else case.add_colorbar),
            add_legend=(False if case.add_legend is None else case.add_legend),
        )

        if isinstance(result, CreatePlotError):
            failures += 1
            msg = f"FAILED: {result.error}"
            lines.append(msg)
            print(f"{case.slug}: {msg}", file=sys.stderr)
            err_fn = f"{case.slug}.error.txt"
            err_path = out_dir / err_fn
            err_path.write_text(result.error, encoding="utf-8")
            lines.append(f"wrote {err_fn}")
            lines.append("")
            outcomes.append(
                CaseRunOutcome(
                    case=case,
                    ok=False,
                    error_filename=err_fn,
                )
            )
            continue

        assert isinstance(result, CreatePlotResult)
        _write_png(result.plot_data, png_path)
        lines.append(f"ok -> {png_name}")
        lines.append(f"applied_isel={result.applied_isel_kwargs!r}")
        lines.append("")
        print(f"{case.slug}: ok -> {png_path}")
        outcomes.append(
            CaseRunOutcome(
                case=case,
                ok=True,
                png_name=png_name,
                applied_isel=dict(result.applied_isel_kwargs),
            )
        )

    summary_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    _write_summary_md(
        out_dir=out_dir,
        data_path=data_path,
        variable_path=args.variable_path,
        full_grid=args.full_grid,
        style=args.style,
        outcomes=outcomes,
    )
    md_path = out_dir / "summary.md"
    print(f"Summary: {summary_path}")
    print(f"Report:  {md_path}")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
