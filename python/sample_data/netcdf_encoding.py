"""NetCDF sample exercising many encoding options."""

import os

import numpy as np
import xarray as xr

from sample_data.common import CREATION_DATETIME


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
        "history": f"Created on {CREATION_DATETIME.strftime('%Y-%m-%d %H:%M:%S')}",
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
    print("   Encoding types: float32, float64, int8, int16, uint8")
    print(
        "   CF attributes tested: valid_range, valid_min, valid_max, missing_value, _FillValue, scale_factor, add_offset, flag_values, flag_meanings, flag_masks, cell_methods, coordinates, grid_mapping, ancillary_variables, bounds"
    )
    print(
        f"   Quality control variables: {len([v for v in ds.data_vars if v.endswith('_qc')])}"
    )
    print(
        f"   Bounds variables: {len([v for v in ds.coords if v.endswith('_bounds')])}"
    )
    return output_file
