"""Helpers shared by the sample data generators."""

import importlib.util
import warnings
from datetime import datetime


def optional_pkg_available(dist_name: str) -> bool:
    """True if optional dependency is installed (metadata check only; no import)."""
    return importlib.util.find_spec(dist_name) is not None


# Suppress warnings for cleaner output
warnings.filterwarnings("ignore")


# Fixed "creation" time written into history/processing_date attributes, so that
# regenerating sample-data produces identical files (golden snapshots depend on it).
CREATION_DATETIME = datetime(2025, 1, 1)
