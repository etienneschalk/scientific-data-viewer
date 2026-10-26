"""NetCDF samples with groups (ordered and unordered)."""

import os
from datetime import datetime

import numpy as np


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


def create_sample_netcdf_unordered_groups():
    """Create a NetCDF file with groups in non-alphabetical file order (Issue #140)."""
    output_file = "sample_data_unordered_groups.nc"

    if os.path.exists(output_file):
        print(
            f"📁 NetCDF unordered-groups file {output_file} already exists. Skipping creation."
        )
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_file

    print("📁 Creating sample NetCDF file with non-alphabetically ordered groups...")

    try:
        import netCDF4 as nc
    except ImportError:
        print(
            "  ❌ netCDF4 not available, skipping unordered-groups NetCDF file creation."
        )
        return None

    np.random.seed(789)
    x = np.arange(5, dtype=np.float32)

    # Create groups in file order: zozo, abba, tutu (not alphabetical).
    with nc.Dataset(output_file, "w", format="NETCDF4") as rootgrp:
        rootgrp.title = "Sample NetCDF with Non-Alphabetical Group Order"
        rootgrp.description = (
            "Groups zozo, abba, tutu are stored in file order (not alphabetical)"
        )
        rootgrp.Conventions = "CF-1.6"

        rootgrp.createDimension("x", len(x))
        root_value = rootgrp.createVariable("root_value", "f4", ("x",))
        root_value[:] = np.zeros(len(x), dtype=np.float32)
        root_value.long_name = "Root level values"

        group_specs = [
            ("zozo", "zozo_var", 1.0),
            ("abba", "abba_var", 2.0),
            ("tutu", "tutu_var", 3.0),
        ]
        for group_name, var_name, mean in group_specs:
            group = rootgrp.createGroup(group_name)
            group.group_name = group_name
            data = np.random.normal(mean, 0.1, len(x)).astype(np.float32)
            var = group.createVariable(var_name, "f4", ("x",))
            var[:] = data
            var.long_name = f"Data in group {group_name}"

    print(f"✅ Created {output_file} with groups in file order: zozo, abba, tutu")
    return output_file
