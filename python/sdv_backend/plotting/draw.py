"""Drawing the selected DataArray with xarray's plotting functions.

``layout.resolve_layout`` has already decided the plot kind and where each
dimension goes (user choices first, the rest automatic); this module makes
the matching xarray call:

- image: ``plot.imshow``, or ``plot.pcolormesh`` when an axis is a
  non-dimension coordinate (imshow needs 1D, evenly spaced axes); maps
  without facets get equal x / y scales;
- line: ``plot.line``, against the selected datetime variable when the
  layout says so;
- histogram: ``plot.hist``;
- a CF flag variable (``flag_plot`` given): the same calls on its index
  array, with one color per meaning (``plotting/flags.py``), and bars in
  place of the histogram.
"""

from typing import Any

import numpy as np
import xarray as xr

from sdv_backend._bootstrap import logger
from sdv_backend.plotting.flags import (
    FlagPlot,
    describe_kwargs,
    draw_flag_bars,
    draw_flag_image,
    draw_flag_line,
)
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
    flag_plot: FlagPlot | None = None,
) -> dict[str, Any]:
    """Draw ``var`` on the current matplotlib figure; return the kwargs used.

    The kwargs returned are readable (a seaborn colormap by its name, a
    ``LogNorm`` as text); the call gets the objects (``bundle.for_call``).
    With ``flag_plot``, ``var`` is its index array (one integer per meaning).
    """
    if flag_plot is not None:
        return _draw_flags(var, layout, bundle, selection, variable_name, flag_plot)
    kwargs = {
        **layout.plot_kwargs(),
        **bundle.for_kind(layout.kind, hue="hue" in layout.choices),
    }
    call = bundle.for_call(kwargs)
    if layout.kind == "histogram":
        var.plot.hist(**call)
        _log_plot_route("DataArray.plot.hist")
    elif layout.kind == "line":
        if layout.against_datetime:
            var = _with_datetime_dimension(var, selection, variable_name)
        var.plot.line(**call)
        _log_plot_route("DataArray.plot.line")
    elif _axes_are_dimensions(var, layout):
        var.plot.imshow(**call)
        _log_plot_route("DataArray.plot.imshow")
        _equal_aspect_if_map(layout)
    else:
        var.plot.pcolormesh(**call)
        _log_plot_route("DataArray.plot.pcolormesh")
        _equal_aspect_if_map(layout)
    return kwargs


def _draw_flags(
    var: xr.DataArray,
    layout: PlotLayout,
    bundle: PlotKwargsBundle,
    selection: DatetimeSelection,
    variable_name: str,
    flag_plot: FlagPlot,
) -> dict[str, Any]:
    if layout.kind == "bars":
        draw_flag_bars(var, flag_plot)
        _log_plot_route("flags: bars per meaning")
        return {"flags": "bars"}
    kind = "line" if layout.kind == "line" else "image"
    kwargs = {
        **layout.plot_kwargs(),
        **bundle.for_kind(kind, hue="hue" in layout.choices),
    }
    for key in ("cmap", "vmin", "vmax", "robust"):
        kwargs.pop(key, None)
    if layout.kind == "line":
        if layout.against_datetime:
            var = _with_datetime_dimension(var, selection, variable_name)
        draw_flag_line(var, flag_plot, kwargs)
        _log_plot_route("flags: DataArray.plot.line (steps)")
        return {**kwargs, "drawstyle": "steps-mid"}
    method = "imshow" if _axes_are_dimensions(var, layout) else "pcolormesh"
    draw_flag_image(var, flag_plot, kwargs, method)
    _log_plot_route(f"flags: DataArray.plot.{method}")
    _equal_aspect_if_map(layout)
    return describe_kwargs(kwargs, flag_plot)


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
    """``var`` (1D) with the selected datetime variable as its dimension.

    Keeps the attributes (axis label: long_name, units) and the scalar
    coordinates (title: the sliced indexes) of ``var``.
    """
    assert selection.datetime_var is not None
    datetime_values = selection.datetime_var.values
    if np.issubdtype(datetime_values.dtype, np.datetime64):
        import pandas as pd

        datetime_values = pd.DatetimeIndex(datetime_values)
    dt_name = selection.datetime_var_name
    scalar_coords = {
        name: coord
        for name, coord in var.coords.items()
        if coord.ndim == 0 and name != dt_name
    }
    return xr.DataArray(
        var.values,
        coords={**scalar_coords, dt_name: datetime_values},
        dims=[dt_name],
        name=variable_name,
        attrs=var.attrs,
    )
