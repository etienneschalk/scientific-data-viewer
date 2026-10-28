"""Datetime ranges (info) and global time filtering (plot): static variables,
NaT, cftime calendars and root-group datetime variables."""

from pathlib import Path, PurePosixPath

import numpy as np
import pandas as pd
import pytest
import xarray as xr

from sdv_backend.formats.detect import detect_file_format
from sdv_backend.info.extract import get_file_info
from sdv_backend.opening import OpenedData
from sdv_backend.plotting.api import create_plot
from sdv_backend.plotting.options import PlotOptions
from sdv_backend.plotting.selection import PlotInputError, apply_datetime_filter
from sdv_backend.results import CreatePlotError, CreatePlotResult, FileInfoResult


def _filter(path: Path, variable_path: str, options: PlotOptions) -> xr.DataArray:
    """Run the plot-mode datetime filter on one variable; return the selection."""
    opened = OpenedData.open(path, detect_file_format(path))
    try:
        group_name = PurePosixPath(variable_path).parent
        name = PurePosixPath(variable_path).name
        group = opened.group(group_name, "all_coords")
        selection = apply_datetime_filter(
            group[name], name, group, group_name, opened, options
        )
        return selection.var.load()
    finally:
        opened.close()


@pytest.fixture
def static_and_timed(tmp_path: Path) -> Path:
    path = tmp_path / "static.nc"
    xr.Dataset(
        {
            "temperature": (("time", "x"), np.arange(20.0).reshape(10, 2)),
            "elevation": ("x", [1.0, 2.0]),
            "scalar": ((), 3.0),
        },
        coords={"time": pd.date_range("2020-01-01", periods=10, freq="D")},
    ).to_netcdf(path)
    return path


@pytest.mark.parametrize("variable", ["/elevation", "/scalar"])
def test_global_time_filter_skips_variables_without_time(
    static_and_timed: Path, variable: str
) -> None:
    """The global filter used to ``sel(time=...)`` static variables (P4)."""
    options = PlotOptions(
        datetime_variable_name="time",
        start_datetime="2020-01-03",
        end_datetime="2020-01-05",
    )
    original = xr.open_dataset(static_and_timed)[variable[1:]]
    assert _filter(static_and_timed, variable, options).equals(original.load())
    if variable == "/elevation":
        assert isinstance(
            create_plot(static_and_timed, variable, options), CreatePlotResult
        )


def test_global_time_filter_still_filters_timed_variables(
    static_and_timed: Path,
) -> None:
    options = PlotOptions(
        datetime_variable_name="time",
        start_datetime="2020-01-03",
        end_datetime="2020-01-05",
    )
    assert _filter(static_and_timed, "/temperature", options).sizes["time"] == 3


def test_datetime_range_ignores_nat(tmp_path: Path) -> None:
    """One NaT used to make min/max "NaT" (P6)."""
    times = pd.to_datetime(["2020-01-02", None, "2020-01-01", "2020-01-05"])
    path = tmp_path / "nat.nc"
    xr.Dataset(
        {"v": ("obs", np.arange(4.0)), "when": ("obs", times)},
    ).to_netcdf(path)
    result = get_file_info(path)
    assert isinstance(result, FileInfoResult)
    (when,) = result.datetime_variables["/"]
    assert when == {
        "name": "when",
        "min": "2020-01-01T00:00:00",
        "max": "2020-01-05T00:00:00",
    }


def test_temperature_named_t_is_not_a_time_variable(tmp_path: Path) -> None:
    """P5: no name heuristic, no ranges computed from non-datetime values."""
    path = tmp_path / "t.nc"
    xr.Dataset(
        {"t": ("x", np.array([280.0, 290.0]), {"units": "K"})},
    ).to_netcdf(path)
    result = get_file_info(path)
    assert isinstance(result, FileInfoResult)
    assert result.datetime_variables == {}


@pytest.fixture
def cftime_file(tmp_path: Path) -> Path:
    pytest.importorskip("cftime")
    path = tmp_path / "cftime.nc"
    times = xr.date_range(
        "2000-02-01", periods=40, freq="D", calendar="360_day", use_cftime=True
    )
    xr.Dataset(
        {"tas": (("time", "x"), np.arange(80.0).reshape(40, 2))},
        coords={"time": times},
    ).to_netcdf(path)
    return path


def test_cftime_datetime_range(cftime_file: Path) -> None:
    """P7: cftime coordinates are detected and get ISO min/max."""
    result = get_file_info(cftime_file)
    assert isinstance(result, FileInfoResult)
    assert result.datetime_variables["/"] == [
        {"name": "time", "min": "2000-02-01T00:00:00", "max": "2000-03-10T00:00:00"}
    ]


def test_cftime_time_filter(cftime_file: Path) -> None:
    """P7: 2000-02-30 exists in the 360_day calendar."""
    options = PlotOptions(
        datetime_variable_name="/time",
        start_datetime="2000-02-29T00:00",
        end_datetime="2000-02-30",
    )
    assert _filter(cftime_file, "/tas", options).sizes["time"] == 2
    result = create_plot(cftime_file, "/tas", options)
    try:
        import nc_time_axis  # noqa: F401
    except ImportError:
        # xarray needs nc-time-axis to draw cftime axes: a clear error, no crash
        assert isinstance(result, CreatePlotError)
        assert "nc-time-axis" in result.error
    else:
        assert isinstance(result, CreatePlotResult)


def test_cftime_time_filter_on_data_variable(tmp_path: Path) -> None:
    """Boolean-mask route (datetime data variable) with cftime values."""
    pytest.importorskip("cftime")
    times = xr.date_range(
        "2000-01-01", periods=5, freq="D", calendar="noleap", use_cftime=True
    )
    path = tmp_path / "cftime_var.nc"
    xr.Dataset({"v": ("obs", np.arange(5.0)), "when": ("obs", times)}).to_netcdf(path)
    options = PlotOptions(datetime_variable_name="when", start_datetime="2000-01-04")
    assert _filter(path, "/v", options).sizes["obs"] == 2


def test_cftime_invalid_date_for_calendar(tmp_path: Path) -> None:
    pytest.importorskip("cftime")
    times = xr.date_range(
        "2000-02-01", periods=40, freq="D", calendar="noleap", use_cftime=True
    )
    path = tmp_path / "noleap.nc"
    xr.Dataset({"v": ("time", np.arange(40.0))}, coords={"time": times}).to_netcdf(path)
    options = PlotOptions(datetime_variable_name="time", start_datetime="2000-02-29")
    with pytest.raises(PlotInputError, match="noleap"):
        _filter(path, "/v", options)
    result = create_plot(path, "/v", options)
    assert isinstance(result, CreatePlotError)
    assert "noleap" in result.error


@pytest.fixture
def root_time_data_variable(tmp_path: Path) -> Path:
    """Root-group datetime *data* variable (not inherited by child groups)."""
    path = tmp_path / "groups.nc"
    times = pd.date_range("2020-01-01", periods=6, freq="D")
    tree = xr.DataTree.from_dict(
        {
            "/": xr.Dataset({"time": ("t", times)}),
            "/sub": xr.Dataset({"temp": ("t", np.arange(6.0))}),
        }
    )
    tree.to_netcdf(path)
    return path


def test_bare_root_datetime_name_from_child_group(
    root_time_data_variable: Path,
) -> None:
    """The webview sends root variables as 'time' (parent '.'), which used to be
    looked up in the plotted variable's group only (P12)."""
    options = PlotOptions(
        datetime_variable_name="time",
        start_datetime="2020-01-02",
        end_datetime="2020-01-04",
    )
    assert _filter(root_time_data_variable, "/sub/temp", options).sizes["t"] == 3


def test_bare_datetime_name_prefers_plotted_group(tmp_path: Path) -> None:
    """A group with its own 'time' keeps using it for a bare name."""
    path = tmp_path / "own_time.nc"
    tree = xr.DataTree.from_dict(
        {
            "/": xr.Dataset(
                {"time": ("t", pd.date_range("1990-01-01", periods=4, freq="D"))}
            ),
            "/sub": xr.Dataset(
                {
                    "temp": ("t2", np.arange(5.0)),
                    "time": ("t2", pd.date_range("2020-01-01", periods=5, freq="D")),
                }
            ),
        }
    )
    tree.to_netcdf(path)
    options = PlotOptions(datetime_variable_name="time", start_datetime="2020-01-03")
    assert _filter(path, "/sub/temp", options).sizes["t2"] == 3
