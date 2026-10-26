"""Helpers shared by the sample data generators."""

import importlib.util
import warnings


def optional_pkg_available(dist_name: str) -> bool:
    """True if optional dependency is installed (metadata check only; no import)."""
    return importlib.util.find_spec(dist_name) is not None


# Suppress warnings for cleaner output
warnings.filterwarnings("ignore")
