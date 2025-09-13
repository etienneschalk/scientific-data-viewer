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


def create_plot(file_path, variable_name, plot_type="line", plot_config=None):
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

        # Handle advanced plotting configuration
        if plot_type == "advanced" and plot_config:
            logger.info("Creating advanced plot with custom configuration")
            var = apply_advanced_plot_config(var, plot_config)

            # Create plot with custom col/row configuration
            col_dims = plot_config.get("col", [])
            row_dims = plot_config.get("row", [])

            # Filter out spatial dimensions from col/row (they're handled automatically)
            spatial_dims = [dim for dim in var.dims if is_spatial_dimension(dim)]
            col_dims = [dim for dim in col_dims if dim not in spatial_dims]
            row_dims = [dim for dim in row_dims if dim not in spatial_dims]

            if col_dims and row_dims:
                # Both col and row specified
                logger.info(
                    f"Creating plot with col={col_dims[0]} and row={row_dims[0]}"
                )
                var.plot(
                    col=col_dims[0], row=row_dims[0], figsize=(20, 15), cmap="viridis"
                )
            elif col_dims:
                # Only col specified
                logger.info(f"Creating plot with col={col_dims[0]}")
                var.plot(col=col_dims[0], figsize=(15, 10), cmap="viridis")
            elif row_dims:
                # Only row specified
                logger.info(f"Creating plot with row={row_dims[0]}")
                var.plot(row=row_dims[0], figsize=(15, 10), cmap="viridis")
            else:
                # No col/row specified, use default plotting
                logger.info("Creating default advanced plot")
                var.plot(figsize=(12, 8), cmap="viridis")
        else:
            # Detect plotting strategy for automatic plotting
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
                var.plot(
                    col=second_dim, row=first_dim, figsize=(20, 15), cmap="viridis"
                )

            else:
                # Default plotting behavior - let xarray decide the best method
                logger.info("Creating default plot using xarray's native plotting")

                if plot_type == "histogram":
                    var.plot.hist(figsize=(10, 6))
                else:
                    # Let xarray automatically choose the best plotting method
                    var.plot(figsize=(12, 8))

        # Apply tight layout
        plt.tight_layout()

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


def apply_advanced_plot_config(var, plot_config):
    """Apply advanced plotting configuration including subsetting."""
    subset = plot_config.get("subset", {})

    if not subset:
        logger.info("No subsetting specified, using full data")
        return var

    # Apply subsetting to each dimension
    subset_slices = {}
    for dim_name, dim_config in subset.items():
        if dim_name in var.dims:
            start = dim_config.get("start", 0)
            end = dim_config.get("end", var.sizes[dim_name] - 1)
            subset_slices[dim_name] = slice(start, end + 1)
            logger.info(f"Subsetting {dim_name} from {start} to {end}")

    if subset_slices:
        var = var.isel(subset_slices)
        logger.info(f"Applied subsetting, new shape: {var.shape}")

    return var


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
    plot_config = None

    # Parse plot configuration if provided
    if len(sys.argv) > 4:
        try:
            plot_config = json.loads(sys.argv[4])
        except json.JSONDecodeError:
            logger.error("Invalid JSON for plot configuration")
            print(json.dumps({"error": "Invalid plot configuration JSON"}))
            sys.exit(1)

    # Redirect logging to stderr so it doesn't interfere with the base64 output

    logging.basicConfig(
        stream=sys.stderr,
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
    )

    result = create_plot(file_path, variable_name, plot_type, plot_config)
    if result:
        print(result)
    else:
        print(json.dumps({"error": "Failed to create plot"}))


if __name__ == "__main__":
    main()
