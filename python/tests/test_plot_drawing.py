"""Choice of the xarray plot call (automatic and user layouts)."""

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pytest
import xarray as xr

from sdv_backend.plotting.draw import draw_plot, is_spatial_dimension
from sdv_backend.plotting.kwargs import PlotKwargsBundle
from sdv_backend.plotting.options import PlotOptions
from sdv_backend.plotting.selection import DatetimeSelection


def _bundle(**kwargs) -> PlotKwargsBundle:
    defaults = {
        "bins": None,
        "robust": None,
        "xincrease": None,
        "yincrease": None,
        "aspect": None,
        "size": None,
        "cmap": None,
        "col_wrap": None,
    }
    return PlotKwargsBundle.build(**{**defaults, **kwargs})


def _draw(var: xr.DataArray, options: PlotOptions = PlotOptions(), **bundle_kw):
    plt.close("all")
    draw_plot(var, _bundle(**bundle_kw), options, DatetimeSelection(var=var), "v")
    return plt.gcf()


@pytest.fixture(autouse=True)
def _close_figures():
    yield
    plt.close("all")


def _image(dims: tuple[str, str]) -> xr.DataArray:
    return xr.DataArray(np.arange(12.0).reshape(3, 4), dims=dims, name="v")


@pytest.mark.parametrize("dims", [("lat", "lon"), ("y", "x"), ("rlat", "rlon")])
def test_maps_get_equal_aspect(dims) -> None:
    assert _draw(_image(dims)).axes[0].get_aspect() == 1.0


@pytest.mark.parametrize("dims", [("time", "level"), ("time", "lon"), ("a", "b")])
def test_non_spatial_2d_keeps_auto_aspect(dims) -> None:
    """``set_aspect("equal")`` used to be forced on every 2D plot (P8)."""
    assert _draw(_image(dims)).axes[0].get_aspect() == "auto"


def test_single_first_index_3d_is_drawn_as_image() -> None:
    var = xr.DataArray(np.zeros((1, 3, 4)), dims=("band", "y", "x"), name="v")
    fig = _draw(var)
    assert len(fig.axes) == 2  # image + colorbar
    assert fig.axes[0].get_aspect() == 1.0


def test_3d_uses_column_facets() -> None:
    var = xr.DataArray(np.zeros((5, 3, 4)), dims=("time", "y", "x"), name="v")
    fig = _draw(var)
    assert len([ax for ax in fig.axes if ax.images]) == 5


def test_4d_uses_row_and_column_facets() -> None:
    var = xr.DataArray(np.zeros((2, 3, 4, 5)), dims=("t", "z", "y", "x"), name="v")
    fig = _draw(var)
    assert len([ax for ax in fig.axes if ax.images]) == 6


def test_1d_line_plot_and_cmap_ignored() -> None:
    var = xr.DataArray(np.arange(5.0), dims=("x",), name="v")
    fig = _draw(var, cmap="viridis")
    assert len(fig.axes[0].lines) == 1


def test_1d_against_datetime_variable() -> None:
    var = xr.DataArray(np.arange(3.0), dims=("obs",), name="v")
    when = xr.DataArray(
        np.array(["2020-01-01", "2020-01-02", "2020-01-03"], dtype="datetime64[ns]"),
        dims=("obs",),
    )
    plt.close("all")
    draw_plot(
        var,
        _bundle(),
        PlotOptions(),
        DatetimeSelection(var=var, datetime_var=when, datetime_var_name="when"),
        "v",
    )
    assert plt.gca().get_xlabel() == "when"


def test_user_histogram() -> None:
    var = xr.DataArray(np.random.default_rng(0).normal(size=50), dims=("x",))
    fig = _draw(var, PlotOptions(bins=7), bins=7)
    assert len(fig.axes[0].patches) == 7


def test_user_facets_with_cmap_use_imshow() -> None:
    var = xr.DataArray(np.zeros((3, 4, 5)), dims=("time", "y", "x"), name="v")
    fig = _draw(var, PlotOptions(facet_col="time"), cmap="magma")
    images = [ax.images[0] for ax in fig.axes if ax.images]
    assert len(images) == 3
    assert images[0].get_cmap().name == "magma"


def test_user_invalid_facet_falls_back_to_default_plot() -> None:
    var = xr.DataArray(np.arange(4.0), dims=("x",), name="v")
    fig = _draw(var, PlotOptions(facet_row="nope"))
    assert len(fig.axes[0].lines) == 1


def test_is_spatial_dimension() -> None:
    assert is_spatial_dimension("Latitude")
    assert not is_spatial_dimension("index")  # substring matches are not enough
    assert not is_spatial_dimension("day")
