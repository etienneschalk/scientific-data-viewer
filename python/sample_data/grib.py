"""GRIB / GRIB2 samples."""

import os
from datetime import datetime, timedelta

import numpy as np
import xarray as xr


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


def create_sample_grib_grb2_file():
    """Create a sample GRIB file with .grb2 extension (GRIB2 format)."""
    output_file = "sample_data.grb2"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"🌦️ GRIB GRB2 file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("🌦️ Creating sample GRIB GRB2 file (.grb2 extension)...")

    try:
        import eccodes

        print("  ✅ eccodes available, creating GRIB GRB2 file")
    except ImportError:
        print("  ❌ eccodes not available, skipping GRIB GRB2 file creation.")
        return None

    # Create time dimension
    time = np.arange(0, 8, 2)  # 2-hourly data for 8 hours
    dates = [datetime(2020, 1, 1) + timedelta(hours=int(t)) for t in time]

    # Create lat/lon grid
    lat = np.linspace(50, 40, 10)
    lon = np.linspace(0, 20, 15)

    # Create sample weather data
    np.random.seed(808)
    time_3d = time[:, np.newaxis, np.newaxis]
    pressure = np.clip(
        1010
        + 15 * np.sin(2 * np.pi * time_3d / 8)
        + np.random.normal(0, 5, (4, 10, 15)),
        990,
        1030,
    )

    # Create dataset
    ds = xr.Dataset(
        {
            "pressure": (
                ["time", "latitude", "longitude"],
                pressure,
                {
                    "long_name": "Surface Pressure",
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
        "title": "Sample GRIB GRB2 Data",
        "description": "Sample GRIB file with .grb2 extension for testing VSCode extension",
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
                    eccodes.codes_set_string(grib_id, "shortName", "msl")
                    eccodes.codes_set_long(
                        grib_id, "dataDate", int(time_val.strftime("%Y%m%d"))
                    )
                    eccodes.codes_set_long(
                        grib_id, "dataTime", int(time_val.strftime("%H%M"))
                    )

                    data_2d = ds["pressure"].isel(time=i).values
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
        print(f"  ⚠️ Error writing GRIB GRB2 file with eccodes: {e}")
        print("  🔄 Falling back to NetCDF format with .grb2 extension")
        temp_file = output_file.replace(".grb2", "_temp.nc")
        ds.to_netcdf(temp_file, engine="netcdf4")
        import shutil

        shutil.move(temp_file, output_file)
        print(f"✅ Created {output_file} (NetCDF format with .grb2 extension)")

    return output_file
