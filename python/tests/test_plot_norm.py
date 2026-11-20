"""``norm=log``: log color scale of images, log data axis of lines (plotting/norm.py)."""

import json
from pathlib import Path

import matplotlib
import numpy as np
import pandas as pd
import pytest
import xarray as xr

from sdv_backend import cli
from sdv_backend.plotting.api import create_plot
from sdv_backend.plotting.options import PlotOptions
from sdv_backend.results import CreatePlotResult

matplotlib.use("Agg")


@pytest.fixture
def sample(tmp_path: Path) -> Path:
    """Values over 6 orders of magnitude, with zeros, negatives and NaN."""
    rng = np.random.default_rng(0)
    field = np.clip(rng.lognormal(0.0, 2.0, (3, 8, 10)), 1e-3, 50.0)
    field[0, :2, :2] = 0.0  # 4 zeros
    field[1, 3, :] = -1.0  # 10 negatives
    field[2, 0, 0] = np.nan
    field[2, 7, 9] = 1e-4
    field[2, 7, 8] = 1e2
    path = tmp_path / "log.nc"
    xr.Dataset(
        {
            "chl": (("time", "lat", "lon"), field, {"units": "mg m-3"}),
            "series": (("x",), np.r_[0.0, rng.lognormal(0.0, 3.0, 19)]),
            "negative": (("lat", "lon"), -np.ones((8, 10))),
            "counts": (("lat", "lon"), np.arange(80).reshape(8, 10)),
            "constant": (("lat", "lon"), np.full((8, 10), 3.0)),
            "when": (
                ("x",),
                pd.date_range("2020-01-01", periods=20, freq="D"),
            ),
            "curvilinear": (
                ("y2", "x2"),
                rng.lognormal(0.0, 1.0, (4, 5)),
            ),
        },
        coords={
            "time": pd.date_range("2020-01-01", periods=3, freq="D"),
            "lat": np.linspace(-10, 10, 8),
            "lon": np.linspace(0, 20, 10),
            "lon2d": (("y2", "x2"), np.add.outer(np.arange(4.0), np.arange(5.0))),
            "lat2d": (("y2", "x2"), np.subtract.outer(np.arange(4.0), np.arange(5.0))),
        },
    ).to_netcdf(path)
    return path


@pytest.fixture(autouse=True)
def figures(monkeypatch) -> list:
    """The figures drawn by ``create_plot`` (it closes them once saved)."""
    from sdv_backend.plotting import api

    seen: list = []
    original = api.figure_to_base64_png

    def keep(plt, suptitle):
        seen.append(plt.gcf())
        return original(plt, suptitle)

    monkeypatch.setattr(api, "figure_to_base64_png", keep)
    return seen


def _plot(path: Path, variable: str = "/chl", **options) -> CreatePlotResult:
    result = create_plot(path, variable, PlotOptions(**options))
    assert isinstance(result, CreatePlotResult), result
    return result


def _norm_item(result: CreatePlotResult) -> dict | None:
    return next((c for c in result.plot_layout["choices"] if c["role"] == "norm"), None)


def _log_norms(figure) -> list:
    from matplotlib.colors import LogNorm

    return [
        image.norm
        for ax in figure.axes
        if ax.get_label() != "<colorbar>"
        for image in [*ax.images, *ax.collections]
        if isinstance(getattr(image, "norm", None), LogNorm)
    ]


def test_linear_is_the_default_and_unchanged(sample: Path) -> None:
    result = _plot(sample, dimension_slices={"time": 2})
    assert "norm" not in result.applied_plot_kwargs
    assert _norm_item(result) is None
    assert result.plot_layout["notes"] == []


def test_image_gets_a_log_norm_from_the_values_above_0(
    sample: Path, figures: list
) -> None:
    result = _plot(sample, dimension_slices={"time": 2}, norm="log")
    kwargs = result.applied_plot_kwargs
    assert kwargs["norm"] == "LogNorm(vmin=0.0001, vmax=100)"
    assert kwargs["center"] is False
    assert "vmin" not in kwargs and "vmax" not in kwargs
    assert _norm_item(result) == {
        "role": "norm",
        "value": "log, 0.0001 to 100",
        "source": "user",
    }
    norms = _log_norms(figures[-1])
    assert len(norms) == 1
    assert (norms[0].vmin, norms[0].vmax) == (1e-4, 100.0)
    # No value <= 0 in this slice (the NaN is not counted)
    assert result.plot_layout["notes"] == []
    json.dumps(result.applied_plot_kwargs)


def test_values_not_above_0_are_counted_in_a_note(sample: Path) -> None:
    result = _plot(sample, norm="log")
    assert result.plot_layout["notes"] == [
        "norm=log: 14 of 239 values ≤ 0 not shown (5.9%)"
    ]


def test_facets_share_one_log_norm(sample: Path, figures: list) -> None:
    result = _plot(sample, norm="log")
    assert result.plot_layout["kind"] == "image"
    assert result.applied_plot_kwargs["col"] == "time"
    norms = _log_norms(figures[-1])
    assert len(norms) == 3
    assert len({(n.vmin, n.vmax) for n in norms}) == 1

    # One colorbar for the three panels, with log ticks
    colorbars = [ax for ax in figures[-1].axes if ax.get_label() == "<colorbar>"]
    assert len(colorbars) == 1
    assert colorbars[0].get_yscale() == "log"


def test_user_limits_are_kept(sample: Path) -> None:
    result = _plot(sample, dimension_slices={"time": 2}, norm="log", vmin=0.01, vmax=50)
    assert result.applied_plot_kwargs["norm"] == "LogNorm(vmin=0.01, vmax=50)"
    assert result.applied_plot_kwargs["extend"] == "both"
    assert result.plot_layout["notes"] == []


def test_limits_not_above_0_are_ignored_with_a_note(sample: Path) -> None:
    result = _plot(sample, dimension_slices={"time": 2}, norm="log", vmin=-1, vmax=0)
    assert result.applied_plot_kwargs["norm"] == "LogNorm(vmin=0.0001, vmax=100)"
    assert result.plot_layout["notes"] == [
        "vmin=-1 ignored: a log scale starts above 0 (0.0001 used)",
        "vmax=0 ignored: a log scale starts above 0 (100 used)",
    ]


def test_one_user_limit_beyond_the_data_does_not_invert_the_scale(
    sample: Path,
) -> None:
    result = _plot(sample, dimension_slices={"time": 2}, norm="log", vmin=500)
    assert result.applied_plot_kwargs["norm"] == "LogNorm(vmin=500, vmax=500)"
    result = _plot(sample, dimension_slices={"time": 2}, norm="log", vmax=1e-5)
    assert result.applied_plot_kwargs["norm"] == "LogNorm(vmin=1e-05, vmax=1e-05)"


def test_robust_uses_the_percentiles_of_the_values_above_0(sample: Path) -> None:
    result = _plot(sample, norm="log", robust=True)
    data = xr.open_dataset(sample)["chl"].values
    positive = data[np.isfinite(data) & (data > 0)]
    low, high = np.percentile(positive, [2, 98])
    assert result.applied_plot_kwargs["norm"] == (
        f"LogNorm(vmin={low:.6g}, vmax={high:.6g})"
    )
    assert "robust" not in result.applied_plot_kwargs
    # xarray's 2nd percentile of all the values is negative: no LogNorm then
    assert np.percentile(data[np.isfinite(data)], 2) < 0


def test_no_value_above_0_stays_linear_with_a_note(sample: Path) -> None:
    result = _plot(sample, "/negative", norm="log")
    assert "norm" not in result.applied_plot_kwargs
    assert _norm_item(result) is None
    assert result.plot_layout["notes"] == [
        "norm=log ignored: no value above 0, linear scale"
    ]


def test_mixed_signs_do_not_get_a_diverging_colormap(
    sample: Path, figures: list
) -> None:
    _plot(sample, dimension_slices={"time": 1}, norm="log")
    image = figures[-1].axes[0].images[0]
    assert image.get_cmap().name == "viridis"
    # Without the log scale, xarray picks RdBu_r for data of both signs
    _plot(sample, dimension_slices={"time": 1})
    assert figures[-1].axes[0].images[0].get_cmap().name == "RdBu_r"


def test_integers_and_a_constant_field(sample: Path) -> None:
    result = _plot(sample, "/counts", norm="log")
    assert result.applied_plot_kwargs["norm"] == "LogNorm(vmin=1, vmax=79)"
    assert result.plot_layout["notes"] == [
        "norm=log: 1 of 80 values ≤ 0 not shown (1.2%)"
    ]
    result = _plot(sample, "/constant", norm="log")
    assert result.applied_plot_kwargs["norm"] == "LogNorm(vmin=3, vmax=3)"


def test_pcolormesh_on_2d_coordinates(sample: Path, figures: list) -> None:
    result = _plot(sample, "/curvilinear", norm="log", plot_x="lon2d", plot_y="lat2d")
    assert result.applied_plot_kwargs["norm"].startswith("LogNorm(")
    assert len(_log_norms(figures[-1])) == 1


def test_line_gets_a_log_y_axis(sample: Path, figures: list) -> None:
    result = _plot(sample, "/series", norm="log")
    assert result.plot_layout["kind"] == "line"
    assert result.applied_plot_kwargs["yscale"] == "log"
    assert "norm" not in result.applied_plot_kwargs
    assert _norm_item(result)["value"] == "log (y axis)"
    assert result.plot_layout["notes"] == [
        "norm=log: 1 of 20 values ≤ 0 not shown (5%)"
    ]
    ax = figures[-1].axes[0]
    assert ax.get_yscale() == "log"
    # The 0 is a gap, not a point at the bottom edge
    assert np.isnan(ax.lines[0].get_ydata()[0])


def test_line_along_y_gets_a_log_x_axis(sample: Path, figures: list) -> None:
    result = _plot(sample, "/series", norm="log", plot_y="x")
    assert result.applied_plot_kwargs["xscale"] == "log"
    assert _norm_item(result)["value"] == "log (x axis)"
    assert figures[-1].axes[0].get_xscale() == "log"


def test_lines_with_hue(sample: Path) -> None:
    result = _plot(sample, norm="log", plot_hue="time", dimension_slices={"lat": 0})
    assert result.plot_layout["kind"] == "line"
    assert result.applied_plot_kwargs["yscale"] == "log"


def test_histogram_ignores_it_with_a_note(sample: Path) -> None:
    result = _plot(sample, norm="log", bins=10)
    assert result.plot_layout["kind"] == "histogram"
    assert "norm" not in result.applied_plot_kwargs
    assert result.plot_layout["notes"] == ["norm=log ignored: not used by a histogram"]


def test_dates_are_not_numbers(sample: Path) -> None:
    result = _plot(sample, "/when", norm="log")
    assert result.plot_layout["notes"] == [
        "norm=log ignored: the values are not numbers (datetime64[ns])"
    ]


def test_flag_variable_ignores_it_with_a_note(tmp_path: Path) -> None:
    path = tmp_path / "flags.nc"
    xr.Dataset(
        {
            "quality": (
                ("lat", "lon"),
                np.array([[0, 1], [2, 1]], dtype="int8"),
                {
                    "flag_values": np.array([0, 1, 2], "int8"),
                    "flag_meanings": "bad fair good",
                },
            )
        }
    ).to_netcdf(path)
    result = _plot(path, "/quality", norm="log")
    assert (
        "norm=log ignored: a CF flag variable is drawn by meaning"
        in (result.plot_layout["notes"])
    )
    assert not result.applied_plot_kwargs["norm"].startswith("LogNorm")


def test_cli_parses_norm() -> None:
    args = cli.parse_cli_args(["plot", "f.nc", "/v", "--norm", "log"])
    assert cli._plot_options(args, None).norm == "log"
    args = cli.parse_cli_args(["plot", "f.nc", "/v"])
    assert cli._plot_options(args, None).norm == "linear"
    with pytest.raises(SystemExit):
        cli.parse_cli_args(["plot", "f.nc", "/v", "--norm", "symlog"])
