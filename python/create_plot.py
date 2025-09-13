#!/usr/bin/env python3
"""
Script to create plots from data file variables.
Usage: python create_plot.py <file_path> <variable_name> [plot_type]
"""

import json
import os
import sys
import xarray as xr
import matplotlib.pyplot as plt
import numpy as np
import base64
from io import BytesIO


def create_plot(file_path, variable_name, plot_type="line"):
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
            return None

        # Get variable
        if variable_name in ds.data_vars:
            var = ds[variable_name]
        elif variable_name in ds.coords:
            var = ds[variable_name]
        else:
            return None

        # Create plot
        plt.figure(figsize=(10, 6))

        if plot_type == "line" and var.ndim == 1:
            var.plot()
        elif plot_type == "heatmap" and var.ndim == 2:
            var.plot()
        elif plot_type == "histogram":
            var.plot.hist()
        else:
            # Default plot
            var.plot()

        plt.title(f"{variable_name}")
        plt.tight_layout()

        # Convert to base64 string
        buffer = BytesIO()
        plt.savefig(buffer, format="png", dpi=100, bbox_inches="tight")
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.getvalue()).decode()
        plt.close()

        ds.close()
        return image_base64

    except Exception as e:
        return None


def main():
    if len(sys.argv) < 3:
        print(
            json.dumps(
                {
                    "error": "Usage: python create_plot.py <file_path> <variable_name> [plot_type]"
                }
            )
        )
        sys.exit(1)

    file_path = sys.argv[1]
    variable_name = sys.argv[2]
    plot_type = sys.argv[3] if len(sys.argv) > 3 else "line"

    result = create_plot(file_path, variable_name, plot_type)
    if result:
        print(result)
    else:
        print(json.dumps({"error": "Failed to create plot"}))


if __name__ == "__main__":
    main()
