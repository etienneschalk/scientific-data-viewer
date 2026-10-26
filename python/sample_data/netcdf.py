"""Basic NetCDF / CDF samples (extensions, encodings, edge cases)."""

import os
from datetime import datetime, timedelta

import numpy as np
import xarray as xr

from sample_data.common import optional_pkg_available


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


def create_sample_netcdf_broken_datetime_variable():
    """Create a NetCDF file with invalid time units (issue #136 degraded-mode test)."""
    output_file = "broken_datetime_variable.nc"

    if os.path.exists(output_file):
        print(f"📄 NetCDF file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    if not optional_pkg_available("netCDF4"):
        print("⚠️  netCDF4 not available; skipping broken_datetime_variable.nc")
        return None

    import netCDF4

    print("🌡️ Creating NetCDF file with broken datetime units...")

    with netCDF4.Dataset(output_file, "w") as ds:
        ds.createDimension("x", 3)
        ds.createDimension("y", 2)
        var = ds.createVariable("delta", "f4", ("y", "x"))
        var[:] = np.arange(6, dtype=np.float32).reshape(2, 3)
        var.units = "(days since 2000-01-01 00:00:00)-1"
        var.long_name = "Variable with invalid CF time units"
        ds.title = "Broken datetime variable sample (issue #136)"

    print(f"✅ Created {output_file}")
    return output_file


def create_sample_netcdf_compound_dtype_variable():
    """Create a NetCDF file with a compound dtype (issue #137 attribute-display repro).

    Based on the NumPy structured-array pets example (basics.rec). netCDF4 compound
    types use fixed-length bytes (S10) instead of Unicode (U10).
    """
    output_file = "compound_dtype_variable.nc"

    if os.path.exists(output_file):
        print(f"📄 NetCDF file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    if not optional_pkg_available("netCDF4"):
        print("⚠️  netCDF4 not available; skipping compound_dtype_variable.nc")
        return None

    import netCDF4

    print("🐾 Creating NetCDF file with compound dtype (structured array)...")

    # https://numpy.org/doc/stable/user/basics.rec.html — Rex/Fido pets example
    pet_dtype = np.dtype([("name", "S10"), ("age", "i4"), ("weight", "f4")])
    pets = np.array([(b"Rex", 9, 81.0), (b"Fido", 3, 27.0)], dtype=pet_dtype)

    with netCDF4.Dataset(output_file, "w") as ds:
        ds.createDimension("pet", len(pets))
        pet_record = ds.createCompoundType(pet_dtype, "pet_record")
        var = ds.createVariable("pets", pet_record, ("pet",))
        var[:] = pets
        var.long_name = "Pet records (numpy structured array example, issue #137)"
        ds.title = "Compound dtype sample (issue #137)"

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
    """Create a sample NASA CDF file with .cdf extension using cdflib."""
    output_file = "sample_data.cdf"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"📄 CDF file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    try:
        import cdflib
    except ImportError:
        print("⚠️  cdflib is not installed. Skipping CDF file creation.")
        print("  💡 Install it with: pip install cdflib")
        return None

    print("🌡️ Creating sample NASA CDF file...")

    # Create time dimension
    time = np.arange(0, 12, 1)  # Monthly data
    # Convert dates to CDF_TIME_TT2000 (nanoseconds since 2000-01-01 00:00:00)
    base_time = datetime(2000, 1, 1)
    dates = [
        int(
            (
                datetime(2020, 1, 1) + timedelta(days=int(t * 30)) - base_time
            ).total_seconds()
            * 1e9
        )
        for t in time
    ]

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

    # Create CDF file using cdflib.cdfwrite
    import cdflib.cdfwrite

    cdf_file = cdflib.cdfwrite.CDF(output_file)

    try:
        # Create time variable (zVariable, 0D - scalar per record)
        cdf_file.write_var(
            var_spec={
                "Variable": "time",
                "Data_Type": cdflib.cdfwrite.CDF.CDF_TIME_TT2000,
                "Num_Elements": 1,
                "Rec_Vary": True,
                "Var_Type": "zVariable",
                "Dim_Sizes": [],  # 0-dimension (scalar per record)
            },
            var_attrs={
                "FIELDNAM": "Time",
                "UNITS": "ns",
                "LABLAXIS": "Time",
            },
            var_data=np.array(dates, dtype=np.int64),
        )

        # Create latitude variable (zVariable, 1D)
        cdf_file.write_var(
            var_spec={
                "Variable": "lat",
                "Data_Type": cdflib.cdfwrite.CDF.CDF_FLOAT,
                "Num_Elements": 1,
                "Rec_Vary": False,
                "Var_Type": "zVariable",
                "Dim_Sizes": [],
            },
            var_attrs={
                "FIELDNAM": "Latitude",
                "UNITS": "degrees_north",
                "LABLAXIS": "Latitude",
            },
            var_data=lat.astype(np.float32),
        )

        # Create longitude variable (zVariable, 1D)
        cdf_file.write_var(
            var_spec={
                "Variable": "lon",
                "Data_Type": cdflib.cdfwrite.CDF.CDF_FLOAT,
                "Num_Elements": 1,
                "Rec_Vary": False,
                "Var_Type": "zVariable",
                "Dim_Sizes": [],
            },
            var_attrs={
                "FIELDNAM": "Longitude",
                "UNITS": "degrees_east",
                "LABLAXIS": "Longitude",
            },
            var_data=lon.astype(np.float32),
        )

        # Create temperature variable (zVariable, 3D: time, lat, lon)
        cdf_file.write_var(
            var_spec={
                "Variable": "temperature",
                "Data_Type": cdflib.cdfwrite.CDF.CDF_FLOAT,
                "Num_Elements": 1,
                "Rec_Vary": True,
                "Var_Type": "zVariable",
                "Dim_Sizes": [90, 180],  # lat, lon dimensions
            },
            var_attrs={
                "FIELDNAM": "Monthly Temperature",
                "UNITS": "Celsius",
                "VALIDMIN": -50.0,
                "VALIDMAX": 50.0,
                "FILLVAL": -9999.0,
            },
            var_data=temperature.astype(np.float32),
        )

        # Add global attributes
        global_attrs = {
            "TITLE": {0: "Sample NASA CDF Data"},
            "DESCRIPTION": {
                0: "Sample NASA CDF file with .cdf extension for testing VSCode extension"
            },
            "INSTITUTION": {0: "Climate Test Center"},
            "SOURCE": {0: "Generated for testing"},
            "HISTORY": {
                0: f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
            },
        }
        cdf_file.write_globalattrs(global_attrs)

    finally:
        cdf_file.close()

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


def create_sample_netcdf_gzip():
    """Create a gzip-compressed NetCDF4 file (v0.13 P1.2 HDF5 filter metadata)."""
    output_file = "sample_netcdf_gzip.nc"

    if os.path.exists(output_file):
        print(f"📄 NetCDF file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("🗜️ Creating gzip-compressed NetCDF sample...")

    ds = xr.Dataset(
        {
            "air_temperature": (
                ["time", "station"],
                np.random.default_rng(11).normal(15, 3, (24, 4)).astype(np.float32),
                {"long_name": "Air temperature", "units": "degC"},
            ),
        },
        coords={
            "time": np.arange(24),
            "station": np.arange(4),
        },
    )
    ds.attrs = {
        "title": "Gzip NetCDF sample",
        "description": "Shows __xarray_encoding.filters.* in the viewer (v0.13)",
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
    }

    ds.to_netcdf(
        output_file,
        encoding={
            "air_temperature": {"zlib": True, "complevel": 4, "shuffle": True},
        },
    )
    print(f"✅ Created {output_file} with zlib compression")
    return output_file


def create_sample_netcdf_no_attributes():
    """Create a simple NetCDF file with variables having NO attributes."""
    output_file = "sample_data_no_attributes.nc"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"📄 NetCDF file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("🌡️ Creating sample NetCDF file with no variable attributes...")

    # Create simple dimensions
    time = np.arange(0, 10, 1)  # 10 time steps
    lat = np.linspace(-45, 45, 9)  # 9 latitude points
    lon = np.linspace(-90, 90, 18)  # 18 longitude points

    # Create sample data
    np.random.seed(42)  # For reproducible data
    temperature = (
        20
        + 10 * np.sin(2 * np.pi * time[:, np.newaxis, np.newaxis] / 10)
        + np.random.normal(0, 2, (10, 9, 18))
    )
    pressure = (
        1013.25
        + 20 * np.cos(2 * np.pi * time[:, np.newaxis, np.newaxis] / 10)
        + np.random.normal(0, 5, (10, 9, 18))
    )
    humidity = np.int32(
        50
        + 30 * np.sin(2 * np.pi * time[:, np.newaxis, np.newaxis] / 10)
        + np.random.normal(0, 10, (10, 9, 18))
    )

    # Create dataset with NO attributes on variables or coordinates
    ds = xr.Dataset(
        {
            "temperature": (["time", "lat", "lon"], temperature),
            "pressure": (["time", "lat", "lon"], pressure),
            "humidity": (["time", "lat", "lon"], humidity),
        },
        coords={
            "time": (["time"], time),
            "lat": (["lat"], lat),
            "lon": (["lon"], lon),
        },
    )

    # Add minimal global attributes only
    ds.attrs = {
        "title": "Sample Data with No Variable Attributes",
        "description": "Simple NetCDF file for testing VSCode extension - variables have no attributes",
    }

    # Save to file
    ds.to_netcdf(output_file)
    print(f"✅ Created {output_file}")
    print(f"   Variables: {list(ds.data_vars.keys())}")
    print(f"   Coordinates: {list(ds.coords.keys())}")
    print("   Variable attributes: None")
    return output_file


def create_sample_netcdf_large_4d():
    """
    Create a large NetCDF file with a 4D variable of shape (3, 366, 366, 12).

    This file is designed to reproduce the bug described in issue #97:
    Resource intensive plotting processes timeout but are not killed.

    The large data size (3 * 366 * 366 * 12 = ~4.8 million elements) is intended
    to create a plot that takes significant time to generate, triggering the
    timeout behavior that needs to be handled properly.
    """
    output_file = "sample_large_4d_data.nc"

    # Check if file already exists
    if os.path.exists(output_file):
        print(
            f"📄 Large 4D NetCDF file {output_file} already exists. Skipping creation."
        )
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("🔬 Creating large 4D NetCDF file for timeout testing (issue #97)...")
    print("   Shape: (3, 366, 366, 12) - ~4.8 million elements")

    # Create dimensions
    # Simulating a dataset with:
    # - 3 time steps (e.g., 3 years or 3 ensemble members)
    # - 366 x 366 spatial grid (e.g., lat x lon)
    # - 12 months or vertical levels
    time_dim = 3
    y_dim = 366
    x_dim = 366
    level_dim = 12

    # Create coordinate arrays
    time = np.arange(time_dim)
    y = np.linspace(-90, 90, y_dim)  # Latitude-like
    x = np.linspace(-180, 180, x_dim)  # Longitude-like
    level = np.arange(level_dim)  # Months or levels

    # Create sample data (large 4D array)
    np.random.seed(97)  # Seed based on issue number for reproducibility

    # Create temperature-like data with some spatial and temporal patterns
    # This creates interesting visual patterns when plotted
    time_pattern = np.sin(2 * np.pi * time / time_dim)[
        :, np.newaxis, np.newaxis, np.newaxis
    ]
    y_pattern = np.cos(np.pi * y / 90)[np.newaxis, :, np.newaxis, np.newaxis]
    x_pattern = np.sin(2 * np.pi * x / 360)[np.newaxis, np.newaxis, :, np.newaxis]
    level_pattern = np.exp(-level / level_dim)[np.newaxis, np.newaxis, np.newaxis, :]

    # Combine patterns with noise
    temperature = (
        20
        + 10 * time_pattern * y_pattern
        + 5 * x_pattern * level_pattern
        + np.random.normal(0, 2, (time_dim, y_dim, x_dim, level_dim))
    )

    # Create dataset
    ds = xr.Dataset(
        {
            "temperature_4d": (
                ["time", "y", "x", "level"],
                temperature.astype(np.float32),  # Use float32 to save space
                {
                    "long_name": "4D Temperature Field (Large Dataset for Timeout Testing)",
                    "units": "Celsius",
                    "standard_name": "air_temperature",
                    "description": "Large 4D dataset designed to test timeout handling in plot generation (issue #97)",
                },
            ),
        },
        coords={
            "time": (
                ["time"],
                time,
                {
                    "long_name": "Time Step",
                    "units": "time steps",
                },
            ),
            "y": (
                ["y"],
                y,
                {
                    "long_name": "Y Coordinate (Latitude-like)",
                    "units": "degrees_north",
                },
            ),
            "x": (
                ["x"],
                x,
                {
                    "long_name": "X Coordinate (Longitude-like)",
                    "units": "degrees_east",
                },
            ),
            "level": (
                ["level"],
                level,
                {
                    "long_name": "Vertical Level or Month",
                    "units": "level",
                },
            ),
        },
    )

    # Add global attributes
    ds.attrs = {
        "title": "Large 4D Dataset for Timeout Testing",
        "description": "NetCDF file with shape (3, 366, 366, 12) for testing timeout handling in plot generation",
        "issue": "https://github.com/etienneschalk/scientific-data-viewer/issues/97",
        "purpose": "Test that resource-intensive plotting processes are properly killed on timeout",
        "total_elements": str(time_dim * y_dim * x_dim * level_dim),
        "history": f"Created on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "Conventions": "CF-1.6",
    }

    # Save to file
    ds.to_netcdf(output_file)

    # Calculate file size
    file_size_mb = os.path.getsize(output_file) / (1024 * 1024)

    print(f"✅ Created {output_file}")
    print(f"   Shape: ({time_dim}, {y_dim}, {x_dim}, {level_dim})")
    print(f"   Total elements: {time_dim * y_dim * x_dim * level_dim:,}")
    print(f"   File size: {file_size_mb:.2f} MB")
    return output_file
