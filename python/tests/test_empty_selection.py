"""Plotting an empty selection returns a clear error (not a ZeroDivisionError)."""

from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr

from sdv_backend.plotting.api import create_plot
from sdv_backend.plotting.options import PlotOptions
from sdv_backend.results import CreatePlotError


def _write(tmp_path: Path) -> Path:
    path = tmp_path / "t.nc"
    xr.Dataset(
        {"v": (("time", "x", "y"), np.zeros((4, 3, 3)))},
        coords={"time": pd.date_range("2020-01-01", periods=4, freq="MS")},
    ).to_netcdf(path)
    return path


def test_time_range_without_data(tmp_path: Path) -> None:
    result = create_plot(
        _write(tmp_path),
        "/v",
        PlotOptions(
            datetime_variable_name="time",
            start_datetime="2020-01-10",
            end_datetime="2020-01-20",
        ),
    )
    assert isinstance(result, CreatePlotError)
    assert result.error.startswith("No data to plot: dimension(s) time are empty")
    assert "2020-01-10" in result.error


def test_empty_dimension_slice(tmp_path: Path) -> None:
    result = create_plot(
        _write(tmp_path), "/v", PlotOptions(dimension_slices={"x": "2:2"})
    )
    assert isinstance(result, CreatePlotError)
    assert "dimension(s) x are empty" in result.error
    assert "dimension slices" in result.error
