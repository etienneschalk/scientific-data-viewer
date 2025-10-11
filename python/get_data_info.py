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

import datetime
from logging import Logger

import argparse
import base64
from dataclasses import asdict, dataclass, field
import io
import json
import logging
import os
from pathlib import Path, PurePosixPath
import sys
from typing import Any, Callable, Literal, cast, Union, List, Dict

import xarray as xr
import numpy as np

from importlib.util import find_spec
from io import BytesIO

from dataclasses import is_dataclass
from typing import Type


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
XR_TEXT_OPTIONS: Dict[str, Any] = XR_OPTIONS | {"display_max_rows": 1000}
XR_HTML_OPTIONS: Dict[str, Any] = XR_OPTIONS | {}

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
]
# Format to engine mapping based on xarray documentation
FORMAT_ENGINE_MAP: Dict[SupportedExtensionType, List[EngineType]] = {
    # Built-in formats
    ".nc": ["netcdf4", "h5netcdf", "scipy"],
    ".nc4": ["netcdf4", "h5netcdf"],
    ".netcdf": ["netcdf4", "h5netcdf", "scipy"],
    ".cdf": ["netcdf4", "h5netcdf", "scipy"],
    #
    ".zarr": ["zarr"],
    #
    ".h5": ["h5netcdf", "h5py", "netcdf4"],
    ".hdf5": ["h5netcdf", "h5py", "netcdf4"],
    #
    ".grib": ["cfgrib"],
    ".grib2": ["cfgrib"],
    ".grb": ["cfgrib"],
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
    ".cdf": "CDF/NetCDF",
    #
    ".zarr": "Zarr",
    #
    ".h5": "HDF5",
    ".hdf5": "HDF5",
    #
    ".grib": "GRIB",
    ".grib2": "GRIB2",
    ".grb": "GRIB",
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
}
# Default backend kwargs for each engine
DEFAULT_XR_OPEN_KWARGS: Dict[EngineType, Union[Dict[str, Any]]] = {
    "netcdf4": {"decode_cf": False},
    "h5netcdf": {"decode_cf": False},
    "scipy": {"decode_cf": False},
    "zarr": {"decode_cf": False},
    "h5py": {"decode_cf": False},
    "cfgrib": {"decode_cf": False},
    "rasterio": {},
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
}


# We try to use DataTree when possible, but for some, do not attempt as the failure is certain.
DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET: Dict[str, bool] = {
    engine: False for engine in ENGINE_PACKAGES
}
DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET["cfgrib"] = True
DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET["rasterio"] = True


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
    """

    name: str
    dtype: str
    shape: List[int]
    dimensions: List[str]
    size_bytes: int
    attributes: Dict[str, Any]


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
    """

    name: str
    dtype: str
    shape: List[int]
    dimensions: List[str]
    size_bytes: int
    attributes: Dict[str, Any]


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
    """

    plot_data: str = field(repr=False)
    format_info: FileFormatInfo


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
    file_path: Path, file_format_info: FileFormatInfo
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

    # Try each available engine
    exceptions: list[Exception] = []

    for engine in file_format_info.available_engines:
        try:
            if can_use_datatree(engine):
                xdt_or_xds = xr.open_datatree(
                    file_path,
                    engine=engine,
                    **DEFAULT_XR_OPEN_KWARGS[engine],
                    backend_kwargs=DEFAULT_ENGINE_BACKEND_KWARGS[engine],
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
                        groups = list(str(g) for g in f.groups)

                    groups = ["/", *groups]
                else:
                    groups = ["/"]

                xds_dict: DictOfDatasets = {
                    group: (
                        xr.open_dataset(
                            file_path,
                            engine=engine,
                            **DEFAULT_XR_OPEN_KWARGS[engine],
                            backend_kwargs=DEFAULT_ENGINE_BACKEND_KWARGS[engine],
                        )
                        if group == "/"
                        else xr.open_dataset(
                            file_path,
                            engine=engine,
                            **DEFAULT_XR_OPEN_KWARGS[engine],
                            backend_kwargs=DEFAULT_ENGINE_BACKEND_KWARGS[engine],
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
    elif ndim == 4:
        # Check if last two dimensions are spatial
        if (
            len(dims) >= 2
            # and is_spatial_dimension(dims[-2])
            # and is_spatial_dimension(dims[-1])
        ):
            logger.info("Using 4D plotting strategy with col and row parameters")
            return "4d_col_row"

    logger.info("Using default plotting strategy")
    return "default"


def create_plot(
    file_path: Path, variable_path: str, plot_type: str = "auto", style: str = "auto"
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
                error="Matplotlib is not installed",
                format_info=file_format_info,
            )

        # Inline imports of matplotlib as it is only used in this function.
        import matplotlib as mpl
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
            file_path, file_format_info
        )

        datatree_flag: bool = can_use_datatree(used_engine) and isinstance(
            xds_or_xdt, xr.DataTree
        )

        path = PurePosixPath(variable_path)
        group_name = path.parent
        variable_name: str = path.stem

        if can_use_datatree(used_engine) and isinstance(xds_or_xdt, xr.DataTree):
            xdt = cast(xr.DataTree, xds_or_xdt)

            group = xdt[str(group_name)].to_dataset()
        else:
            xds_dict = cast(DictOfDatasets, xds_or_xdt)

            group = xds_dict[str(group_name)]

        # Get variable
        if variable_name in group.data_vars:
            var = group[variable_name]
        elif variable_name in group.coords:
            var = group[variable_name]
        else:
            logger.error(f"Variable '{variable_name}' not found in dataset")
            # Close Start
            if datatree_flag:
                xdt = cast(xr.DataTree, xds_or_xdt)
                xdt.close()
            else:
                xds_dict = cast(DictOfDatasets, xds_or_xdt)
                for group, xds in xds_dict.items():
                    logger.info(f"Close {group=}")
                    xds.close()
            # Close End
            return CreatePlotError(
                error=f"Variable '{variable_name}' not found in dataset",
                format_info=file_format_info,
            )

        # Detect plotting strategy
        strategy = detect_plotting_strategy(var)
        logger.info(f"Using plotting strategy: {strategy}")

        with mpl.rc_context(MATPLOTLIB_RC_CONTEXT):
            # Create plot using xarray's native plotting methods
            if strategy == "2d_classic":
                # 2D spatial data - plot directly with appropriate colormap
                logger.info("Creating 2D spatial plot")
                ax = var.plot.imshow(cmap="viridis")
                plt.gca().set_aspect("equal")
            elif strategy == "2d_classic_isel":
                logger.info("Creating 2D spatial plot with isel")
                first_dim = var.dims[0]
                ax = var.isel({first_dim: 0}).plot.imshow(cmap="viridis")
                plt.gca().set_aspect("equal")
            elif strategy == "3d_col":
                # 3D data with spatial dimensions - use col parameter
                logger.info("Creating 3D plot with col parameter")
                first_dim = var.dims[0]
                col_wrap = min(4, var.shape[0])
                ax = var.plot.imshow(
                    col=first_dim, cmap="viridis", aspect=1, size=4, col_wrap=col_wrap
                )
            elif strategy == "4d_col_row":
                # 4D data with spatial dimensions - use col and row parameters
                logger.info("Creating 4D plot with col and row parameters")
                first_dim = var.dims[0]
                second_dim = var.dims[1]
                ax = var.plot.imshow(
                    col=second_dim, row=first_dim, cmap="viridis", aspect=1, size=4
                )
            else:
                # Default plotting behavior - let xarray decide the best method
                logger.info("Creating default plot using xarray's native plotting")
                var.plot()

            plt.suptitle(
                f"Variable: {variable_name}\n"
                "Creation date: "
                f"{datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')}",
                # f"{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                y=1.10,
            )
            # Convert to base64 string
            buffer = BytesIO()
            plt.savefig(buffer, format="png", dpi=100, bbox_inches="tight")
            buffer.seek(0)
            image_base64 = base64.b64encode(buffer.getvalue()).decode()
            plt.close()

        # Close Start
        if datatree_flag:
            xdt: xr.DataTree = cast(xr.DataTree, xds_or_xdt)
            xdt.close()
        else:
            xds_dict: DictOfDatasets = cast(DictOfDatasets, xds_or_xdt)
            for group, xds in xds_dict.items():
                logger.info(f"Close {group=}")
                xds.close()
        # Close End

        logger.info("Plot created successfully")
        return CreatePlotResult(
            plot_data=image_base64,
            format_info=file_format_info,
        )

    except Exception as exc:
        logger.error(
            f"Error creating plot: {exc!r} ({file_path=} {variable_path=} {plot_type=})"
        )
        return CreatePlotError(
            error=f"Error creating plot: {exc!r} ({file_path=} {variable_path=} {plot_type=})",
            format_info=file_format_info,
        )


def get_file_info(file_path: Path) -> Union[FileInfoResult, FileInfoError]:
    """Extract comprehensive information from a data file.

    Analyzes a data file and extracts metadata including format information,
    variables, coordinates, dimensions, and attributes. Supports both
    DataTree and Dataset structures.

    Parameters
    ----------
    file_path : Path
        Path to the data file

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
            file_path, file_format_info
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
            xdt: xr.DataTree = cast(xr.DataTree, xds_or_xdt)
            # Extract information
            with xr.set_options(**XR_TEXT_OPTIONS):
                # Get HTML representation using xarray's built-in HTML representation
                repr_text: str = str(xdt)
            with xr.set_options(**XR_HTML_OPTIONS):
                # Get text representation using xarray's built-in text representation
                repr_html: str = xdt._repr_html_()

            # logger.info(f"{xdt=}")

            flat_dict_of_xds: DictOfDatasets = {
                group: group_xdt
                for group, group_xdt in sorted(
                    xdt.to_dict().items(), key=lambda x: x[0]
                )
            }
            logger.info(
                f"Processing DataTree with {len(flat_dict_of_xds.keys())} groups"
            )
        else:
            xds_dict: DictOfDatasets = cast(DictOfDatasets, xds_or_xdt)
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
        )

        for group in flat_dict_of_xds.keys():
            logger.info(f"Processing group: {group}")
            # logger.info(f"{flat_dict_of_xds[group]=}")
            xds = flat_dict_of_xds[group]

            # Add attributes for group
            info.attributes_flattened[group] = {str(k): v for k, v in xds.attrs.items()}
            info.dimensions_flattened[group] = {str(k): v for k, v in xds.dims.items()}
            # Add coordinate variables for group
            for coord_name, coord in xds.coords.items():
                coord_info = create_coord_info(str(coord_name), coord)
                info.coordinates_flattened.setdefault(group, []).append(coord_info)

            # Add data variables for group
            for var_name, var in xds.data_vars.items():
                var_info = create_variable_info(str(var_name), var)
                logger.info(
                    f"Processing group and var: {group=}  {var_name=} {var_info=}"
                )

                info.variables_flattened.setdefault(group, []).append(var_info)

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
            xdt: xr.DataTree = cast(xr.DataTree, xds_or_xdt)
            xdt.close()
        else:
            xds_dict: DictOfDatasets = cast(DictOfDatasets, xds_or_xdt)
            for group, xds in xds_dict.items():
                logger.info(f"Close {group=}")
                xds.close()
        # Close End

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


def create_variable_info(var_name: str, var: xr.DataArray) -> VariableInfo:
    """Create VariableInfo from a DataArray.

    Parameters
    ----------
    var_name : str
        Name of the variable
    var : xr.DataArray
        DataArray to extract information from

    Returns
    -------
    VariableInfo
        Information about the variable
    """
    return VariableInfo(
        name=str(var_name),
        dtype=str(var.dtype),
        shape=list(var.shape),
        dimensions=[str(d) for d in var.dims],
        size_bytes=var.nbytes,
        attributes={str(k): v for k, v in var.attrs.items()},
    )


def create_coord_info(coord_name: str, coord: xr.DataArray) -> CoordinateInfo:
    """Create CoordinateInfo from a DataArray.

    Parameters
    ----------
    coord_name : str
        Name of the coordinate
    coord : xr.DataArray
        DataArray to extract information from

    Returns
    -------
    CoordinateInfo
        Information about the coordinate
    """
    return CoordinateInfo(
        name=str(coord_name),
        dtype=str(coord.dtype),
        shape=list(coord.shape),
        dimensions=[str(d) for d in coord.dims],
        size_bytes=coord.nbytes,
        attributes={str(k): v for k, v in coord.attrs.items()},
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
        result = get_file_info(args.file_path)
        ok = isinstance(result, FileInfoResult)

    elif args.mode == "plot":
        # Create plot
        result = create_plot(
            args.file_path, args.variable_name, args.plot_type, args.style
        )
        ok = isinstance(result, CreatePlotResult)

    # Log and print result
    logger.info(f"{args.mode} Result: {result}")
    print(to_json_best_effort({"result" if ok else "error": asdict(result)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
