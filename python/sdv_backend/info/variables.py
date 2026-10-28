"""Per-variable and per-coordinate metadata extraction."""

from typing import Literal

import numpy as np
import xarray as xr
from xarray.coding.times import contains_cftime_datetimes

from sdv_backend.info.display import (
    DEFAULT_SMALL_VALUE_DISPLAY_MAX_LEN,
    format_small_value,
)
from sdv_backend.info.encoding import collect_dataarray_attributes
from sdv_backend.results import CoordinateInfo, VariableInfo


def create_variable_info(
    var_name: str,
    var: xr.DataArray,
    small_variable_bytes: int = 0,
    small_value_display_max_len: int = DEFAULT_SMALL_VALUE_DISPLAY_MAX_LEN,
    show_xarray_encoding_attributes: bool = True,
) -> VariableInfo:
    """Create VariableInfo from a DataArray.

    Parameters
    ----------
    var_name : str
        Name of the variable
    var : xr.DataArray
        DataArray to extract information from
    small_variable_bytes : int
        Max size in bytes to load and display values (Issue #102). If 0, feature disabled.
    small_value_display_max_len : int
        Max character length for display (truncation).
    show_xarray_encoding_attributes : bool
        When True, include ``__xarray_encoding.*`` entries from encoding metadata.

    Returns
    -------
    VariableInfo
        Information about the variable
    """
    display_value = None
    if small_variable_bytes > 0 and var.nbytes <= small_variable_bytes:
        display_value = format_small_value(var, max_len=small_value_display_max_len)

    return VariableInfo(
        name=str(var_name),
        dtype=str(var.dtype),
        shape=list(var.shape),
        dimensions=[str(d) for d in var.dims],
        size_bytes=var.nbytes,
        attributes=collect_dataarray_attributes(
            var,
            show_xarray_encoding_attributes=show_xarray_encoding_attributes,
        ),
        display_value=display_value,
    )


def is_datetime_variable(var: xr.DataArray) -> bool:
    """Whether ``var`` holds decoded datetimes: ``datetime64`` or cftime objects.

    Raw numbers with CF time units (e.g. when the file was opened with
    ``decode_cf=False``) are not datetimes: their values cannot be compared
    with dates. Only the first element of an object array is read to look
    for cftime objects.
    """
    if np.issubdtype(var.dtype, np.datetime64):
        return True
    if var.dtype != object:
        return False
    try:
        return bool(contains_cftime_datetimes(var.variable))
    except Exception:
        return False


def check_monotonicity(
    var: xr.DataArray,
) -> Literal["increasing", "decreasing", "non_monotonic"]:
    """Check if a variable is monotonic increasing, decreasing, or non-monotonic.

    Uses pandas Index methods for efficient monotonicity checking.

    Parameters
    ----------
    var : xr.DataArray
        Variable to check (typically a datetime coordinate)

    Returns
    -------
    str
        'increasing' if monotonic increasing, 'decreasing' if monotonic decreasing,
        'non_monotonic' if not monotonic
    """
    if var.size < 2:
        # Single value or empty - consider as increasing for simplicity
        return "increasing"

    # Convert to pandas Index to use built-in monotonicity checks
    import pandas as pd

    index = pd.Index(var.values)

    # Check monotonicity using pandas Index properties
    if index.is_monotonic_increasing:
        return "increasing"
    elif index.is_monotonic_decreasing:
        return "decreasing"
    else:
        return "non_monotonic"


def create_coord_info(
    coord_name: str,
    coord: xr.DataArray,
    small_variable_bytes: int = 0,
    small_value_display_max_len: int = DEFAULT_SMALL_VALUE_DISPLAY_MAX_LEN,
    show_xarray_encoding_attributes: bool = True,
    inherited_from: str | None = None,
) -> CoordinateInfo:
    """Create CoordinateInfo from a DataArray.

    Parameters
    ----------
    coord_name : str
        Name of the coordinate
    coord : xr.DataArray
        DataArray to extract information from
    small_variable_bytes : int
        Max size in bytes to load and display values (Issue #102). If 0, feature disabled.
    small_value_display_max_len : int
        Max character length for display (truncation).
    show_xarray_encoding_attributes : bool
        When True, include ``__xarray_encoding.*`` entries from encoding metadata.

    Returns
    -------
    CoordinateInfo
        Information about the coordinate
    """
    display_value = None
    if small_variable_bytes > 0 and coord.nbytes <= small_variable_bytes:
        display_value = format_small_value(coord, max_len=small_value_display_max_len)

    attributes = collect_dataarray_attributes(
        coord,
        show_xarray_encoding_attributes=show_xarray_encoding_attributes,
    )
    if inherited_from:
        attributes = {**attributes, "inherited_from": inherited_from}

    return CoordinateInfo(
        name=str(coord_name),
        dtype=str(coord.dtype),
        shape=list(coord.shape),
        dimensions=[str(d) for d in coord.dims],
        size_bytes=coord.nbytes,
        attributes=attributes,
        display_value=display_value,
    )
