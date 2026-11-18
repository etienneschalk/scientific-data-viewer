"""User options that cannot be used as given leave a note under the plot."""

from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr

from sdv_backend.plotting.api import create_plot
from sdv_backend.plotting.options import PlotOptions
from sdv_backend.results import CreatePlotResult


def _write(tmp_path: Path) -> Path:
    path = tmp_path / "t.nc"
    xr.Dataset(
        {
            "v": (
                ("time", "lat", "lon"),
                np.arange(36.0).reshape(4, 3, 3),
                {"long_name": "Precipitation", "units": "mm"},
            )
        },
        coords={
            "time": pd.date_range("2020-01-01", periods=4, freq="D"),
            "lat": [0.0, 1.0, 2.0],
            "lon": [0.0, 1.0, 2.0],
        },
    ).to_netcdf(path)
    return path


def _plot(tmp_path: Path, **options) -> CreatePlotResult:
    result = create_plot(_write(tmp_path), "/v", PlotOptions(**options))
    assert isinstance(result, CreatePlotResult), result
    return result


def test_slice_on_unknown_dimension_is_noted(tmp_path: Path) -> None:
    result = _plot(tmp_path, dimension_slices={"nope": 0, "time": 0})
    assert result.plot_layout["notes"] == [
        "Slice on nope ignored: not a dimension of this variable "
        "(dimensions: time, lat, lon)"
    ]
    assert result.applied_isel_kwargs == {"time": 0}


def test_vmin_above_vmax_is_swapped_with_a_note(tmp_path: Path) -> None:
    result = _plot(tmp_path, dimension_slices={"time": 0}, vmin=5, vmax=1)
    assert result.applied_plot_kwargs["vmin"] == 1.0
    assert result.applied_plot_kwargs["vmax"] == 5.0
    assert result.plot_layout["notes"] == [
        "vmin=5 is above vmax=1: the two are swapped"
    ]


def test_vmin_above_vmax_not_noted_on_a_line(tmp_path: Path) -> None:
    """Lines ignore vmin / vmax: no note about them."""
    result = _plot(tmp_path, dimension_slices={"time": 0, "lat": 0}, vmin=5, vmax=1)
    assert result.plot_layout["kind"] == "line"
    assert result.plot_layout["notes"] == []


def test_unknown_style_is_noted(tmp_path: Path) -> None:
    result = _plot(tmp_path, dimension_slices={"time": 0}, style="doesnotexist")
    assert result.plot_layout["notes"] == [
        "Style 'doesnotexist' not found: default style used "
        "(setting scientificDataViewer.matplotlibStyle)"
    ]


def test_known_style_has_no_note(tmp_path: Path) -> None:
    result = _plot(tmp_path, dimension_slices={"time": 0}, style="dark_background")
    assert result.plot_layout["notes"] == []
