#!/usr/bin/env python3
"""
Script to create sample scientific data files for testing the VSCode extension.
This script creates NetCDF, Zarr, and HDF5 files with sample climate data.
"""

import numpy as np
import xarray as xr
import os
from datetime import datetime, timedelta


def create_sample_netcdf():
    """Create a sample NetCDF file with climate data."""
    output_file = "sample_data.nc"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"NetCDF file {output_file} already exists. Skipping creation.")
        print("  To regenerate, please delete the existing file first.")
        return output_file

    print("Creating sample NetCDF file...")

    # Create time dimension
    time = np.arange(0, 365, 1)
    dates = [datetime(2020, 1, 1) + timedelta(days=int(t)) for t in time]

    # Create lat/lon grid
    lat = np.linspace(-90, 90, 180)
    lon = np.linspace(-180, 180, 360)

    # Create sample data
    np.random.seed(42)  # For reproducible data
    # Reshape time for broadcasting
    time_3d = time[:, np.newaxis, np.newaxis]
    temperature = (
        15
        + 10 * np.sin(2 * np.pi * time_3d / 365)
        + np.random.normal(0, 2, (365, 180, 360))
    )
    pressure = (
        1013.25
        + 20 * np.sin(2 * np.pi * time_3d / 365)
        + np.random.normal(0, 5, (365, 180, 360))
    )

    # Create dataset
    ds = xr.Dataset(
        {
            "temperature": (
                ["time", "lat", "lon"],
                temperature,
                {
                    "long_name": "Surface Temperature",
                    "units": "Celsius",
                    "standard_name": "air_temperature",
                },
            ),
            "pressure": (
                ["time", "lat", "lon"],
                pressure,
                {
                    "long_name": "Surface Pressure",
                    "units": "hPa",
                    "standard_name": "surface_air_pressure",
                },
            ),
        },
        coords={
            "time": (["time"], dates, {"long_name": "Time", "standard_name": "time"}),
            "lat": (
                ["lat"],
                lat,
                {
                    "long_name": "Latitude",
                    "units": "degrees_north",
                    "standard_name": "latitude",
                },
            ),
            "lon": (
                ["lon"],
                lon,
                {
                    "long_name": "Longitude",
                    "units": "degrees_east",
                    "standard_name": "longitude",
                },
            ),
        },
    )

    # Add global attributes
    ds.attrs = {
        "title": "Sample Climate Data",
        "description": "Sample NetCDF file for testing VSCode extension",
        "institution": "Test Institution",
        "source": "Generated for testing",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "Conventions": "CF-1.6",
    }

    # Save to file
    ds.to_netcdf(output_file)
    print(f"Created {output_file}")
    return output_file


def create_sample_zarr():
    """Create a sample Zarr file with ocean data."""
    output_file = "sample_data.zarr"

    # Check if directory already exists
    if os.path.exists(output_file):
        print(f"Zarr file {output_file} already exists. Skipping creation.")
        print("  To regenerate, please delete the existing directory first.")
        return output_file

    print("Creating sample Zarr file...")

    # Create dimensions
    time = np.arange(0, 100, 1)
    depth = np.array([0, 10, 20, 50, 100, 200, 500, 1000])
    lat = np.linspace(-80, 80, 160)
    lon = np.linspace(-180, 180, 320)

    # Create sample ocean data
    np.random.seed(123)
    # Reshape time for broadcasting
    time_4d = time[:, np.newaxis, np.newaxis, np.newaxis]
    salinity = (
        35
        + 2 * np.sin(2 * np.pi * time_4d / 100)
        + np.random.normal(0, 0.5, (100, 8, 160, 320))
    )
    temperature = (
        20
        - 10 * np.sin(2 * np.pi * time_4d / 100)
        + np.random.normal(0, 1, (100, 8, 160, 320))
    )

    # Create dataset
    ds = xr.Dataset(
        {
            "salinity": (
                ["time", "depth", "lat", "lon"],
                salinity,
                {
                    "long_name": "Sea Water Salinity",
                    "units": "psu",
                    "standard_name": "sea_water_salinity",
                },
            ),
            "temperature": (
                ["time", "depth", "lat", "lon"],
                temperature,
                {
                    "long_name": "Sea Water Temperature",
                    "units": "Celsius",
                    "standard_name": "sea_water_temperature",
                },
            ),
        },
        coords={
            "time": (
                ["time"],
                time,
                {"long_name": "Time", "units": "days since 2020-01-01"},
            ),
            "depth": (
                ["depth"],
                depth,
                {"long_name": "Depth", "units": "m", "positive": "down"},
            ),
            "lat": (["lat"], lat, {"long_name": "Latitude", "units": "degrees_north"}),
            "lon": (["lon"], lon, {"long_name": "Longitude", "units": "degrees_east"}),
        },
    )

    # Add global attributes
    ds.attrs = {
        "title": "Sample Ocean Data",
        "description": "Sample Zarr file for testing VSCode extension",
        "institution": "Ocean Test Institute",
        "source": "Generated for testing",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
    }

    # Save to Zarr
    ds.to_zarr(output_file)
    print(f"Created {output_file}")
    return output_file


def create_sample_hdf5():
    """Create a sample HDF5 file with satellite data."""
    output_file = "sample_data.h5"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"HDF5 file {output_file} already exists. Skipping creation.")
        print("  To regenerate, please delete the existing file first.")
        return output_file

    print("Creating sample HDF5 file...")

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
    print(f"Created {output_file}")
    return output_file


def main():
    """Create all sample data files."""
    print("Creating sample scientific data files for VSCode extension testing...")
    print("=" * 60)

    # Create output directory
    os.makedirs("sample-data", exist_ok=True)
    os.chdir("sample-data")

    try:
        # Create sample files
        netcdf_file = create_sample_netcdf()
        zarr_file = create_sample_zarr()
        hdf5_file = create_sample_hdf5()

        print("=" * 60)
        print("Sample data files created successfully!")
        print(f"- {netcdf_file} (NetCDF format)")
        print(f"- {zarr_file} (Zarr format)")
        print(f"- {hdf5_file} (HDF5 format)")
        print("\nYou can now test the VSCode extension with these files.")

    except Exception as e:
        print(f"Error creating sample data: {e}")

        import traceback

        print(traceback.format_exc())
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
