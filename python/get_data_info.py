#!/usr/bin/env python3
"""
Script to get data file information including format, dimensions, variables, and attributes.
Supports all xarray-compatible formats with automatic engine detection and dependency management.
Usage: python get_data_info.py <file_path>
"""

from logging import Logger


from dataclasses import asdict, dataclass
import io
import json
import logging
import os
from pathlib import Path
import sys
from typing import Any
from xarray.core.dataset import Dataset
from xarray.core.datatree import DataTree
import xarray as xr
from importlib.util import find_spec

# Set up logging
# Redirect logging to stderr so it doesn't interfere with the base64 output
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger: Logger = logging.getLogger(__name__)

XR_OPTIONS: dict[str, Any] = {"display_max_rows": 1000}

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


@dataclass(frozen=True, kw_only=True)
class FileFormatInfo:
    extension: str
    display_name: str
    available_engines: list[str]
    missing_packages: list[str]

    @property
    def is_supported(self) -> bool:
        return len(self.available_engines) > 0


@dataclass(frozen=True, kw_only=True)
class VariableInfo:
    name: str
    dtype: str
    shape: list[int]
    dimensions: list[str]
    size_bytes: int
    attributes: dict[str, Any]


@dataclass(frozen=True, kw_only=True)
class CoordinateInfo:
    name: str
    dtype: str
    shape: list[int]
    dimensions: list[str]
    size_bytes: int
    attributes: dict[str, Any]


@dataclass(frozen=True, kw_only=True)
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


@dataclass(frozen=True, kw_only=True)
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
) -> tuple[Dataset | DataTree, str]:
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
            use_datatree: bool = (
                hasattr(xr, "open_datatree")
                and not DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET[engine]
            )
            if use_datatree:
                xdt_or_xds = xr.open_datatree(
                    file_path,
                    engine=engine,
                    backend_kwargs=DEFAULT_ENGINE_BACKEND_KWARGS[engine],
                )
                if xdt_or_xds.groups == ("/",):
                    # DataTree with single group can be narrowed down to a dataset
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
        with xr.set_options(**XR_OPTIONS):
            # Get HTML representation using xarray's built-in HTML representation
            repr_text: str = str(xds_or_xdt)
            # Get text representation using xarray's built-in text representation
            repr_html: str = xds_or_xdt._repr_html_()

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
        )

        # Add coordinate variables
        for coord_name, coord in xds_or_xdt.coords.items():
            coord_info = CoordinateInfo(
                name=str(coord_name),
                dtype=str(coord.dtype),
                shape=list(coord.shape),
                dimensions=[str(d) for d in coord.dims],
                size_bytes=coord.nbytes,
                attributes={str(k): v for k, v in coord.attrs.items()},
            )
            info.coordinates.append(coord_info)

        # Add data variables
        for var_name, var in xds_or_xdt.data_vars.items():
            var_info = VariableInfo(
                name=str(var_name),
                dtype=str(var.dtype),
                shape=list(var.shape),
                dimensions=[str(d) for d in var.dims],
                size_bytes=var.nbytes,
                attributes={str(k): v for k, v in var.attrs.items()},
            )
            info.variables.append(var_info)

        xds_or_xdt.close()
        return info
    except Exception as exc:
        # Handle other errors (file corruption, format issues, etc.)
        error = FileInfoError(
            error=str(exc),
            error_type=type(exc).__name__,
            suggestion="Check if the file is corrupted or in an unsupported format",
            format_info=file_format_info,
            xarray_show_versions=versions_text,
        )
        return error


def main() -> None:
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: python get_data_info.py <file_path>"}))
        sys.exit(1)

    file_path: Path = Path(sys.argv[1])
    result: FileInfoError | FileInfoResult = get_file_info(file_path)
    logger.info(f"Result: {result}")
    if isinstance(result, FileInfoError):
        print(json.dumps({"error": asdict(result)}, default=str))
    else:
        print(json.dumps({"result": asdict(result)}, default=str))


if __name__ == "__main__":
    main()
