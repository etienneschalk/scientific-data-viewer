"""xarray plot call made for each resolved layout."""

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pytest
import xarray as xr
from matplotlib.collections import QuadMesh

from sdv_backend.plotting.draw import draw_plot, is_spatial_dimension
from sdv_backend.plotting.kwargs import PlotKwargsBundle
from sdv_backend.plotting.layout import resolve_layout
from sdv_backend.plotting.options import PlotOptions
from sdv_backend.plotting.selection import DatetimeSelection


def _draw(var: xr.DataArray, options: PlotOptions = PlotOptions(), **style):
    plt.close("all")
    selection = DatetimeSelection(var=var)
    var, layout = resolve_layout(var, options, selection)
    draw_plot(var, layout, PlotKwargsBundle.build(**style), selection, "v")
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
    selection = DatetimeSelection(var=var, datetime_var=when, datetime_var_name="when")
    var, layout = resolve_layout(var, PlotOptions(), selection)
    draw_plot(var, layout, PlotKwargsBundle.build(), selection, "v")
    assert plt.gca().get_xlabel() == "when"


def test_user_histogram() -> None:
    var = xr.DataArray(np.random.default_rng(0).normal(size=50), dims=("x",))
    fig = _draw(var, PlotOptions(bins=7), bins=7)
    assert len(fig.axes[0].patches) == 7


def test_user_facets_with_cmap() -> None:
    var = xr.DataArray(np.zeros((3, 4, 5)), dims=("time", "y", "x"), name="v")
    fig = _draw(var, PlotOptions(facet_col="time"), cmap="magma")
    images = [ax.images[0] for ax in fig.axes if ax.images]
    assert len(images) == 3
    assert images[0].get_cmap().name == "magma"


def test_user_invalid_facet_is_ignored() -> None:
    var = xr.DataArray(np.arange(4.0), dims=("x",), name="v")
    fig = _draw(var, PlotOptions(facet_row="nope"))
    assert len(fig.axes[0].lines) == 1


def _image_limits(fig) -> list[tuple[float, float]]:
    """Color limits of the images."""
    return [
        (image.norm.vmin, image.norm.vmax) for ax in fig.axes for image in ax.images
    ]


def test_image_keeps_vmin_vmax() -> None:
    """vmin / vmax used to be dropped by every DataArray.plot() call."""
    var = xr.DataArray(np.arange(12.0).reshape(3, 4), dims=("y", "x"), name="v")
    fig = _draw(var, vmin=2.0, vmax=5.0)
    assert _image_limits(fig) == [(2.0, 5.0)]


def test_user_facets_keep_vmin_vmax_and_add_colorbar() -> None:
    var = xr.DataArray(np.zeros((3, 4, 5)), dims=("time", "y", "x"), name="v")
    fig = _draw(
        var, PlotOptions(facet_col="time"), vmin=-1.0, vmax=1.0, add_colorbar=False
    )
    assert _image_limits(fig) == [(-1.0, 1.0)] * 3
    assert len(fig.axes) == 3, "no colorbar axis"


def test_coordinate_axis_uses_pcolormesh() -> None:
    """imshow needs dimension axes: a 2D coordinate goes to pcolormesh."""
    lon2d = np.add.outer(np.arange(3.0), np.arange(4.0))
    var = xr.DataArray(
        np.zeros((3, 4)),
        dims=("j", "i"),
        coords={"lon2d": (("j", "i"), lon2d), "lat2d": (("j", "i"), lon2d.T.T)},
        name="v",
    )
    fig = _draw(var, PlotOptions(plot_x="lon2d", plot_y="lat2d"), vmin=0.0, vmax=1.0)
    meshes = [c for ax in fig.axes for c in ax.collections if isinstance(c, QuadMesh)]
    assert meshes and (meshes[0].norm.vmin, meshes[0].norm.vmax) == (0.0, 1.0)


@pytest.mark.parametrize("options", [PlotOptions(), PlotOptions(bins=None, size=3)])
def test_lines_ignore_color_options(options) -> None:
    """Line artists reject robust / vmin / add_colorbar (robust used to crash)."""
    var = xr.DataArray(np.arange(5.0), dims=("x",), name="v")
    fig = _draw(var, options, robust=True, vmin=1.0, add_colorbar=False)
    assert len(fig.axes[0].lines) == 1


def test_hue_lines_get_a_legend() -> None:
    var = xr.DataArray(np.zeros((3, 4)), dims=("t", "x"), name="v")
    fig = _draw(var, PlotOptions(plot_hue="t"), add_legend=True, cmap="magma")
    assert len(fig.axes[0].lines) == 3


def test_histogram_takes_user_size() -> None:
    var = xr.DataArray(np.zeros(10), dims=("x",), name="v")
    fig = _draw(var, PlotOptions(bins=4, size=2, aspect=3), bins=4)
    assert tuple(fig.get_size_inches()) == (6.0, 2.0)


def test_slicing_keeps_the_automatic_facets() -> None:
    """A slice used to switch to the user route: a 3D histogram instead of facets."""
    var = xr.DataArray(np.zeros((5, 6, 7)), dims=("time", "lat", "lon"), name="v")
    var = var.isel(lat=slice(1, 4))
    fig = _draw(var, PlotOptions(dimension_slices={"lat": "1:4"}))
    assert len([ax for ax in fig.axes if ax.images]) == 5


def test_is_spatial_dimension() -> None:
    assert is_spatial_dimension("Latitude")
    assert not is_spatial_dimension("index")  # substring matches are not enough
    assert not is_spatial_dimension("day")
