"""Python backend of the Scientific Data Viewer VSCode extension.

Extracts metadata from scientific data files and renders plots with xarray.
Run as ``python -m sdv_backend info|plot ...`` (see :mod:`sdv_backend.cli`).
"""

from sdv_backend import _bootstrap  # noqa: F401  (logging + display options)
