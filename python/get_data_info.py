#!/usr/bin/env python3
"""
Script to get data file information including format, dimensions, variables, and attributes.
Usage: python get_data_info.py <file_path>
"""

import json
import os
import sys
import xarray as xr
import numpy as np


def get_file_info(file_path):
    try:
        # Determine file format
        ext = os.path.splitext(file_path)[1].lower()
        if ext in [".nc", ".netcdf"]:
            format_name = "NetCDF"
        elif ext == ".zarr":
            format_name = "Zarr"
        elif ext in [".h5", ".hdf5"]:
            format_name = "HDF5"
        else:
            format_name = "Unknown"

        # Open dataset
        if ext in [".nc", ".netcdf"]:
            ds = xr.open_dataset(file_path)
        elif ext == ".zarr":
            ds = xr.open_zarr(file_path)
        elif ext in [".h5", ".hdf5"]:
            ds = xr.open_dataset(file_path, engine="h5netcdf")
        else:
            return None

        # Get file size
        file_size = os.path.getsize(file_path)

        # Extract information
        info = {
            "format": format_name,
            "fileSize": file_size,
            "dimensions": dict(ds.dims),
            "variables": [],
            "attributes": dict(ds.attrs) if hasattr(ds, "attrs") else {},
        }

        # Process variables
        for var_name, var in ds.data_vars.items():
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

        # Add coordinate variables
        for coord_name, coord in ds.coords.items():
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
            info["variables"].append(coord_info)

        ds.close()
        return info

    except Exception as e:
        return {"error": str(e)}


def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: python get_data_info.py <file_path>"}))
        sys.exit(1)

    file_path = sys.argv[1]
    result = get_file_info(file_path)
    print(json.dumps(result, default=str))


if __name__ == "__main__":
    main()
