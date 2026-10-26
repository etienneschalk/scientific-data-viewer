"""Disposable files used to test file deletion."""

import os
from datetime import datetime

import numpy as np
import xarray as xr

from sample_data.common import optional_pkg_available


def cleanup_disposable_files():
    """Clean up existing disposable files before creating new ones."""
    disposable_dir = "disposable"

    if os.path.exists(disposable_dir):
        print(
            f"🧹 Cleaning up existing disposable files in {disposable_dir}/ directory..."
        )
        import shutil

        shutil.rmtree(disposable_dir)
        print(f"  ✅ Cleaned up {disposable_dir}/ directory")

    # Recreate the directory
    os.makedirs(disposable_dir, exist_ok=True)


def create_disposable_netcdf_files():
    """Create 10 small NetCDF files in a disposable subdirectory for testing deletion."""
    disposable_dir = "disposable"

    # Create disposable directory
    os.makedirs(disposable_dir, exist_ok=True)

    print(f"🗑️ Creating 10 small NetCDF files in {disposable_dir}/ directory...")

    created_files = []

    for i in range(10):
        output_file = os.path.join(disposable_dir, f"disposable_file_{i:02d}.nc")

        # Check if file already exists
        if os.path.exists(output_file):
            print(
                f"  📄 Disposable file {output_file} already exists. Skipping creation."
            )
            created_files.append(output_file)
            continue

        # Create very small dimensions to keep files small
        time = np.arange(0, 2, 1)  # 2 time steps
        lat = np.linspace(-10, 10, 10)  # 10 latitude points
        lon = np.linspace(-10, 10, 10)  # 10 longitude points

        # Create sample data
        np.random.seed(2000 + i)
        time_3d = time[:, np.newaxis, np.newaxis]
        data = (
            10
            + 5 * np.sin(2 * np.pi * time_3d / 2)
            + np.random.normal(0, 1, (2, 10, 10))
        )

        # Create dataset
        ds = xr.Dataset(
            {
                f"variable_{i:02d}": (
                    ["time", "lat", "lon"],
                    data,
                    {
                        "long_name": f"Disposable Variable {i:02d}",
                        "units": "1",
                        "description": f"Small test variable {i:02d} for deletion testing",
                    },
                ),
            },
            coords={
                "time": (
                    ["time"],
                    time,
                    {"long_name": "Time", "units": "days since 2020-01-01"},
                ),
                "lat": (
                    ["lat"],
                    lat,
                    {"long_name": "Latitude", "units": "degrees_north"},
                ),
                "lon": (
                    ["lon"],
                    lon,
                    {"long_name": "Longitude", "units": "degrees_east"},
                ),
            },
        )

        # Add global attributes
        ds.attrs = {
            "title": f"Disposable Test File {i:02d}",
            "description": f"Small disposable NetCDF file {i:02d} for testing file deletion",
            "institution": "Test Center",
            "source": "Generated for testing deletion",
            "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "Conventions": "CF-1.6",
            "test_purpose": "disposable_deletion_testing",
            "file_number": i,
        }

        # Save to NetCDF
        ds.to_netcdf(output_file)
        created_files.append(output_file)
        print(f"  ✅ Created {output_file}")

    print(
        f"✅ Created {len(created_files)} disposable files in {disposable_dir}/ directory"
    )
    return created_files


def create_disposable_zarr_files():
    """Create 10 small Zarr files in a disposable subdirectory for testing deletion."""
    disposable_dir = "disposable"

    # Create disposable directory
    os.makedirs(disposable_dir, exist_ok=True)

    print(f"🗑️ Creating 10 small Zarr files in {disposable_dir}/ directory...")

    if not optional_pkg_available("zarr"):
        print(
            "  ❌ zarr or xarray not available, skipping disposable Zarr file creation."
        )
        return []

    created_files = []

    for i in range(10):
        output_file = os.path.join(disposable_dir, f"disposable_file_{i:02d}.zarr")

        # Check if file already exists
        if os.path.exists(output_file):
            print(
                f"  📦 Disposable Zarr file {output_file} already exists. Skipping creation."
            )
            created_files.append(output_file)
            continue

        # Create very small dimensions to keep files small
        time = np.arange(0, 2, 1)  # 2 time steps
        lat = np.linspace(-5, 5, 8)  # 8 latitude points
        lon = np.linspace(-5, 5, 8)  # 8 longitude points

        # Create sample data
        np.random.seed(3000 + i)
        time_3d = time[:, np.newaxis, np.newaxis]
        data = (
            5
            + 3 * np.sin(2 * np.pi * time_3d / 2)
            + np.random.normal(0, 0.5, (2, 8, 8))
        )

        # Create dataset
        ds = xr.Dataset(
            {
                f"zarr_variable_{i:02d}": (
                    ["time", "lat", "lon"],
                    data,
                    {
                        "long_name": f"Disposable Zarr Variable {i:02d}",
                        "units": "1",
                        "description": f"Small test Zarr variable {i:02d} for deletion testing",
                    },
                ),
            },
            coords={
                "time": (
                    ["time"],
                    time,
                    {"long_name": "Time", "units": "days since 2020-01-01"},
                ),
                "lat": (
                    ["lat"],
                    lat,
                    {"long_name": "Latitude", "units": "degrees_north"},
                ),
                "lon": (
                    ["lon"],
                    lon,
                    {"long_name": "Longitude", "units": "degrees_east"},
                ),
            },
        )

        # Add global attributes
        ds.attrs = {
            "title": f"Disposable Zarr Test File {i:02d}",
            "description": f"Small disposable Zarr file {i:02d} for testing file deletion",
            "institution": "Test Center",
            "source": "Generated for testing deletion",
            "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "Conventions": "CF-1.6",
            "test_purpose": "disposable_deletion_testing",
            "file_number": i,
            "format": "zarr",
        }

        # Save to Zarr
        ds.to_zarr(output_file)
        created_files.append(output_file)
        print(f"  ✅ Created {output_file}")

    print(
        f"✅ Created {len(created_files)} disposable Zarr files in {disposable_dir}/ directory"
    )
    return created_files
