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
    topgroup_ds = xr.Dataset(
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
    topgroup_ds.attrs = {
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
    dt["topgroup"] = topgroup_ds
    dt["topgroup/ocean_data"] = ocean_ds
    dt["topgroup/ocean_data/physical_properties"] = physical_ds
    dt["topgroup/ocean_data/chemical_properties"] = chemical_ds
    dt["topgroup/ocean_data/quality_control"] = qc_ds

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


def create_sample_netcdf_cdf():
    """Create a sample NetCDF file with .cdf extension."""
    output_file = "sample_data.cdf"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"📄 NetCDF CDF file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("🌡️ Creating sample NetCDF CDF file...")

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
        "title": "Sample NetCDF CDF Data",
        "description": "Sample NetCDF file with .cdf extension for testing VSCode extension",
        "institution": "Climate Test Center",
        "source": "Generated for testing",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "Conventions": "CF-1.7",
        "featureType": "timeSeries",
    }

    # Save to NetCDF
    ds.to_netcdf(output_file)
    print(f"✅ Created {output_file}")
    return output_file


def create_sample_netcdf_netcdf():
    """Create a sample NetCDF file with .netcdf extension."""
    output_file = "sample_data.netcdf"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"📄 NetCDF NETCDF file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("🌡️ Creating sample NetCDF NETCDF file...")

    # Create time dimension
    time = np.arange(0, 6, 1)  # 6 time steps
    dates = [datetime(2020, 1, 1) + timedelta(days=int(t * 30)) for t in time]

    # Create lat/lon grid
    lat = np.linspace(-45, 45, 45)
    lon = np.linspace(-90, 90, 90)

    # Create sample climate data
    np.random.seed(404)
    time_3d = time[:, np.newaxis, np.newaxis]
    precipitation = np.clip(np.random.exponential(2, (6, 45, 90)), 0, 50).astype(
        np.float32
    )

    # Create dataset
    ds = xr.Dataset(
        {
            "precipitation": (
                ["time", "lat", "lon"],
                precipitation,
                {
                    "long_name": "Monthly Precipitation",
                    "units": "mm",
                    "standard_name": "precipitation_amount",
                    "valid_range": [0, 1000],
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
        "title": "Sample NetCDF NETCDF Data",
        "description": "Sample NetCDF file with .netcdf extension for testing VSCode extension",
        "institution": "Climate Test Center",
        "source": "Generated for testing",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "Conventions": "CF-1.7",
        "featureType": "timeSeries",
    }

    # Save to NetCDF
    ds.to_netcdf(output_file)
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


def create_sample_grib_grib2():
    """Create a sample GRIB2 file."""
    output_file = "sample_data.grib2"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"🌦️ GRIB2 file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("🌦️ Creating sample GRIB2 file...")

    try:
        import eccodes

        print("  ✅ eccodes available, creating GRIB2 file")
    except ImportError:
        print("  ❌ eccodes not available, skipping GRIB2 file creation.")
        return None

    # Create time dimension
    time = np.arange(0, 12, 3)  # 3-hourly data for 12 hours
    dates = [datetime(2020, 1, 1) + timedelta(hours=int(t)) for t in time]

    # Create lat/lon grid
    lat = np.linspace(60, 30, 12)  # Smaller grid for GRIB2
    lon = np.linspace(0, 30, 16)

    # Create sample weather data
    np.random.seed(606)
    time_3d = time[:, np.newaxis, np.newaxis]
    wind_speed = (
        5 + 10 * np.sin(2 * np.pi * time_3d / 12) + np.random.normal(0, 2, (4, 12, 16))
    )

    # Create dataset
    ds = xr.Dataset(
        {
            "wind_speed": (
                ["time", "latitude", "longitude"],
                wind_speed,
                {
                    "long_name": "Wind Speed",
                    "units": "m/s",
                    "standard_name": "wind_speed",
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
        "title": "Sample GRIB2 Data",
        "description": "Sample GRIB2 file for testing VSCode extension",
        "institution": "Weather Test Center",
        "source": "Generated for testing",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "Conventions": "CF-1.6",
    }

    # Save to GRIB2 using eccodes directly
    try:
        with open(output_file, "wb") as f:
            for i, time_val in enumerate(dates):
                grib_id = eccodes.codes_grib_new_from_samples("regular_ll_sfc_grib2")

                try:
                    eccodes.codes_set_string(grib_id, "shortName", "10si")
                    eccodes.codes_set_long(
                        grib_id, "dataDate", int(time_val.strftime("%Y%m%d"))
                    )
                    eccodes.codes_set_long(
                        grib_id, "dataTime", int(time_val.strftime("%H%M"))
                    )

                    data_2d = ds["wind_speed"].isel(time=i).values
                    if data_2d.size != eccodes.codes_get_size(grib_id, "values"):
                        expected_size = eccodes.codes_get_size(grib_id, "values")
                        if data_2d.size < expected_size:
                            padded_data = np.zeros(expected_size)
                            padded_data[: data_2d.size] = data_2d.flatten()
                            data_2d = padded_data
                        else:
                            data_2d = data_2d.flatten()[:expected_size]
                    else:
                        data_2d = data_2d.flatten()

                    eccodes.codes_set_values(grib_id, data_2d)
                    eccodes.codes_write(grib_id, f)

                finally:
                    eccodes.codes_release(grib_id)

        print(f"✅ Created {output_file} (GRIB2 format)")

    except Exception as e:
        print(f"  ⚠️ Error writing GRIB2 file with eccodes: {e}")
        print("  🔄 Falling back to NetCDF format with .grib2 extension")
        temp_file = output_file.replace(".grib2", "_temp.nc")
        ds.to_netcdf(temp_file, engine="netcdf4")
        import shutil

        shutil.move(temp_file, output_file)
        print(f"✅ Created {output_file} (NetCDF format with .grib2 extension)")

    return output_file


def create_sample_grib_grb():
    """Create a sample GRIB file with .grb extension."""
    output_file = "sample_data.grb"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"🌦️ GRIB GRB file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("🌦️ Creating sample GRIB GRB file...")

    try:
        import eccodes

        print("  ✅ eccodes available, creating GRIB GRB file")
    except ImportError:
        print("  ❌ eccodes not available, skipping GRIB GRB file creation.")
        return None

    # Create time dimension
    time = np.arange(0, 8, 2)  # 2-hourly data for 8 hours
    dates = [datetime(2020, 1, 1) + timedelta(hours=int(t)) for t in time]

    # Create lat/lon grid
    lat = np.linspace(50, 40, 10)
    lon = np.linspace(0, 20, 15)

    # Create sample weather data
    np.random.seed(707)
    time_3d = time[:, np.newaxis, np.newaxis]
    humidity = np.clip(
        50
        + 30 * np.sin(2 * np.pi * time_3d / 8)
        + np.random.normal(0, 10, (4, 10, 15)),
        0,
        100,
    )

    # Create dataset
    ds = xr.Dataset(
        {
            "humidity": (
                ["time", "latitude", "longitude"],
                humidity,
                {
                    "long_name": "Relative Humidity",
                    "units": "%",
                    "standard_name": "relative_humidity",
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
        "title": "Sample GRIB GRB Data",
        "description": "Sample GRIB file with .grb extension for testing VSCode extension",
        "institution": "Weather Test Center",
        "source": "Generated for testing",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "Conventions": "CF-1.6",
    }

    # Save to GRIB using eccodes directly
    try:
        with open(output_file, "wb") as f:
            for i, time_val in enumerate(dates):
                grib_id = eccodes.codes_grib_new_from_samples("regular_ll_sfc_grib2")

                try:
                    eccodes.codes_set_string(grib_id, "shortName", "r")
                    eccodes.codes_set_long(
                        grib_id, "dataDate", int(time_val.strftime("%Y%m%d"))
                    )
                    eccodes.codes_set_long(
                        grib_id, "dataTime", int(time_val.strftime("%H%M"))
                    )

                    data_2d = ds["humidity"].isel(time=i).values
                    if data_2d.size != eccodes.codes_get_size(grib_id, "values"):
                        expected_size = eccodes.codes_get_size(grib_id, "values")
                        if data_2d.size < expected_size:
                            padded_data = np.zeros(expected_size)
                            padded_data[: data_2d.size] = data_2d.flatten()
                            data_2d = padded_data
                        else:
                            data_2d = data_2d.flatten()[:expected_size]
                    else:
                        data_2d = data_2d.flatten()

                    eccodes.codes_set_values(grib_id, data_2d)
                    eccodes.codes_write(grib_id, f)

                finally:
                    eccodes.codes_release(grib_id)

        print(f"✅ Created {output_file} (GRIB format)")

    except Exception as e:
        print(f"  ⚠️ Error writing GRIB GRB file with eccodes: {e}")
        print("  🔄 Falling back to NetCDF format with .grb extension")
        temp_file = output_file.replace(".grb", "_temp.nc")
        ds.to_netcdf(temp_file, engine="netcdf4")
        import shutil

        shutil.move(temp_file, output_file)
        print(f"✅ Created {output_file} (NetCDF format with .grb extension)")

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

    try:
        import rioxarray

        print("  ✅ rioxarray available, creating GeoTIFF TIFF file")
    except ImportError:
        print("  ❌ rioxarray not available, skipping GeoTIFF TIFF file creation.")
        return None

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

    try:
        import rioxarray

        print("  ✅ rioxarray available, creating GeoTIFF GEOTIFF file")
    except ImportError:
        print("  ❌ rioxarray not available, skipping GeoTIFF GEOTIFF file creation.")
        return None

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
        "title": "Sample GeoTIFF GEOTIFF Data",
        "description": "Sample GeoTIFF file with .geotiff extension for testing VSCode extension",
        "institution": "Satellite Test Center",
        "source": "Generated for testing",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
    }

    # Save to GeoTIFF
    ds.rio.to_raster(output_file, driver="GTiff")
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

    try:
        import rioxarray
    except ImportError:
        print(
            "  ❌ rioxarray not available, skipping JPEG-2000 JPEG2000 file creation."
        )
        return None

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
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
    }

    # Save to JPEG-2000
    ds.rio.to_raster(output_file, driver="JPEG")
    print(f"✅ Created {output_file}")
    return output_file


def create_sample_file_with_spaces():
    """Create a sample file with spaces in the name."""
    output_file = "sample data with spaces.nc"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"📄 File with spaces {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("📄 Creating sample file with spaces in name...")

    # Create time dimension
    time = np.arange(0, 5, 1)  # 5 time steps
    dates = [datetime(2020, 1, 1) + timedelta(days=int(t)) for t in time]

    # Create lat/lon grid
    lat = np.linspace(-30, 30, 30)
    lon = np.linspace(-60, 60, 60)

    # Create sample data
    np.random.seed(1111)
    time_3d = time[:, np.newaxis, np.newaxis]
    data = (
        20 + 10 * np.sin(2 * np.pi * time_3d / 5) + np.random.normal(0, 2, (5, 30, 60))
    )

    # Create dataset
    ds = xr.Dataset(
        {
            "test_variable": (
                ["time", "lat", "lon"],
                data,
                {
                    "long_name": "Test Variable with Spaces in Filename",
                    "units": "1",
                    "description": "This file tests handling of filenames with spaces",
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
        "title": "Sample Data with Spaces in Filename",
        "description": "Test file with spaces in the filename for testing VSCode extension",
        "institution": "Test Center",
        "source": "Generated for testing filename handling",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "Conventions": "CF-1.6",
        "test_purpose": "filename_with_spaces",
    }

    # Save to NetCDF
    ds.to_netcdf(output_file)
    print(f"✅ Created {output_file}")
    return output_file


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

    try:
        import zarr
        import xarray as xr
    except ImportError:
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


def create_sample_zarr_arborescence():
    """Create a sample Zarr file with many subgroups (arborescence) using DataTree."""
    output_file = "sample_zarr_arborescence.zarr"

    # Check if directory already exists
    if os.path.exists(output_file):
        print(
            f"🌳 Zarr arborescence file {output_file} already exists. Skipping creation."
        )
        print("  🔄 To regenerate, please delete the existing directory first.")
        return output_file

    print("🌳 Creating sample Zarr file with arborescence structure...")

    try:
        import zarr
        import xarray as xr
    except ImportError:
        print(
            "  ❌ zarr or xarray not available, skipping arborescence Zarr file creation."
        )
        return None

    # Create small dimensions for manageable file size
    time = np.arange(0, 3, 1)
    lat = np.linspace(-10, 10, 200)
    lon = np.linspace(-10, 10, 200)

    # Set random seed for reproducible data
    np.random.seed(42)

    # Create root dataset
    root_ds = xr.Dataset(
        {
            "metadata": (
                ["time"],
                np.arange(3),
                {"long_name": "Root metadata", "units": "1"},
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
        "title": "Sample Zarr Arborescence",
        "description": "Zarr file with many subgroups for testing tree navigation",
        "institution": "Test Institute",
        "source": "Generated for testing",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
    }

    # Create DataTree structure
    dt = xr.DataTree(name="root")
    dt["root"] = root_ds

    # Create level 1 groups
    level1_groups = ["atmosphere", "ocean", "land", "cryosphere", "biosphere"]
    for group_name in level1_groups:
        # Create small data arrays for each group
        data = np.random.normal(0, 1, (3, 200, 200)).astype(np.float32)

        group_ds = xr.Dataset(
            {
                f"{group_name}_data": (
                    ["time", "lat", "lon"],
                    data,
                    {
                        "long_name": f"{group_name.title()} Data",
                        "units": "1",
                        "description": f"Sample {group_name} data",
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
        group_ds.attrs = {
            "description": f"{group_name.title()} data group",
            "data_type": group_name,
            "level": 1,
        }

        dt[f"root/{group_name}"] = group_ds

        # Create level 2 subgroups for each level 1 group
        level2_groups = ["physical", "chemical", "biological"]
        for sub_group in level2_groups:
            sub_data = np.random.normal(0, 0.5, (3, 200, 200)).astype(np.float32)

            sub_ds = xr.Dataset(
                {
                    f"{sub_group}_data": (
                        ["time", "lat", "lon"],
                        sub_data,
                        {
                            "long_name": f"{sub_group.title()} {group_name.title()} Data",
                            "units": "1",
                            "description": f"Sample {sub_group} {group_name} data",
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
            sub_ds.attrs = {
                "description": f"{sub_group.title()} {group_name.title()} data",
                "data_type": f"{group_name}_{sub_group}",
                "level": 2,
            }

            dt[f"root/{group_name}/{sub_group}"] = sub_ds

            # Create level 3 subgroups for some combinations
            if group_name in ["atmosphere", "ocean"] and sub_group == "physical":
                level3_groups = (
                    ["temperature", "pressure", "humidity"]
                    if group_name == "atmosphere"
                    else ["salinity", "density", "currents"]
                )

                for var_name in level3_groups:
                    var_data = np.random.normal(0, 0.3, (3, 200, 200)).astype(
                        np.float32
                    )

                    var_ds = xr.Dataset(
                        {
                            var_name: (
                                ["time", "lat", "lon"],
                                var_data,
                                {
                                    "long_name": f"{var_name.title()}",
                                    "units": "1",
                                    "description": f"Sample {var_name} data",
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
                    var_ds.attrs = {
                        "description": f"{var_name.title()} variable",
                        "data_type": f"{group_name}_{sub_group}_{var_name}",
                        "level": 3,
                    }

                    dt[f"root/{group_name}/{sub_group}/{var_name}"] = var_ds

    # Save to Zarr using DataTree's to_zarr method
    dt.to_zarr(output_file, mode="w")
    print(f"✅ Created {output_file} with arborescence structure")
    return output_file


def create_sample_zarr_inherited_coords():
    """Create a sample Zarr file with inherited coordinates using DataTree."""
    output_file = "sample_zarr_inherited_coords.zarr"

    # Check if directory already exists
    if os.path.exists(output_file):
        print(
            f"🔗 Zarr inherited coords file {output_file} already exists. Skipping creation."
        )
        print("  🔄 To regenerate, please delete the existing directory first.")
        return output_file

    print("🔗 Creating sample Zarr file with inherited coordinates...")

    try:
        import zarr
        import xarray as xr
    except ImportError:
        print(
            "  ❌ zarr or xarray not available, skipping inherited coords Zarr file creation."
        )
        return None

    # Create dimensions
    time = np.arange(0, 5, 1)
    lat = np.linspace(-5, 5, 50)
    lon = np.linspace(-5, 5, 50)

    # Set random seed for reproducible data
    np.random.seed(123)

    # Create root dataset with coordinates
    root_ds = xr.Dataset(
        {
            "global_metadata": (
                ["time"],
                np.arange(5),
                {"long_name": "Global metadata index", "units": "1"},
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
    root_ds.attrs = {
        "title": "Sample Zarr with Inherited Coordinates",
        "description": "Zarr file demonstrating coordinate inheritance",
        "institution": "Test Institute",
        "source": "Generated for testing",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
    }

    # Create DataTree structure
    dt = xr.DataTree(name="root")
    dt["root"] = root_ds

    # Create groups that inherit coordinates from parent
    groups_data = {
        "temperature": np.random.normal(20, 5, (5, 50, 50)).astype(np.float32),
        "pressure": np.random.normal(1013, 20, (5, 50, 50)).astype(np.float32),
        "humidity": np.random.normal(60, 15, (5, 50, 50)).astype(np.float32),
    }

    for var_name, data in groups_data.items():
        # Create dataset without explicit coordinates - they will be inherited
        var_ds = xr.Dataset(
            {
                var_name: (
                    ["time", "lat", "lon"],
                    data,
                    {
                        "long_name": f"{var_name.title()}",
                        "units": "1",
                        "description": f"Sample {var_name} data with inherited coordinates",
                    },
                ),
            },
            # No coords defined here - they will be inherited from parent
        )
        var_ds.attrs = {
            "description": f"{var_name.title()} data group",
            "data_type": var_name,
            "inherits_coordinates": True,
        }

        dt[f"root/{var_name}"] = var_ds

        # Create subgroups that also inherit coordinates
        sub_groups = ["raw", "processed", "quality_control"]
        for sub_group in sub_groups:
            sub_data = np.random.normal(0, 1, (5, 50, 50)).astype(np.float32)

            sub_ds = xr.Dataset(
                {
                    f"{var_name}_{sub_group}": (
                        ["time", "lat", "lon"],
                        sub_data,
                        {
                            "long_name": f"{var_name.title()} {sub_group.title()}",
                            "units": "1",
                            "description": f"Sample {var_name} {sub_group} data",
                        },
                    ),
                },
                # No coords defined here - they will be inherited from parent
            )
            sub_ds.attrs = {
                "description": f"{var_name.title()} {sub_group.title()} data",
                "data_type": f"{var_name}_{sub_group}",
                "inherits_coordinates": True,
            }

            dt[f"root/{var_name}/{sub_group}"] = sub_ds

    # Save to Zarr using DataTree's to_zarr method
    dt.to_zarr(output_file, mode="w")
    print(f"✅ Created {output_file} with inherited coordinates")
    return output_file


def create_sample_netcdf_multiple_groups():
    """Create a sample NetCDF file with multiple groups."""
    output_file = "sample_data_multiple_groups.nc"

    # Check if file already exists
    if os.path.exists(output_file):
        print(
            f"📁 NetCDF multi-group file {output_file} already exists. Skipping creation."
        )
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("📁 Creating sample NetCDF file with multiple groups...")

    try:
        import netCDF4 as nc
    except ImportError:
        print("  ❌ netCDF4 not available, skipping multi-group NetCDF file creation.")
        return None

    # Create dimensions
    time = np.arange(0, 10, 1)
    lat = np.linspace(-10, 10, 20)
    lon = np.linspace(-10, 10, 20)

    # Set random seed for reproducible data
    np.random.seed(456)

    # Create NetCDF file with groups
    with nc.Dataset(output_file, "w", format="NETCDF4") as rootgrp:
        # Add global attributes
        rootgrp.title = "Sample NetCDF with Multiple Groups"
        rootgrp.description = "NetCDF file with multiple groups for testing"
        rootgrp.institution = "Test Institute"
        rootgrp.source = "Generated for testing"
        rootgrp.history = f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        rootgrp.Conventions = "CF-1.6"

        # Create dimensions
        rootgrp.createDimension("time", len(time))
        rootgrp.createDimension("lat", len(lat))
        rootgrp.createDimension("lon", len(lon))

        # Create root level variables
        time_var = rootgrp.createVariable("time", "f4", ("time",))
        time_var[:] = time
        time_var.long_name = "Time"
        time_var.units = "days since 2020-01-01"

        lat_var = rootgrp.createVariable("lat", "f4", ("lat",))
        lat_var[:] = lat
        lat_var.long_name = "Latitude"
        lat_var.units = "degrees_north"

        lon_var = rootgrp.createVariable("lon", "f4", ("lon",))
        lon_var[:] = lon
        lon_var.long_name = "Longitude"
        lon_var.units = "degrees_east"

        # Create root level data
        root_data = np.random.normal(0, 1, (10, 20, 20)).astype(np.float32)
        root_var = rootgrp.createVariable("root_data", "f4", ("time", "lat", "lon"))
        root_var[:] = root_data
        root_var.long_name = "Root Level Data"
        root_var.units = "1"

        # Create Group 1: Atmosphere
        atm_group = rootgrp.createGroup("atmosphere")
        atm_group.description = "Atmospheric data group"
        atm_group.data_type = "atmospheric"

        # Add variables to atmosphere group
        temp_data = np.random.normal(20, 5, (10, 20, 20)).astype(np.float32)
        temp_var = atm_group.createVariable("temperature", "f4", ("time", "lat", "lon"))
        temp_var[:] = temp_data
        temp_var.long_name = "Temperature"
        temp_var.units = "Celsius"

        press_data = np.random.normal(1013, 20, (10, 20, 20)).astype(np.float32)
        press_var = atm_group.createVariable("pressure", "f4", ("time", "lat", "lon"))
        press_var[:] = press_data
        press_var.long_name = "Pressure"
        press_var.units = "hPa"

        # Create subgroup in atmosphere
        wind_group = atm_group.createGroup("wind")
        wind_group.description = "Wind data subgroup"

        u_wind_data = np.random.normal(0, 5, (10, 20, 20)).astype(np.float32)
        u_wind_var = wind_group.createVariable(
            "u_component", "f4", ("time", "lat", "lon")
        )
        u_wind_var[:] = u_wind_data
        u_wind_var.long_name = "U-component of wind"
        u_wind_var.units = "m/s"

        v_wind_data = np.random.normal(0, 5, (10, 20, 20)).astype(np.float32)
        v_wind_var = wind_group.createVariable(
            "v_component", "f4", ("time", "lat", "lon")
        )
        v_wind_var[:] = v_wind_data
        v_wind_var.long_name = "V-component of wind"
        v_wind_var.units = "m/s"

        # Create Group 2: Ocean
        ocean_group = rootgrp.createGroup("ocean")
        ocean_group.description = "Oceanographic data group"
        ocean_group.data_type = "oceanographic"

        # Add variables to ocean group
        salinity_data = np.random.normal(35, 2, (10, 20, 20)).astype(np.float32)
        salinity_var = ocean_group.createVariable(
            "salinity", "f4", ("time", "lat", "lon")
        )
        salinity_var[:] = salinity_data
        salinity_var.long_name = "Salinity"
        salinity_var.units = "psu"

        # Create Group 3: Land
        land_group = rootgrp.createGroup("land")
        land_group.description = "Land surface data group"
        land_group.data_type = "land_surface"

        # Add variables to land group
        soil_data = np.random.normal(0.3, 0.1, (10, 20, 20)).astype(np.float32)
        soil_var = land_group.createVariable(
            "soil_moisture", "f4", ("time", "lat", "lon")
        )
        soil_var[:] = soil_data
        soil_var.long_name = "Soil Moisture"
        soil_var.units = "m³/m³"

    print(f"✅ Created {output_file} with multiple groups")
    return output_file


def create_broken_files():
    """Create broken files for all supported extensions to test error handling."""
    print("💥 Creating broken files for error handling testing...")

    broken_files = []
    file_extensions = [".nc", ".nc4", ".h5", ".grib", ".tif", ".jp2", ".zarr", ".safe"]

    for ext in file_extensions:
        filename = f"broken_file{ext}"
        if ext == ".zarr" or ext == ".safe":
            # Create empty directory for zarr/safe
            os.makedirs(filename, exist_ok=True)
        else:
            # Create empty file for other formats
            with open(filename, "w") as f:
                pass  # Empty file

        broken_files.append(filename)
        print(f"  💥 Created {filename} (empty file/directory)")

    return broken_files


def create_sample_netcdf_many_vars():
    """Create a sample NetCDF file with many variables and attributes for stress testing."""
    output_file = "sample_data_many_vars.nc"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"📊 NetCDF file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("📊 Creating sample NetCDF file with many variables and attributes...")

    # Create small dimensions to keep file size manageable
    time = np.arange(0, 5, 1)  # 5 time steps
    lat = np.linspace(-10, 10, 10)  # 10 latitude points
    lon = np.linspace(-10, 10, 10)  # 10 longitude points
    depth = np.array([0, 5, 10])  # 3 depth levels

    # Set random seed for reproducible data
    np.random.seed(42)

    # Create data variables dictionary
    data_vars = {}

    # Generate 100+ variables with small data arrays
    variable_categories = [
        ("temperature", "Celsius", "air_temperature"),
        ("pressure", "hPa", "surface_air_pressure"),
        ("humidity", "%", "relative_humidity"),
        ("wind_speed", "m/s", "wind_speed"),
        ("wind_direction", "degrees", "wind_from_direction"),
        ("precipitation", "mm", "precipitation_amount"),
        ("cloud_cover", "%", "cloud_area_fraction"),
        ("visibility", "km", "visibility_in_air"),
        ("solar_radiation", "W/m²", "surface_downwelling_shortwave_flux_in_air"),
        ("albedo", "1", "surface_albedo"),
    ]

    # Create 10 variables for each category (10 * 10 = 100 variables)
    for i in range(10):
        for base_name, units, standard_name in variable_categories:
            var_name = f"{base_name}_{i:02d}"

            # Create small random data with different patterns
            if "temperature" in base_name:
                data = (
                    20
                    + 10 * np.sin(2 * np.pi * i / 10)
                    + np.random.normal(0, 2, (5, 3, 10, 10))
                )
            elif "pressure" in base_name:
                data = (
                    1013.25
                    + 20 * np.cos(2 * np.pi * i / 10)
                    + np.random.normal(0, 5, (5, 3, 10, 10))
                )
            elif "humidity" in base_name:
                data = (
                    50
                    + 30 * np.sin(2 * np.pi * i / 10)
                    + np.random.normal(0, 10, (5, 3, 10, 10))
                )
            elif "wind" in base_name:
                data = (
                    5
                    + 10 * np.sin(2 * np.pi * i / 10)
                    + np.random.normal(0, 2, (5, 3, 10, 10))
                )
            else:
                data = np.random.normal(0, 1, (5, 3, 10, 10))

            # Ensure data is within reasonable bounds
            if "humidity" in base_name or "cloud_cover" in base_name:
                data = np.clip(data, 0, 100)
            elif "albedo" in base_name:
                data = np.clip(data, 0, 1)
            elif "visibility" in base_name:
                data = np.clip(data, 0, 50)

            data_vars[var_name] = (
                ["time", "depth", "lat", "lon"],
                data.astype(np.float32),
                {
                    "long_name": f"{base_name.replace('_', ' ').title()} {i:02d}",
                    "units": units,
                    "standard_name": standard_name,
                    "valid_range": [float(np.min(data)), float(np.max(data))],
                    "missing_value": -9999.0,
                    "description": f"Sample {base_name} data variable number {i:02d}",
                    "source": "Generated for testing",
                    "comment": f"This is variable {i + 1} of 100 in the stress test dataset",
                },
            )

    # Create coordinates
    coords = {
        "time": (
            ["time"],
            time,
            {
                "long_name": "Time",
                "units": "days since 2020-01-01",
                "standard_name": "time",
                "calendar": "gregorian",
                "axis": "T",
            },
        ),
        "depth": (
            ["depth"],
            depth,
            {
                "long_name": "Depth",
                "units": "m",
                "positive": "down",
                "axis": "Z",
                "standard_name": "depth",
            },
        ),
        "lat": (
            ["lat"],
            lat,
            {
                "long_name": "Latitude",
                "units": "degrees_north",
                "standard_name": "latitude",
                "axis": "Y",
            },
        ),
        "lon": (
            ["lon"],
            lon,
            {
                "long_name": "Longitude",
                "units": "degrees_east",
                "standard_name": "longitude",
                "axis": "X",
            },
        ),
    }

    # Create dataset
    ds = xr.Dataset(data_vars, coords=coords)

    # Add 100+ global attributes
    global_attrs = {
        # Basic metadata
        "title": "Sample NetCDF with Many Variables and Attributes",
        "description": "Test dataset with 100+ variables and 100+ attributes for stress testing the VSCode extension",
        "institution": "Scientific Data Viewer Test Center",
        "source": "Generated for testing purposes",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "Conventions": "CF-1.8",
        "featureType": "grid",
        "data_type": "scientific_test_data",
        # Contact information
        "contact": "test@example.com",
        "contact_person": "Test User",
        "contact_organization": "Test Organization",
        "contact_phone": "+1-555-0123",
        "contact_address": "123 Test Street, Test City, TC 12345",
        # Data characteristics
        "total_variables": 100,
        "total_attributes": 120,
        "data_size": "small",
        "purpose": "stress_testing",
        "test_type": "many_variables_attributes",
        "file_format": "NetCDF-4",
        "compression": "zlib",
        "chunk_sizes": "optimized",
        # Geographic information
        "geospatial_lat_min": float(np.min(lat)),
        "geospatial_lat_max": float(np.max(lat)),
        "geospatial_lon_min": float(np.min(lon)),
        "geospatial_lon_max": float(np.max(lon)),
        "geospatial_vertical_min": float(np.min(depth)),
        "geospatial_vertical_max": float(np.max(depth)),
        "geospatial_vertical_positive": "down",
        "geospatial_vertical_units": "m",
        "geospatial_lat_units": "degrees_north",
        "geospatial_lon_units": "degrees_east",
        # Temporal information
        "time_coverage_start": "2020-01-01T00:00:00Z",
        "time_coverage_end": "2020-01-05T00:00:00Z",
        "time_coverage_duration": "P4D",
        "time_coverage_resolution": "P1D",
        # Processing information
        "processing_level": "L1",
        "processing_software": "Python xarray",
        "processing_version": "0.20.0",
        "processing_date": datetime.now().strftime("%Y-%m-%d"),
        "processing_center": "Test Processing Center",
        "processing_algorithm": "random_generation",
        # Quality information
        "quality_control": "automated",
        "quality_flag": "good",
        "quality_assessment": "test_data",
        "data_quality": "synthetic",
        "uncertainty": "not_applicable",
        # References and citations
        "references": "Test reference 1, Test reference 2",
        "citation": "Test Dataset (2024) - Generated for VSCode Extension Testing",
        "doi": "10.1234/test.2024.001",
        "publication_date": "2024-01-01",
        "version": "1.0",
        # Technical specifications
        "netcdf_version": "4.0",
        "hdf5_version": "1.10.0",
        "zlib_version": "1.2.11",
        "creation_tool": "xarray",
        "creation_tool_version": "0.20.0",
        "python_version": "3.9.0",
        "numpy_version": "1.21.0",
        # Data lineage
        "parent_experiment": "test_experiment",
        "parent_experiment_id": "test_exp_001",
        "experiment_id": "test_exp_001_v1",
        "sub_experiment": "none",
        "sub_experiment_id": "none",
        "variant_label": "test_variant",
        # Additional metadata
        "keywords": "test, scientific, data, variables, attributes, stress, testing",
        "keywords_vocabulary": "GCMD",
        "platform": "test_platform",
        "platform_name": "Test Platform",
        "platform_type": "virtual",
        "sensor": "test_sensor",
        "sensor_name": "Test Sensor",
        "sensor_type": "synthetic",
        # Data access
        "license": "CC BY 4.0",
        "access_rights": "public",
        "use_constraints": "none",
        "distribution_statement": "Test data for development purposes only",
        "data_license": "Creative Commons Attribution 4.0 International",
        # Additional test attributes (to reach 100+)
        "test_attr_001": "value_001",
        "test_attr_002": "value_002",
        "test_attr_003": "value_003",
        "test_attr_004": "value_004",
        "test_attr_005": "value_005",
        "test_attr_006": "value_006",
        "test_attr_007": "value_007",
        "test_attr_008": "value_008",
        "test_attr_009": "value_009",
        "test_attr_010": "value_010",
        "test_attr_011": "value_011",
        "test_attr_012": "value_012",
        "test_attr_013": "value_013",
        "test_attr_014": "value_014",
        "test_attr_015": "value_015",
        "test_attr_016": "value_016",
        "test_attr_017": "value_017",
        "test_attr_018": "value_018",
        "test_attr_019": "value_019",
        "test_attr_020": "value_020",
        "test_attr_021": "value_021",
        "test_attr_022": "value_022",
        "test_attr_023": "value_023",
        "test_attr_024": "value_024",
        "test_attr_025": "value_025",
        "test_attr_026": "value_026",
        "test_attr_027": "value_027",
        "test_attr_028": "value_028",
        "test_attr_029": "value_029",
        "test_attr_030": "value_030",
        "test_attr_031": "value_031",
        "test_attr_032": "value_032",
        "test_attr_033": "value_033",
        "test_attr_034": "value_034",
        "test_attr_035": "value_035",
        "test_attr_036": "value_036",
        "test_attr_037": "value_037",
        "test_attr_038": "value_038",
        "test_attr_039": "value_039",
        "test_attr_040": "value_040",
        "test_attr_041": "value_041",
        "test_attr_042": "value_042",
        "test_attr_043": "value_043",
        "test_attr_044": "value_044",
        "test_attr_045": "value_045",
        "test_attr_046": "value_046",
        "test_attr_047": "value_047",
        "test_attr_048": "value_048",
        "test_attr_049": "value_049",
        "test_attr_050": "value_050",
        "test_attr_051": "value_051",
        "test_attr_052": "value_052",
        "test_attr_053": "value_053",
        "test_attr_054": "value_054",
        "test_attr_055": "value_055",
        "test_attr_056": "value_056",
        "test_attr_057": "value_057",
        "test_attr_058": "value_058",
        "test_attr_059": "value_059",
        "test_attr_060": "value_060",
        "test_attr_061": "value_061",
        "test_attr_062": "value_062",
        "test_attr_063": "value_063",
        "test_attr_064": "value_064",
        "test_attr_065": "value_065",
        "test_attr_066": "value_066",
        "test_attr_067": "value_067",
        "test_attr_068": "value_068",
        "test_attr_069": "value_069",
        "test_attr_070": "value_070",
        "test_attr_071": "value_071",
        "test_attr_072": "value_072",
        "test_attr_073": "value_073",
        "test_attr_074": "value_074",
        "test_attr_075": "value_075",
        "test_attr_076": "value_076",
        "test_attr_077": "value_077",
        "test_attr_078": "value_078",
        "test_attr_079": "value_079",
        "test_attr_080": "value_080",
        "test_attr_081": "value_081",
        "test_attr_082": "value_082",
        "test_attr_083": "value_083",
        "test_attr_084": "value_084",
        "test_attr_085": "value_085",
        "test_attr_086": "value_086",
        "test_attr_087": "value_087",
        "test_attr_088": "value_088",
        "test_attr_089": "value_089",
        "test_attr_090": "value_090",
        "test_attr_091": "value_091",
        "test_attr_092": "value_092",
        "test_attr_093": "value_093",
        "test_attr_094": "value_094",
        "test_attr_095": "value_095",
        "test_attr_096": "value_096",
        "test_attr_097": "value_097",
        "test_attr_098": "value_098",
        "test_attr_099": "value_099",
        "test_attr_100": "value_100",
    }

    # Add global attributes to dataset
    ds.attrs = global_attrs

    # Save to NetCDF with compression
    ds.to_netcdf(
        output_file,
        engine="netcdf4",
        encoding={var: {"zlib": True, "complevel": 6} for var in ds.data_vars},
    )

    print(
        f"✅ Created {output_file} with {len(ds.data_vars)} variables and {len(ds.attrs)} attributes"
    )
    return output_file


def create_sample_netcdf_long_variable_names():
    """Create a sample NetCDF file with very long variable names for testing."""
    output_file = "sample_data_long_variable_names.nc"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"📏 NetCDF file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("📏 Creating sample NetCDF file with very long variable names...")

    # Create small dimensions to keep file size manageable
    time = np.arange(0, 3, 1)  # 3 time steps
    lat = np.linspace(-5, 5, 10)  # 10 latitude points
    lon = np.linspace(-5, 5, 10)  # 10 longitude points

    # Set random seed for reproducible data
    np.random.seed(42)

    # Create data variables with very long names
    data_vars = {}

    # Define very long variable names for testing
    long_variable_names = [
        "very_long_atmospheric_surface_air_temperature_anomaly_from_climatological_mean_1981_2010",
        "extremely_long_oceanographic_sea_water_salinity_concentration_measured_in_situ_using_conductivity_temperature_depth_profiler",
        "incredibly_long_meteorological_surface_air_pressure_at_mean_sea_level_adjusted_for_altitude_and_temperature_variations",
        "unbelievably_long_geophysical_earth_surface_land_cover_classification_according_to_modis_land_cover_type_international_geosphere_biosphere_programme_igbp_scheme",
        "extraordinarily_long_hydrological_precipitation_rate_accumulated_over_time_period_measured_using_tipping_bucket_rain_gauge_with_wind_speed_correction",
        "exceptionally_long_biogeochemical_phytoplankton_chlorophyll_a_concentration_in_sea_water_derived_from_satellite_ocean_color_observations",
        "remarkably_long_cryospheric_sea_ice_concentration_fractional_coverage_of_ocean_surface_derived_from_passive_microwave_satellite_observations",
        "incredibly_long_terrestrial_vegetation_index_normalized_difference_vegetation_index_ndvi_derived_from_moderate_resolution_imaging_spectroradiometer_modis_surface_reflectance_data",
        "extraordinarily_long_atmospheric_carbon_dioxide_concentration_mixing_ratio_in_dry_air_measured_using_non_dispersive_infrared_ndir_spectroscopy",
        "unbelievably_long_oceanographic_sea_surface_height_anomaly_relative_to_mean_sea_surface_derived_from_altimeter_observations_with_tidal_and_atmospheric_corrections",
    ]

    # Create data for each long variable name
    for i, var_name in enumerate(long_variable_names):
        # Create small random data with different patterns
        if "temperature" in var_name.lower():
            data = (
                20
                + 10 * np.sin(2 * np.pi * i / len(long_variable_names))
                + np.random.normal(0, 2, (3, 10, 10))
            )
        elif "pressure" in var_name.lower():
            data = (
                1013.25
                + 20 * np.cos(2 * np.pi * i / len(long_variable_names))
                + np.random.normal(0, 5, (3, 10, 10))
            )
        elif "salinity" in var_name.lower():
            data = (
                35
                + 2 * np.sin(2 * np.pi * i / len(long_variable_names))
                + np.random.normal(0, 0.5, (3, 10, 10))
            )
        elif "precipitation" in var_name.lower():
            data = np.clip(np.random.exponential(2, (3, 10, 10)), 0, 50)
        elif "chlorophyll" in var_name.lower():
            data = np.clip(np.random.exponential(1, (3, 10, 10)), 0, 10)
        elif "ice" in var_name.lower():
            data = np.clip(np.random.uniform(0, 1, (3, 10, 10)), 0, 1)
        elif "vegetation" in var_name.lower() or "ndvi" in var_name.lower():
            data = np.clip(np.random.uniform(-1, 1, (3, 10, 10)), -1, 1)
        elif "carbon" in var_name.lower():
            data = (
                400
                + 20 * np.sin(2 * np.pi * i / len(long_variable_names))
                + np.random.normal(0, 5, (3, 10, 10))
            )
        elif "height" in var_name.lower():
            data = (
                0
                + 0.5 * np.sin(2 * np.pi * i / len(long_variable_names))
                + np.random.normal(0, 0.1, (3, 10, 10))
            )
        else:
            data = np.random.normal(0, 1, (3, 10, 10))

        # Create descriptive attributes for each variable
        data_vars[var_name] = (
            ["time", "lat", "lon"],
            data.astype(np.float32),
            {
                "long_name": var_name.replace("_", " ").title(),
                "units": "1",  # Generic units for testing
                "description": f"Test variable with very long name: {var_name}",
                "source": "Generated for testing long variable name handling",
                "comment": f"This variable name has {len(var_name)} characters",
                "test_purpose": "long_variable_names",
                "name_length": len(var_name),
                "category": "test_data",
            },
        )

    # Create coordinates
    coords = {
        "time": (
            ["time"],
            time,
            {
                "long_name": "Time",
                "units": "days since 2020-01-01",
                "standard_name": "time",
                "calendar": "gregorian",
            },
        ),
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
    }

    # Create dataset
    ds = xr.Dataset(data_vars, coords=coords)

    # Add global attributes
    ds.attrs = {
        "title": "Sample NetCDF with Very Long Variable Names",
        "description": "Test dataset with extremely long variable names for testing UI handling and display",
        "institution": "Scientific Data Viewer Test Center",
        "source": "Generated for testing long variable name handling",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "Conventions": "CF-1.8",
        "featureType": "grid",
        "data_type": "test_data_long_names",
        "purpose": "testing_long_variable_names",
        "test_type": "ui_display_handling",
        "max_variable_name_length": max(len(name) for name in long_variable_names),
        "total_variables": len(long_variable_names),
        "average_name_length": sum(len(name) for name in long_variable_names)
        / len(long_variable_names),
        "longest_variable_name": max(long_variable_names, key=len),
        "shortest_variable_name": min(long_variable_names, key=len),
    }

    # Save to NetCDF
    ds.to_netcdf(output_file, engine="netcdf4")

    print(
        f"✅ Created {output_file} with {len(ds.data_vars)} variables with very long names"
    )
    print(
        f"   Longest variable name: {max(long_variable_names, key=len)} ({max(len(name) for name in long_variable_names)} characters)"
    )
    return output_file


def create_sample_netcdf_complex_long_names():
    """Create a sample NetCDF file with very long names for dimensions, coordinates, variables, and complex dtypes."""
    output_file = "sample_data_complex_long_names.nc"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"🔬 NetCDF file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print(
        "🔬 Creating sample NetCDF file with complex long names and many dimensions..."
    )

    # Create many dimensions with very long names
    time_steps = np.arange(0, 5, 1)  # 5 time steps
    vertical_levels_atmospheric_pressure = np.array(
        [1000, 925, 850, 700, 500, 300, 200, 100, 50, 30, 20, 10]
    )  # 12 pressure levels
    vertical_levels_ocean_depth = np.array(
        [0, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 3000, 4000, 5000]
    )  # 13 depth levels
    latitude_points_global_coverage = np.linspace(-90, 90, 20)  # 20 lat points
    longitude_points_global_coverage = np.linspace(-180, 180, 40)  # 40 lon points
    spectral_bands_visible_near_infrared = np.arange(1, 8)  # 7 spectral bands
    ensemble_members_perturbed_initial_conditions = np.arange(
        1, 6
    )  # 5 ensemble members
    quality_control_flags_data_assimilation = np.arange(0, 5)  # 5 QC flags
    instrument_channels_remote_sensing = np.arange(1, 4)  # 3 instrument channels

    # Set random seed for reproducible data
    np.random.seed(42)

    # Create data variables with very long names and complex structures
    data_vars = {}

    # Define very long variable names with complex data types
    complex_variable_names = [
        "atmospheric_temperature_anomaly_from_climatological_mean_1981_2010_at_multiple_pressure_levels_derived_from_radiosonde_observations_and_numerical_weather_prediction_model_output",
        "oceanographic_sea_water_salinity_concentration_measured_in_situ_using_conductivity_temperature_depth_profiler_at_various_depth_levels_with_quality_control_flags",
        "satellite_derived_vegetation_index_normalized_difference_vegetation_index_ndvi_from_moderate_resolution_imaging_spectroradiometer_modis_surface_reflectance_data_across_multiple_spectral_bands",
        "ensemble_forecast_surface_air_pressure_at_mean_sea_level_from_perturbed_initial_conditions_using_ensemble_kalman_filter_data_assimilation_system",
        "multi_instrument_remote_sensing_cloud_optical_thickness_derived_from_visible_and_infrared_spectral_measurements_with_uncertainty_estimates",
    ]

    # Create complex data for each variable
    for i, var_name in enumerate(complex_variable_names):
        # Create data with multiple dimensions based on variable type
        if "atmospheric_temperature" in var_name.lower():
            # 4D data: time, pressure_levels, lat, lon
            data = (
                20
                + 10 * np.sin(2 * np.pi * i / len(complex_variable_names))
                + np.random.normal(0, 2, (5, 12, 20, 40))
            )
            dims = [
                "time_steps",
                "vertical_levels_atmospheric_pressure",
                "latitude_points_global_coverage",
                "longitude_points_global_coverage",
            ]
            dtype = np.float32
        elif "oceanographic_sea_water_salinity" in var_name.lower():
            # 4D data: time, depth_levels, lat, lon
            data = (
                35
                + 2 * np.sin(2 * np.pi * i / len(complex_variable_names))
                + np.random.normal(0, 0.5, (5, 13, 20, 40))
            )
            dims = [
                "time_steps",
                "vertical_levels_ocean_depth",
                "latitude_points_global_coverage",
                "longitude_points_global_coverage",
            ]
            dtype = np.float32
        elif "satellite_derived_vegetation" in var_name.lower():
            # 5D data: time, spectral_bands, lat, lon, ensemble_members
            data = np.clip(np.random.uniform(-1, 1, (5, 7, 20, 40, 5)), -1, 1)
            dims = [
                "time_steps",
                "spectral_bands_visible_near_infrared",
                "latitude_points_global_coverage",
                "longitude_points_global_coverage",
                "ensemble_members_perturbed_initial_conditions",
            ]
            dtype = np.float32
        elif "ensemble_forecast_surface_air_pressure" in var_name.lower():
            # 4D data: time, lat, lon, ensemble_members
            data = (
                1013.25
                + 20 * np.cos(2 * np.pi * i / len(complex_variable_names))
                + np.random.normal(0, 5, (5, 20, 40, 5))
            )
            dims = [
                "time_steps",
                "latitude_points_global_coverage",
                "longitude_points_global_coverage",
                "ensemble_members_perturbed_initial_conditions",
            ]
            dtype = np.float32
        elif "multi_instrument_remote_sensing" in var_name.lower():
            # 5D data: time, lat, lon, instrument_channels, quality_control_flags
            data = np.clip(np.random.exponential(1, (5, 20, 40, 3, 5)), 0, 10)
            dims = [
                "time_steps",
                "latitude_points_global_coverage",
                "longitude_points_global_coverage",
                "instrument_channels_remote_sensing",
                "quality_control_flags_data_assimilation",
            ]
            dtype = np.float32
        else:
            # Default 3D data
            data = np.random.normal(0, 1, (5, 20, 40))
            dims = [
                "time_steps",
                "latitude_points_global_coverage",
                "longitude_points_global_coverage",
            ]
            dtype = np.float32

        # Create comprehensive attributes for each variable
        data_vars[var_name] = (
            dims,
            data.astype(dtype),
            {
                "long_name": var_name.replace("_", " ").title(),
                "units": "1",  # Generic units for testing
                "description": f"Complex test variable with very long name and multiple dimensions: {var_name}",
                "source": "Generated for testing complex long name handling",
                "comment": f"This variable name has {len(var_name)} characters and {len(dims)} dimensions",
                "test_purpose": "complex_long_names_multiple_dimensions",
                "name_length": len(var_name),
                "dimension_count": len(dims),
                "data_type": str(dtype),
                "category": "complex_test_data",
                "dimensions": dims,
                "shape": list(data.shape),
                "total_elements": data.size,
                "memory_size_bytes": data.nbytes,
            },
        )

    # Create coordinates with very long names
    coords = {
        "time_steps": (
            ["time_steps"],
            time_steps,
            {
                "long_name": "Time Steps in Days Since Reference Date",
                "units": "days since 2020-01-01",
                "standard_name": "time",
                "calendar": "gregorian",
                "axis": "T",
                "description": "Temporal dimension representing time steps in the dataset",
            },
        ),
        "vertical_levels_atmospheric_pressure": (
            ["vertical_levels_atmospheric_pressure"],
            vertical_levels_atmospheric_pressure,
            {
                "long_name": "Vertical Levels of Atmospheric Pressure in Hectopascals",
                "units": "hPa",
                "standard_name": "air_pressure",
                "positive": "down",
                "axis": "Z",
                "description": "Vertical dimension representing atmospheric pressure levels",
            },
        ),
        "vertical_levels_ocean_depth": (
            ["vertical_levels_ocean_depth"],
            vertical_levels_ocean_depth,
            {
                "long_name": "Vertical Levels of Ocean Depth in Meters Below Sea Surface",
                "units": "m",
                "standard_name": "depth",
                "positive": "down",
                "axis": "Z",
                "description": "Vertical dimension representing ocean depth levels",
            },
        ),
        "latitude_points_global_coverage": (
            ["latitude_points_global_coverage"],
            latitude_points_global_coverage,
            {
                "long_name": "Latitude Points for Global Coverage in Degrees North",
                "units": "degrees_north",
                "standard_name": "latitude",
                "axis": "Y",
                "description": "Latitudinal dimension for global spatial coverage",
            },
        ),
        "longitude_points_global_coverage": (
            ["longitude_points_global_coverage"],
            longitude_points_global_coverage,
            {
                "long_name": "Longitude Points for Global Coverage in Degrees East",
                "units": "degrees_east",
                "standard_name": "longitude",
                "axis": "X",
                "description": "Longitudinal dimension for global spatial coverage",
            },
        ),
        "spectral_bands_visible_near_infrared": (
            ["spectral_bands_visible_near_infrared"],
            spectral_bands_visible_near_infrared,
            {
                "long_name": "Spectral Bands in Visible and Near-Infrared Wavelength Range",
                "units": "1",
                "standard_name": "wavelength",
                "description": "Spectral dimension for multi-band remote sensing data",
            },
        ),
        "ensemble_members_perturbed_initial_conditions": (
            ["ensemble_members_perturbed_initial_conditions"],
            ensemble_members_perturbed_initial_conditions,
            {
                "long_name": "Ensemble Members with Perturbed Initial Conditions",
                "units": "1",
                "standard_name": "realization",
                "description": "Ensemble dimension for probabilistic forecasts",
            },
        ),
        "quality_control_flags_data_assimilation": (
            ["quality_control_flags_data_assimilation"],
            quality_control_flags_data_assimilation,
            {
                "long_name": "Quality Control Flags for Data Assimilation System",
                "units": "1",
                "flag_values": [0, 1, 2, 3, 4],
                "flag_meanings": "good questionable bad missing not_applicable",
                "description": "Quality control dimension for data quality assessment",
            },
        ),
        "instrument_channels_remote_sensing": (
            ["instrument_channels_remote_sensing"],
            instrument_channels_remote_sensing,
            {
                "long_name": "Instrument Channels for Remote Sensing Observations",
                "units": "1",
                "standard_name": "sensor_band",
                "description": "Instrument dimension for multi-channel remote sensing",
            },
        ),
    }

    # Create dataset
    ds = xr.Dataset(data_vars, coords=coords)

    # Add comprehensive global attributes
    ds.attrs = {
        "title": "Sample NetCDF with Complex Long Names and Many Dimensions",
        "description": "Test dataset with extremely long names for dimensions, coordinates, variables, and complex data types for comprehensive UI testing",
        "institution": "Scientific Data Viewer Test Center",
        "source": "Generated for testing complex long name handling",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "Conventions": "CF-1.8",
        "featureType": "grid",
        "data_type": "complex_test_data_long_names",
        "purpose": "testing_complex_long_names_multiple_dimensions",
        "test_type": "comprehensive_ui_display_handling",
        "max_variable_name_length": max(len(name) for name in complex_variable_names),
        "max_dimension_name_length": max(len(name) for name in coords.keys()),
        "max_coordinate_name_length": max(len(name) for name in coords.keys()),
        "total_variables": len(ds.data_vars),
        "total_dimensions": len(ds.dims),
        "total_coordinates": len(ds.coords),
        "average_variable_name_length": sum(
            len(name) for name in complex_variable_names
        )
        / len(complex_variable_names),
        "average_dimension_name_length": sum(len(name) for name in coords.keys())
        / len(coords.keys()),
        "longest_variable_name": max(complex_variable_names, key=len),
        "longest_dimension_name": max(coords.keys(), key=len),
        "shortest_variable_name": min(complex_variable_names, key=len),
        "shortest_dimension_name": min(coords.keys(), key=len),
        "complex_data_types": "float32",
        "dimension_statistics": f"time_steps:{len(time_steps)}, vertical_levels_atmospheric_pressure:{len(vertical_levels_atmospheric_pressure)}, vertical_levels_ocean_depth:{len(vertical_levels_ocean_depth)}, latitude_points_global_coverage:{len(latitude_points_global_coverage)}, longitude_points_global_coverage:{len(longitude_points_global_coverage)}, spectral_bands_visible_near_infrared:{len(spectral_bands_visible_near_infrared)}, ensemble_members_perturbed_initial_conditions:{len(ensemble_members_perturbed_initial_conditions)}, quality_control_flags_data_assimilation:{len(quality_control_flags_data_assimilation)}, instrument_channels_remote_sensing:{len(instrument_channels_remote_sensing)}",
        "total_data_points": sum(data.size for data in ds.data_vars.values()),
        "file_size_estimate": "large",
        "ui_testing_categories": "long_variable_names, long_dimension_names, long_coordinate_names, multiple_dimensions, complex_data_structures, comprehensive_attributes, ui_display_handling, tree_navigation, metadata_display",
    }

    # Save to NetCDF with compression
    ds.to_netcdf(output_file, engine="netcdf4")

    print(
        f"✅ Created {output_file} with {len(ds.data_vars)} variables, {len(ds.dims)} dimensions, and {len(ds.coords)} coordinates"
    )
    print(
        f"   Longest variable name: {max(complex_variable_names, key=len)} ({max(len(name) for name in complex_variable_names)} characters)"
    )
    print(
        f"   Longest dimension name: {max(coords.keys(), key=len)} ({max(len(name) for name in coords.keys())} characters)"
    )
    print(f"   Total data points: {sum(data.size for data in ds.data_vars.values()):,}")
    return output_file


def create_sample_netcdf_many_encoding():
    """Create a sample NetCDF file with many different encoding combinations to test CF attributes."""
    output_file = "sample_many_encoding.nc"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"🔧 NetCDF file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("🔧 Creating sample NetCDF file with many encoding combinations...")

    # Create small dimensions to keep file size manageable
    time = np.arange(0, 3, 1)  # 3 time steps
    lat = np.linspace(-5, 5, 8)  # 8 latitude points
    lon = np.linspace(-5, 5, 8)  # 8 longitude points
    level = np.array([1000, 850, 700, 500])  # 4 pressure levels

    # Set random seed for reproducible data
    np.random.seed(42)

    # Create data variables with different encoding combinations
    data_vars = {}

    # 1. Basic CF standard attributes
    temp_data = (
        20
        + 10 * np.sin(2 * np.pi * time[:, np.newaxis, np.newaxis, np.newaxis] / 3)
        + np.random.normal(0, 2, (3, 4, 8, 8))
    )
    data_vars["temperature"] = (
        ["time", "level", "lat", "lon"],
        temp_data.astype(np.float32),
        {
            "long_name": "Air Temperature",
            "standard_name": "air_temperature",
            "units": "K",
            "valid_range": [200.0, 350.0],
            "valid_min": 200.0,
            "valid_max": 350.0,
            "missing_value": -999.0,
            "_FillValue": -999.0,
            "scale_factor": 1.0,
            "add_offset": 0.0,
            "cell_methods": "time: mean",
            "coordinates": "time level lat lon",
            "grid_mapping": "crs",
            "ancillary_variables": "temperature_qc",
            "comment": "Temperature with basic CF attributes",
        },
    )

    # 2. Pressure with different encoding
    press_data = (
        1013.25
        + 20 * np.cos(2 * np.pi * time[:, np.newaxis, np.newaxis, np.newaxis] / 3)
        + np.random.normal(0, 5, (3, 4, 8, 8))
    )
    data_vars["pressure"] = (
        ["time", "level", "lat", "lon"],
        press_data.astype(np.float64),
        {
            "long_name": "Surface Air Pressure",
            "standard_name": "surface_air_pressure",
            "units": "Pa",
            "valid_range": [80000.0, 110000.0],
            "valid_min": 80000.0,
            "valid_max": 110000.0,
            "missing_value": -9999.0,
            "_FillValue": -9999.0,
            "scale_factor": 0.01,
            "add_offset": 0.0,
            "cell_methods": "time: point",
            "coordinates": "time level lat lon",
            "grid_mapping": "crs",
            "ancillary_variables": "pressure_qc",
            "comment": "Pressure with different encoding parameters",
        },
    )

    # 3. Humidity with flag values and meanings
    humid_data = (
        50
        + 30 * np.sin(2 * np.pi * time[:, np.newaxis, np.newaxis, np.newaxis] / 3)
        + np.random.normal(0, 10, (3, 4, 8, 8))
    )
    humid_data = np.clip(humid_data, 0, 100)
    data_vars["humidity"] = (
        ["time", "level", "lat", "lon"],
        humid_data.astype(np.int16),
        {
            "long_name": "Relative Humidity",
            "standard_name": "relative_humidity",
            "units": "%",
            "valid_range": [0.0, 100.0],
            "valid_min": 0.0,
            "valid_max": 100.0,
            "missing_value": -999,
            "_FillValue": -999,
            "scale_factor": 0.1,
            "add_offset": 0.0,
            "flag_values": [0, 1, 2, 3, 4],
            "flag_meanings": "good questionable bad missing not_applicable",
            "flag_masks": [1, 2, 4, 8, 16],
            "cell_methods": "time: mean",
            "coordinates": "time level lat lon",
            "grid_mapping": "crs",
            "ancillary_variables": "humidity_qc",
            "comment": "Humidity with flag values and meanings",
        },
    )

    # 4. Wind speed with different data type and encoding
    wind_data = (
        5
        + 10 * np.sin(2 * np.pi * time[:, np.newaxis, np.newaxis, np.newaxis] / 3)
        + np.random.normal(0, 2, (3, 4, 8, 8))
    )
    wind_data = np.clip(wind_data, 0, 50)
    data_vars["wind_speed"] = (
        ["time", "level", "lat", "lon"],
        wind_data.astype(np.uint8),
        {
            "long_name": "Wind Speed",
            "standard_name": "wind_speed",
            "units": "m s-1",
            "valid_range": [0.0, 50.0],
            "valid_min": 0.0,
            "valid_max": 50.0,
            "missing_value": 255,
            "_FillValue": 255,
            "scale_factor": 0.2,
            "add_offset": 0.0,
            "cell_methods": "time: maximum",
            "coordinates": "time level lat lon",
            "grid_mapping": "crs",
            "ancillary_variables": "wind_speed_qc",
            "comment": "Wind speed with uint8 encoding",
        },
    )

    # 5. Precipitation with different encoding and bounds
    precip_data = np.clip(np.random.exponential(2, (3, 4, 8, 8)), 0, 100)
    data_vars["precipitation"] = (
        ["time", "level", "lat", "lon"],
        precip_data.astype(np.float32),
        {
            "long_name": "Precipitation Rate",
            "standard_name": "precipitation_flux",
            "units": "kg m-2 s-1",
            "valid_range": [0.0, 100.0],
            "valid_min": 0.0,
            "valid_max": 100.0,
            "missing_value": -999.0,
            "_FillValue": -999.0,
            "scale_factor": 0.001,
            "add_offset": 0.0,
            "cell_methods": "time: sum",
            "coordinates": "time level lat lon",
            "grid_mapping": "crs",
            "ancillary_variables": "precipitation_qc",
            "bounds": "precipitation_bounds",
            "comment": "Precipitation with bounds attribute",
        },
    )

    # 6. Cloud cover with different encoding
    cloud_data = np.clip(np.random.uniform(0, 1, (3, 4, 8, 8)), 0, 1)
    data_vars["cloud_cover"] = (
        ["time", "level", "lat", "lon"],
        cloud_data.astype(np.int8),
        {
            "long_name": "Cloud Cover Fraction",
            "standard_name": "cloud_area_fraction",
            "units": "1",
            "valid_range": [0.0, 1.0],
            "valid_min": 0.0,
            "valid_max": 1.0,
            "missing_value": -128,
            "_FillValue": -128,
            "scale_factor": 0.01,
            "add_offset": 0.0,
            "cell_methods": "time: mean",
            "coordinates": "time level lat lon",
            "grid_mapping": "crs",
            "ancillary_variables": "cloud_cover_qc",
            "comment": "Cloud cover with int8 encoding",
        },
    )

    # 7. Temperature anomaly with different encoding
    temp_anom_data = temp_data - 20
    data_vars["temperature_anomaly"] = (
        ["time", "level", "lat", "lon"],
        temp_anom_data.astype(np.int16),
        {
            "long_name": "Temperature Anomaly",
            "standard_name": "air_temperature_anomaly",
            "units": "K",
            "valid_range": [-20.0, 20.0],
            "valid_min": -20.0,
            "valid_max": 20.0,
            "missing_value": -32768,
            "_FillValue": -32768,
            "scale_factor": 0.01,
            "add_offset": 0.0,
            "cell_methods": "time: mean",
            "coordinates": "time level lat lon",
            "grid_mapping": "crs",
            "ancillary_variables": "temperature_anomaly_qc",
            "comment": "Temperature anomaly with int16 encoding",
        },
    )

    # 8. Quality control flags
    qc_data = np.random.randint(0, 4, (3, 4, 8, 8), dtype=np.int8)
    data_vars["temperature_qc"] = (
        ["time", "level", "lat", "lon"],
        qc_data,
        {
            "long_name": "Temperature Quality Control",
            "units": "1",
            "flag_values": [0, 1, 2, 3],
            "flag_meanings": "good questionable bad missing",
            "flag_masks": [1, 2, 4, 8],
            "valid_range": [0, 3],
            "valid_min": 0,
            "valid_max": 3,
            "missing_value": -1,
            "_FillValue": -1,
            "scale_factor": 1.0,
            "add_offset": 0.0,
            "cell_methods": "time: point",
            "coordinates": "time level lat lon",
            "grid_mapping": "crs",
            "comment": "Quality control flags for temperature",
        },
    )

    # 9. Pressure quality control
    press_qc_data = np.random.randint(0, 4, (3, 4, 8, 8), dtype=np.int8)
    data_vars["pressure_qc"] = (
        ["time", "level", "lat", "lon"],
        press_qc_data,
        {
            "long_name": "Pressure Quality Control",
            "units": "1",
            "flag_values": [0, 1, 2, 3],
            "flag_meanings": "good questionable bad missing",
            "flag_masks": [1, 2, 4, 8],
            "valid_range": [0, 3],
            "valid_min": 0,
            "valid_max": 3,
            "missing_value": -1,
            "_FillValue": -1,
            "scale_factor": 1.0,
            "add_offset": 0.0,
            "cell_methods": "time: point",
            "coordinates": "time level lat lon",
            "grid_mapping": "crs",
            "comment": "Quality control flags for pressure",
        },
    )

    # 10. Humidity quality control
    humid_qc_data = np.random.randint(0, 4, (3, 4, 8, 8), dtype=np.int8)
    data_vars["humidity_qc"] = (
        ["time", "level", "lat", "lon"],
        humid_qc_data,
        {
            "long_name": "Humidity Quality Control",
            "units": "1",
            "flag_values": [0, 1, 2, 3],
            "flag_meanings": "good questionable bad missing",
            "flag_masks": [1, 2, 4, 8],
            "valid_range": [0, 3],
            "valid_min": 0,
            "valid_max": 3,
            "missing_value": -1,
            "_FillValue": -1,
            "scale_factor": 1.0,
            "add_offset": 0.0,
            "cell_methods": "time: point",
            "coordinates": "time level lat lon",
            "grid_mapping": "crs",
            "comment": "Quality control flags for humidity",
        },
    )

    # 11. Wind speed quality control
    wind_qc_data = np.random.randint(0, 4, (3, 4, 8, 8), dtype=np.int8)
    data_vars["wind_speed_qc"] = (
        ["time", "level", "lat", "lon"],
        wind_qc_data,
        {
            "long_name": "Wind Speed Quality Control",
            "units": "1",
            "flag_values": [0, 1, 2, 3],
            "flag_meanings": "good questionable bad missing",
            "flag_masks": [1, 2, 4, 8],
            "valid_range": [0, 3],
            "valid_min": 0,
            "valid_max": 3,
            "missing_value": -1,
            "_FillValue": -1,
            "scale_factor": 1.0,
            "add_offset": 0.0,
            "cell_methods": "time: point",
            "coordinates": "time level lat lon",
            "grid_mapping": "crs",
            "comment": "Quality control flags for wind speed",
        },
    )

    # 12. Precipitation quality control
    precip_qc_data = np.random.randint(0, 4, (3, 4, 8, 8), dtype=np.int8)
    data_vars["precipitation_qc"] = (
        ["time", "level", "lat", "lon"],
        precip_qc_data,
        {
            "long_name": "Precipitation Quality Control",
            "units": "1",
            "flag_values": [0, 1, 2, 3],
            "flag_meanings": "good questionable bad missing",
            "flag_masks": [1, 2, 4, 8],
            "valid_range": [0, 3],
            "valid_min": 0,
            "valid_max": 3,
            "missing_value": -1,
            "_FillValue": -1,
            "scale_factor": 1.0,
            "add_offset": 0.0,
            "cell_methods": "time: point",
            "coordinates": "time level lat lon",
            "grid_mapping": "crs",
            "comment": "Quality control flags for precipitation",
        },
    )

    # 13. Cloud cover quality control
    cloud_qc_data = np.random.randint(0, 4, (3, 4, 8, 8), dtype=np.int8)
    data_vars["cloud_cover_qc"] = (
        ["time", "level", "lat", "lon"],
        cloud_qc_data,
        {
            "long_name": "Cloud Cover Quality Control",
            "units": "1",
            "flag_values": [0, 1, 2, 3],
            "flag_meanings": "good questionable bad missing",
            "flag_masks": [1, 2, 4, 8],
            "valid_range": [0, 3],
            "valid_min": 0,
            "valid_max": 3,
            "missing_value": -1,
            "_FillValue": -1,
            "scale_factor": 1.0,
            "add_offset": 0.0,
            "cell_methods": "time: point",
            "coordinates": "time level lat lon",
            "grid_mapping": "crs",
            "comment": "Quality control flags for cloud cover",
        },
    )

    # 14. Temperature anomaly quality control
    temp_anom_qc_data = np.random.randint(0, 4, (3, 4, 8, 8), dtype=np.int8)
    data_vars["temperature_anomaly_qc"] = (
        ["time", "level", "lat", "lon"],
        temp_anom_qc_data,
        {
            "long_name": "Temperature Anomaly Quality Control",
            "units": "1",
            "flag_values": [0, 1, 2, 3],
            "flag_meanings": "good questionable bad missing",
            "flag_masks": [1, 2, 4, 8],
            "valid_range": [0, 3],
            "valid_min": 0,
            "valid_max": 3,
            "missing_value": -1,
            "_FillValue": -1,
            "scale_factor": 1.0,
            "add_offset": 0.0,
            "cell_methods": "time: point",
            "coordinates": "time level lat lon",
            "grid_mapping": "crs",
            "comment": "Quality control flags for temperature anomaly",
        },
    )

    # 15. Precipitation bounds
    precip_bounds_data = np.stack([precip_data, precip_data + 0.1], axis=-1)
    data_vars["precipitation_bounds"] = (
        ["time", "level", "lat", "lon", "bounds"],
        precip_bounds_data.astype(np.float32),
        {
            "long_name": "Precipitation Rate Bounds",
            "units": "kg m-2 s-1",
            "comment": "Bounds for precipitation rate",
        },
    )

    # Create coordinates with different encoding
    coords = {
        "time": (
            ["time"],
            time,
            {
                "long_name": "Time",
                "units": "days since 2020-01-01",
                "standard_name": "time",
                "calendar": "gregorian",
                "axis": "T",
                "valid_range": [0.0, 2.0],
                "valid_min": 0.0,
                "valid_max": 2.0,
                "missing_value": -999.0,
                "_FillValue": -999.0,
                "scale_factor": 1.0,
                "add_offset": 0.0,
                "cell_methods": "time: point",
                "bounds": "time_bounds",
                "comment": "Time coordinate with bounds",
            },
        ),
        "level": (
            ["level"],
            level,
            {
                "long_name": "Pressure Level",
                "units": "hPa",
                "standard_name": "air_pressure",
                "positive": "down",
                "axis": "Z",
                "valid_range": [100.0, 1100.0],
                "valid_min": 100.0,
                "valid_max": 1100.0,
                "missing_value": -999.0,
                "_FillValue": -999.0,
                "scale_factor": 1.0,
                "add_offset": 0.0,
                "cell_methods": "level: point",
                "bounds": "level_bounds",
                "comment": "Pressure level coordinate with bounds",
            },
        ),
        "lat": (
            ["lat"],
            lat,
            {
                "long_name": "Latitude",
                "units": "degrees_north",
                "standard_name": "latitude",
                "axis": "Y",
                "valid_range": [-90.0, 90.0],
                "valid_min": -90.0,
                "valid_max": 90.0,
                "missing_value": -999.0,
                "_FillValue": -999.0,
                "scale_factor": 1.0,
                "add_offset": 0.0,
                "cell_methods": "lat: point",
                "bounds": "lat_bounds",
                "comment": "Latitude coordinate with bounds",
            },
        ),
        "lon": (
            ["lon"],
            lon,
            {
                "long_name": "Longitude",
                "units": "degrees_east",
                "standard_name": "longitude",
                "axis": "X",
                "valid_range": [-180.0, 180.0],
                "valid_min": -180.0,
                "valid_max": 180.0,
                "missing_value": -999.0,
                "_FillValue": -999.0,
                "scale_factor": 1.0,
                "add_offset": 0.0,
                "cell_methods": "lon: point",
                "bounds": "lon_bounds",
                "comment": "Longitude coordinate with bounds",
            },
        ),
    }

    # Add bounds coordinates
    time_bounds = np.column_stack([time, time + 1])
    coords["time_bounds"] = (
        ["time", "bounds"],
        time_bounds,
        {
            "long_name": "Time Bounds",
            "units": "days since 2020-01-01",
            "comment": "Time bounds for each time step",
        },
    )

    level_bounds = np.column_stack([level - 25, level + 25])
    coords["level_bounds"] = (
        ["level", "bounds"],
        level_bounds,
        {
            "long_name": "Pressure Level Bounds",
            "units": "hPa",
            "comment": "Pressure level bounds for each level",
        },
    )

    lat_bounds = np.column_stack([lat - 0.625, lat + 0.625])
    coords["lat_bounds"] = (
        ["lat", "bounds"],
        lat_bounds,
        {
            "long_name": "Latitude Bounds",
            "units": "degrees_north",
            "comment": "Latitude bounds for each grid cell",
        },
    )

    lon_bounds = np.column_stack([lon - 0.625, lon + 0.625])
    coords["lon_bounds"] = (
        ["lon", "bounds"],
        lon_bounds,
        {
            "long_name": "Longitude Bounds",
            "units": "degrees_east",
            "comment": "Longitude bounds for each grid cell",
        },
    )

    # Create dataset
    ds = xr.Dataset(data_vars, coords=coords)

    # Add comprehensive global attributes
    ds.attrs = {
        "title": "Sample NetCDF with Many Encoding Combinations",
        "description": "Test dataset with various encoding combinations to test CF attributes handling in the VSCode extension",
        "institution": "Scientific Data Viewer Test Center",
        "source": "Generated for testing encoding combinations",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "Conventions": "CF-1.8",
        "featureType": "grid",
        "data_type": "test_data_encoding",
        "purpose": "testing_encoding_combinations",
        "test_type": "cf_attributes_encoding",
        "total_variables": len(ds.data_vars),
        "total_coordinates": len(ds.coords),
        "encoding_types": "float32, float64, int8, int16, uint8",
        "cf_attributes_tested": "valid_range, valid_min, valid_max, missing_value, _FillValue, scale_factor, add_offset, flag_values, flag_meanings, flag_masks, cell_methods, coordinates, grid_mapping, ancillary_variables, bounds, comment, long_name, standard_name, units",
        "data_compression": "zlib",
        "compression_level": 6,
        "chunk_sizes": "optimized",
        "file_format": "NetCDF-4",
        "netcdf_version": "4.0",
        "hdf5_version": "1.10.0",
        "zlib_version": "1.2.11",
        "creation_tool": "xarray",
        "creation_tool_version": "0.20.0",
        "python_version": "3.9.0",
        "numpy_version": "1.21.0",
        "ui_testing_categories": "encoding_combinations, cf_attributes, data_types, compression, quality_control, bounds, ancillary_variables, grid_mapping, cell_methods, flag_values, scale_factor, add_offset, valid_range, missing_values",
    }

    # Save to NetCDF with different encoding for each variable
    encoding = {}
    for var in ds.data_vars:
        if var.endswith("_qc"):
            # Quality control variables - no compression
            encoding[var] = {"zlib": False, "complevel": 0}
        elif var in ["temperature", "pressure"]:
            # Main variables - high compression
            encoding[var] = {"zlib": True, "complevel": 9}
        elif var in ["humidity", "wind_speed", "precipitation"]:
            # Secondary variables - medium compression
            encoding[var] = {"zlib": True, "complevel": 6}
        else:
            # Other variables - low compression
            encoding[var] = {"zlib": True, "complevel": 3}

    # Add encoding for coordinates
    for coord in ds.coords:
        if coord.endswith("_bounds"):
            encoding[coord] = {"zlib": False, "complevel": 0}
        else:
            encoding[coord] = {"zlib": True, "complevel": 1}

    ds.to_netcdf(output_file, engine="netcdf4", encoding=encoding)

    print(
        f"✅ Created {output_file} with {len(ds.data_vars)} variables and {len(ds.coords)} coordinates"
    )
    print(f"   Encoding types: float32, float64, int8, int16, uint8")
    print(
        f"   CF attributes tested: valid_range, valid_min, valid_max, missing_value, _FillValue, scale_factor, add_offset, flag_values, flag_meanings, flag_masks, cell_methods, coordinates, grid_mapping, ancillary_variables, bounds"
    )
    print(
        f"   Quality control variables: {len([v for v in ds.data_vars if v.endswith('_qc')])}"
    )
    print(
        f"   Bounds variables: {len([v for v in ds.coords if v.endswith('_bounds')])}"
    )
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

        netcdf_cdf_file = create_sample_netcdf_cdf()
        if netcdf_cdf_file:
            created_files.append((netcdf_cdf_file, "NetCDF CDF"))

        netcdf_netcdf_file = create_sample_netcdf_netcdf()
        if netcdf_netcdf_file:
            created_files.append((netcdf_netcdf_file, "NetCDF NETCDF"))

        many_vars_netcdf_file = create_sample_netcdf_many_vars()
        if many_vars_netcdf_file:
            created_files.append((many_vars_netcdf_file, "NetCDF (Many Variables)"))

        multigroup_netcdf_file = create_sample_netcdf_multiple_groups()
        if multigroup_netcdf_file:
            created_files.append((multigroup_netcdf_file, "NetCDF Multiple Groups"))
        else:
            skipped_files.append("NetCDF Multiple Groups (netCDF4 not available)")

        long_names_netcdf_file = create_sample_netcdf_long_variable_names()
        if long_names_netcdf_file:
            created_files.append(
                (long_names_netcdf_file, "NetCDF (Long Variable Names)")
            )

        complex_long_names_netcdf_file = create_sample_netcdf_complex_long_names()
        if complex_long_names_netcdf_file:
            created_files.append(
                (complex_long_names_netcdf_file, "NetCDF (Complex Long Names)")
            )

        many_encoding_netcdf_file = create_sample_netcdf_many_encoding()
        if many_encoding_netcdf_file:
            created_files.append((many_encoding_netcdf_file, "NetCDF (Many Encoding)"))

        print("\n📁 Creating HDF5 files...")
        hdf5_file = create_sample_hdf5()
        if hdf5_file:
            created_files.append((hdf5_file, "HDF5"))

        hdf5_hdf5_file = create_sample_hdf5_hdf5()
        if hdf5_hdf5_file:
            created_files.append((hdf5_hdf5_file, "HDF5 HDF5"))

        print("\n📁 Creating GRIB files...")
        grib_file = create_sample_grib()
        if grib_file:
            created_files.append((grib_file, "GRIB"))
        else:
            skipped_files.append("GRIB (cfgrib not available)")

        grib2_file = create_sample_grib_grib2()
        if grib2_file:
            created_files.append((grib2_file, "GRIB2"))
        else:
            skipped_files.append("GRIB2 (eccodes not available)")

        grib_grb_file = create_sample_grib_grb()
        if grib_grb_file:
            created_files.append((grib_grb_file, "GRIB GRB"))
        else:
            skipped_files.append("GRIB GRB (eccodes not available)")

        print("\n📁 Creating GeoTIFF files...")
        geotiff_file = create_sample_geotiff()
        if geotiff_file:
            created_files.append((geotiff_file, "GeoTIFF"))
        else:
            skipped_files.append("GeoTIFF (rioxarray not available)")

        geotiff_tiff_file = create_sample_geotiff_tiff()
        if geotiff_tiff_file:
            created_files.append((geotiff_tiff_file, "GeoTIFF TIFF"))
        else:
            skipped_files.append("GeoTIFF TIFF (rioxarray not available)")

        geotiff_geotiff_file = create_sample_geotiff_geotiff()
        if geotiff_geotiff_file:
            created_files.append((geotiff_geotiff_file, "GeoTIFF GEOTIFF"))
        else:
            skipped_files.append("GeoTIFF GEOTIFF (rioxarray not available)")

        print("\n📁 Creating JPEG-2000 files...")
        jp2_file = create_sample_jp2()
        if jp2_file:
            created_files.append((jp2_file, "JPEG-2000"))
        else:
            skipped_files.append("JPEG-2000 (rioxarray not available)")

        jp2_jpeg2000_file = create_sample_jp2_jpeg2000()
        if jp2_jpeg2000_file:
            created_files.append((jp2_jpeg2000_file, "JPEG-2000 JPEG2000"))
        else:
            skipped_files.append("JPEG-2000 JPEG2000 (rioxarray not available)")

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

        arborescence_zarr_file = create_sample_zarr_arborescence()
        if arborescence_zarr_file:
            created_files.append((arborescence_zarr_file, "Zarr Arborescence"))
        else:
            skipped_files.append("Zarr Arborescence (zarr or xarray not available)")

        inherited_coords_zarr_file = create_sample_zarr_inherited_coords()
        if inherited_coords_zarr_file:
            created_files.append((inherited_coords_zarr_file, "Zarr Inherited Coords"))
        else:
            skipped_files.append("Zarr Inherited Coords (zarr or xarray not available)")

        print("\n📁 Creating Sentinel-1 SAFE files...")
        sentinel_file = create_sample_sentinel()
        if sentinel_file:
            created_files.append((sentinel_file, "Sentinel-1 SAFE"))
        else:
            skipped_files.append("Sentinel-1 SAFE (xarray-sentinel not available)")

        print("\n📄 Creating file with spaces in name...")
        spaces_file = create_sample_file_with_spaces()
        if spaces_file:
            created_files.append((spaces_file, "File with Spaces"))

        print("\n💥 Creating broken files for error handling...")
        broken_files = create_broken_files()
        if broken_files:
            for broken_file in broken_files:
                created_files.append((broken_file, "Broken File"))

        # print("\n🗑️ Creating disposable files for deletion testing...")
        # cleanup_disposable_files()

        # disposable_netcdf_files = create_disposable_netcdf_files()
        # if disposable_netcdf_files:
        #     for disposable_file in disposable_netcdf_files:
        #         created_files.append((disposable_file, "Disposable NetCDF"))

        # disposable_zarr_files = create_disposable_zarr_files()
        # if disposable_zarr_files:
        #     for disposable_file in disposable_zarr_files:
        #         created_files.append((disposable_file, "Disposable Zarr"))

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
