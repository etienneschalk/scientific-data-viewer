"""HDF5 samples."""

import os
from datetime import datetime

import numpy as np
import xarray as xr


def create_sample_hdf5():
    """Create a sample HDF5 file with satellite data."""
    output_file = "sample_data.h5"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"🛰️ HDF5 file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("🛰️ Creating sample HDF5 file...")

    # Create dimensions
    time = np.arange(0, 30, 1)  # 30 days
    lat = np.linspace(-60, 60, 120)
    lon = np.linspace(-180, 180, 240)

    # Create sample satellite data
    np.random.seed(456)
    # Reshape time for broadcasting
    time_3d = time[:, np.newaxis, np.newaxis]
    reflectance = (
        0.1
        + 0.2 * np.sin(2 * np.pi * time_3d / 30)
        + np.random.normal(0, 0.05, (30, 120, 240))
    )
    cloud_mask = np.random.randint(0, 2, (30, 120, 240))

    # Create dataset
    ds = xr.Dataset(
        {
            "reflectance": (
                ["time", "lat", "lon"],
                reflectance,
                {
                    "long_name": "Surface Reflectance",
                    "units": "1",
                    "valid_range": [0, 1],
                },
            ),
            "cloud_mask": (
                ["time", "lat", "lon"],
                cloud_mask,
                {
                    "long_name": "Cloud Mask",
                    "units": "1",
                    "flag_values": [0, 1],
                    "flag_meanings": "clear cloudy",
                },
            ),
        },
        coords={
            "time": (
                ["time"],
                time,
                {"long_name": "Time", "units": "days since 2020-01-01"},
            ),
            "lat": (["lat"], lat, {"long_name": "Latitude", "units": "degrees_north"}),
            "lon": (["lon"], lon, {"long_name": "Longitude", "units": "degrees_east"}),
        },
    )

    # Add global attributes
    ds.attrs = {
        "title": "Sample Satellite Data",
        "description": "Sample HDF5 file for testing VSCode extension",
        "institution": "Satellite Test Center",
        "source": "Generated for testing",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "Conventions": "CF-1.6",
    }

    # Save to HDF5
    ds.to_netcdf(output_file, engine="h5netcdf")
    print(f"✅ Created {output_file}")
    return output_file


def create_sample_hdf5_hdf5():
    """Create a sample HDF5 file with .hdf5 extension."""
    output_file = "sample_data.hdf5"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"🛰️ HDF5 HDF5 file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("🛰️ Creating sample HDF5 HDF5 file...")

    # Create dimensions
    time = np.arange(0, 20, 1)  # 20 days
    lat = np.linspace(-60, 60, 60)
    lon = np.linspace(-180, 180, 120)

    # Create sample satellite data
    np.random.seed(505)
    time_3d = time[:, np.newaxis, np.newaxis]
    cloud_fraction = np.clip(
        0.1
        + 0.3 * np.sin(2 * np.pi * time_3d / 20)
        + np.random.normal(0, 0.1, (20, 60, 120)),
        0,
        1,
    )

    # Create dataset
    ds = xr.Dataset(
        {
            "cloud_fraction": (
                ["time", "lat", "lon"],
                cloud_fraction,
                {
                    "long_name": "Cloud Fraction",
                    "units": "1",
                    "valid_range": [0, 1],
                },
            ),
        },
        coords={
            "time": (
                ["time"],
                time,
                {"long_name": "Time", "units": "days since 2020-01-01"},
            ),
            "lat": (["lat"], lat, {"long_name": "Latitude", "units": "degrees_north"}),
            "lon": (["lon"], lon, {"long_name": "Longitude", "units": "degrees_east"}),
        },
    )

    # Add global attributes
    ds.attrs = {
        "title": "Sample HDF5 HDF5 Data",
        "description": "Sample HDF5 file with .hdf5 extension for testing VSCode extension",
        "institution": "Satellite Test Center",
        "source": "Generated for testing",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "Conventions": "CF-1.6",
    }

    # Save to HDF5
    ds.to_netcdf(output_file, engine="h5netcdf")
    print(f"✅ Created {output_file}")
    return output_file
