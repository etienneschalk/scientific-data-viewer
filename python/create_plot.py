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
import base64
import logging
from io import BytesIO

# Set up logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


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
            logger.error(f"Unsupported file format: {ext}")
            return None

        # Get variable
        if variable_name in ds.data_vars:
            var = ds[variable_name]
        elif variable_name in ds.coords:
            var = ds[variable_name]
        else:
            logger.error(f"Variable '{variable_name}' not found in dataset")
            return None

        # Detect plotting strategy
        strategy = detect_plotting_strategy(var)
        logger.info(f"Using plotting strategy: {strategy}")

        # Create plot using xarray's native plotting methods
        if strategy == "2d_spatial":
            # 2D spatial data - plot directly with appropriate colormap
            logger.info("Creating 2D spatial plot")
            var.plot(figsize=(12, 8), cmap="viridis")

        elif strategy == "3d_col":
            # 3D data with spatial dimensions - use col parameter
            logger.info("Creating 3D plot with col parameter")
            first_dim = var.dims[0]
            var.plot(col=first_dim, figsize=(15, 10), cmap="viridis")

        elif strategy == "4d_col_row":
            # 4D data with spatial dimensions - use col and row parameters
            logger.info("Creating 4D plot with col and row parameters")
            first_dim = var.dims[0]
            second_dim = var.dims[1]
            var.plot(col=second_dim, row=first_dim, figsize=(20, 15), cmap="viridis")

        else:
            # Default plotting behavior - let xarray decide the best method
            logger.info("Creating default plot using xarray's native plotting")

            if plot_type == "histogram":
                var.plot.hist(figsize=(10, 6))
            else:
                # Let xarray automatically choose the best plotting method
                var.plot(figsize=(12, 8))

        # Apply tight layout
        # plt.tight_layout()

        # Convert to base64 string
        buffer = BytesIO()
        plt.savefig(buffer, format="png", dpi=100, bbox_inches="tight")
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.getvalue()).decode()
        plt.close()

        ds.close()
        logger.info("Plot created successfully")
        return image_base64

    except Exception as e:
        logger.error(f"Error creating plot: {str(e)}")
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

    # Redirect logging to stderr so it doesn't interfere with the base64 output

    logging.basicConfig(
        stream=sys.stderr,
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
    )

    result = create_plot(file_path, variable_name, plot_type)
    if result:
        print(result)
    else:
        print(json.dumps({"error": "Failed to create plot"}))


if __name__ == "__main__":
    main()
