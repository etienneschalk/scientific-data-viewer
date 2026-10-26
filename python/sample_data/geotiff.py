"""GeoTIFF samples (single/multi band, COG)."""

import importlib.util
import os
from datetime import datetime

import numpy as np
import xarray as xr

from sample_data.common import optional_pkg_available


def create_sample_geotiff():
    """Create a sample GeoTIFF file with satellite imagery data."""
    output_file = "sample_data.tif"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"🛰️ GeoTIFF file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("🛰️ Creating sample GeoTIFF file...")

    if not optional_pkg_available("rioxarray"):
        print("  ❌ rioxarray not available, skipping GeoTIFF file creation.")
        return None
    importlib.import_module("rioxarray")  # register xarray .rio accessor

    print("  ✅ rioxarray available, creating GeoTIFF file")

    # Create spatial dimensions
    height = 200
    width = 200

    # Create sample satellite imagery data
    np.random.seed(101)

    # Create RGB bands with more realistic satellite-like patterns
    x, y = np.meshgrid(np.linspace(0, 1, width), np.linspace(0, 1, height))

    # Create more complex patterns that look like satellite imagery
    red = np.clip(
        100
        + 80 * np.sin(2 * np.pi * x) * np.cos(2 * np.pi * y)
        + 30 * np.sin(8 * np.pi * x) * np.cos(8 * np.pi * y)
        + np.random.normal(0, 20, (height, width)),
        0,
        255,
    ).astype(np.uint8)

    green = np.clip(
        120
        + 60 * np.cos(3 * np.pi * x) * np.sin(3 * np.pi * y)
        + 25 * np.sin(6 * np.pi * x) * np.cos(6 * np.pi * y)
        + np.random.normal(0, 15, (height, width)),
        0,
        255,
    ).astype(np.uint8)

    blue = np.clip(
        80
        + 70 * np.sin(4 * np.pi * x) * np.cos(4 * np.pi * y)
        + 35 * np.sin(10 * np.pi * x) * np.cos(10 * np.pi * y)
        + np.random.normal(0, 18, (height, width)),
        0,
        255,
    ).astype(np.uint8)

    # Create dataset with proper geospatial information
    ds = xr.Dataset(
        {
            "red": (
                ["y", "x"],
                red,
                {
                    "long_name": "Red band",
                    "units": "DN",
                    "description": "Red channel of satellite imagery",
                },
            ),
            "green": (
                ["y", "x"],
                green,
                {
                    "long_name": "Green band",
                    "units": "DN",
                    "description": "Green channel of satellite imagery",
                },
            ),
            "blue": (
                ["y", "x"],
                blue,
                {
                    "long_name": "Blue band",
                    "units": "DN",
                    "description": "Blue channel of satellite imagery",
                },
            ),
        },
        coords={
            "x": (
                ["x"],
                np.linspace(-180, 180, width),
                {"long_name": "Longitude", "units": "degrees_east"},
            ),
            "y": (
                ["y"],
                np.linspace(90, -90, height),
                {"long_name": "Latitude", "units": "degrees_north"},
            ),
        },
    )

    # Add CRS information
    ds = ds.rio.write_crs("EPSG:4326")

    # Add global attributes
    ds.attrs = {
        "title": "Sample Satellite Imagery",
        "description": "Sample GeoTIFF file for testing VSCode extension",
        "institution": "Satellite Test Center",
        "source": "Generated for testing",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "Conventions": "CF-1.6",
        "spatial_resolution": "1 degree",
        "temporal_coverage": "2020-01-01",
    }

    # Save to GeoTIFF with compression
    try:
        ds.rio.to_raster(output_file, compress="lzw")
        print(f"✅ Created {output_file} (compressed GeoTIFF)")
    except Exception:
        # Fallback to uncompressed if compression fails
        ds.rio.to_raster(output_file)
        print(f"✅ Created {output_file} (uncompressed GeoTIFF)")

    return output_file


def create_sample_geotiff_tiff():
    """Create a sample GeoTIFF file with .tiff extension."""
    output_file = "sample_data.tiff"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"🛰️ GeoTIFF TIFF file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("🛰️ Creating sample GeoTIFF TIFF file...")

    if not optional_pkg_available("rioxarray"):
        print("  ❌ rioxarray not available, skipping GeoTIFF TIFF file creation.")
        return None
    importlib.import_module("rioxarray")  # register xarray .rio accessor

    print("  ✅ rioxarray available, creating GeoTIFF TIFF file")

    # Create spatial dimensions
    height = 100
    width = 100

    # Create sample satellite imagery data
    np.random.seed(808)

    # Create single band data
    data = np.random.randint(0, 255, (height, width), dtype=np.uint8)

    # Add spatial patterns
    x, y = np.meshgrid(np.linspace(0, 1, width), np.linspace(0, 1, height))
    data = np.clip(
        data + 100 * np.sin(5 * np.pi * x) * np.cos(5 * np.pi * y), 0, 255
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
        "title": "Sample GeoTIFF TIFF Data",
        "description": "Sample GeoTIFF file with .tiff extension for testing VSCode extension",
        "institution": "Satellite Test Center",
        "source": "Generated for testing",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
    }

    # Save to GeoTIFF
    ds.rio.to_raster(output_file, driver="GTiff")
    print(f"✅ Created {output_file}")
    return output_file


def create_sample_geotiff_geotiff():
    """Create a sample GeoTIFF file with .geotiff extension."""
    output_file = "sample_data.geotiff"

    # Check if file already exists
    if os.path.exists(output_file):
        print(
            f"🛰️ GeoTIFF GEOTIFF file {output_file} already exists. Skipping creation."
        )
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("🛰️ Creating sample GeoTIFF GEOTIFF file...")

    if not optional_pkg_available("rioxarray"):
        print("  ❌ rioxarray not available, skipping GeoTIFF GEOTIFF file creation.")
        return None
    importlib.import_module("rioxarray")  # register xarray .rio accessor

    print("  ✅ rioxarray available, creating GeoTIFF GEOTIFF file")

    # Create spatial dimensions
    height = 80
    width = 80

    # Create sample satellite imagery data
    np.random.seed(909)

    # Create single band data
    data = np.random.randint(0, 255, (height, width), dtype=np.uint8)

    # Add spatial patterns
    x, y = np.meshgrid(np.linspace(0, 1, width), np.linspace(0, 1, height))
    data = np.clip(
        data + 80 * np.sin(3 * np.pi * x) * np.cos(3 * np.pi * y), 0, 255
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
    ds = ds.rio.write_crs("EPSG:4326")  # WGS84

    # Add global attributes
    ds.attrs = {
        "title": "Sample GeoTIFF GEOTIFF",
        "description": "Sample GeoTIFF file for testing VSCode extension",
        "institution": "Test Center",
        "source": "Generated for testing",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "Conventions": "CF-1.6",
        "spatial_resolution": "0.1 degrees",
        "temporal_coverage": "2020-01-01",
    }

    # Save to GeoTIFF
    try:
        ds.rio.to_raster(output_file, compress="lzw")
        print(f"✅ Created {output_file} (compressed GeoTIFF)")
    except Exception:
        # Fallback to uncompressed if compression fails
        ds.rio.to_raster(output_file)
        print(f"✅ Created {output_file} (uncompressed GeoTIFF)")

    return output_file


def create_sample_multiband_geotiff():
    """Create a sample multi-band GeoTIFF file that will be loaded as 3D DataArray."""
    output_file = "sample_multiband.tif"

    # Check if file already exists
    if os.path.exists(output_file):
        print(
            f"🛰️ Multi-band GeoTIFF file {output_file} already exists. Skipping creation."
        )
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("🛰️ Creating sample multi-band GeoTIFF file...")

    if not optional_pkg_available("rioxarray"):
        print(
            "  ❌ rioxarray not available, skipping multi-band GeoTIFF file creation."
        )
        return None
    importlib.import_module("rioxarray")  # register xarray .rio accessor

    print("  ✅ rioxarray available, creating multi-band GeoTIFF file")

    # Create spatial dimensions
    height = 100
    width = 100
    n_bands = 4

    # Create sample multi-band satellite imagery data
    np.random.seed(42)

    # Create 3D data array (band, y, x) - this simulates what rioxarray loads
    data = np.random.randint(0, 255, (n_bands, height, width), dtype=np.uint8)

    # Add different patterns for each band
    x, y = np.meshgrid(np.linspace(0, 1, width), np.linspace(0, 1, height))

    for i in range(n_bands):
        # Create different patterns for each band
        pattern = np.clip(
            100
            + 50 * np.sin((i + 1) * 2 * np.pi * x) * np.cos((i + 1) * 2 * np.pi * y)
            + 30 * np.sin((i + 1) * 4 * np.pi * x) * np.cos((i + 1) * 4 * np.pi * y)
            + np.random.normal(0, 15, (height, width)),
            0,
            255,
        ).astype(np.uint8)
        data[i] = pattern

    # Create separate band variables for saving as GeoTIFF
    band_vars = {}
    for i in range(n_bands):
        band_name = f"band_{i + 1}"
        band_data = data[i]  # 2D data for each band
        band_vars[band_name] = (
            ["y", "x"],
            band_data,
            {
                "long_name": f"Band {i + 1}",
                "units": "DN",
                "description": f"Satellite band {i + 1} data",
            },
        )

    # Create dataset with separate band variables
    ds = xr.Dataset(
        band_vars,
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
        "title": "Sample Multi-band GeoTIFF",
        "description": "Sample multi-band GeoTIFF file for testing band-to-variables conversion",
        "institution": "Test Center",
        "source": "Generated for testing",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "Conventions": "CF-1.6",
        "spatial_resolution": "0.2 degrees",
        "temporal_coverage": "2020-01-01",
        "number_of_bands": n_bands,
    }

    # Save to GeoTIFF
    try:
        ds.rio.to_raster(output_file, compress="lzw")
        print(f"✅ Created {output_file} (compressed multi-band GeoTIFF)")
    except Exception:
        # Fallback to uncompressed if compression fails
        ds.rio.to_raster(output_file)
        print(f"✅ Created {output_file} (uncompressed multi-band GeoTIFF)")

    return output_file


def create_sample_geotiff_cog():
    """Create a Cloud Optimized GeoTIFF (v0.13 P2.3 COG label)."""
    output_file = "sample_data_cog.tif"

    if os.path.exists(output_file):
        print(f"🛰️ COG file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("☁️ Creating Cloud Optimized GeoTIFF (COG) sample...")

    if not optional_pkg_available("rasterio"):
        print("  ❌ rasterio not available, skipping COG sample.")
        return None

    import rasterio
    from rasterio.transform import from_origin

    height, width = 64, 64
    data = np.random.default_rng(99).integers(0, 255, (height, width), dtype=np.uint8)

    with rasterio.open(
        output_file,
        "w",
        driver="COG",
        height=height,
        width=width,
        count=1,
        dtype="uint8",
        crs="EPSG:4326",
        transform=from_origin(-1.0, 1.0, 2.0 / width, 2.0 / height),
        compress="deflate",
    ) as dst:
        dst.write(data, 1)
        dst.update_tags(title="Sample COG", description="v0.13 COG format label test")

    print(f"✅ Created {output_file} (Cloud Optimized GeoTIFF)")
    return output_file
