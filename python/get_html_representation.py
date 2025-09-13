#!/usr/bin/env python3
"""
Script to get HTML representation of xarray dataset.
Usage: python get_html_representation.py <file_path>
"""

import json
import os
import sys
import xarray as xr
import numpy as np


def get_html_representation(file_path):
    try:
        # Open dataset
        ext = os.path.splitext(file_path)[1].lower()
        if ext in [".nc", ".netcdf"]:
            ds = xr.open_dataset(file_path)
        elif ext == ".zarr":
            ds = xr.open_zarr(file_path)
        elif ext in [".h5", ".hdf5"]:
            ds = xr.open_dataset(file_path, engine="h5netcdf")
        else:
            return {"error": "Unsupported file format"}

        # Get HTML representation using xarray's built-in HTML representation
        html_repr = ds._repr_html_()

        ds.close()
        return {"html": html_repr}

    except Exception as e:
        return {"error": str(e)}


def main():
    if len(sys.argv) != 2:
        print(
            json.dumps(
                {"error": "Usage: python get_html_representation.py <file_path>"}
            )
        )
        sys.exit(1)

    file_path = sys.argv[1]
    result = get_html_representation(file_path)
    print(json.dumps(result, default=str))


if __name__ == "__main__":
    main()
