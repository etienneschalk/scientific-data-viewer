#!/usr/bin/env python3
"""
Script to get data file information including format, dimensions, variables, and attributes.
Supports all xarray-compatible formats with automatic engine detection and dependency management.
Usage: python get_data_info.py <file_path>
"""

import json
import os
import sys
import xarray as xr


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


def check_package_availability(package_name):
    """Check if a Python package is available."""
    try:
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
            xds = xr.open_datatree(file_path, engine=engine)
            return xds, engine
        except Exception as e:
            # Fallback on dataset
            xds = xr.open_dataset(file_path, engine=engine)
            return xds, engine
        except Exception as e:
            last_error = e
            continue

    # If all engines failed, raise the last error
    raise last_error


def get_file_info(file_path):
    try:
        # Detect file format and available engines
        file_format_info = detect_file_format(file_path)

        if not file_format_info["is_supported"]:
            return {
                "error": f"Missing dependencies for {file_format_info['display_name']} files: {', '.join(file_format_info['missing_packages'])}",
                "error_type": "ImportError",
                "format_info": file_format_info,
                "suggestion": f"Install required packages: pip install {' '.join(file_format_info['missing_packages'])}",
            }

        # Open dataset with fallback
        xds, used_engine = open_datatree_with_fallback(file_path, file_format_info)

        # Extract information
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
            "xarray_text_repr": str(xds),
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

    except ImportError as e:
        # Handle missing dependencies
        return {
            "error": f"Missing dependencies: {str(e)}",
            "error_type": "ImportError",
            "suggestion": "Install required packages using pip install <package_name>",
        }
    except Exception as e:
        # Handle other errors (file corruption, format issues, etc.)
        return {
            "error": str(e),
            "error_type": type(e).__name__,
            "suggestion": "Check if the file is corrupted or in an unsupported format",
        }


def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: python get_data_info.py <file_path>"}))
        sys.exit(1)

    file_path = sys.argv[1]
    result = get_file_info(file_path)
    print(json.dumps(result, default=str))


if __name__ == "__main__":
    main()
