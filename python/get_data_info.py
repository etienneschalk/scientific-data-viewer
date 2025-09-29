#!/usr/bin/env python3
"""
Script to get data file information and create plots from data file variables.
Supports all xarray-compatible formats with automatic engine detection and dependency management.
Usage:
  python get_data_info.py info <file_path>
  python get_data_info.py plot <file_path> <variable_name> [plot_type]
"""

from logging import Logger

import argparse
import base64
from dataclasses import asdict, dataclass
import io
import json
import logging
import os
from pathlib import Path, PurePosixPath
import sys
from typing import Any
import xarray as xr
import matplotlib as mpl
import numpy as np

from importlib.util import find_spec
import matplotlib.pyplot as plt
from io import BytesIO

# Set up logging
# Redirect logging to stderr so it doesn't interfere with the base64 output
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger: Logger = logging.getLogger(__name__)

# Set globally for all plots: use scientific notation for large/small numbers
mpl.rcParams["axes.formatter.limits"] = (-3, 3)
mpl.rcParams["axes.formatter.use_mathtext"] = True
xr.set_options(display_expand_attrs=False, display_expand_data=False)
np.set_printoptions(threshold=20, edgeitems=2)

XR_TEXT_OPTIONS: dict[str, Any] = {"display_max_rows": 1000}

# Format to engine mapping based on xarray documentation
FORMAT_ENGINE_MAP: dict[str, list[str]] = {
    # Built-in formats
    ".nc": ["netcdf4", "h5netcdf", "scipy"],
    ".netcdf": ["netcdf4", "h5netcdf", "scipy"],
    ".zarr": ["zarr"],
    ".h5": ["h5netcdf", "h5py", "netcdf4"],
    ".hdf5": ["h5netcdf", "h5py", "netcdf4"],
    ".grib": ["cfgrib"],
    ".grib2": ["cfgrib"],
    ".tif": ["rasterio"],
    ".tiff": ["rasterio"],
    ".geotiff": ["rasterio"],
    ".jp2": ["rasterio"],
    ".jpeg2000": ["rasterio"],
    ".safe": ["sentinel"],
    ".nc4": ["netcdf4", "h5netcdf"],
    ".cdf": ["netcdf4", "h5netcdf", "scipy"],
}

# Format display names
FORMAT_DISPLAY_NAMES: dict[str, str] = {
    ".nc": "NetCDF",
    ".netcdf": "NetCDF",
    ".zarr": "Zarr",
    ".h5": "HDF5",
    ".hdf5": "HDF5",
    ".grib": "GRIB",
    ".grib2": "GRIB2",
    ".tif": "GeoTIFF",
    ".tiff": "GeoTIFF",
    ".geotiff": "GeoTIFF",
    ".jp2": "JPEG-2000",
    ".jpeg2000": "JPEG-2000",
    ".safe": "Sentinel-1 SAFE",
    ".nc4": "NetCDF4",
    ".cdf": "CDF/NetCDF",
}

# Required packages for each engine
ENGINE_PACKAGES: dict[str, str] = {
    "netcdf4": "netCDF4",
    "h5netcdf": "h5netcdf",
    "scipy": "scipy",
    "zarr": "zarr",
    "h5py": "h5py",
    "cfgrib": "cfgrib",
    "rasterio": "rioxarray",
    "sentinel": "xarray-sentinel",
}

# Default backend kwargs for each engine
DEFAULT_ENGINE_BACKEND_KWARGS: dict[str, Any | None] = {
    engine: None for engine in ENGINE_PACKAGES
}
# Avoid intempestive .idx file creation
DEFAULT_ENGINE_BACKEND_KWARGS["cfgrib"] = {"indexpath": ""}

# We try to use DataTree when possible, but for some, do not attempt as the failure is certain.
DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET: dict[str, bool] = {
    engine: False for engine in ENGINE_PACKAGES
}
DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET["cfgrib"] = True
DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET["rasterio"] = True


@dataclass(frozen=True)
class FileFormatInfo:
    extension: str
    display_name: str
    available_engines: list[str]
    missing_packages: list[str]

    @property
    def is_supported(self) -> bool:
        return len(self.available_engines) > 0


@dataclass(frozen=True)
class VariableInfo:
    name: str
    dtype: str
    shape: list[int]
    dimensions: list[str]
    size_bytes: int
    attributes: dict[str, Any]


@dataclass(frozen=True)
class CoordinateInfo:
    name: str
    dtype: str
    shape: list[int]
    dimensions: list[str]
    size_bytes: int
    attributes: dict[str, Any]


@dataclass(frozen=True)
class FileInfoResult:
    format: str
    format_info: FileFormatInfo
    used_engine: str
    fileSize: int
    dimensions: dict[str, int]
    variables: list[VariableInfo]
    coordinates: list[CoordinateInfo]
    attributes: dict[str, Any]
    xarray_html_repr: str
    xarray_text_repr: str
    xarray_show_versions: str
    # For flattented datatrees
    variables_flattened: dict[str, list[VariableInfo]]
    coordinates_flattened: dict[str, list[CoordinateInfo]]
    attributes_flattened: dict[str, dict[str, Any]]
    xarray_html_repr_flattened: dict[str, str]
    xarray_text_repr_flattened: dict[str, str]
    datatree_flag: bool


@dataclass(frozen=True)
class FileInfoError:
    error: str
    error_type: str
    suggestion: str
    format_info: FileFormatInfo
    xarray_show_versions: str


def check_package_availability(package_name: str) -> bool:
    """Check if a Python package is available."""
    logger.info(f"Checking package availability: {package_name}")
    return find_spec(package_name) is not None


def get_available_engines(file_extension: str) -> list[str]:
    """Get available engines for a file extension."""
    if file_extension not in FORMAT_ENGINE_MAP:
        return []

    available_engines: list[str] = []
    for engine in FORMAT_ENGINE_MAP[file_extension]:
        package_name: str = ENGINE_PACKAGES.get(engine, engine)
        if check_package_availability(package_name):
            available_engines.append(engine)

    return available_engines


def get_missing_packages(file_extension: str) -> list[str]:
    """Get missing packages required for a file extension."""
    if file_extension not in FORMAT_ENGINE_MAP:
        return []

    missing_packages: list[str] = []
    for engine in FORMAT_ENGINE_MAP[file_extension]:
        package_name: str = ENGINE_PACKAGES.get(engine, engine)
        if not check_package_availability(package_name):
            missing_packages.append(package_name)

    return missing_packages


def detect_file_format(file_path: Path) -> FileFormatInfo:
    """Detect file format and return extension, display name, and available engines."""
    ext: str = file_path.suffix.lower()
    display_name: str = FORMAT_DISPLAY_NAMES.get(ext, "Unknown")
    available_engines: list[str] = get_available_engines(ext)
    missing_packages: list[str] = get_missing_packages(ext)

    return FileFormatInfo(
        extension=ext,
        display_name=display_name,
        available_engines=available_engines,
        missing_packages=missing_packages,
    )


def open_datatree_with_fallback(
    file_path: Path, file_format_info: FileFormatInfo
) -> tuple[xr.Dataset | Any, str]:
    """Open datatree or dataset with fallback to different engines."""
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
                    backend_kwargs=DEFAULT_ENGINE_BACKEND_KWARGS[engine],
                )
                if hasattr(xdt_or_xds, "groups") and xdt_or_xds.groups == ("/",):
                    # DataTree with single top-level group can be narrowed down to a dataset
                    xdt_or_xds = xdt_or_xds.to_dataset()
            else:
                xdt_or_xds = xr.open_dataset(
                    file_path,
                    engine=engine,
                    backend_kwargs=DEFAULT_ENGINE_BACKEND_KWARGS[engine],
                )
            return xdt_or_xds, engine
        except NotImplementedError as exc:
            # Fallback on dataset
            logger.warning(
                f"Opening file as DataTree is not implemented with engine {engine}: {exc!r}"
            )
            logger.warning("Fallback to opening file as Dataset")
            xds = xr.open_dataset(
                file_path,
                engine=engine,
                backend_kwargs=DEFAULT_ENGINE_BACKEND_KWARGS[engine],
            )
            return xds, engine
        except Exception as exc:
            exceptions.append(exc)
            continue

    # If all engines failed, raise the last error
    raise exceptions[-1]


def can_use_datatree(engine: str) -> bool:
    return (
        hasattr(xr, "open_datatree")
        and not DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET[engine]
    )


def is_spatial_dimension(dim_name):
    """Check if a dimension name represents spatial coordinates."""
    spatial_patterns = [
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


def detect_plotting_strategy(var):
    """Detect the best plotting strategy based on variable dimensions."""
    dims = list(var.dims)
    ndim = var.ndim

    logger.info(f"Variable '{var.name}' has {ndim} dimensions: {dims}")

    if ndim == 2:
        # Check if last two dimensions are spatial
        if (
            len(dims) >= 2
            and is_spatial_dimension(dims[-2])
            and is_spatial_dimension(dims[-1])
        ):
            logger.info("Using 2D spatial plotting strategy")
            return "2d_spatial"

    elif ndim == 3:
        # Check if last two dimensions are spatial
        if (
            len(dims) >= 2
            and is_spatial_dimension(dims[-2])
            and is_spatial_dimension(dims[-1])
        ):
            logger.info("Using 3D plotting strategy with col parameter")
            return "3d_col"

    elif ndim == 4:
        # Check if last two dimensions are spatial
        if (
            len(dims) >= 2
            and is_spatial_dimension(dims[-2])
            and is_spatial_dimension(dims[-1])
        ):
            logger.info("Using 4D plotting strategy with col and row parameters")
            return "4d_col_row"

    logger.info("Using default plotting strategy")
    return "default"


def create_plot(file_path: Path, variable_path: str, plot_type: str = "line"):
    """Create a plot from a data file variable."""
    try:
        # Detect file format and available engines
        file_format_info = detect_file_format(file_path)

        if not file_format_info.is_supported:
            logger.error(
                f"No engines available for {file_format_info.extension} files. "
                f"Missing packages: {', '.join(file_format_info.missing_packages)}"
            )
            return None

        # Open dataset with fallback
        xds_or_xdt, used_engine = open_datatree_with_fallback(
            file_path, file_format_info
        )

        if can_use_datatree(used_engine) and isinstance(xds_or_xdt, xr.DataTree):
            path = PurePosixPath(variable_path)
            group_name = path.parent
            group = xds_or_xdt[str(group_name)].to_dataset()
            variable_name = path.stem
        else:
            group = xds_or_xdt
            variable_name = variable_path

        # Get variable
        if variable_name in group.data_vars:
            var = group[variable_name]
        elif variable_name in group.coords:
            var = group[variable_name]
        else:
            logger.error(f"Variable '{variable_name}' not found in dataset")
            xds_or_xdt.close()
            return None

        # Detect plotting strategy
        strategy = detect_plotting_strategy(var)
        logger.info(f"Using plotting strategy: {strategy}")

        # Create plot using xarray's native plotting methods
        if strategy == "2d_spatial":
            # 2D spatial data - plot directly with appropriate colormap
            logger.info("Creating 2D spatial plot")
            ax = var.plot.imshow(cmap="viridis", aspect=1)

        elif strategy == "3d_col":
            # 3D data with spatial dimensions - use col parameter
            logger.info("Creating 3D plot with col parameter")
            first_dim = var.dims[0]
            ax = var.plot.imshow(col=first_dim, cmap="viridis", aspect=1)
        elif strategy == "4d_col_row":
            # 4D data with spatial dimensions - use col and row parameters
            logger.info("Creating 4D plot with col and row parameters")
            first_dim = var.dims[0]
            second_dim = var.dims[1]
            ax = var.plot.imshow(
                col=second_dim,
                row=first_dim,
                cmap="viridis",
                aspect=1,
            )
        else:
            # Default plotting behavior - let xarray decide the best method
            logger.info("Creating default plot using xarray's native plotting")
            var.plot()

            # if plot_type == "histogram":
            #     var.plot.hist(figsize=(10, 6))
            # else:
            #     # Let xarray automatically choose the best plotting method
            #     var.plot(figsize=(12, 8))

        # Convert to base64 string
        buffer = BytesIO()
        plt.savefig(buffer, format="png", dpi=100, bbox_inches="tight")
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.getvalue()).decode()
        plt.close()

        xds_or_xdt.close()
        logger.info("Plot created successfully")
        return image_base64

    except Exception as e:
        logger.error(f"Error creating plot: {str(e)}")
        return None


def get_file_info(file_path: Path):
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
        # Extract information
        with xr.set_options(**XR_TEXT_OPTIONS):
            # Get HTML representation using xarray's built-in HTML representation
            repr_text: str = str(xds_or_xdt)
        # Get text representation using xarray's built-in text representation
        repr_html: str = xds_or_xdt._repr_html_()

        datatree_flag: bool = can_use_datatree(used_engine) and isinstance(
            xds_or_xdt, xr.DataTree
        )

        info = FileInfoResult(
            format=file_format_info.display_name,
            format_info=file_format_info,
            used_engine=used_engine,
            fileSize=os.path.getsize(file_path),
            dimensions={str(k): v for k, v in xds_or_xdt.dims.items()},
            variables=[],
            coordinates=[],
            attributes={str(k): v for k, v in xds_or_xdt.attrs.items()},
            xarray_html_repr=repr_html,
            xarray_text_repr=repr_text,
            xarray_show_versions=versions_text,
            coordinates_flattened={},
            variables_flattened={},
            attributes_flattened={},
            xarray_html_repr_flattened={},
            xarray_text_repr_flattened={},
            datatree_flag=datatree_flag,
        )

        # Add coordinate variables
        for coord_name, coord in xds_or_xdt.coords.items():
            coord_info = create_coord_info(str(coord_name), coord)
            info.coordinates.append(coord_info)

        # Add data variables
        for var_name, var in xds_or_xdt.data_vars.items():
            var_info = create_variable_info(str(var_name), var)
            info.variables.append(var_info)

        if datatree_flag:
            xdt = xds_or_xdt
            logger.info(f"Processing DataTree with {len(xdt.to_dict().keys())} groups")
            logger.info(f"{xdt=}")
            for group in xdt.to_dict().keys():
                logger.info(f"Processing group: {group}")
                logger.info(f"{xdt[group].to_dataset()=}")
                xds = xdt[group].to_dataset()

                # Add attributes for group
                info.attributes_flattened[group] = {
                    str(k): v for k, v in xds.attrs.items()
                }
                # Add coordinate variables for group
                for coord_name, coord in xds.coords.items():
                    coord_info = create_coord_info(str(coord_name), coord)
                    info.coordinates_flattened.setdefault(group, []).append(coord_info)

                # Add data variables for group
                for var_name, var in xds.data_vars.items():
                    var_info = create_variable_info(str(var_name), var)
                    info.variables_flattened.setdefault(group, []).append(var_info)

                # Extract information
                with xr.set_options(**XR_TEXT_OPTIONS):
                    # Get HTML representation using xarray's built-in HTML representation
                    repr_text: str = str(xds)
                # Get text representation using xarray's built-in text representation
                repr_html: str = xds._repr_html_()

                info.xarray_html_repr_flattened[group] = repr_html
                info.xarray_text_repr_flattened[group] = repr_text

        xds_or_xdt.close()
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
    return VariableInfo(
        name=str(var_name),
        dtype=str(var.dtype),
        shape=list(var.shape),
        dimensions=[str(d) for d in var.dims],
        size_bytes=var.nbytes,
        attributes={str(k): v for k, v in var.attrs.items()},
    )


def create_coord_info(coord_name: str, coord: xr.DataArray) -> CoordinateInfo:
    return CoordinateInfo(
        name=str(coord_name),
        dtype=str(coord.dtype),
        shape=list(coord.shape),
        dimensions=[str(d) for d in coord.dims],
        size_bytes=coord.nbytes,
        attributes={str(k): v for k, v in coord.attrs.items()},
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Get data file information and create plots from data file variables",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python get_data_info.py info sample_data.nc
  python get_data_info.py plot sample_data.nc temperature
  python get_data_info.py plot sample_data.nc temperature histogram
        """,
    )

    parser.add_argument(
        "mode",
        choices=["info", "plot"],
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
        default="line",
        help="Plot type: 'line' or 'histogram' (optional, default: 'line')",
    )

    args = parser.parse_args()

    # Validate arguments based on mode
    if args.mode == "plot" and not args.variable_name:
        print(json.dumps({"error": "Variable name is required for plot mode"}))
        sys.exit(1)

    if args.mode == "info":
        # Get file information
        result: FileInfoError | FileInfoResult = get_file_info(args.file_path)
        logger.info(f"Result: {result}")
        if isinstance(result, FileInfoError):
            print(json.dumps({"error": asdict(result)}, default=str))
        else:
            print(json.dumps({"result": asdict(result)}, default=str))

    elif args.mode == "plot":
        # Create plot
        result = create_plot(args.file_path, args.variable_name, args.plot_type)
        if result:
            print(result)
        else:
            print(json.dumps({"error": "Failed to create plot"}))


if __name__ == "__main__":
    main()
