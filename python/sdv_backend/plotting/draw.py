"""Drawing the selected DataArray with xarray's plotting functions.

``layout.resolve_layout`` has already decided the plot kind and where each
dimension goes (user choices first, the rest automatic); this module makes
the matching xarray call:

- image: ``plot.imshow``, or ``plot.pcolormesh`` when an axis is a
  non-dimension coordinate (imshow needs 1D, evenly spaced axes); maps
  without facets get equal x / y scales;
- line: ``plot.line``, against the selected datetime variable when the
  layout says so;
- histogram: ``plot.hist``.
"""

from typing import Any

import numpy as np
import xarray as xr

from sdv_backend._bootstrap import logger
from sdv_backend.plotting.kwargs import PlotKwargsBundle
from sdv_backend.plotting.layout import PlotLayout
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


def is_spatial_dimension(name: object) -> bool:
    """Whether a dimension name is a usual horizontal coordinate (x, lat, ...)."""
    return str(name).lower() in SPATIAL_DIMENSION_NAMES


def draw_plot(
    var: xr.DataArray,
    layout: PlotLayout,
    bundle: PlotKwargsBundle,
    selection: DatetimeSelection,
    variable_name: str,
) -> dict[str, Any]:
    """Draw ``var`` on the current matplotlib figure; return the kwargs used."""
    kwargs = {
        **layout.plot_kwargs(),
        **bundle.for_kind(layout.kind, hue="hue" in layout.choices),
    }
    if layout.kind == "histogram":
        var.plot.hist(**kwargs)
        _log_plot_route("DataArray.plot.hist")
    elif layout.kind == "line":
        if layout.against_datetime:
            var = _with_datetime_dimension(var, selection, variable_name)
        var.plot.line(**kwargs)
        _log_plot_route("DataArray.plot.line")
    elif _axes_are_dimensions(var, layout):
        var.plot.imshow(**kwargs)
        _log_plot_route("DataArray.plot.imshow")
        _equal_aspect_if_map(layout)
    else:
        var.plot.pcolormesh(**kwargs)
        _log_plot_route("DataArray.plot.pcolormesh")
        _equal_aspect_if_map(layout)
    return kwargs


def _log_plot_route(route: str) -> None:
    """Record which xarray plot call ran (stdout is reserved for JSON)."""
    logger.info(f"plot_used: {route}")


def _axes_are_dimensions(var: xr.DataArray, layout: PlotLayout) -> bool:
    return all(
        layout.value(role) is None or layout.value(role) in var.dims
        for role in ("x", "y")
    )


def _equal_aspect_if_map(layout: PlotLayout) -> None:
    """Equal x/y scales for a single map only; other 2D data keeps a filled
    figure, and a size the user chose is kept."""
    if layout.is_faceted() or layout.choices.get("aspect") is not None:
        return
    if all(is_spatial_dimension(layout.value(role)) for role in ("x", "y")):
        import matplotlib.pyplot as plt

        plt.gca().set_aspect("equal")


def _with_datetime_dimension(
    var: xr.DataArray, selection: DatetimeSelection, variable_name: str
) -> xr.DataArray:
    """``var`` (1D) with the selected datetime variable as its dimension."""
    assert selection.datetime_var is not None
    datetime_values = selection.datetime_var.values
    if np.issubdtype(datetime_values.dtype, np.datetime64):
        import pandas as pd

        datetime_values = pd.DatetimeIndex(datetime_values)
    dt_name = selection.datetime_var_name
    return xr.DataArray(
        var.values,
        coords={dt_name: datetime_values},
        dims=[dt_name],
        name=variable_name,
    )
