"""Process-wide setup: logging to stderr and xarray/numpy display options."""

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


# Collapsed attrs and data: also the options of the HTML repr (see info/display.py)
XR_DISPLAY_OPTIONS = {"display_expand_attrs": False, "display_expand_data": False}


xr.set_options(**XR_DISPLAY_OPTIONS)


np.set_printoptions(threshold=20, edgeitems=2)
