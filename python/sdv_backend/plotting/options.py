"""Parsing of user plot options (dimension slices, col_wrap, figsize)."""

import argparse
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Literal

import xarray as xr

from sdv_backend.types import ColWrap


def _parse_dimension_slice_spec(spec: str | int) -> int | slice:
    """Parse a single dimension slice spec (Issue #117). Returns int or slice()."""
    if isinstance(spec, int):
        return spec
    s = str(spec).strip()
    if not s:
        raise ValueError("Empty slice spec")
    if ":" not in s:
        return int(s)
    parts = s.split(":")
    if len(parts) == 2:
        start_s, stop_s = parts
        start = int(start_s) if start_s else None
        stop = int(stop_s) if stop_s else None
        return slice(start, stop)
    if len(parts) == 3:
        start_s, stop_s, step_s = parts
        start = int(start_s) if start_s else None
        stop = int(stop_s) if stop_s else None
        step = int(step_s) if step_s else None
        return slice(start, stop, step)
    raise ValueError(f"Invalid slice spec: {s!r}")


def _parse_dimension_slices(
    slices_dict: dict[str, Any] | None,
) -> dict[str, int | slice] | None:
    """Parse dimension_slices from JSON/CLI into isel-compatible dict (Issue #117)."""
    if not slices_dict:
        return None
    out: dict[str, int | slice] = {}
    for dim, spec in slices_dict.items():
        if spec is None or (isinstance(spec, str) and not spec.strip()):
            continue
        try:
            out[str(dim)] = _parse_dimension_slice_spec(spec)
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid slice for dimension {dim!r}: {e}") from e
    return out if out else None


def parse_col_wrap(value: str) -> int | Literal["auto"]:
    """Parse ``--col-wrap``: a positive integer or the token ``auto``."""
    text = str(value).strip()
    if text.lower() == "auto":
        return "auto"
    try:
        parsed = int(text)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            "col_wrap must be a positive integer or 'auto'"
        ) from exc
    if parsed < 1:
        raise argparse.ArgumentTypeError("col_wrap must be >= 1")
    return parsed


def parse_facetgrid_figsize(value: str) -> tuple[float, float]:
    """Parse ``--facetgrid-figsize WIDTH,HEIGHT`` for xarray faceted plot panels."""
    parts = [part.strip() for part in value.split(",")]
    if len(parts) != 2:
        raise argparse.ArgumentTypeError(
            "facetgrid_figsize must be two comma-separated numbers (width,height)"
        )
    try:
        width, height = float(parts[0]), float(parts[1])
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            "facetgrid_figsize must be two numbers"
        ) from exc
    if width <= 0 or height <= 0:
        raise argparse.ArgumentTypeError("facetgrid_figsize values must be > 0")
    return (width, height)


def xarray_supports_col_wrap_auto() -> bool:
    """xarray 2026.04.0 added ``col_wrap='auto'`` for faceted plots."""
    parts = xr.__version__.split(".")
    try:
        year, month = int(parts[0]), int(parts[1])
    except (ValueError, IndexError):
        return False
    return (year, month) >= (2026, 4)


def col_wrap_is_set(col_wrap: ColWrap) -> bool:
    return col_wrap == "auto" or (isinstance(col_wrap, int) and col_wrap >= 1)


@dataclass(frozen=True)
class PlotOptions:
    """Everything the user can tune for one plot (one field per CLI flag).

    Other xarray ``DataArray.plot`` kwargs worth wiring later (see xarray plotting
    docs) include ``norm``, ``center``, ``levels``, ``extend``, ``subplot_kws``,
    ``cbar_kwargs``, ``edgecolors``, ``linewidth``, ``marker``, ``linestyle``,
    and ``alpha``.

    Attributes
    ----------
    plot_type : str
        Type of plot to create (currently only 'auto' supported)
    style : str
        Matplotlib style to use (e.g., 'default', 'dark_background')
    vmin, vmax : float, optional
        Color scale limits (passed to colormap plots only; not histograms or plain
        line plots).
    add_colorbar : bool
        Whether to draw a colorbar for scalar-mappable plots (default True).
        Ignored for histograms.
    add_legend : bool
        Whether to add a legend when xarray supports it (e.g. ``hue``). Omitted on
        generic ``DataArray.plot`` and ``plot.imshow`` when ``hue`` is not set, so
        kwargs are not forwarded to matplotlib artists that reject ``add_legend``
        (e.g. ``QuadMesh``). Default False.
    """

    plot_type: str = "auto"
    style: str = "auto"

    # Opening the file
    convert_bands_to_variables: bool = False
    netcdf_engine_order: Sequence[str] | str | None = None
    show_inherited_coordinates: bool = True
    open_as_kerchunk: bool = False

    # Data selection
    datetime_variable_name: str | None = None
    start_datetime: str | None = None
    end_datetime: str | None = None
    dimension_slices: dict[str, str | int] | None = None

    # Layout (xarray facets and axes)
    facet_row: str | None = None
    facet_col: str | None = None
    col_wrap: ColWrap = None
    plot_x: str | None = None
    plot_y: str | None = None
    plot_hue: str | None = None
    facetgrid_figsize: tuple[float, float] | None = None

    # xarray plot kwargs
    xincrease: bool | None = None
    yincrease: bool | None = None
    aspect: int | float | None = None
    size: int | float | None = None
    robust: bool | None = None
    cmap: str | None = None
    bins: int | None = None
    vmin: int | float | None = None
    vmax: int | float | None = None
    add_colorbar: bool = True
    add_legend: bool = False

    @property
    def has_user_layout(self) -> bool:
        """True when the user set any slice/facet/x/y/hue/bins/aspect/size option.

        In that case the plot is built from user input only. When only ``cmap`` is
        set, the automatic strategies are kept so cmap is passed to the relevant
        plot calls there.
        """
        return bool(
            (self.dimension_slices and len(self.dimension_slices) > 0)
            or (self.facet_row and self.facet_row.strip())
            or (self.facet_col and self.facet_col.strip())
            or col_wrap_is_set(self.col_wrap)
            or (self.plot_x and self.plot_x.strip())
            or (self.plot_y and self.plot_y.strip())
            or (self.plot_hue and self.plot_hue.strip())
            or (self.bins is not None and self.bins >= 1)
            or (self.aspect is not None and self.aspect > 0)
            or (self.size is not None and self.size > 0)
        )
