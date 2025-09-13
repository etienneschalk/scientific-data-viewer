#!/usr/bin/env python3
"""
Script to get data slice from a variable in a data file.
Usage: python get_data_slice.py <file_path> <variable_name> [slice_spec_json]
"""

import json
import os
import sys
import xarray as xr
import numpy as np


def get_data_slice(file_path, variable_name, slice_spec=None):
    try:
        # Determine file format and open
        ext = os.path.splitext(file_path)[1].lower()
        if ext in [".nc", ".netcdf"]:
            ds = xr.open_dataset(file_path)
        elif ext == ".zarr":
            ds = xr.open_zarr(file_path)
        elif ext in [".h5", ".hdf5"]:
            ds = xr.open_dataset(file_path, engine="h5netcdf")
        else:
            return None

        # Get variable
        if variable_name in ds.data_vars:
            var = ds[variable_name]
        elif variable_name in ds.coords:
            var = ds[variable_name]
        else:
            return None

        # Apply slicing if specified
        if slice_spec:
            # Convert slice specification to actual slicing
            # This is a simplified version - in practice, you'd want more sophisticated slicing
            if "start" in slice_spec and "stop" in slice_spec:
                var = var.isel(
                    {
                        slice_spec.get("dim", 0): slice(
                            slice_spec["start"], slice_spec["stop"]
                        )
                    }
                )

        # Convert to numpy array for JSON serialization
        data = var.values

        # Handle different data types
        if data.dtype.kind in ["U", "S"]:  # Unicode or byte strings
            data = data.astype(str).tolist()
        elif data.dtype.kind == "O":  # Object arrays
            data = data.astype(str).tolist()
        else:
            data = data.tolist()

        result = {
            "variable": variable_name,
            "data": data,
            "shape": list(var.shape),
            "dtype": str(var.dtype),
        }

        ds.close()
        return result

    except Exception as e:
        return {"error": str(e)}


def main():
    if len(sys.argv) < 3:
        print(
            json.dumps(
                {
                    "error": "Usage: python get_data_slice.py <file_path> <variable_name> [slice_spec_json]"
                }
            )
        )
        sys.exit(1)

    file_path = sys.argv[1]
    variable_name = sys.argv[2]
    slice_spec = None

    if len(sys.argv) > 3:
        try:
            slice_spec = json.loads(sys.argv[3])
        except json.JSONDecodeError:
            print(json.dumps({"error": "Invalid JSON for slice_spec"}))
            sys.exit(1)

    result = get_data_slice(file_path, variable_name, slice_spec)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
