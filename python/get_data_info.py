#!/usr/bin/env python3
"""
Script to get data file information including format, dimensions, variables, and attributes.
Supports all xarray-compatible formats with automatic engine detection and dependency management.
Usage: python get_data_info.py <file_path>
"""

import io
import json
import logging
import os
import sys
import xarray as xr


# Set up logging
# Redirect logging to stderr so it doesn't interfere with the base64 output
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

XARRAY_MAX_ROWS_FOR_TEXT_REPRESENTATION = 1000

# Format to engine mapping based on xarray documentation
FORMAT_ENGINE_MAP = {
    # Built-in formats
    ".nc": ["netcdf4", "h5netcdf", "scipy"],
    ".netcdf": ["netcdf4", "h5netcdf", "scipy"],
    ".zarr": ["zarr"],
    ".h5": ["h5netcdf", "h5py", "netcdf4"],
    ".hdf5": ["h5netcdf", "h5py", "netcdf4"],
    # Additional formats that might be supported
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
FORMAT_DISPLAY_NAMES = {
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
ENGINE_PACKAGES = {
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
DEFAULT_ENGINE_BACKEND_KWARGS = {engine: None for engine in ENGINE_PACKAGES}
# Avoid intempestive .idx file creation
DEFAULT_ENGINE_BACKEND_KWARGS["cfgrib"] = {"indexpath": ""}

# We try to use DataTree when possible, but for some, do not attempt as the failure is certain.
DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET = {engine: False for engine in ENGINE_PACKAGES}
DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET["cfgrib"] = True
DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET["rasterio"] = True


def check_package_availability(package_name):
    """Check if a Python package is available."""
    try:
        logger.info(f"Checking package availability: {package_name}")
        __import__(package_name)
        return True
    except ImportError:
        return False


def get_available_engines(file_extension):
    """Get available engines for a file extension."""
    if file_extension not in FORMAT_ENGINE_MAP:
        return []

    available_engines = []
    for engine in FORMAT_ENGINE_MAP[file_extension]:
        package_name = ENGINE_PACKAGES.get(engine, engine)
        if check_package_availability(package_name):
            available_engines.append(engine)

    return available_engines


def get_missing_packages(file_extension):
    """Get missing packages required for a file extension."""
    if file_extension not in FORMAT_ENGINE_MAP:
        return []

    missing_packages = []
    for engine in FORMAT_ENGINE_MAP[file_extension]:
        package_name = ENGINE_PACKAGES.get(engine, engine)
        if not check_package_availability(package_name):
            missing_packages.append(package_name)

    return missing_packages


def detect_file_format(file_path):
    """Detect file format and return extension, display name, and available engines."""
    ext = os.path.splitext(file_path)[1].lower()
    display_name = FORMAT_DISPLAY_NAMES.get(ext, "Unknown")
    available_engines = get_available_engines(ext)
    missing_packages = get_missing_packages(ext)

    return {
        "extension": ext,
        "display_name": display_name,
        "available_engines": available_engines,
        "missing_packages": missing_packages,
        "is_supported": len(available_engines) > 0,
    }


def open_datatree_with_fallback(file_path, file_format_info):
    """Open datatree with fallback to different engines."""
    ext = file_format_info["extension"]
    available_engines = file_format_info["available_engines"]

    if not available_engines:
        raise ImportError(
            f"No engines available for {ext} files. Missing packages: {', '.join(file_format_info['missing_packages'])}"
        )

    # Try each available engine
    last_error = None
    for engine in available_engines:
        try:
            if DEFAULT_ENGINE_TO_FORCE_USE_OPEN_DATASET[engine]:
                xds = xr.open_dataset(
                    file_path,
                    engine=engine,
                    backend_kwargs=DEFAULT_ENGINE_BACKEND_KWARGS[engine],
                )
                return xds, engine

            xds = xr.open_datatree(
                file_path,
                engine=engine,
                backend_kwargs=DEFAULT_ENGINE_BACKEND_KWARGS[engine],
            )
            return xds, engine
        except NotImplementedError as e:
            # Fallback on dataset
            logger.warning(
                f"Opening file as DataTree is not implemented with engine {engine}: {e!r}"
            )
            logger.warning("Fallback to opening file as Dataset")
            xds = xr.open_dataset(
                file_path,
                engine=engine,
                backend_kwargs=DEFAULT_ENGINE_BACKEND_KWARGS[engine],
            )
            return xds, engine
        except Exception as e:
            last_error = e
            continue

    # If all engines failed, raise the last error
    raise last_error


def get_file_info(file_path):
    try:
        # Diagnostic: xr.show_versions()
        # Capture the output of xr.show_versions() by passing a StringIO object
        output = io.StringIO()
        xr.show_versions(file=output)
        versions_text = output.getvalue()

        # Detect file format and available engines
        file_format_info = detect_file_format(file_path)

        if not file_format_info["is_supported"]:
            error = {
                "error": f"Missing dependencies for {file_format_info['display_name']} files: {', '.join(file_format_info['missing_packages'])}",
                "error_type": "ImportError",
                "format_info": file_format_info,
                "suggestion": f"Install required packages: pip install {' '.join(file_format_info['missing_packages'])}",
                "xarray_show_versions": versions_text,
            }
            return {"error": error}

        # Open dataset with fallback
        xds, used_engine = open_datatree_with_fallback(file_path, file_format_info)

        # Extract information
        with xr.set_options(display_max_rows=XARRAY_MAX_ROWS_FOR_TEXT_REPRESENTATION):
            repr_text = str(xds)

        info = {
            "format": file_format_info["display_name"],
            "format_info": file_format_info,
            "used_engine": used_engine,
            "fileSize": os.path.getsize(file_path),
            "dimensions": dict(xds.dims),
            "variables": [],
            "coordinates": [],
            "attributes": dict(xds.attrs) if hasattr(xds, "attrs") else {},
            # Get HTML representation using xarray's built-in HTML representation
            "xarray_html_repr": xds._repr_html_(),
            # Get text representation using xarray's built-in text representation
            "xarray_text_repr": repr_text,
            "xarray_show_versions": versions_text,
        }

        # Add coordinate variables
        for coord_name, coord in xds.coords.items():
            # Calculate size in bytes
            size_bytes = coord.nbytes

            # Get dimension names
            dim_names = list(coord.dims) if hasattr(coord, "dims") else []

            coord_info = {
                "name": coord_name,
                "dtype": str(coord.dtype),
                "shape": list(coord.shape),
                "dimensions": dim_names,
                "size_bytes": size_bytes,
                "attributes": dict(coord.attrs) if hasattr(coord, "attrs") else {},
            }
            info["coordinates"].append(coord_info)

        # Add data variables
        for var_name, var in xds.data_vars.items():
            # Calculate size in bytes
            size_bytes = var.nbytes

            # Get dimension names
            dim_names = list(var.dims) if hasattr(var, "dims") else []

            var_info = {
                "name": var_name,
                "dtype": str(var.dtype),
                "shape": list(var.shape),
                "dimensions": dim_names,
                "size_bytes": size_bytes,
                "attributes": dict(var.attrs) if hasattr(var, "attrs") else {},
            }
            info["variables"].append(var_info)

        xds.close()
        result = info
        return {"result": result}
    except ImportError as e:
        # Handle missing dependencies
        error = {
            "error": f"Missing dependencies: {str(e)}",
            "error_type": "ImportError",
            "suggestion": "Install required packages using pip install <package_name>",
            "format_info": file_format_info,
            "xarray_show_versions": versions_text,
        }
        return {"error": error}
    except Exception as e:
        # Handle other errors (file corruption, format issues, etc.)
        error = {
            "error": str(e),
            "error_type": type(e).__name__,
            "suggestion": "Check if the file is corrupted or in an unsupported format",
            "format_info": file_format_info,
            "xarray_show_versions": versions_text,
        }
        return {"error": error}


def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: python get_data_info.py <file_path>"}))
        sys.exit(1)

    file_path = sys.argv[1]
    result = get_file_info(file_path)
    logger.info(f"Result: {result}")
    print(json.dumps(result, default=str))


if __name__ == "__main__":
    main()
