"""xarray display options and small-value formatting for the info view."""

from typing import Any

import xarray as xr

XR_OPTIONS = {"display_expand_attrs": False, "display_expand_data": False}


# For text representation, expand attrs since users can't click to expand them
XR_TEXT_OPTIONS: dict[str, Any] = {
    "display_expand_attrs": True,
    "display_expand_data": True,
    "display_max_rows": 1000,
}


# For HTML representation, keep attrs collapsed (users can click to expand)
XR_HTML_OPTIONS: dict[str, Any] = {**XR_OPTIONS}


# Defaults for Issue #102 (overridable via CLI --small-variable-bytes / --small-value-display-max-len).
# When small_variable_bytes is 0, the feature is disabled.
DEFAULT_SMALL_VARIABLE_BYTES = 1000


DEFAULT_SMALL_VALUE_DISPLAY_MAX_LEN = 500


def _format_small_value(
    var: xr.DataArray,
    max_len: int = DEFAULT_SMALL_VALUE_DISPLAY_MAX_LEN,
) -> str:
    """Load and format variable values for display when size is below threshold."""
    try:
        loaded = var.values
        if loaded.size == 0:
            return "[]"
        s = repr(loaded)
        if len(s) > max_len:
            s = s[: max_len - 3] + "..."
        return s
    except Exception as e:
        return f"<could not load: {e!s}>"
