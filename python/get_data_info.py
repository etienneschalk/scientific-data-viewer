#!/usr/bin/env python3
"""
Scientific Data Viewer - Data Information and Plotting Script

This script provides functionality to extract metadata and create visualizations
from scientific data files. It supports multiple data formats including NetCDF,
Zarr, HDF5, GRIB, GeoTIFF, and more through xarray's engine system.

The script can operate in two modes:
1. Info mode: Extract and display comprehensive metadata about data files
2. Plot mode: Create matplotlib visualizations of data variables

Features:
- Automatic engine detection and dependency management
- Support for DataTree and Dataset structures
- Intelligent plotting strategy detection based on data dimensions
- VSCode theme-aware matplotlib styling
- Comprehensive error handling and logging

Usage:
    python get_data_info.py info <file_path>
    python get_data_info.py plot <file_path> <variable_name> [plot_type] [--style STYLE]

Examples:
    python get_data_info.py info sample_data.nc
    python get_data_info.py plot sample_data.nc temperature
    python get_data_info.py plot sample_data.nc temperature --style dark_background

Author: Scientific Data Viewer Extension
"""

import argparse
import base64
import datetime
import io
import itertools
import json
import logging
import os
import sys
from dataclasses import asdict, dataclass, field, is_dataclass
from importlib.util import find_spec
from io import BytesIO
from logging import Logger
from pathlib import Path, PurePosixPath
from typing import Any, Callable, Dict, List, Literal, Optional, Type, Union, cast

import numpy as np
import xarray as xr

# <JSON Serialization Section>


def sanitize_nan(obj, default: Callable[[Any], str]):
    if isinstance(obj, dict):
        return {k: sanitize_nan(v, default) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_nan(v, default) for v in obj]
    elif isinstance(obj, float) and np.isnan(obj):
        # str gives 'nan', repr gives eg np.float64(nan)
        return default(obj)
    return obj


class ComplexEncoder(json.JSONEncoder):
    def encode(self, obj, *args, **kwargs):
        return super().encode(sanitize_nan(obj, repr), *args, **kwargs)

    def default(self, obj: Any) -> Any:
        """
        Best effort to try to convert non-native Python objects to strings when serialization to JSON,
        with a fallback on calling ``str`` on the object to serialized

        Parameters
        ----------
        obj
            Object to convert to

        Returns
        -------
            Serializable representation of the object
        """
        if is_dataclass(obj):
            return asdict(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, (xr.Dataset, xr.DataArray)):
            return obj.to_dict()
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.integer):
            return int(obj)
        # Let the base class default method raise the TypeError
        # The default=str kwarg can still be passed to json.dumps
        # to catch all and convert to string.
        return super().default(obj)


def to_json_best_effort(
    obj: Any,
    *,
    encoder: Type[json.JSONEncoder] = ComplexEncoder,
    **kwargs: Any,
) -> str:
    """
    Best effort to convert a complex object to JSON.

    Parameters
    ----------
    obj
        Object to convert
    encoder, optional
        JSONEncoder to use, by default ComplexEncoderDefaultStr
        The default should be able to convert most common complex objects encountered in the project to JSON.
    kwargs
        Additional keyword arguments to pass to the ``json.dumps`` function, eg ``indent``
    Returns
    -------
        JSON string
    """
    return json.dumps(obj, cls=encoder, allow_nan=False, default=str, **kwargs)


# </JSON Serialization Section>

DictOfDatasets = Dict[str, xr.Dataset]

# Set up logging
# Redirect logging to stderr so it doesn't interfere with the base64 output
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger: Logger = logging.getLogger(__name__)
logger.info("Python version: %s", sys.version)

xr.set_options(display_expand_attrs=False, display_expand_data=False)
np.set_printoptions(threshold=20, edgeitems=2)

# Set globally for all plots: use scientific notation for large/small numbers
MATPLOTLIB_RC_CONTEXT = {
    "interactive": False,
    "axes.formatter.limits": (-3, 3),
    "axes.formatter.use_mathtext": True,
}

XR_OPTIONS = {"display_expand_attrs": False, "display_expand_data": False}
# For text representation, expand attrs since users can't click to expand them
XR_TEXT_OPTIONS: Dict[str, Any] = {
    "display_expand_attrs": True,
    "display_expand_data": True,
    "display_max_rows": 1000,
}
# For HTML representation, keep attrs collapsed (users can click to expand)
XR_HTML_OPTIONS: Dict[str, Any] = {**XR_OPTIONS}

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


SupportedExtensionType = Literal[
    ".nc",
    ".nc4",
    ".netcdf",
    ".cdf",
    ".zarr",
    ".h5",
    ".hdf5",
    ".grib",
    ".grib2",
    ".grb",
    ".grb2",
    ".tif",
    ".tiff",
    ".geotiff",
    ".jp2",
    ".jpeg2000",
    ".safe",
]
EngineType = Literal[
    "netcdf4",
    "h5netcdf",
    "scipy",
    "zarr",
    "h5py",
    "cfgrib",
    "rasterio",
    "cdflib",
]
# Format to engine mapping based on xarray documentation
FORMAT_ENGINE_MAP: Dict[SupportedExtensionType, List[EngineType]] = {
    # Built-in formats
    ".nc": ["netcdf4", "h5netcdf", "scipy"],
    ".nc4": ["netcdf4", "h5netcdf"],
    ".netcdf": ["netcdf4", "h5netcdf", "scipy"],
    ".cdf": ["cdflib"],  # NASA CDF format, not NetCDF
    #
    ".zarr": ["zarr"],
    #
    ".h5": ["h5netcdf", "h5py", "netcdf4"],
    ".hdf5": ["h5netcdf", "h5py", "netcdf4"],
    #
    ".grib": ["cfgrib"],
    ".grib2": ["cfgrib"],
    ".grb": ["cfgrib"],
    ".grb2": ["cfgrib"],
    #
    ".tif": ["rasterio"],
    ".tiff": ["rasterio"],
    ".geotiff": ["rasterio"],
    #
    ".jp2": ["rasterio"],
    ".jpeg2000": ["rasterio"],
}

# Format display names
FORMAT_DISPLAY_NAMES: Dict[SupportedExtensionType, str] = {
    ".nc": "NetCDF",
    ".nc4": "NetCDF4",
    ".netcdf": "NetCDF",
    ".cdf": "CDF (NASA)",
    #
    ".zarr": "Zarr",
    #
    ".h5": "HDF5",
    ".hdf5": "HDF5",
    #
    ".grib": "GRIB",
    ".grib2": "GRIB2",
    ".grb": "GRIB",
    ".grb2": "GRIB2",
    #
    ".tif": "GeoTIFF",
    ".tiff": "GeoTIFF",
    ".geotiff": "GeoTIFF",
    #
    ".jp2": "JPEG-2000",
    ".jpeg2000": "JPEG-2000",
}

# Required packages for each engine
ENGINE_PACKAGES: Dict[EngineType, str] = {
    "netcdf4": "netCDF4",
    "h5netcdf": "h5netcdf",
    "scipy": "scipy",
    "zarr": "zarr",
    "h5py": "h5py",
    "cfgrib": "cfgrib",
    "rasterio": "rioxarray",
    "cdflib": "cdflib",
}
# Default backend kwargs for each engine
DEFAULT_XR_OPEN_KWARGS: Dict[EngineType, Union[Dict[str, Any]]] = {
    "netcdf4": {
        "decode_cf": True,
        # "decode_times": True,
        # "decode_timedelta": True,
        # "use_cftime": True,
    },
    "h5netcdf": {
        "decode_cf": True,
        # "decode_times": True,
        # "decode_timedelta": True,
        # "use_cftime": True,
    },
    "scipy": {
        "decode_cf": True,
        # "decode_times": True,
        # "decode_timedelta": True,
        # "use_cftime": True,
    },
    "zarr": {
        "decode_cf": True,
        # "decode_times": True,
        # "decode_timedelta": True,
        # "use_cftime": True,
    },
    "h5py": {
        "decode_cf": True,
        # "decode_times": True,
        # "decode_timedelta": True,
        # "use_cftime": True,
    },
    "cfgrib": {
        "decode_cf": True,
        # "decode_times": True,
        # "decode_timedelta": True,
        # "use_cftime": True,
    },
    "rasterio": {},
    "cdflib": {},  # cdflib uses its own API, not xr.open_dataset
}
# Default backend kwargs for each engine
DEFAULT_ENGINE_BACKEND_KWARGS: Dict[EngineType, Union[Dict[str, Any], None]] = {
    "netcdf4": None,
    "h5netcdf": None,
    "scipy": None,
    "zarr": None,
    "h5py": None,
    "cfgrib": {"indexpath": ""},  # Avoid intempestive .idx file creation
    "rasterio": {"mask_and_scale": False},
    "cdflib": None,  # cdflib uses its own API, not xr.open_dataset
}


# We try to use DataTree when possible, but for some, do not attempt as the failure is certain.
DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET: Dict[str, bool] = dict.fromkeys(
    ENGINE_PACKAGES, False
)
DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET["cfgrib"] = True
DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET["rasterio"] = True
DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET["cdflib"] = True  # cdflib uses its own API


@dataclass(frozen=True)
class FileFormatInfo:
    """Information about a supported file format.

    Attributes
    ----------
    extension : str
        File extension (e.g., '.nc', '.zarr')
    display_name : str
        Human-readable format name (e.g., 'NetCDF', 'Zarr')
    available_engines : List[str]
        List of xarray engines that can read this format
    missing_packages : List[str]
        List of required packages that are not installed
    """

    extension: str
    display_name: str
    available_engines: List[str]
    missing_packages: List[str]

    @property
    def is_supported(self) -> bool:
        """Check if the format is supported by any available engine.

        Returns
        -------
        bool
            True if at least one engine is available, False otherwise
        """
        return len(self.available_engines) > 0


@dataclass(frozen=True)
class VariableInfo:
    """Information about a data variable.

    Attributes
    ----------
    name : str
        Variable name
    dtype : str
        Data type (e.g., 'float64', 'int32')
    shape : List[int]
        Shape of the variable array
    dimensions : List[str]
        Names of the dimensions
    size_bytes : int
        Memory size in bytes
    attributes : Dict[str, Any]
        Variable attributes/metadata
    display_value : Optional[str], optional
        Loaded value(s) as string when size_bytes <= small_variable_bytes (Issue #102; configurable, 0 = disabled).
    """

    name: str
    dtype: str
    shape: List[int]
    dimensions: List[str]
    size_bytes: int
    attributes: Dict[str, Any]
    display_value: Optional[str] = None


@dataclass(frozen=True)
class CoordinateInfo:
    """Information about a coordinate variable.

    Attributes
    ----------
    name : str
        Coordinate name
    dtype : str
        Data type (e.g., 'float64', 'datetime64[ns]')
    shape : List[int]
        Shape of the coordinate array
    dimensions : List[str]
        Names of the dimensions
    size_bytes : int
        Memory size in bytes
    attributes : Dict[str, Any]
        Coordinate attributes/metadata
    display_value : Optional[str], optional
        Loaded value(s) as string when size_bytes <= small_variable_bytes (Issue #102; configurable, 0 = disabled).
    """

    name: str
    dtype: str
    shape: List[int]
    dimensions: List[str]
    size_bytes: int
    attributes: Dict[str, Any]
    display_value: Optional[str] = None


@dataclass(frozen=True)
class FileInfoResult:
    """Complete information about a data file.

    Attributes
    ----------
    format_info : FileFormatInfo
        Detailed format information
    used_engine : str
        xarray engine used to read the file
    fileSize : int
        File size in bytes
    xarray_html_repr : str
        HTML representation of the dataset
    xarray_text_repr : str
        Text representation of the dataset
    xarray_show_versions : str
        Version information for all packages
    dimensions_flattened : Dict[str, Dict[str, int]]
        Dimensions for each group (for DataTree support)
    variables_flattened : Dict[str, List[VariableInfo]]
        Variables for each group (for DataTree support)
    coordinates_flattened : Dict[str, List[CoordinateInfo]]
        Coordinates for each group (for DataTree support)
    attributes_flattened : Dict[str, Dict[str, Any]]
        Attributes for each group (for DataTree support)
    xarray_html_repr_flattened : Dict[str, str]
        HTML representation for each group
    xarray_text_repr_flattened : Dict[str, str]
        Text representation for each group
    """

    format_info: FileFormatInfo
    used_engine: str
    fileSize: int
    xarray_html_repr: str = field(repr=False)
    xarray_text_repr: str = field(repr=False)
    xarray_show_versions: str
    # For flattented datatrees
    dimensions_flattened: Dict[str, Dict[str, int]]
    variables_flattened: Dict[str, List[VariableInfo]]
    coordinates_flattened: Dict[str, List[CoordinateInfo]]
    attributes_flattened: Dict[str, Dict[str, Any]]
    xarray_html_repr_flattened: Dict[str, str] = field(repr=False)
    xarray_text_repr_flattened: Dict[str, str] = field(repr=False)
    datetime_variables: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)
    # Format: {group_name: [{"name": var_name, "min": min_value, "max": max_value}, ...]}


@dataclass(frozen=True)
class FileInfoError:
    """Error information when file processing fails.

    Attributes
    ----------
    error : str
        Error message describing what went wrong
    error_type : str
        Type of error (e.g., 'ImportError', 'FileNotFoundError')
    suggestion : str
        Suggested action to resolve the error
    format_info : FileFormatInfo
        Format information for the file that failed
    xarray_show_versions : str
        Version information for debugging
    """

    error: str
    error_type: str
    suggestion: str
    format_info: FileFormatInfo
    xarray_show_versions: str


@dataclass(frozen=True)
class CreatePlotResult:
    """Result of creating a plot.

    Attributes
    ----------
    plot_data : str
        Base64-encoded PNG image data
    format_info : FileFormatInfo
        File format metadata
    applied_isel_kwargs : dict
        Final applied dimension slices (isel kwargs); values are int or str for slice
    applied_plot_kwargs : dict
        Final applied plot kwargs (row, col, xincrease, etc.)
    matplotlib_style : str
        Matplotlib style used for the plot
    variable_path : str
        Variable path that was plotted (e.g. '/temperature')
    """

    plot_data: str = field(repr=False)
    format_info: FileFormatInfo
    applied_isel_kwargs: Dict[str, Union[int, str]] = field(default_factory=dict)
    applied_plot_kwargs: Dict[str, Any] = field(default_factory=dict)
    matplotlib_style: str = ""
    variable_path: str = ""


@dataclass(frozen=True)
class CreatePlotError:
    """Error when creating a plot.

    Attributes
    ----------
    error : str
        Error message describing what went wrong
    """

    error: str
    format_info: FileFormatInfo


def check_package_availability(package_name: str) -> bool:
    """Check if a Python package is available.

    Parameters
    ----------
    package_name : str
        Name of the package to check

    Returns
    -------
    bool
        True if package is available, False otherwise
    """
    logger.info(f"Checking package availability: {package_name}")
    return find_spec(package_name) is not None


def get_available_engines(file_extension: str) -> List[str]:
    """Get available engines for a file extension.

    Parameters
    ----------
    file_extension : str
        File extension (e.g., '.nc', '.zarr')

    Returns
    -------
    List[str]
        List of available xarray engines for the file extension
    """
    if file_extension not in FORMAT_ENGINE_MAP:
        return []

    available_engines: List[str] = []
    for engine in FORMAT_ENGINE_MAP[file_extension]:
        package_name: str = ENGINE_PACKAGES.get(engine, engine)
        if check_package_availability(package_name):
            available_engines.append(engine)

    return available_engines


def get_missing_packages(file_extension: str) -> List[str]:
    """Get missing packages required for a file extension.

    Parameters
    ----------
    file_extension : str
        File extension (e.g., '.nc', '.zarr')

    Returns
    -------
    List[str]
        List of missing packages required for the file extension
    """
    if file_extension not in FORMAT_ENGINE_MAP:
        return []

    missing_packages: List[str] = []
    for engine in FORMAT_ENGINE_MAP[file_extension]:
        package_name: str = ENGINE_PACKAGES.get(engine, engine)
        if not check_package_availability(package_name):
            missing_packages.append(package_name)

    return missing_packages


def detect_file_format(file_path: Path) -> FileFormatInfo:
    """Detect file format and return format information.

    Parameters
    ----------
    file_path : Path
        Path to the data file

    Returns
    -------
    FileFormatInfo
        Information about the detected file format including available engines
    """
    ext: str = file_path.suffix.lower()
    display_name: str = FORMAT_DISPLAY_NAMES.get(ext, "Unknown")
    available_engines: List[str] = get_available_engines(ext)
    missing_packages: List[str] = get_missing_packages(ext)

    return FileFormatInfo(
        extension=ext,
        display_name=display_name,
        available_engines=available_engines,
        missing_packages=missing_packages,
    )


def open_datatree_with_fallback(
    file_path: Path,
    file_format_info: FileFormatInfo,
    convert_bands_to_variables: bool = False,
) -> "tuple[Union[xr.DataTree, DictOfDatasets], str]":
    """Open datatree or dataset with fallback to different engines.

    Attempts to open the file as a DataTree first, then falls back to
    opening as individual datasets grouped by hierarchy.

    Parameters
    ----------
    file_path : Path
        Path to the data file
    file_format_info : FileFormatInfo
        Format information for the file

    Returns
    -------
    tuple
        Tuple containing (data_structure, engine_name) where data_structure
        is either a DataTree or DictOfDatasets

    Raises
    ------
    ImportError
        If no engines are available for the file format
    Exception
        If all engines fail to open the file
    """
    if not file_format_info.is_supported:
        raise ImportError(
            f"No engines available for {file_format_info.extension} files. "
            f"Missing packages: {', '.join(file_format_info.missing_packages)}"
        )

    # Special handling for cdflib (NASA CDF format)
    # cdflib uses its own API, not xr.open_dataset
    if "cdflib" in file_format_info.available_engines:
        try:
            import cdflib.xarray

            logger.info("Using cdflib to open CDF file")
            xds = cdflib.xarray.cdf_to_xarray(file_path)
            # cdflib returns a Dataset, wrap it in a dict for consistency
            xds_dict: DictOfDatasets = {"/": xds}
            return xds_dict, "cdflib"
        except Exception as exc:
            logger.error(f"Failed to open CDF file with cdflib: {exc!r}")
            # If cdflib fails and it's the only engine, raise the error
            if len(file_format_info.available_engines) == 1:
                raise exc
            # Otherwise, continue to try other engines (though there shouldn't be any for .cdf)

    # Try each available engine
    exceptions: list[Exception] = []

    for engine in file_format_info.available_engines:
        # Skip cdflib as it's handled separately above
        if engine == "cdflib":
            continue

        try:
            # Prepare backend kwargs based on configuration
            backend_kwargs = (
                DEFAULT_ENGINE_BACKEND_KWARGS[engine].copy()
                if DEFAULT_ENGINE_BACKEND_KWARGS[engine]
                else {}
            )

            # Apply band_as_variable for rasterio if configuration is enabled
            if engine == "rasterio" and convert_bands_to_variables:
                backend_kwargs["band_as_variable"] = True
                logger.info(
                    f"Using band_as_variable=True for {file_format_info.extension} file"
                )

            if can_use_datatree(engine):
                xdt_or_xds = xr.open_datatree(
                    file_path,
                    engine=engine,
                    **DEFAULT_XR_OPEN_KWARGS[engine],
                    backend_kwargs=backend_kwargs,
                )
                return xdt_or_xds, engine
            else:
                # Attempt to replace DataTree by a dict of Datasets
                if engine == "netcdf4" and check_package_availability("netCDF4"):
                    import netCDF4

                    with netCDF4.Dataset(file_path) as f:
                        groups = list(f.groups)

                    groups = ["/", *groups]
                elif engine == "h5netcdf" and check_package_availability("h5netcdf"):
                    import h5netcdf

                    with h5netcdf.File(file_path) as f:
                        groups = [str(g) for g in f.groups]

                    groups = ["/", *groups]
                else:
                    groups = ["/"]

                xds_dict: DictOfDatasets = {
                    group: (
                        xr.open_dataset(
                            file_path,
                            engine=engine,
                            **DEFAULT_XR_OPEN_KWARGS[engine],
                            backend_kwargs=backend_kwargs,
                        )
                        if group == "/"
                        else xr.open_dataset(
                            file_path,
                            engine=engine,
                            **DEFAULT_XR_OPEN_KWARGS[engine],
                            backend_kwargs=backend_kwargs,
                            group=group,
                        )
                    )
                    for group in groups
                }
                return xds_dict, engine
        except NotImplementedError as exc:
            # Fallback on dataset
            logger.warning(
                f"Opening file as DataTree is not implemented with engine {engine}: {exc!r}"
            )
            logger.warning("Fallback to opening file as Dataset")
            xds = xr.open_dataset(
                file_path,
                engine=engine,
                **DEFAULT_XR_OPEN_KWARGS[engine],
                backend_kwargs=DEFAULT_ENGINE_BACKEND_KWARGS[engine],
            )
            return xds, engine
        except Exception as exc:
            exceptions.append(exc)
            continue

    # If all engines failed, raise the last error
    raise exceptions[-1]


def can_use_datatree(engine: str) -> bool:
    """Check if DataTree can be used with the given engine.

    Parameters
    ----------
    engine : str
        xarray engine name

    Returns
    -------
    bool
        True if DataTree can be used, False otherwise
    """
    return (
        hasattr(xr, "open_datatree")
        and not DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET[engine]
    )


def is_spatial_dimension(dim_name: str) -> bool:
    """Check if a dimension name represents spatial coordinates.

    Parameters
    ----------
    dim_name : str
        Dimension name to check

    Returns
    -------
    bool
        True if the dimension appears to be spatial, False otherwise
    """
    spatial_patterns: List[str] = [
        "x",
        "y",
        "lon",
        "lat",
        "longitude",
        "latitude",
        "east",
        "west",
        "north",
        "south",
        "easting",
        "westing",
        "northing",
        "southing",
    ]
    return any(pattern in dim_name.lower() for pattern in spatial_patterns)


def detect_plotting_strategy(
    var: xr.DataArray,
) -> Literal["2d_classic", "3d_col", "4d_col_row", "2d_classic_isel", "default"]:
    """Detect the best plotting strategy based on variable dimensions.

    Analyzes the variable's dimensions and shape to determine the most
    appropriate plotting strategy for visualization.

    Parameters
    ----------
    var : xr.DataArray
        DataArray to analyze for plotting strategy

    Returns
    -------
    str
        Plotting strategy name:
        - '2d_classic': 2D spatial data
        - '2d_classic_isel': 2D data with single coordinate
        - '3d_col': 3D data with spatial dimensions
        - '4d_col_row': 4D data with spatial dimensions
        - 'default': Fallback strategy
    """
    dims = list(var.dims)
    ndim = var.ndim

    logger.info(f"Variable '{var.name}' has {ndim} dimensions: {dims}")

    if ndim == 2:
        # Check if last two dimensions are spatial
        if (
            len(dims) >= 2
            # TODO eschalk for now, just use the rightmost dims as x and y.
            # and is_spatial_dimension(dims[-2])
            # and is_spatial_dimension(dims[-1])
        ):
            logger.info("Using 2D spatial plotting strategy")
            return "2d_classic"

    elif ndim == 3:
        # Check if last two dimensions are spatial
        if (
            len(dims) >= 2
            # and is_spatial_dimension(dims[-2])
            # and is_spatial_dimension(dims[-1])
        ):
            if var.shape[0] == 1:
                return "2d_classic_isel"
            else:
                logger.info("Using 3D plotting strategy with col parameter")
                return "3d_col"
    elif ndim == 4 and len(dims) >= 2:
        logger.info("Using 4D plotting strategy with col and row parameters")
        return "4d_col_row"

    logger.info("Using default plotting strategy")
    return "default"


def _parse_dimension_slice_spec(spec: Union[str, int]) -> Union[int, slice]:
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
    slices_dict: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Union[int, slice]]]:
    """Parse dimension_slices from JSON/CLI into isel-compatible dict (Issue #117)."""
    if not slices_dict:
        return None
    out: Dict[str, Union[int, slice]] = {}
    for dim, spec in slices_dict.items():
        if spec is None or (isinstance(spec, str) and not spec.strip()):
            continue
        try:
            out[str(dim)] = _parse_dimension_slice_spec(spec)
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid slice for dimension {dim!r}: {e}") from e
    return out if out else None


def create_plot(
    file_path: Path,
    variable_path: str,
    plot_type: str = "auto",
    style: str = "auto",
    convert_bands_to_variables: bool = False,
    datetime_variable_name: Optional[str] = None,
    start_datetime: Optional[str] = None,
    end_datetime: Optional[str] = None,
    dimension_slices: Optional[Dict[str, Union[str, int]]] = None,
    facet_row: Optional[str] = None,
    facet_col: Optional[str] = None,
    col_wrap: Optional[int] = None,
    plot_x: Optional[str] = None,
    plot_y: Optional[str] = None,
    plot_hue: Optional[str] = None,
    xincrease: Optional[bool] = None,
    yincrease: Optional[bool] = None,
    aspect: Optional[Union[int, float]] = None,
    size: Optional[Union[int, float]] = None,
    robust: Optional[bool] = None,
    cmap: Optional[str] = None,
    bins: Optional[int] = None,
) -> Union[CreatePlotResult, CreatePlotError]:
    """Create a plot from a data file variable.

    Opens a data file, extracts the specified variable, and creates a
    matplotlib visualization. The plotting strategy is automatically
    determined based on the variable's dimensions.

    Parameters
    ----------
    file_path : Path
        Path to the data file
    variable_path : str
        Path to the variable within the file (e.g., '/temperature')
    plot_type : str, optional
        Type of plot to create (currently only 'auto' supported)
    style : str, optional
        Matplotlib style to use (e.g., 'default', 'dark_background')

    Returns
    -------
    CreatePlotResult or CreatePlotError
        CreatePlotResult with Base64-encoded PNG image data if successful, CreatePlotError if failed
    """

    try:
        if plot_type != "auto":
            raise ValueError(f"Invalid plot type: {plot_type}")

        # Detect file format and available engines
        file_format_info = detect_file_format(file_path)

        if not file_format_info.is_supported:
            logger.error(
                f"No engines available for {file_format_info.extension} files. "
                f"Missing packages: {', '.join(file_format_info.missing_packages)}"
            )
            return CreatePlotError(
                error=f"No engines available for {file_format_info.extension} files. "
                f"Missing packages: {', '.join(file_format_info.missing_packages)}",
                format_info=file_format_info,
            )

        if not check_package_availability("matplotlib"):
            logger.error("Matplotlib is not installed")
            return CreatePlotError(
                error="Matplotlib is not installed. Install it and retry.",
                format_info=file_format_info,
            )

        # Inline imports of matplotlib as it is only used in this function.
        import matplotlib as mpl

        # Use non-interactive backend so plotting works headless (e.g. in VSCode)
        # and we avoid "Current Serial #N" / figure-manager errors from GUI backends.
        mpl.use("Agg")
        import matplotlib.pyplot as plt

        # Apply matplotlib style provided by VSCode extension
        if style and style.strip():
            try:
                logger.info(f"Using matplotlib style: {style}")
                plt.style.use(style)
            except Exception as exc:
                logger.warning(f"Failed to apply style '{style}': {exc}, using default")
                plt.style.use("default")
        else:
            logger.info("No style specified, using default")
            plt.style.use("default")

        # Open dataset with fallback
        xds_or_xdt, used_engine = open_datatree_with_fallback(
            file_path, file_format_info, convert_bands_to_variables
        )

        datatree_flag: bool = can_use_datatree(used_engine) and isinstance(
            xds_or_xdt, xr.DataTree
        )

        path = PurePosixPath(variable_path)
        group_name = path.parent
        variable_name: str = (
            path.name
        )  # Use .name instead of .stem to preserve dots in variable names

        if can_use_datatree(used_engine) and isinstance(xds_or_xdt, xr.DataTree):
            xdt = cast("xr.DataTree", xds_or_xdt)

            group = xdt[str(group_name)].to_dataset()
        else:
            xds_dict = cast("DictOfDatasets", xds_or_xdt)

            group = xds_dict[str(group_name)]

        # Get variable
        if variable_name in group.data_vars or variable_name in group.coords:
            var = group[variable_name]
        else:
            logger.error(f"Variable '{variable_name}' not found in dataset")
            # Close Start
            if datatree_flag:
                xdt = cast("xr.DataTree", xds_or_xdt)
                xdt.close()
            else:
                xds_dict = cast("DictOfDatasets", xds_or_xdt)
                for group, xds in xds_dict.items():
                    logger.info(f"Close {group=}")
                    xds.close()
            # Close End
            return CreatePlotError(
                error=f"Variable '{variable_name}' not found in dataset",
                format_info=file_format_info,
            )

        # Apply dimension slices (Issue #117) before datetime filtering
        applied_isel: Dict[str, Union[int, slice]] = {}
        if dimension_slices:
            try:
                isel_dict = _parse_dimension_slices(dimension_slices)
                if isel_dict:
                    # Only apply isel for dimensions that exist on this variable
                    var_dims = set(var.dims)
                    isel_subset = {d: v for d, v in isel_dict.items() if d in var_dims}
                    if isel_subset:
                        var = var.isel(isel_subset)
                        applied_isel = dict(isel_subset)
                        logger.info(f"Applied dimension slices: {applied_isel}")
            except ValueError as e:
                logger.warning(f"Dimension slice parse error: {e}")
                return CreatePlotError(
                    error=f"Invalid dimension slice: {e}",
                    format_info=file_format_info,
                )
            except Exception as e:
                logger.exception("Dimension slice (isel) failed")
                return CreatePlotError(
                    error=f"Dimension slice error: {type(e).__name__}: {e}",
                    format_info=file_format_info,
                )

        # Handle datetime variable and time filtering
        datetime_var = None
        datetime_var_display_name = None
        datetime_var_name = None
        if datetime_variable_name:
            try:
                # Parse datetime strings
                import pandas as pd

                start_ts = pd.Timestamp(start_datetime) if start_datetime else None
                end_ts = pd.Timestamp(end_datetime) if end_datetime else None

                # Handle datetime variable path (may include group path like "/time" or "group/time")
                datetime_path = PurePosixPath(datetime_variable_name)
                datetime_group_name = datetime_path.parent
                datetime_var_name = (
                    datetime_path.name
                )  # Use .name instead of .stem to preserve dots in variable names
                datetime_var_display_name = datetime_var_name  # Store for plot labels

                # If datetime variable is in a different group, get that group
                datetime_group = group
                if (
                    str(datetime_group_name) != str(group_name)
                    and str(datetime_group_name) != "."
                ):
                    if can_use_datatree(used_engine) and isinstance(
                        xds_or_xdt, xr.DataTree
                    ):
                        xdt = cast("xr.DataTree", xds_or_xdt)
                        datetime_group = xdt[str(datetime_group_name)].to_dataset()
                    else:
                        xds_dict = cast("DictOfDatasets", xds_or_xdt)
                        datetime_group = xds_dict[str(datetime_group_name)]

                # Get the datetime variable
                if (
                    datetime_var_name not in datetime_group.coords
                    and datetime_var_name not in datetime_group.data_vars
                ):
                    logger.error(
                        f"Datetime variable '{datetime_var_name}' not found in dataset"
                    )
                    return CreatePlotError(
                        error=f"Datetime variable '{datetime_var_name}' not found in dataset",
                        format_info=file_format_info,
                    )

                datetime_var = datetime_group[datetime_var_name]

                # If datetime variable is not a coordinate but shares a dimension with var,
                # we can set it as a coordinate temporarily or use boolean indexing
                if datetime_var_name not in datetime_group.coords:
                    # Find common dimension
                    common_dims = set(var.dims) & set(datetime_var.dims)
                    if common_dims:
                        dim_name = next(iter(common_dims))
                        # Create boolean mask for time range filtering
                        if start_ts and end_ts:
                            mask = (datetime_var >= start_ts) & (datetime_var <= end_ts)
                        elif start_ts:
                            mask = datetime_var >= start_ts
                        elif end_ts:
                            mask = datetime_var <= end_ts
                        else:
                            mask = None

                        if mask is not None:
                            var = var.isel({dim_name: mask})
                            datetime_var = datetime_var.isel({dim_name: mask})
                    else:
                        # No common dimensions - cannot use this datetime variable for plotting
                        logger.warning(
                            f"Datetime variable '{datetime_var_name}' does not share any dimensions "
                            f"with variable '{variable_name}'. Cannot use for plotting. "
                            f"Variable dimensions: {var.dims}, datetime dimensions: {datetime_var.dims}"
                        )
                        datetime_var = None
                else:
                    # Use .sel() if datetime is a coordinate
                    # But first check if the coordinate exists in var's dataset
                    # (it might be from a different group)
                    if datetime_var_name in group.coords:
                        # Check monotonicity before using .sel() with slice
                        monotonicity = check_monotonicity(datetime_var)
                        if monotonicity == "non_monotonic":
                            # Fall back to boolean indexing for non-monotonic data
                            logger.info(
                                f"Datetime variable '{datetime_var_name}' is not monotonic. "
                                f"Using boolean indexing instead of .sel() with slice."
                            )
                            # Find common dimension
                            common_dims = set(var.dims) & set(datetime_var.dims)
                            if common_dims:
                                dim_name = next(iter(common_dims))
                                # Create boolean mask for time range filtering
                                if start_ts and end_ts:
                                    mask = (datetime_var >= start_ts) & (
                                        datetime_var <= end_ts
                                    )
                                elif start_ts:
                                    mask = datetime_var >= start_ts
                                elif end_ts:
                                    mask = datetime_var <= end_ts
                                else:
                                    mask = None

                                if mask is not None:
                                    var = var.isel({dim_name: mask})
                                    datetime_var = datetime_var.isel({dim_name: mask})
                            else:
                                logger.warning(
                                    f"Datetime variable '{datetime_var_name}' does not share any dimensions "
                                    f"with variable '{variable_name}'. Cannot use for plotting."
                                )
                                datetime_var = None
                        else:
                            # Coordinate exists in var's dataset - can use .sel() directly
                            # For monotonic decreasing, swap start and end times
                            if monotonicity == "decreasing":
                                logger.info(
                                    f"Datetime variable '{datetime_var_name}' is monotonic decreasing. "
                                    f"Swapping start and end times for slice."
                                )
                                slice_start = end_ts
                                slice_end = start_ts
                            else:
                                # monotonicity == "increasing"
                                slice_start = start_ts
                                slice_end = end_ts

                            # slice() accepts None for start/end, so a single call handles all cases
                            var = var.sel(
                                {datetime_var_name: slice(slice_start, slice_end)}
                            )
                            datetime_var = datetime_var.sel(
                                {datetime_var_name: slice(slice_start, slice_end)}
                            )
                    else:
                        # Coordinate is from a different group - need to use positional indexing
                        # Find common dimension between var and datetime_var
                        common_dims = set(var.dims) & set(datetime_var.dims)
                        if common_dims:
                            dim_name = next(iter(common_dims))
                            # Create boolean mask for time range filtering
                            if start_ts and end_ts:
                                mask = (datetime_var >= start_ts) & (
                                    datetime_var <= end_ts
                                )
                            elif start_ts:
                                mask = datetime_var >= start_ts
                            elif end_ts:
                                mask = datetime_var <= end_ts
                            else:
                                mask = None

                            if mask is not None:
                                var = var.isel({dim_name: mask})
                                datetime_var = datetime_var.isel({dim_name: mask})
                        else:
                            # No common dimensions - cannot use this datetime variable for plotting
                            logger.warning(
                                f"Datetime variable '{datetime_var_name}' is a coordinate in a different group "
                                f"and does not share any dimensions with variable '{variable_name}'. "
                                f"Cannot use for plotting. "
                                f"Variable dimensions: {var.dims}, datetime dimensions: {datetime_var.dims}"
                            )
                            datetime_var = None

            except Exception as exc:
                logger.error(f"Error processing datetime variable: {exc!r}")
                return CreatePlotError(
                    error=f"Error processing datetime variable: {exc!r}",
                    format_info=file_format_info,
                )

        # Branch: user provided any dimension-slice/facet/x/y/hue/bins/aspect/size params => build only from user input
        # When only cmap is set, we keep auto branch so cmap is passed to the relevant plot calls there
        user_provided = bool(
            (dimension_slices and len(dimension_slices) > 0)
            or (facet_row and facet_row.strip())
            or (facet_col and facet_col.strip())
            or (col_wrap is not None and col_wrap >= 1)
            or (plot_x and plot_x.strip())
            or (plot_y and plot_y.strip())
            or (plot_hue and plot_hue.strip())
            or (bins is not None and bins >= 1)
            or (aspect is not None and aspect > 0)
            or (size is not None and size > 0)
        )

        # Optional plot kwargs (e.g. bins for histogram, robust, xincrease, yincrease, aspect, size)
        logger.info(
            "Plot params received: row=%r, col=%r, plot_x=%r, plot_y=%r, plot_hue=%r, "
            "bins=%s, xincrease=%s, yincrease=%s, aspect=%s, size=%s, robust=%s, cmap=%r, col_wrap=%s",
            facet_row,
            facet_col,
            plot_x,
            plot_y,
            plot_hue,
            bins,
            xincrease,
            yincrease,
            aspect,
            size,
            robust,
            cmap,
            col_wrap,
        )
        plot_kwargs = {}
        if bins is not None and bins >= 1:
            plot_kwargs["bins"] = bins
        if robust is True:
            plot_kwargs["robust"] = (
                True  # 2nd/98th percentiles for color limits (outliers)
            )
        if xincrease is not None:
            plot_kwargs["xincrease"] = xincrease
        if yincrease is not None:
            plot_kwargs["yincrease"] = yincrease
        if aspect is not None and aspect > 0:
            plot_kwargs["aspect"] = float(aspect)
        if size is not None and size > 0:
            plot_kwargs["size"] = float(size)
        if cmap is not None and cmap.strip():
            plot_kwargs["cmap"] = cmap.strip()
        if col_wrap is not None and col_wrap >= 1:
            plot_kwargs["col_wrap"] = int(col_wrap)

        # Log applied kwargs including row/col (xarray names) when set
        applied_for_log = dict(plot_kwargs)
        if facet_row and facet_row.strip():
            applied_for_log["row"] = facet_row.strip()
        if facet_col and facet_col.strip():
            applied_for_log["col"] = facet_col.strip()
        logger.info("Applied plot kwargs: %s", applied_for_log)

        def _kwargs_for_plot():
            """Return plot kwargs for generic .plot() calls. Never include cmap here:
            xarray can pass it to artists that do not support it (e.g. Rectangle).
            Use explicit .plot.imshow() when cmap is needed.
            """
            out = dict(plot_kwargs)
            out.pop("cmap", None)
            return out

        # Start with a clean figure state (avoids "Current Serial #N" / stale-figure issues)
        plt.close("all")

        with mpl.rc_context(MATPLOTLIB_RC_CONTEXT):
            if user_provided:
                # --- User-provided branch: build plot only from user params (Issue #117) ---
                logger.info(
                    "User provided dimension/facet/bins params: building plot from user input only"
                )
                if "bins" in plot_kwargs and plot_kwargs.get("bins") is not None:
                    logger.info(
                        "Creating histogram plot with bins=%s", plot_kwargs["bins"]
                    )
                    var.plot.hist(**_kwargs_for_plot())
                elif facet_row or facet_col or plot_x or plot_y or plot_hue:
                    row_dim = (
                        facet_row.strip()
                        if (
                            facet_row
                            and facet_row.strip()
                            and facet_row.strip() in var.dims
                        )
                        else None
                    )
                    col_dim = (
                        facet_col.strip()
                        if (
                            facet_col
                            and facet_col.strip()
                            and facet_col.strip() in var.dims
                        )
                        else None
                    )

                    # x, y, hue: dimension or coordinate name (xarray plot kwargs)
                    def _valid_plot_dim(name, var_arr):
                        if not name or not name.strip():
                            return None
                        n = name.strip()
                        if n in var_arr.dims:
                            return n
                        if n in var_arr.coords:
                            return n
                        return None

                    x_dim = _valid_plot_dim(plot_x, var)
                    y_dim = _valid_plot_dim(plot_y, var)
                    hue_dim = _valid_plot_dim(plot_hue, var)

                    plot_kw = {}
                    if row_dim or col_dim:
                        if row_dim and col_dim:
                            plot_kw = {"row": row_dim, "col": col_dim}
                        elif row_dim:
                            plot_kw["row"] = row_dim
                        else:
                            plot_kw["col"] = col_dim
                            plot_kw["col_wrap"] = min(4, var.sizes.get(col_dim, 4))
                    if x_dim is not None:
                        plot_kw["x"] = x_dim
                    if y_dim is not None:
                        plot_kw["y"] = y_dim
                    if hue_dim is not None:
                        plot_kw["hue"] = hue_dim

                    if plot_kw:
                        var.plot(**{**plot_kw, **_kwargs_for_plot()})
                    else:
                        logger.warning(
                            "Facet row/col and x/y/hue not found on variable; using default plot",
                        )
                        var.plot(**_kwargs_for_plot()) if plot_kwargs else var.plot()
                else:
                    # Slices only, no facet/bins: let xarray choose plot type
                    logger.info("Creating plot from sliced data (xarray default)")
                    var.plot(**_kwargs_for_plot()) if plot_kwargs else var.plot()
            else:
                # --- Auto-plot branch: strategy-based (no user dimension/facet/bins) ---
                strategy = detect_plotting_strategy(var)
                logger.info(f"Auto-plot: using strategy {strategy}")
                # cmap is safe to pass only to .plot.imshow(); include when user set it
                _imshow_kw = (
                    {"cmap": plot_kwargs["cmap"]} if "cmap" in plot_kwargs else {}
                )
                # aspect/size: xarray uses figsize = (aspect * size, size) per panel when creating figure
                _fig_kw = {}
                if "aspect" in plot_kwargs:
                    _fig_kw["aspect"] = plot_kwargs["aspect"]
                if "size" in plot_kwargs:
                    _fig_kw["size"] = plot_kwargs["size"]
                _plot_kw = {**_fig_kw, **_imshow_kw}

                if strategy == "2d_classic":
                    logger.info("Creating 2D spatial plot")
                    var.plot.imshow(**_plot_kw)
                    plt.gca().set_aspect("equal")
                elif strategy == "2d_classic_isel":
                    logger.info("Creating 2D spatial plot with isel")
                    first_dim = var.dims[0]
                    var.isel({first_dim: 0}).plot.imshow(**_plot_kw)
                    plt.gca().set_aspect("equal")
                elif strategy == "3d_col":
                    logger.info("Creating 3D plot (col facet)")
                    first_dim = var.dims[0]
                    col_wrap = min(4, var.sizes.get(first_dim, 4))
                    var.plot.imshow(
                        col=first_dim,
                        aspect=_fig_kw.get("aspect", 1),
                        size=_fig_kw.get("size", 4),
                        col_wrap=col_wrap,
                        **_imshow_kw,
                    )
                elif strategy == "4d_col_row":
                    logger.info("Creating 4D plot (row and col facets)")
                    first_dim = var.dims[0]
                    second_dim = var.dims[1]
                    var.plot.imshow(
                        col=second_dim,
                        row=first_dim,
                        aspect=_fig_kw.get("aspect", 1),
                        size=_fig_kw.get("size", 4),
                        **_imshow_kw,
                    )
                else:
                    logger.info("Creating default plot (xarray choice)")
                    if datetime_var is not None and var.ndim == 1:
                        datetime_values = datetime_var.values
                        var_values = var.values
                        if datetime_values.shape != var_values.shape:
                            logger.warning(
                                "Datetime shape mismatch, falling back to default plot"
                            )
                            var.plot(**_kwargs_for_plot())
                        else:
                            import pandas as pd

                            if not isinstance(datetime_values, pd.DatetimeIndex):
                                datetime_index = pd.DatetimeIndex(datetime_values)
                            else:
                                datetime_index = datetime_values
                            var_with_time = xr.DataArray(
                                var_values,
                                coords={datetime_var_display_name: datetime_index},
                                dims=[datetime_var_display_name],
                                name=variable_name,
                            )
                            var_with_time.plot(**_kwargs_for_plot())
                    elif var.ndim >= 2 and "cmap" in plot_kwargs:
                        # Use explicit imshow so cmap is applied (generic .plot() can trigger Rectangle.set(cmap) error)
                        if var.ndim == 2:
                            var.plot.imshow(**_plot_kw)
                        elif var.ndim == 3:
                            first = var.dims[0]
                            var.plot.imshow(
                                col=first,
                                aspect=_fig_kw.get("aspect", 1),
                                size=_fig_kw.get("size", 4),
                                col_wrap=min(4, var.sizes.get(first, 4)),
                                **_imshow_kw,
                            )
                        else:
                            first, second = var.dims[0], var.dims[1]
                            var.plot.imshow(
                                row=first,
                                col=second,
                                aspect=_fig_kw.get("aspect", 1),
                                size=_fig_kw.get("size", 4),
                                **_imshow_kw,
                            )
                    else:
                        var.plot(**_kwargs_for_plot())

            # Build suptitle with optional start/end time information
            # Only include start/end time if datetime variable is actually being used
            datetime_var_used = False
            if datetime_var is not None and datetime_var_name is not None:
                datetime_var_used = (
                    datetime_var_name in var.dims
                    or datetime_var_name in var.coords
                    or bool(set(var.dims) & set(datetime_var.dims))
                )

            suptitle_lines = [
                f"Variable: {variable_name}",
                "Creation date: "
                f"{datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')}",
            ]
            if datetime_var_used:
                if start_datetime:
                    suptitle_lines.append(
                        f"Start Time: {start_datetime} ({datetime_var_name})"
                    )
                if end_datetime:
                    suptitle_lines.append(
                        f"End Time: {end_datetime} ({datetime_var_name})"
                    )

            plt.suptitle("\n".join(suptitle_lines), y=1.20)
            # Convert to base64 string
            buffer = BytesIO()
            plt.savefig(buffer, format="png", dpi=100, bbox_inches="tight")
            buffer.seek(0)
            image_base64 = base64.b64encode(buffer.getvalue()).decode()
            plt.close("all")

        # Close Start
        if datatree_flag:
            xdt: xr.DataTree = cast("xr.DataTree", xds_or_xdt)
            xdt.close()
        else:
            xds_dict: DictOfDatasets = cast("DictOfDatasets", xds_or_xdt)
            for group, xds in xds_dict.items():
                logger.info(f"Close {group=}")
                xds.close()
        # Close End

        logger.info("Plot created successfully")
        # Serialize isel kwargs for result (slice -> str for JSON)
        applied_isel_serializable: Dict[str, Union[int, str]] = {
            k: v if isinstance(v, int) else str(v) for k, v in applied_isel.items()
        }
        return CreatePlotResult(
            plot_data=image_base64,
            format_info=file_format_info,
            applied_isel_kwargs=applied_isel_serializable,
            applied_plot_kwargs=dict(applied_for_log),
            matplotlib_style=style,
            variable_path=variable_path,
        )

    except Exception as exc:
        logger.error(
            f"Error creating plot: {exc!r} ({file_path=} {variable_path=} {plot_type=})"
        )
        return CreatePlotError(
            error=f"Error creating plot: {exc!r} ({file_path=} {variable_path=} {plot_type=})",
            format_info=file_format_info,
        )


def get_file_info(
    file_path: Path,
    convert_bands_to_variables: bool = False,
    small_variable_bytes: int = 0,
    small_value_display_max_len: int = DEFAULT_SMALL_VALUE_DISPLAY_MAX_LEN,
) -> Union[FileInfoResult, FileInfoError]:
    """Extract comprehensive information from a data file.

    Analyzes a data file and extracts metadata including format information,
    variables, coordinates, dimensions, and attributes. Supports both
    DataTree and Dataset structures.

    Parameters
    ----------
    file_path : Path
        Path to the data file
    convert_bands_to_variables : bool
        Whether to convert GeoTIFF bands to variables.
    small_variable_bytes : int
        Max size in bytes for variables/coordinates to load and display values (Issue #102). If 0, disabled.
    small_value_display_max_len : int
        Max character length for displayed small values (truncation).

    Returns
    -------
    FileInfoResult or FileInfoError
        Complete file information if successful, error information if failed
    """
    # Diagnostic: xr.show_versions()
    # Capture the output of xr.show_versions() by passing a StringIO object
    output = io.StringIO()
    xr.show_versions(file=output)
    versions_text = output.getvalue()

    # Detect file format and available engines
    file_format_info = detect_file_format(file_path)

    try:
        # Open dataset with fallback
        xds_or_xdt, used_engine = open_datatree_with_fallback(
            file_path, file_format_info, convert_bands_to_variables
        )
    except ImportError:
        # Handle missing dependencies
        error = FileInfoError(
            error=f"Missing dependencies for {file_format_info.display_name} files: {', '.join(file_format_info.missing_packages)}",
            error_type="ImportError",
            format_info=file_format_info,
            suggestion=f"Install required packages: pip install {' '.join(file_format_info.missing_packages)}",
            xarray_show_versions=versions_text,
        )
        return error

    try:
        datatree_flag: bool = can_use_datatree(used_engine) and isinstance(
            xds_or_xdt, xr.DataTree
        )
        if datatree_flag:
            xdt: xr.DataTree = cast("xr.DataTree", xds_or_xdt)
            # Extract information
            with xr.set_options(**XR_TEXT_OPTIONS):
                # Get HTML representation using xarray's built-in HTML representation
                repr_text: str = str(xdt)
            with xr.set_options(**XR_HTML_OPTIONS):
                # Get text representation using xarray's built-in text representation
                repr_html: str = xdt._repr_html_()

            # logger.info(f"{xdt=}")

            flat_dict_of_xds: DictOfDatasets = dict(
                sorted(xdt.to_dict().items(), key=lambda x: x[0])
            )
            logger.info(
                f"Processing DataTree with {len(flat_dict_of_xds.keys())} groups"
            )
        else:
            xds_dict: DictOfDatasets = cast("DictOfDatasets", xds_or_xdt)
            # For a single root group, display the traditional Dataset reprs
            if len(xds_dict) == 1 and "/" in xds_dict:
                xds: xr.Dataset = xds_dict["/"]
                with xr.set_options(**XR_TEXT_OPTIONS):
                    # Get HTML representation using xarray's built-in HTML representation
                    repr_text: str = str(xds)
                with xr.set_options(**XR_HTML_OPTIONS):
                    # Get text representation using xarray's built-in text representation
                    repr_html: str = xds._repr_html_()
            # Otherwise, need to do a custom repr.
            else:
                with xr.set_options(**XR_TEXT_OPTIONS):
                    repr_text: str = f"{'-' * 80}\n\n".join(
                        (
                            f"Group: {group}\n\n{xds!s}\n\n"
                            for group, xds in xds_dict.items()
                        )
                    )
                with xr.set_options(**XR_HTML_OPTIONS):
                    repr_html: str = "<br><br>".join(
                        (
                            f"<p>Group: {group}</p><br><br>{xds._repr_html_()}"
                            for group, xds in xds_dict.items()
                        )
                    )
            logger.info(f"{xds_dict=}")

            flat_dict_of_xds: DictOfDatasets = xds_dict
            logger.info(
                f"Processing DictOfDatasets with {len(flat_dict_of_xds.keys())} groups"
            )

        info = FileInfoResult(
            format_info=file_format_info,
            used_engine=used_engine,
            fileSize=os.path.getsize(file_path),
            xarray_html_repr=repr_html,
            xarray_text_repr=repr_text,
            xarray_show_versions=versions_text,
            dimensions_flattened={},
            coordinates_flattened={},
            variables_flattened={},
            attributes_flattened={},
            xarray_html_repr_flattened={},
            xarray_text_repr_flattened={},
            datetime_variables={},
        )

        for group in flat_dict_of_xds:
            logger.info(f"Processing group: {group}")
            # logger.info(f"{flat_dict_of_xds[group]=}")
            xds = flat_dict_of_xds[group]

            # Add attributes for group
            info.attributes_flattened[group] = {
                str(k): v
                for k, v in itertools.chain(
                    xds.attrs.items(),
                    (
                        ("__xarray_encoding." + str(k), v)
                        for k, v in xds.encoding.items()
                    ),
                )
            }
            info.dimensions_flattened[group] = {str(k): v for k, v in xds.dims.items()}
            # Add coordinate variables for group
            for coord_name, coord in xds.coords.items():
                coord_info = create_coord_info(
                    str(coord_name),
                    coord,
                    small_variable_bytes=small_variable_bytes,
                    small_value_display_max_len=small_value_display_max_len,
                )
                info.coordinates_flattened.setdefault(group, []).append(coord_info)
                # Check if coordinate is a datetime variable
                if is_datetime_variable(coord):
                    logger.info(
                        f"Found datetime coordinate: {group}/{coord_name} (dtype: {coord.dtype})"
                    )
                    # Compute min and max values
                    try:
                        import pandas as pd

                        coord_values = coord.values
                        if coord_values.size > 0:
                            min_val = pd.Timestamp(coord_values.min()).isoformat()
                            max_val = pd.Timestamp(coord_values.max()).isoformat()
                        else:
                            min_val = None
                            max_val = None
                    except Exception as exc:
                        logger.warning(
                            f"Could not compute min/max for datetime coordinate {coord_name}: {exc!r}"
                        )
                        min_val = None
                        max_val = None

                    info.datetime_variables.setdefault(group, []).append(
                        {
                            "name": str(coord_name),
                            "min": min_val,
                            "max": max_val,
                        }
                    )

            # Add data variables for group
            for var_name, var in xds.data_vars.items():
                var_info = create_variable_info(
                    str(var_name),
                    var,
                    small_variable_bytes=small_variable_bytes,
                    small_value_display_max_len=small_value_display_max_len,
                )
                logger.info(
                    f"Processing group and var: {group=}  {var_name=} {var_info=}"
                )

                info.variables_flattened.setdefault(group, []).append(var_info)
                # Check if data variable is a datetime variable
                if is_datetime_variable(var):
                    logger.info(
                        f"Found datetime data variable: {group}/{var_name} (dtype: {var.dtype})"
                    )
                    # Compute min and max values
                    try:
                        import pandas as pd

                        var_values = var.values
                        if var_values.size > 0:
                            min_val = pd.Timestamp(var_values.min()).isoformat()
                            max_val = pd.Timestamp(var_values.max()).isoformat()
                        else:
                            min_val = None
                            max_val = None
                    except Exception as exc:
                        logger.warning(
                            f"Could not compute min/max for datetime variable {var_name}: {exc!r}"
                        )
                        min_val = None
                        max_val = None

                    info.datetime_variables.setdefault(group, []).append(
                        {
                            "name": str(var_name),
                            "min": min_val,
                            "max": max_val,
                        }
                    )

            # Extract information
            with xr.set_options(**XR_TEXT_OPTIONS):
                # Get HTML representation using xarray's built-in HTML representation
                repr_text: str = str(xds)
            with xr.set_options(**XR_HTML_OPTIONS):
                # Get text representation using xarray's built-in text representation
                repr_html: str = xds._repr_html_()

            info.xarray_html_repr_flattened[group] = repr_html
            info.xarray_text_repr_flattened[group] = repr_text

        # Close Start
        if datatree_flag:
            xdt: xr.DataTree = cast("xr.DataTree", xds_or_xdt)
            xdt.close()
        else:
            xds_dict: DictOfDatasets = cast("DictOfDatasets", xds_or_xdt)
            for group, xds in xds_dict.items():
                logger.info(f"Close {group=}")
                xds.close()
        # Close End

        logger.info(f"Detected datetime variables: {info.datetime_variables}")
        return info
    except Exception as exc:
        logger.info(f"Error getting file info: {exc!r}")
        # Handle other errors (file corruption, format issues, etc.)
        error = FileInfoError(
            error=str(exc),
            error_type=type(exc).__name__,
            suggestion="Check if the file is corrupted or in an unsupported format",
            format_info=file_format_info,
            xarray_show_versions=versions_text,
        )
        return error


def create_variable_info(
    var_name: str,
    var: xr.DataArray,
    small_variable_bytes: int = 0,
    small_value_display_max_len: int = DEFAULT_SMALL_VALUE_DISPLAY_MAX_LEN,
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
        attributes={
            str(k): v
            for k, v in itertools.chain(
                var.attrs.items(),
                (("__xarray_encoding." + str(k), v) for k, v in var.encoding.items()),
            )
        },
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

    Returns
    -------
    CoordinateInfo
        Information about the coordinate
    """
    display_value = None
    if small_variable_bytes > 0 and coord.nbytes <= small_variable_bytes:
        display_value = _format_small_value(coord, max_len=small_value_display_max_len)

    return CoordinateInfo(
        name=str(coord_name),
        dtype=str(coord.dtype),
        shape=list(coord.shape),
        dimensions=[str(d) for d in coord.dims],
        size_bytes=coord.nbytes,
        attributes={
            str(k): v
            for k, v in itertools.chain(
                coord.attrs.items(),
                (("__xarray_encoding." + str(k), v) for k, v in coord.encoding.items()),
            )
        },
        display_value=display_value,
    )


def main() -> int:
    """Main entry point for the script.

    Parses command line arguments and executes the appropriate mode
    (info or plot) based on user input.
    """
    parser = argparse.ArgumentParser(
        description="Get data file information and create plots from data file variables",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python get_data_info.py info sample_data.nc
  python get_data_info.py plot sample_data.nc temperature
  python get_data_info.py plot sample_data.nc temperature histogram
  python get_data_info.py plot sample_data.nc temperature --style dark_background
  python get_data_info.py plot sample_data.nc temperature --style default
  python get_data_info.py plot sample_data.nc temperature --style seaborn
        """,
    )

    mode_choices = ["info", "plot"]

    parser.add_argument(
        "mode",
        choices=mode_choices,
        help="Mode: 'info' to get file information, 'plot' to create plots",
    )

    parser.add_argument("file_path", type=Path, help="Path to the data file")

    parser.add_argument(
        "variable_name",
        nargs="?",
        help="Variable name to plot (required for plot mode)",
    )

    parser.add_argument(
        "plot_type",
        nargs="?",
        default="auto",
        help="Plot type: 'line' or 'histogram' (optional, default: 'auto')",
    )

    parser.add_argument(
        "--style",
        default="",
        help="Matplotlib plot style. Any valid matplotlib style name (e.g., 'default', 'dark_background', 'seaborn', 'ggplot', etc.)",
    )

    parser.add_argument(
        "--convert-bands-to-variables",
        action="store_true",
        help="Convert bands of GeoTIFF rasters to variables for better readability",
    )

    parser.add_argument(
        "--datetime-variable",
        default=None,
        help="Name of datetime variable to use as x-axis",
    )

    parser.add_argument(
        "--start-datetime",
        default=None,
        help="Start datetime for filtering (ISO format string)",
    )

    parser.add_argument(
        "--end-datetime",
        default=None,
        help="End datetime for filtering (ISO format string)",
    )

    parser.add_argument(
        "--dimension-slices",
        default=None,
        help='JSON object of dimension name to index or slice string (e.g. {"time": "0:24:2", "rlat": "100:120", "rlon": 130}) for isel() before plotting (Issue #117)',
    )

    parser.add_argument(
        "--facet-row",
        default=None,
        help="Dimension name for faceted plot row (Issue #117)",
    )

    parser.add_argument(
        "--facet-col",
        default=None,
        help="Dimension name for faceted plot col (Issue #117)",
    )

    parser.add_argument(
        "--col-wrap",
        type=int,
        default=None,
        help="xarray plot col_wrap: max number of columns in faceted grid (positive integer)",
    )

    parser.add_argument(
        "--plot-x",
        default=None,
        help="Dimension or coordinate for x-axis (xarray plot x=)",
    )

    parser.add_argument(
        "--plot-y",
        default=None,
        help="Dimension or coordinate for y-axis (xarray plot y=)",
    )

    parser.add_argument(
        "--plot-hue",
        default=None,
        help="Dimension or coordinate for hue (xarray plot hue=, e.g. multiple lines)",
    )

    parser.add_argument(
        "--xincrease",
        default=None,
        choices=("true", "false"),
        help="xarray plot xincrease (axes direction): 'true' or 'false'",
    )

    parser.add_argument(
        "--yincrease",
        default=None,
        choices=("true", "false"),
        help="xarray plot yincrease (axes direction): 'true' or 'false'",
    )

    parser.add_argument(
        "--aspect",
        type=float,
        default=None,
        help="xarray plot aspect (figure width = aspect * size in inches, float)",
    )

    parser.add_argument(
        "--size",
        type=float,
        default=None,
        help="xarray plot size (figure height in inches, float)",
    )

    parser.add_argument(
        "--bins",
        type=int,
        default=None,
        help="Number of bins for histogram-style plots (Issue #117; passed as plot kwarg)",
    )

    parser.add_argument(
        "--robust",
        action="store_true",
        help="xarray plot robust: use 2nd/98th percentiles for color limits (helps with outliers)",
    )

    parser.add_argument(
        "--cmap",
        type=str,
        default=None,
        help="Matplotlib colormap name (user must provide a valid existing cmap). See https://matplotlib.org/stable/users/explain/colors/colormaps.html",
    )

    parser.add_argument(
        "--small-variable-bytes",
        type=int,
        default=DEFAULT_SMALL_VARIABLE_BYTES,
        help="Max size in bytes for variables/coordinates to load and display values (Issue #102). Set to 0 to disable.",
    )

    parser.add_argument(
        "--small-value-display-max-len",
        type=int,
        default=DEFAULT_SMALL_VALUE_DISPLAY_MAX_LEN,
        help="Max character length for displayed small variable/coordinate values (truncation).",
    )

    args = parser.parse_args()

    # Validate arguments based on mode
    if args.mode not in mode_choices:
        print(to_json_best_effort({"error": f"Invalid mode: {args.mode}"}))
        return 1

    if args.mode == "plot" and not args.variable_name:
        print(to_json_best_effort({"error": "Variable name is required for plot mode"}))
        return 1

    # Dispatch based on mode
    if args.mode == "info":
        # Get file information
        result = get_file_info(
            args.file_path,
            args.convert_bands_to_variables,
            small_variable_bytes=args.small_variable_bytes,
            small_value_display_max_len=args.small_value_display_max_len,
        )
        ok = isinstance(result, FileInfoResult)

    elif args.mode == "plot":
        dimension_slices_dict = None
        if args.dimension_slices and args.dimension_slices.strip():
            try:
                dimension_slices_dict = json.loads(args.dimension_slices)
            except json.JSONDecodeError as e:
                print(
                    to_json_best_effort(
                        {"error": f"Invalid --dimension-slices JSON: {e}"}
                    )
                )
                return 1
        # Parse xincrease/yincrease from CLI ('true'/'false' strings)
        xincrease_arg = None
        if args.xincrease is not None:
            xincrease_arg = args.xincrease == "true"
        yincrease_arg = None
        if args.yincrease is not None:
            yincrease_arg = args.yincrease == "true"

        # Create plot
        result = create_plot(
            args.file_path,
            args.variable_name,
            args.plot_type,
            args.style,
            args.convert_bands_to_variables,
            args.datetime_variable,
            args.start_datetime,
            args.end_datetime,
            dimension_slices=dimension_slices_dict,
            facet_row=args.facet_row,
            facet_col=args.facet_col,
            col_wrap=args.col_wrap,
            plot_x=args.plot_x,
            plot_y=args.plot_y,
            plot_hue=args.plot_hue,
            xincrease=xincrease_arg,
            yincrease=yincrease_arg,
            aspect=args.aspect,
            size=args.size,
            robust=args.robust,
            cmap=args.cmap,
            bins=args.bins,
        )
        ok = isinstance(result, CreatePlotResult)

    # Log and print result
    logger.info(f"{args.mode} Result: {result}")
    print(to_json_best_effort({"result" if ok else "error": asdict(result)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
