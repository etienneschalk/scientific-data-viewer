"""Process-wide setup: xarray version check, logging to stderr and xarray/numpy display options."""

import json
import logging
import sys
from logging import Logger

import numpy as np
import xarray as xr

# Set up logging
# Redirect logging to stderr so it doesn't interfere with the base64 output
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)


logger: Logger = logging.getLogger(__name__)


logger.info("Python version: %s", sys.version)


# xr.DataTree (used throughout the backend) appeared in xarray 2024.10
MIN_XARRAY_VERSION = (2024, 10)


def xarray_version_error(version: str) -> str | None:
    """Message explaining that ``version`` of xarray is too old, or None."""
    try:
        major, minor = (int(part) for part in version.split(".")[:2])
    except ValueError:
        return None
    if (major, minor) >= MIN_XARRAY_VERSION:
        return None
    return (
        f"xarray {version} is too old for Scientific Data Viewer "
        f"(xarray >= {MIN_XARRAY_VERSION[0]}.{MIN_XARRAY_VERSION[1]} is required, "
        "2026.4 or newer is recommended). Upgrade it in the selected Python "
        'interpreter: pip install -U "xarray>=2026.4.0" "zarr>=3", or turn on '
        "scientificDataViewer.python.useExtensionOwnEnvironment."
    )


# Fail with a JSON error (shown by the extension) rather than with an
# AttributeError when the backend modules are imported
_xarray_error = xarray_version_error(xr.__version__)
if _xarray_error:
    logger.error(_xarray_error)
    print(json.dumps({"error": _xarray_error}))
    sys.exit(1)


# Collapsed attrs and data: also the options of the HTML repr (see info/display.py)
XR_DISPLAY_OPTIONS = {"display_expand_attrs": False, "display_expand_data": False}


xr.set_options(**XR_DISPLAY_OPTIONS)


np.set_printoptions(threshold=20, edgeitems=2)
