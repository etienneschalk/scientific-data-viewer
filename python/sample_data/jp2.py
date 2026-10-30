"""JPEG-2000 samples."""

import importlib.util
import os

import numpy as np
import xarray as xr

from sample_data.common import CREATION_DATETIME, optional_pkg_available


def create_sample_jp2():
    """Create a sample JPEG-2000 file with satellite data."""
    output_file = "sample_data.jp2"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"📸 JPEG-2000 file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("📸 Creating sample JPEG-2000 file...")

    if not optional_pkg_available("rioxarray"):
        print("  ❌ rioxarray not available, skipping JPEG-2000 file creation.")
        return None
    importlib.import_module("rioxarray")  # register xarray .rio accessor

    # Create spatial dimensions
    height = 50
    width = 50

    # Create sample satellite data
    np.random.seed(202)

    # Create single band data
    data = np.random.randint(0, 255, (height, width), dtype=np.uint8)

    # Add spatial patterns
    x, y = np.meshgrid(np.linspace(0, 1, width), np.linspace(0, 1, height))
    data = np.clip(
        data + 100 * np.sin(10 * np.pi * x) * np.cos(10 * np.pi * y), 0, 255
    ).astype(np.uint8)

    # Create dataset
    ds = xr.Dataset(
        {
            "band1": (["y", "x"], data, {"long_name": "Satellite band", "units": "DN"}),
        },
        coords={
            "x": (
                ["x"],
                np.linspace(-10, 10, width),
                {"long_name": "X coordinate", "units": "m"},
            ),
            "y": (
                ["y"],
                np.linspace(10, -10, height),
                {"long_name": "Y coordinate", "units": "m"},
            ),
        },
    )

    # Add CRS information
    ds = ds.rio.write_crs("EPSG:3857")  # Web Mercator

    # Add global attributes
    ds.attrs = {
        "title": "Sample JPEG-2000 Data",
        "description": "Sample JPEG-2000 file for testing VSCode extension",
        "institution": "Satellite Test Center",
        "source": "Generated for testing",
        "history": f"Created on {CREATION_DATETIME.strftime('%Y-%m-%d %H:%M:%S')}",
    }

    # Save to JPEG-2000
    ds.rio.to_raster(output_file)
    print(f"✅ Created {output_file}")
    return output_file


def create_sample_jp2_jpeg2000():
    """Create a sample JPEG-2000 file with .jpeg2000 extension."""
    output_file = "sample_data.jpeg2000"

    # Check if file already exists
    if os.path.exists(output_file):
        print(
            f"📸 JPEG-2000 JPEG2000 file {output_file} already exists. Skipping creation."
        )
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("📸 Creating sample JPEG-2000 JPEG2000 file...")

    if not optional_pkg_available("rioxarray"):
        print(
            "  ❌ rioxarray not available, skipping JPEG-2000 JPEG2000 file creation."
        )
        return None
    importlib.import_module("rioxarray")  # register xarray .rio accessor

    # Create spatial dimensions
    height = 40
    width = 40

    # Create sample satellite data
    np.random.seed(1010)

    # Create single band data
    data = np.random.randint(0, 255, (height, width), dtype=np.uint8)

    # Add spatial patterns
    x, y = np.meshgrid(np.linspace(0, 1, width), np.linspace(0, 1, height))
    data = np.clip(
        data + 50 * np.sin(8 * np.pi * x) * np.cos(8 * np.pi * y), 0, 255
    ).astype(np.uint8)

    # Create dataset
    ds = xr.Dataset(
        {
            "band1": (["y", "x"], data, {"long_name": "Satellite band", "units": "DN"}),
        },
        coords={
            "x": (
                ["x"],
                np.linspace(-5, 5, width),
                {"long_name": "X coordinate", "units": "m"},
            ),
            "y": (
                ["y"],
                np.linspace(5, -5, height),
                {"long_name": "Y coordinate", "units": "m"},
            ),
        },
    )

    # Add CRS information
    ds = ds.rio.write_crs("EPSG:3857")  # Web Mercator

    # Add global attributes
    ds.attrs = {
        "title": "Sample JPEG-2000 JPEG2000 Data",
        "description": "Sample JPEG-2000 file with .jpeg2000 extension for testing VSCode extension",
        "institution": "Satellite Test Center",
        "source": "Generated for testing",
        "history": f"Created on {CREATION_DATETIME.strftime('%Y-%m-%d %H:%M:%S')}",
    }

    # Save to JPEG-2000
    ds.rio.to_raster(output_file, driver="JPEG")
    print(f"✅ Created {output_file}")
    return output_file
