#!/usr/bin/env python3
"""
Script to create sample scientific data files for testing the VSCode extension.
This script creates sample files for all supported formats: NetCDF, HDF5, Zarr, GRIB, GeoTIFF, JPEG-2000, and Sentinel-1 SAFE.
"""

import numpy as np
import xarray as xr
import os
import tempfile
import shutil
from datetime import datetime, timedelta
import warnings

# Suppress warnings for cleaner output
warnings.filterwarnings("ignore")


def create_sample_netcdf():
    """Create a sample NetCDF file with climate data."""
    output_file = "sample_data.nc"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"📄 NetCDF file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("🌡️ Creating sample NetCDF file...")

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
    print(f"✅ Created {output_file}")
    return output_file


def create_sample_zarr_single_group_from_dataset():
    """Create a sample Zarr file with ocean data."""
    output_file = "sample_zarr_single_group_from_dataset.zarr"

    # Check if directory already exists
    if os.path.exists(output_file):
        print(f"📦 Zarr file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing directory first.")
        return output_file

    print("🌊 Creating sample Zarr file...")

    try:
        import zarr
    except ImportError:
        print("  ❌ zarr not available, skipping Zarr file creation.")
        return None

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
    print(f"✅ Created {output_file}")
    return output_file


def create_sample_zarr_with_nested_groups_from_datatree():
    """Create a sample Zarr file with nested groups using xr.DataTree and to_zarr method."""
    output_file = "sample_zarr_nested_groups_from_datatree.zarr"

    # Check if directory already exists
    if os.path.exists(output_file):
        print(
            f"📦 xr.DataTree Zarr file {output_file} already exists. Skipping creation."
        )
        print("  🔄 To regenerate, please delete the existing directory first.")
        return output_file

    print("🌊 Creating sample Zarr file with xr.DataTree and nested groups...")

    try:
        import zarr
        import xarray as xr
    except ImportError:
        print(
            "  ❌ zarr or datatree not available, skipping xr.DataTree Zarr file creation."
        )
        return None

    # Create dimensions
    time = np.arange(0, 30, 1)
    depth = np.array([0, 10, 20, 50, 100, 200])
    lat = np.linspace(-60, 60, 60)
    lon = np.linspace(-180, 180, 120)

    # Create sample data
    np.random.seed(789)
    time_4d = time[:, np.newaxis, np.newaxis, np.newaxis]

    # Create temperature data
    temperature = (
        20
        - 10 * np.sin(2 * np.pi * time_4d / 30)
        + np.random.normal(0, 1, (30, 6, 60, 120))
    )

    # Create salinity data
    salinity = (
        35
        + 2 * np.sin(2 * np.pi * time_4d / 30)
        + np.random.normal(0, 0.5, (30, 6, 60, 120))
    )

    # Create datasets for different groups
    # Root level dataset
    root_ds = xr.Dataset(
        {
            "metadata": (
                ["time"],
                np.arange(30),
                {"long_name": "Metadata index", "units": "1"},
            ),
        },
        coords={
            "time": (
                ["time"],
                time,
                {"long_name": "Time", "units": "days since 2020-01-01"},
            ),
        },
    )
    root_ds.attrs = {
        "title": "Sample xr.DataTree Ocean Data",
        "description": "Sample xr.DataTree Zarr file for testing VSCode extension",
        "institution": "Ocean Test Institute",
        "source": "Generated for testing",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "Conventions": "CF-1.6",
    }

    # Ocean data group
    ocean_ds = xr.Dataset(
        {
            "temperature": (
                ["time", "depth", "lat", "lon"],
                temperature,
                {
                    "long_name": "Sea Water Temperature",
                    "units": "Celsius",
                    "standard_name": "sea_water_temperature",
                    "valid_range": [-2, 35],
                },
            ),
            "salinity": (
                ["time", "depth", "lat", "lon"],
                salinity,
                {
                    "long_name": "Sea Water Salinity",
                    "units": "psu",
                    "standard_name": "sea_water_salinity",
                    "valid_range": [0, 40],
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
    ocean_ds.attrs = {
        "description": "Oceanographic measurements",
        "data_type": "oceanographic",
        "collection_date": "2020-01-01",
    }

    # Physical properties subgroup
    physical_ds = xr.Dataset(
        {
            "temperature_anomaly": (
                ["time", "depth", "lat", "lon"],
                temperature - 20,  # Anomaly from mean
                {
                    "long_name": "Temperature Anomaly",
                    "units": "Celsius",
                    "description": "Temperature deviation from climatological mean",
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
    physical_ds.attrs = {
        "description": "Physical oceanographic properties",
        "measurement_type": "in_situ",
    }

    # Chemical properties subgroup
    chemical_ds = xr.Dataset(
        {
            "nitrate": (
                ["time", "depth", "lat", "lon"],
                np.random.exponential(2, (30, 6, 60, 120)).astype("f4"),
                {
                    "long_name": "Nitrate Concentration",
                    "units": "μmol/L",
                    "standard_name": "mole_concentration_of_nitrate_in_sea_water",
                },
            ),
            "phosphate": (
                ["time", "depth", "lat", "lon"],
                np.random.exponential(0.5, (30, 6, 60, 120)).astype("f4"),
                {
                    "long_name": "Phosphate Concentration",
                    "units": "μmol/L",
                    "standard_name": "mole_concentration_of_phosphate_in_sea_water",
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
    chemical_ds.attrs = {
        "description": "Chemical oceanographic properties",
        "measurement_type": "laboratory",
    }

    # Quality control subgroup
    qc_ds = xr.Dataset(
        {
            "temperature_qc": (
                ["time", "depth", "lat", "lon"],
                np.random.randint(0, 4, (30, 6, 60, 120), dtype="i1"),
                {
                    "long_name": "Temperature Quality Control",
                    "units": "1",
                    "flag_values": [0, 1, 2, 3],
                    "flag_meanings": "good questionable bad missing",
                },
            ),
            "salinity_qc": (
                ["time", "depth", "lat", "lon"],
                np.random.randint(0, 4, (30, 6, 60, 120), dtype="i1"),
                {
                    "long_name": "Salinity Quality Control",
                    "units": "1",
                    "flag_values": [0, 1, 2, 3],
                    "flag_meanings": "good questionable bad missing",
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
    qc_ds.attrs = {
        "description": "Quality control flags and information",
        "qc_version": "1.2",
    }

    # Create xr.DataTree structure
    dt = xr.DataTree(name="root")
    dt["root"] = root_ds
    dt["root/ocean_data"] = ocean_ds
    dt["root/ocean_data/physical_properties"] = physical_ds
    dt["root/ocean_data/chemical_properties"] = chemical_ds
    dt["root/ocean_data/quality_control"] = qc_ds

    # Save to Zarr using xr.DataTree's to_zarr method
    dt.to_zarr(output_file, mode="w")
    print(f"✅ Created {output_file} with xr.DataTree structure")
    return output_file


def create_sample_zarr_with_nested_groups_from_zarr():
    """Create a sample Zarr file with nested groups (3+ levels deep)."""
    output_file = "sample_zarr_nested_groups_from_zarr.zarr"

    # Check if directory already exists
    if os.path.exists(output_file):
        print(f"📦 Nested Zarr file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing directory first.")
        return output_file

    print("🌊 Creating sample Zarr file with nested groups...")

    try:
        import zarr
    except ImportError:
        print("  ❌ zarr not available, skipping nested Zarr file creation.")
        return None

    # Create the root group
    root = zarr.open(output_file, mode="w")

    # Add global attributes to root
    root.attrs.update(
        {
            "title": "Sample Nested Zarr Data",
            "description": "Sample Zarr file with nested groups for testing VSCode extension",
            "institution": "Ocean Test Institute",
            "source": "Generated for testing",
            "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "Conventions": "CF-1.6",
        }
    )

    # Create dimensions
    time = np.arange(0, 50, 1)
    depth = np.array([0, 10, 20, 50, 100, 200])
    lat = np.linspace(-60, 60, 80)
    lon = np.linspace(-180, 180, 160)

    # Level 1: Ocean data group
    ocean_group = root.create_group("ocean_data")
    ocean_group.attrs.update(
        {
            "description": "Oceanographic measurements",
            "data_type": "oceanographic",
            "collection_date": "2020-01-01",
        }
    )

    # Level 2: Physical properties group
    physical_group = ocean_group.create_group("physical_properties")
    physical_group.attrs.update(
        {
            "description": "Physical oceanographic properties",
            "measurement_type": "in_situ",
        }
    )

    # Level 3: Temperature data group
    temp_group = physical_group.create_group("temperature")
    temp_group.attrs.update(
        {
            "description": "Sea water temperature measurements",
            "units": "Celsius",
            "standard_name": "sea_water_temperature",
        }
    )

    # Create temperature data
    np.random.seed(456)
    time_4d = time[:, np.newaxis, np.newaxis, np.newaxis]
    temperature = (
        20
        - 10 * np.sin(2 * np.pi * time_4d / 50)
        + np.random.normal(0, 1, (50, 6, 80, 160))
    )

    # Add temperature array to the deepest group
    temp_array = temp_group.create_array(
        "values",
        data=temperature,
        chunks=(10, 2, 20, 40),
    )
    temp_array.attrs.update(
        {
            "long_name": "Sea Water Temperature",
            "units": "Celsius",
            "standard_name": "sea_water_temperature",
            "valid_range": [-2, 35],
        }
    )

    # Add coordinates to the temperature group
    temp_group.create_array("time", data=time)
    temp_group.create_array("depth", data=depth)
    temp_group.create_array("latitude", data=lat)
    temp_group.create_array("longitude", data=lon)

    # Level 3: Salinity data group (same level as temperature)
    salinity_group = physical_group.create_group("salinity")
    salinity_group.attrs.update(
        {
            "description": "Sea water salinity measurements",
            "units": "psu",
            "standard_name": "sea_water_salinity",
        }
    )

    # Create salinity data
    salinity = (
        35
        + 2 * np.sin(2 * np.pi * time_4d / 50)
        + np.random.normal(0, 0.5, (50, 6, 80, 160))
    )

    salinity_array = salinity_group.create_array(
        "values",
        data=salinity,
        chunks=(10, 2, 20, 40),
    )
    salinity_array.attrs.update(
        {
            "long_name": "Sea Water Salinity",
            "units": "psu",
            "standard_name": "sea_water_salinity",
            "valid_range": [0, 40],
        }
    )

    # Add coordinates to the salinity group
    salinity_group.create_array("time", data=time)
    salinity_group.create_array("depth", data=depth)
    salinity_group.create_array("latitude", data=lat)
    salinity_group.create_array("longitude", data=lon)

    # Level 2: Chemical properties group
    chemical_group = ocean_group.create_group("chemical_properties")
    chemical_group.attrs.update(
        {
            "description": "Chemical oceanographic properties",
            "measurement_type": "laboratory",
        }
    )

    # Level 3: Nutrients group
    nutrients_group = chemical_group.create_group("nutrients")
    nutrients_group.attrs.update(
        {"description": "Nutrient concentrations", "analysis_method": "colorimetric"}
    )

    # Create nutrient data (nitrate, phosphate, silicate)
    nitrate = np.random.exponential(2, (50, 6, 80, 160)).astype("f4")
    phosphate = np.random.exponential(0.5, (50, 6, 80, 160)).astype("f4")
    silicate = np.random.exponential(10, (50, 6, 80, 160)).astype("f4")

    nutrients_group.create_array("nitrate", data=nitrate, chunks=(10, 2, 20, 40))
    nutrients_group.create_array("phosphate", data=phosphate, chunks=(10, 2, 20, 40))
    nutrients_group.create_array("silicate", data=silicate, chunks=(10, 2, 20, 40))

    # Add coordinates to nutrients group
    nutrients_group.create_array("time", data=time)
    nutrients_group.create_array("depth", data=depth)
    nutrients_group.create_array("latitude", data=lat)
    nutrients_group.create_array("longitude", data=lon)

    # Level 1: Metadata group
    metadata_group = root.create_group("metadata")
    metadata_group.attrs.update(
        {"description": "Metadata and quality control information", "version": "1.0"}
    )

    # Level 2: Quality control group
    qc_group = metadata_group.create_group("quality_control")
    qc_group.attrs.update(
        {"description": "Quality control flags and information", "qc_version": "1.2"}
    )

    # Level 3: Flags group
    flags_group = qc_group.create_group("flags")
    flags_group.attrs.update(
        {
            "description": "Data quality flags",
            "flag_meanings": "good questionable bad missing",
        }
    )

    # Create quality flags
    quality_flags = np.random.randint(0, 4, (50, 6, 80, 160), dtype="i1")
    flags_group.create_array(
        "temperature_qc", data=quality_flags, chunks=(10, 2, 20, 40)
    )
    flags_group.create_array("salinity_qc", data=quality_flags, chunks=(10, 2, 20, 40))

    # Add some scalar metadata at different levels
    root.attrs["total_groups"] = 7
    ocean_group.attrs["data_points"] = 3840000  # 50*6*80*160
    physical_group.attrs["variables"] = 2
    temp_group.attrs["min_temp"] = float(np.min(temperature))
    temp_group.attrs["max_temp"] = float(np.max(temperature))

    print(f"✅ Created {output_file} with nested groups (3+ levels deep)")
    return output_file


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


def create_sample_grib():
    """Create a sample GRIB file with weather data."""
    output_file = "sample_data.grib"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"🌦️ GRIB file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("🌦️ Creating sample GRIB file...")

    try:
        import eccodes

        print("  ✅ eccodes available, creating GRIB file")
    except ImportError:
        print("  ❌ eccodes not available, skipping GRIB file creation.")
        return None

    # Create time dimension
    time = np.arange(0, 24, 6)  # 6-hourly data for 24 hours
    dates = [datetime(2020, 1, 1) + timedelta(hours=int(t)) for t in time]

    # Create lat/lon grid to match GRIB sample (496 values = 31x16 grid)
    lat = np.linspace(60, 30, 16)  # Match the sample's latitude range
    lon = np.linspace(0, 30, 31)  # Match the sample's longitude range

    # Create sample weather data
    np.random.seed(789)
    time_3d = time[:, np.newaxis, np.newaxis]
    temperature = (
        15 + 10 * np.sin(2 * np.pi * time_3d / 24) + np.random.normal(0, 2, (4, 16, 31))
    )
    pressure = (
        1013.25
        + 20 * np.sin(2 * np.pi * time_3d / 24)
        + np.random.normal(0, 5, (4, 16, 31))
    )

    # Create dataset
    ds = xr.Dataset(
        {
            "t": (  # Temperature
                ["time", "latitude", "longitude"],
                temperature,
                {
                    "long_name": "Temperature",
                    "units": "K",
                    "standard_name": "air_temperature",
                },
            ),
            "sp": (  # Surface pressure
                ["time", "latitude", "longitude"],
                pressure,
                {
                    "long_name": "Surface pressure",
                    "units": "Pa",
                    "standard_name": "surface_air_pressure",
                },
            ),
        },
        coords={
            "time": (["time"], dates, {"long_name": "Time", "standard_name": "time"}),
            "latitude": (
                ["latitude"],
                lat,
                {"long_name": "Latitude", "units": "degrees_north"},
            ),
            "longitude": (
                ["longitude"],
                lon,
                {"long_name": "Longitude", "units": "degrees_east"},
            ),
        },
    )

    # Add global attributes
    ds.attrs = {
        "title": "Sample Weather Data",
        "description": "Sample GRIB file for testing VSCode extension",
        "institution": "Weather Test Center",
        "source": "Generated for testing",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "Conventions": "CF-1.6",
    }

    # Save to GRIB using eccodes directly
    try:
        # Create GRIB file using eccodes - try the simplest approach first
        with open(output_file, "wb") as f:
            for i, time_val in enumerate(dates):
                # Create a new GRIB message from sample
                grib_id = eccodes.codes_grib_new_from_samples("regular_ll_sfc_grib2")

                try:
                    # Set only the most basic parameters
                    eccodes.codes_set_string(grib_id, "shortName", "t")
                    eccodes.codes_set_long(
                        grib_id, "dataDate", int(time_val.strftime("%Y%m%d"))
                    )
                    eccodes.codes_set_long(
                        grib_id, "dataTime", int(time_val.strftime("%H%M"))
                    )

                    # Set data values
                    data_2d = ds["t"].isel(time=i).values
                    # Resize data to match the GRIB grid if needed
                    if data_2d.size != eccodes.codes_get_size(grib_id, "values"):
                        # Get the expected size from the GRIB message
                        expected_size = eccodes.codes_get_size(grib_id, "values")
                        # Resize or pad the data
                        if data_2d.size < expected_size:
                            # Pad with zeros
                            padded_data = np.zeros(expected_size)
                            padded_data[: data_2d.size] = data_2d.flatten()
                            data_2d = padded_data
                        else:
                            # Truncate
                            data_2d = data_2d.flatten()[:expected_size]
                    else:
                        data_2d = data_2d.flatten()

                    eccodes.codes_set_values(grib_id, data_2d)

                    # Write the message
                    eccodes.codes_write(grib_id, f)

                finally:
                    eccodes.codes_release(grib_id)

        print(f"✅ Created {output_file} (GRIB format)")

    except Exception as e:
        print(f"  ⚠️ Error writing GRIB file with eccodes: {e}")
        print("  🔄 Falling back to NetCDF format with .grib extension")
        # Fallback to NetCDF format
        temp_file = output_file.replace(".grib", "_temp.nc")
        ds.to_netcdf(temp_file, engine="netcdf4")
        import shutil

        shutil.move(temp_file, output_file)
        print(f"✅ Created {output_file} (NetCDF format with .grib extension)")

    return output_file


def create_sample_geotiff():
    """Create a sample GeoTIFF file with satellite imagery data."""
    output_file = "sample_data.tif"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"🛰️ GeoTIFF file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("🛰️ Creating sample GeoTIFF file...")

    try:
        import rioxarray

        print("  ✅ rioxarray available, creating GeoTIFF file")
    except ImportError:
        print("  ❌ rioxarray not available, skipping GeoTIFF file creation.")
        return None

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
    except Exception as e:
        # Fallback to uncompressed if compression fails
        ds.rio.to_raster(output_file)
        print(f"✅ Created {output_file} (uncompressed GeoTIFF)")

    return output_file


def create_sample_jp2():
    """Create a sample JPEG-2000 file with satellite data."""
    output_file = "sample_data.jp2"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"📸 JPEG-2000 file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("📸 Creating sample JPEG-2000 file...")

    try:
        import rioxarray
    except ImportError:
        print("  ❌ rioxarray not available, skipping JPEG-2000 file creation.")
        return None

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
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
    }

    # Save to JPEG-2000
    ds.rio.to_raster(output_file)
    print(f"✅ Created {output_file}")
    return output_file


def create_sample_sentinel():
    """Create a sample Sentinel-1 SAFE directory structure."""
    output_file = "sample_data.safe"

    # Check if directory already exists
    if os.path.exists(output_file):
        print(
            f"🛰️ Sentinel-1 SAFE file {output_file} already exists. Skipping creation."
        )
        print("  🔄 To regenerate, please delete the existing directory first.")
        return output_file

    print("🛰️ Creating sample Sentinel-1 SAFE file...")

    try:
        import xarray_sentinel
    except ImportError:
        print(
            "  ❌ xarray-sentinel not available, skipping Sentinel-1 SAFE file creation."
        )
        return None

    # Create SAFE directory structure
    os.makedirs(output_file, exist_ok=True)

    # Create manifest.safe file
    manifest_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<xfdu:XFDU xmlns:xfdu="urn:ccsds:schema:xfdu:1" xmlns:gml="http://www.opengis.net/gml" xmlns:s1="http://www.esa.int/safe/sentinel-1.0" xmlns:s1sar="http://www.esa.int/safe/sentinel-1.0/sar" xmlns:s1sarl1="http://www.esa.int/safe/sentinel-1.0/sar/level-1" xmlns:s1sarl2="http://www.esa.int/safe/sentinel-1.0/sar/level-2" xmlns:gx="http://www.google.com/kml/ext/2.2" version="esa/safe/sentinel-1.0/sentinel-1/sar/level-1">
  <informationPackageMap>
    <contentUnit>
      <dataObject ID="s1Level1ProductSchema">
        <byteStream MIMEType="text/xml" size="1234">
          <fileLocation href="./annotation/s1Level1ProductSchema.xsd"/>
        </byteStream>
      </dataObject>
    </contentUnit>
  </informationPackageMap>
  <metadataSection>
    <metadataObject ID="platform" category="DMD">
      <metadataWrap>
        <xmlData>
          <s1:platform>
            <s1:nssdcIdentifier>48284</s1:nssdcIdentifier>
            <s1:familyName>SENTINEL-1</s1:familyName>
            <s1:number>1</s1:number>
            <s1:instrument>
              <s1:familyName>C-SAR</s1:familyName>
              <s1:number>1</s1:number>
            </s1:instrument>
          </s1:platform>
        </xmlData>
      </metadataWrap>
    </metadataObject>
  </metadataSection>
</xfdu:XFDU>"""

    with open(os.path.join(output_file, "manifest.safe"), "w") as f:
        f.write(manifest_content)

    # Create annotation directory and files
    os.makedirs(os.path.join(output_file, "annotation"), exist_ok=True)

    # Create a simple annotation file
    annotation_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<product xmlns="http://www.esa.int/safe/sentinel-1.0/sar/level-1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <adsHeader>
    <missionId>S1</missionId>
    <productType>GRD</productType>
    <polarisation>VV</polarisation>
    <mode>IW</mode>
    <swath>IW1</swath>
    <startTime>{datetime.now().isoformat()}</startTime>
    <stopTime>{(datetime.now() + timedelta(minutes=10)).isoformat()}</stopTime>
    <absoluteOrbitNumber>12345</absoluteOrbitNumber>
    <missionDataTakeId>67890</missionDataTakeId>
    <productClass>S</productClass>
  </adsHeader>
  <productInfo>
    <productName>S1A_IW_GRDH_1SDV_20200101T120000_20200101T120010_030123_037234_5A1A</productName>
    <productType>GRD</productType>
    <productClass>S</productClass>
    <acquisitionMode>IW</acquisitionMode>
    <polarisation>VV</polarisation>
    <antennaPointing>right</antennaPointing>
  </productInfo>
</product>"""

    with open(
        os.path.join(output_file, "annotation", "s1Level1ProductSchema.xsd"), "w"
    ) as f:
        f.write(annotation_content)

    print(f"✅ Created {output_file}")
    return output_file


def create_sample_netcdf4():
    """Create a sample NetCDF4 file with advanced features."""
    output_file = "sample_data.nc4"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"🌡️ NetCDF4 file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("🌡️ Creating sample NetCDF4 file...")

    # Create time dimension
    time = np.arange(0, 12, 1)  # Monthly data
    dates = [datetime(2020, 1, 1) + timedelta(days=int(t * 30)) for t in time]

    # Create lat/lon grid
    lat = np.linspace(-90, 90, 90)
    lon = np.linspace(-180, 180, 180)

    # Create sample climate data
    np.random.seed(303)
    time_3d = time[:, np.newaxis, np.newaxis]
    temperature = (
        15
        + 10 * np.sin(2 * np.pi * time_3d / 12)
        + np.random.normal(0, 2, (12, 90, 180))
    )

    # Create dataset
    ds = xr.Dataset(
        {
            "temperature": (
                ["time", "lat", "lon"],
                temperature,
                {
                    "long_name": "Monthly Temperature",
                    "units": "Celsius",
                    "standard_name": "air_temperature",
                    "valid_range": [-50, 50],
                    "missing_value": -9999,
                },
            ),
        },
        coords={
            "time": (["time"], dates, {"long_name": "Time", "standard_name": "time"}),
            "lat": (["lat"], lat, {"long_name": "Latitude", "units": "degrees_north"}),
            "lon": (["lon"], lon, {"long_name": "Longitude", "units": "degrees_east"}),
        },
    )

    # Add global attributes
    ds.attrs = {
        "title": "Sample NetCDF4 Data",
        "description": "Sample NetCDF4 file for testing VSCode extension",
        "institution": "Climate Test Center",
        "source": "Generated for testing",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "Conventions": "CF-1.7",
        "featureType": "timeSeries",
    }

    # Save to NetCDF4
    ds.to_netcdf(output_file, engine="netcdf4")
    print(f"✅ Created {output_file}")
    return output_file


def main():
    """Create all sample data files."""
    print("🔬 Creating sample scientific data files for VSCode extension testing...")
    print("=" * 80)

    # Create output directory
    os.makedirs("sample-data", exist_ok=True)
    os.chdir("sample-data")

    created_files = []
    skipped_files = []

    try:
        # Create sample files for all supported formats
        print("\n📁 Creating NetCDF files...")
        netcdf_file = create_sample_netcdf()
        if netcdf_file:
            created_files.append((netcdf_file, "NetCDF"))

        netcdf4_file = create_sample_netcdf4()
        if netcdf4_file:
            created_files.append((netcdf4_file, "NetCDF4"))

        print("\n📁 Creating HDF5 files...")
        hdf5_file = create_sample_hdf5()
        if hdf5_file:
            created_files.append((hdf5_file, "HDF5"))

        print("\n📁 Creating GRIB files...")
        grib_file = create_sample_grib()
        if grib_file:
            created_files.append((grib_file, "GRIB"))
        else:
            skipped_files.append("GRIB (cfgrib not available)")

        print("\n📁 Creating GeoTIFF files...")
        geotiff_file = create_sample_geotiff()
        if geotiff_file:
            created_files.append((geotiff_file, "GeoTIFF"))
        else:
            skipped_files.append("GeoTIFF (rioxarray not available)")

        print("\n📁 Creating JPEG-2000 files...")
        jp2_file = create_sample_jp2()
        if jp2_file:
            created_files.append((jp2_file, "JPEG-2000"))
        else:
            skipped_files.append("JPEG-2000 (rioxarray not available)")

        print("\n📁 Creating Zarr files...")
        zarr_file = create_sample_zarr_single_group_from_dataset()
        if zarr_file:
            created_files.append((zarr_file, "Zarr"))
        else:
            skipped_files.append("Zarr (zarr not available)")

        nested_zarr_file = create_sample_zarr_with_nested_groups_from_zarr()
        if nested_zarr_file:
            created_files.append((nested_zarr_file, "Nested Zarr"))
        else:
            skipped_files.append("Nested Zarr (zarr not available)")

        datatree_zarr_file = create_sample_zarr_with_nested_groups_from_datatree()
        if datatree_zarr_file:
            created_files.append((datatree_zarr_file, "xr.DataTree Zarr"))
        else:
            skipped_files.append("xr.DataTree Zarr (zarr or datatree not available)")

        print("\n📁 Creating Sentinel-1 SAFE files...")
        sentinel_file = create_sample_sentinel()
        if sentinel_file:
            created_files.append((sentinel_file, "Sentinel-1 SAFE"))
        else:
            skipped_files.append("Sentinel-1 SAFE (xarray-sentinel not available)")

        print("\n" + "=" * 80)
        print("✅ Sample data files created successfully!")
        print(f"\n📊 Created {len(created_files)} files:")
        for filename, format_name in created_files:
            print(f"  • {filename} ({format_name} format)")

        if skipped_files:
            print(f"\n⚠️  Skipped {len(skipped_files)} formats (missing dependencies):")
            for format_name in skipped_files:
                print(f"  • {format_name}")

        print(f"\n🎯 You can now test the VSCode extension with these files!")
        print("   Right-click on any file in VS Code and select 'Open in Data Viewer'")

    except Exception as e:
        print(f"\n❌ Error creating sample data: {e}")
        import traceback

        print(traceback.format_exc())
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
