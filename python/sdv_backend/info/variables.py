"""Per-variable and per-coordinate metadata extraction."""

from typing import Literal

import numpy as np
import xarray as xr

from sdv_backend.info.display import (
    DEFAULT_SMALL_VALUE_DISPLAY_MAX_LEN,
    _format_small_value,
)
from sdv_backend.info.encoding import _collect_dataarray_attributes
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
        display_value = _format_small_value(var, max_len=small_value_display_max_len)

    return VariableInfo(
        name=str(var_name),
        dtype=str(var.dtype),
        shape=list(var.shape),
        dimensions=[str(d) for d in var.dims],
        size_bytes=var.nbytes,
        attributes=_collect_dataarray_attributes(
            var,
            show_xarray_encoding_attributes=show_xarray_encoding_attributes,
        ),
        display_value=display_value,
    )


def is_datetime_variable(var: xr.DataArray) -> bool:
    """Check if a variable is a datetime type.

    Parameters
    ----------
    var : xr.DataArray
        Variable to check

    Returns
    -------
    bool
        True if variable is datetime type
    """
    # Check dtype for datetime64
    if np.issubdtype(var.dtype, np.datetime64):
        return True

    # Check if dtype string contains 'datetime'
    dtype_str = str(var.dtype)
    if "datetime" in dtype_str.lower():
        return True

    # Check for CF-convention time coordinates (numeric with time units)
    # These are often used in NetCDF files
    attrs = var.attrs
    if "units" in attrs:
        units = str(attrs["units"]).lower()
        # Check for time units like "days since", "hours since", "seconds since", etc.
        if "since" in units and any(
            time_unit in units
            for time_unit in ["day", "hour", "minute", "second", "year", "month"]
        ):
            return True

    # Check for standard_name indicating time
    if "standard_name" in attrs and str(attrs["standard_name"]).lower() == "time":
        return True

    # Check if variable name suggests it's a time variable (common names)
    var_name_lower = str(var.name).lower() if hasattr(var, "name") else ""
    # Additional check: if it has units or standard_name, it's likely a time variable
    return var_name_lower in ["time", "timestamp", "datetime", "date", "t"] and (
        "units" in attrs or "standard_name" in attrs
    )


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
        display_value = _format_small_value(coord, max_len=small_value_display_max_len)

    attributes = _collect_dataarray_attributes(
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
