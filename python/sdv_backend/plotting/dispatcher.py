"""Plotting strategy detection and xarray plot dispatch."""

import sys
from typing import Any, Literal

import xarray as xr

from sdv_backend._bootstrap import logger
from sdv_backend.plotting.kwargs import strip_add_legend_unless_hue


def is_spatial_dimension(dim_name: str) -> bool:
    """Check if a dimension name represents spatial coordinates.

    Parameters
    ----------
    dim_name : str
        Dimension name to check

    Returns
    -------
    bool
        True if the dimension appears to be spatial, False otherwise
    """
    spatial_patterns: list[str] = [
        "x",
        "y",
        "lon",
        "lat",
        "longitude",
        "latitude",
        "east",
        "west",
        "north",
        "south",
        "easting",
        "westing",
        "northing",
        "southing",
    ]
    return any(pattern in dim_name.lower() for pattern in spatial_patterns)


def detect_plotting_strategy(
    var: xr.DataArray,
) -> Literal["2d_classic", "3d_col", "4d_col_row", "2d_classic_isel", "default"]:
    """Detect the best plotting strategy based on variable dimensions.

    Analyzes the variable's dimensions and shape to determine the most
    appropriate plotting strategy for visualization.

    Parameters
    ----------
    var : xr.DataArray
        DataArray to analyze for plotting strategy

    Returns
    -------
    str
        Plotting strategy name:
        - '2d_classic': 2D spatial data
        - '2d_classic_isel': 2D data with single coordinate
        - '3d_col': 3D data with spatial dimensions
        - '4d_col_row': 4D data with spatial dimensions
        - 'default': Fallback strategy
    """
    dims = list(var.dims)
    ndim = var.ndim

    logger.info(f"Variable '{var.name}' has {ndim} dimensions: {dims}")

    if ndim == 2:
        # Check if last two dimensions are spatial
        if (
            len(dims) >= 2
            # TODO eschalk for now, just use the rightmost dims as x and y.
            # and is_spatial_dimension(dims[-2])
            # and is_spatial_dimension(dims[-1])
        ):
            logger.info("Using 2D spatial plotting strategy")
            return "2d_classic"

    elif ndim == 3:
        # Check if last two dimensions are spatial
        if (
            len(dims) >= 2
            # and is_spatial_dimension(dims[-2])
            # and is_spatial_dimension(dims[-1])
        ):
            if var.shape[0] == 1:
                return "2d_classic_isel"
            else:
                logger.info("Using 3D plotting strategy with col parameter")
                return "3d_col"
    elif ndim == 4 and len(dims) >= 2:
        logger.info("Using 4D plotting strategy with col and row parameters")
        return "4d_col_row"

    logger.info("Using default plotting strategy")
    return "default"


def _log_plot_route(route: str) -> None:
    """Record which plot entry point ran. Stdout is reserved for JSON; print to stderr."""
    msg = f"plot_used: {route}"
    logger.info(msg)
    print(msg, file=sys.stderr)


class XarrayPlotDispatcher:
    """Single place for DataArray.plot / .plot.imshow / .plot.hist (reduces scattered calls)."""

    def imshow(self, dataarray: xr.DataArray, route: str, **kwargs: Any) -> None:
        dataarray.plot.imshow(**strip_add_legend_unless_hue(kwargs))
        _log_plot_route(route)

    def plot(self, dataarray: xr.DataArray, route: str, **kwargs: Any) -> None:
        if kwargs:
            dataarray.plot(**strip_add_legend_unless_hue(kwargs))
        else:
            dataarray.plot()
        _log_plot_route(route)

    def hist(self, dataarray: xr.DataArray, route: str, **kwargs: Any) -> None:
        dataarray.plot.hist(**kwargs)
        _log_plot_route(route)
