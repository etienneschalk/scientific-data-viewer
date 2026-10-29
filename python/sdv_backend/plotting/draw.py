"""Drawing the selected DataArray with xarray's plotting functions.

Two routes:

- **user layout** (``PlotOptions.has_user_layout``): histogram when ``bins``
  is set, otherwise the user's facets / x / y / hue, otherwise xarray's
  default plot of the sliced data;
- **automatic**: chosen from the number of dimensions (2D image, 3D column
  facets, 4D row/column facets, else xarray's default plot).

``cmap`` (and the other colormap kwargs) only go to ``plot.imshow``; the
generic ``DataArray.plot`` may route to functions that reject them.
"""

from typing import Any

import numpy as np
import xarray as xr

from sdv_backend._bootstrap import logger
from sdv_backend.plotting.kwargs import (
    PlotKwargsBundle,
    build_user_facet_plot_kw,
    draws_color_mesh,
    strip_add_legend_unless_hue,
)
from sdv_backend.plotting.options import PlotOptions
from sdv_backend.plotting.selection import DatetimeSelection

# Dimension names for which a 2D image is drawn with equal x/y scales
SPATIAL_DIMENSION_NAMES: frozenset[str] = frozenset(
    {
        "x",
        "y",
        "lon",
        "lat",
        "longitude",
        "latitude",
        "rlon",
        "rlat",
        "easting",
        "northing",
    }
)


def draw_plot(
    var: xr.DataArray,
    bundle: PlotKwargsBundle,
    options: PlotOptions,
    selection: DatetimeSelection,
    variable_name: str,
) -> None:
    """Draw ``var`` on the current matplotlib figure."""
    if options.has_user_layout:
        logger.info(
            "User provided dimension/facet/bins params: building plot from user input only"
        )
        _draw_user_layout(var, bundle, options)
    else:
        _draw_auto(var, bundle, selection, variable_name)


def is_spatial_dimension(name: object) -> bool:
    """Whether a dimension name is a usual horizontal coordinate (x, lat, ...)."""
    return str(name).lower() in SPATIAL_DIMENSION_NAMES


def _imshow(var: xr.DataArray, route: str, **kwargs: Any) -> None:
    var.plot.imshow(**strip_add_legend_unless_hue(kwargs))
    _log_plot_route(route)


def _plot(var: xr.DataArray, route: str, **kwargs: Any) -> None:
    var.plot(**strip_add_legend_unless_hue(kwargs))
    _log_plot_route(route)


def _log_plot_route(route: str) -> None:
    """Record which xarray plot call ran (stdout is reserved for JSON)."""
    logger.info(f"plot_used: {route}")


def _draw_user_layout(
    var: xr.DataArray, bundle: PlotKwargsBundle, options: PlotOptions
) -> None:
    if bundle.raw.get("bins") is not None:
        logger.info("Creating histogram plot with bins=%s", bundle.raw["bins"])
        var.plot.hist(**bundle.hist_kwargs())
        _log_plot_route("user_provided:DataArray.plot.hist")
        return

    use_imshow = var.ndim >= 2 and bundle.use_cmap_imshow_path()
    plot_kw = build_user_facet_plot_kw(
        var,
        facet_row=options.facet_row,
        facet_col=options.facet_col,
        plot_x=options.plot_x,
        plot_y=options.plot_y,
        plot_hue=options.plot_hue,
    )
    if plot_kw:
        if use_imshow:
            _imshow(
                var,
                "user_provided:DataArray.plot.imshow(facets+slice_kwargs)",
                **{**plot_kw, **bundle.imshow_kwargs()},
            )
        else:
            _plot(
                var,
                "user_provided:DataArray.plot(facets+slice_kwargs)",
                **{
                    **plot_kw,
                    **bundle.generic_kwargs(color_mesh=draws_color_mesh(var, plot_kw)),
                },
            )
        return

    if (
        options.facet_row
        or options.facet_col
        or options.plot_x
        or options.plot_y
        or options.plot_hue
    ):
        logger.warning(
            "Facet row/col and x/y/hue not found on variable; using default plot"
        )
    if use_imshow:
        _imshow(
            var,
            "user_provided:DataArray.plot.imshow(no_facets+cmap)",
            **bundle.imshow_kwargs(),
        )
    else:
        _plot(
            var,
            "user_provided:DataArray.plot(no_facets)",
            **bundle.generic_kwargs(color_mesh=draws_color_mesh(var, {})),
        )


def _draw_auto(
    var: xr.DataArray,
    bundle: PlotKwargsBundle,
    selection: DatetimeSelection,
    variable_name: str,
) -> None:
    logger.info(f"Variable '{var.name}' has {var.ndim} dimensions: {list(var.dims)}")
    if bundle.use_cmap_imshow_path():
        logger.info("Colormap for imshow: %s", bundle.raw.get("cmap"))
    # Facet grids: user aspect/size never reach this route (has_user_layout)
    facet_size = {
        "aspect": bundle.raw.get("aspect", 1),
        "size": bundle.raw.get("size", 4),
    }

    if var.ndim == 2:
        logger.info("Creating 2D plot")
        _imshow(var, "auto:2d:DataArray.plot.imshow", **bundle.imshow_kwargs())
        _equal_aspect_if_spatial(var)
    elif var.ndim == 3 and var.shape[0] == 1:
        logger.info("Creating 2D plot of the single first-dimension index")
        image = var.isel({var.dims[0]: 0})
        _imshow(image, "auto:2d_isel:DataArray.plot.imshow", **bundle.imshow_kwargs())
        _equal_aspect_if_spatial(image)
    elif var.ndim == 3:
        logger.info("Creating 3D plot (col facet)")
        first_dim = var.dims[0]
        _imshow(
            var,
            "auto:3d_col:DataArray.plot.imshow",
            **{
                **bundle.imshow_kwargs(),
                "col": first_dim,
                "col_wrap": min(4, var.sizes[first_dim]),
                **facet_size,
            },
        )
    elif var.ndim == 4:
        logger.info("Creating 4D plot (row and col facets)")
        _imshow(
            var,
            "auto:4d_col_row:DataArray.plot.imshow",
            **{
                **bundle.imshow_kwargs(),
                "row": var.dims[0],
                "col": var.dims[1],
                **facet_size,
            },
        )
    elif var.ndim == 1 and selection.datetime_var is not None:
        _plot_1d_against_datetime(var, bundle, selection, variable_name)
    elif var.ndim > 4 and bundle.use_cmap_imshow_path():
        _imshow(
            var,
            "auto:default:cmap:DataArray.plot.imshow(ndim>4)",
            **{
                **bundle.imshow_kwargs(),
                "row": var.dims[0],
                "col": var.dims[1],
                **facet_size,
            },
        )
    else:
        logger.info("Creating default plot (xarray choice)")
        _plot(
            var,
            "auto:default:DataArray.plot",
            **bundle.generic_kwargs(color_mesh=draws_color_mesh(var, {})),
        )


def _equal_aspect_if_spatial(image: xr.DataArray) -> None:
    """Equal x/y scales for maps only; other 2D data keeps a filled figure."""
    if all(is_spatial_dimension(dim) for dim in image.dims):
        import matplotlib.pyplot as plt

        plt.gca().set_aspect("equal")


def _plot_1d_against_datetime(
    var: xr.DataArray,
    bundle: PlotKwargsBundle,
    selection: DatetimeSelection,
    variable_name: str,
) -> None:
    """Line plot of ``var`` with the selected datetime variable as x-axis."""
    assert selection.datetime_var is not None
    datetime_values = selection.datetime_var.values
    if datetime_values.shape != var.shape:
        logger.warning("Datetime shape mismatch, falling back to default plot")
        _plot(
            var,
            "auto:default:DataArray.plot(datetime_mismatch_fallback)",
            **bundle.generic_kwargs(color_mesh=draws_color_mesh(var, {})),
        )
        return
    if np.issubdtype(datetime_values.dtype, np.datetime64):
        import pandas as pd

        datetime_values = pd.DatetimeIndex(datetime_values)
    dt_name = selection.datetime_var_name
    var_with_time = xr.DataArray(
        var.values,
        coords={dt_name: datetime_values},
        dims=[dt_name],
        name=variable_name,
    )
    _plot(
        var_with_time,
        "auto:default:DataArray.plot(1d+datetime_coord)",
        **bundle.generic_kwargs(color_mesh=False),
    )
