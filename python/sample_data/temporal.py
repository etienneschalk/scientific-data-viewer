"""Datasets for datetime filtering tests (temporal-datasets/)."""

import os
from datetime import datetime, timedelta

import numpy as np
import xarray as xr

from sample_data.common import optional_pkg_available


def create_temporal_datasets():
    """Create temporal test datasets in various formats for testing datetime variable selection."""
    temporal_dir = "temporal-datasets"

    # Create temporal datasets directory
    os.makedirs(temporal_dir, exist_ok=True)
    original_dir = os.getcwd()
    os.chdir(temporal_dir)

    print("📅 Creating temporal test datasets...")
    print("=" * 80)

    created_files = []
    skipped_files = []

    try:
        # 1. CDF file with datetime variable as coordinate
        cdf_file = create_temporal_cdf_with_datetime_coord()
        if cdf_file:
            created_files.append((cdf_file, "CDF with datetime coordinate"))
        else:
            skipped_files.append("CDF with datetime coordinate (cdflib not available)")

        # 2. CDF file with datetime variable as data variable
        cdf_file2 = create_temporal_cdf_with_datetime_data()
        if cdf_file2:
            created_files.append((cdf_file2, "CDF with datetime data variable"))
        else:
            skipped_files.append(
                "CDF with datetime data variable (cdflib not available)"
            )

        # 3. NetCDF file with time coordinate
        nc_file = create_temporal_netcdf_with_time_coord()
        if nc_file:
            created_files.append((nc_file, "NetCDF with time coordinate"))

        # 4. Zarr file with multigroups and time dimensions
        zarr_file = create_temporal_zarr_multigroups()
        if zarr_file:
            created_files.append((zarr_file, "Zarr multigroups with time"))
        else:
            skipped_files.append("Zarr multigroups (zarr not available)")

        # 5. NetCDF file with datetime64 coordinate
        nc_file2 = create_temporal_netcdf_datetime64()
        if nc_file2:
            created_files.append((nc_file2, "NetCDF with datetime64 coordinate"))

        # 6. CDF file with multiple datetime variables
        cdf_file3 = create_temporal_cdf_multiple_datetime()
        if cdf_file3:
            created_files.append((cdf_file3, "CDF with multiple datetime variables"))
        else:
            skipped_files.append("CDF multiple datetime (cdflib not available)")

        # 7. CDF file with unordered time variable
        cdf_file4 = create_temporal_cdf_unordered_time()
        if cdf_file4:
            created_files.append((cdf_file4, "CDF with unordered time variable"))
        else:
            skipped_files.append("CDF unordered time (cdflib not available)")

        print("\n" + "=" * 80)
        print("✅ Temporal test datasets created successfully!")
        print(f"\n📊 Created {len(created_files)} files:")
        for filename, format_name in created_files:
            print(f"  • {filename} ({format_name})")

        if skipped_files:
            print(f"\n⚠️  Skipped {len(skipped_files)} formats (missing dependencies):")
            for format_name in skipped_files:
                print(f"  • {format_name}")

    except Exception as e:
        print(f"\n❌ Error creating temporal datasets: {e}")
        import traceback

        print(traceback.format_exc())
    finally:
        os.chdir(original_dir)

    return created_files


def create_temporal_cdf_with_datetime_coord():
    """Create a CDF file with datetime variable as coordinate."""
    output_file = "temporal_cdf_datetime_coord.cdf"

    if os.path.exists(output_file):
        print(f"📄 CDF file {output_file} already exists. Skipping creation.")
        return output_file

    try:
        import cdflib
    except ImportError:
        print("⚠️  cdflib is not installed. Skipping CDF file creation.")
        return None

    print("📅 Creating CDF file with datetime coordinate...")

    # Create time dimension - 24 hours of hourly data
    base_time = datetime(2019, 5, 10, 0, 0, 0)
    dates = [
        int(
            (base_time + timedelta(hours=i) - datetime(2000, 1, 1)).total_seconds()
            * 1e9
        )
        for i in range(24)
    ]

    # Create sample data variables
    np.random.seed(42)
    temperature = (
        20 + 5 * np.sin(2 * np.pi * np.arange(24) / 24) + np.random.normal(0, 1, 24)
    )
    pressure = (
        1013.25
        + 10 * np.cos(2 * np.pi * np.arange(24) / 24)
        + np.random.normal(0, 2, 24)
    )
    humidity = (
        50 + 20 * np.sin(2 * np.pi * np.arange(24) / 24) + np.random.normal(0, 5, 24)
    )

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
                "Dim_Sizes": [],
            },
            var_attrs={
                "FIELDNAM": "Time",
                "UNITS": "ns",
                "LABLAXIS": "Time",
            },
            var_data=np.array(dates, dtype=np.int64),
        )

        # Create data variables
        for var_name, var_data in [
            ("temperature", temperature),
            ("pressure", pressure),
            ("humidity", humidity),
        ]:
            cdf_file.write_var(
                var_spec={
                    "Variable": var_name,
                    "Data_Type": cdflib.cdfwrite.CDF.CDF_FLOAT,
                    "Num_Elements": 1,
                    "Rec_Vary": True,
                    "Var_Type": "zVariable",
                    "Dim_Sizes": [],
                },
                var_attrs={
                    "FIELDNAM": var_name.title(),
                    "UNITS": "Celsius"
                    if var_name == "temperature"
                    else ("hPa" if var_name == "pressure" else "%"),
                },
                var_data=var_data.astype(np.float32),
            )

        # Add global attributes
        global_attrs = {
            "TITLE": {0: "Temporal CDF with Datetime Coordinate"},
            "DESCRIPTION": {0: "Test CDF file for datetime variable selection"},
        }
        cdf_file.write_globalattrs(global_attrs)

    finally:
        cdf_file.close()

    print(f"✅ Created {output_file}")
    return output_file


def create_temporal_cdf_with_datetime_data():
    """Create a CDF file with datetime variable as data variable (not coordinate)."""
    output_file = "temporal_cdf_datetime_data.cdf"

    if os.path.exists(output_file):
        print(f"📄 CDF file {output_file} already exists. Skipping creation.")
        return output_file

    try:
        import cdflib
    except ImportError:
        print("⚠️  cdflib is not installed. Skipping CDF file creation.")
        return None

    print("📅 Creating CDF file with datetime data variable...")

    # Create time dimension - 7 days of daily data
    base_time = datetime(2019, 5, 10, 0, 0, 0)
    dates = [
        int(
            (base_time + timedelta(days=i) - datetime(2000, 1, 1)).total_seconds() * 1e9
        )
        for i in range(7)
    ]

    # Create sample data
    np.random.seed(123)
    latitude = np.random.normal(0, 1, 7)
    longitude = np.random.normal(0, 1, 7)

    import cdflib.cdfwrite

    cdf_file = cdflib.cdfwrite.CDF(output_file)

    try:
        # Create datetime variable as data variable (not coordinate)
        cdf_file.write_var(
            var_spec={
                "Variable": "Timestamp",
                "Data_Type": cdflib.cdfwrite.CDF.CDF_TIME_TT2000,
                "Num_Elements": 1,
                "Rec_Vary": True,
                "Var_Type": "zVariable",
                "Dim_Sizes": [],
            },
            var_attrs={
                "FIELDNAM": "Timestamp",
                "UNITS": "ns",
            },
            var_data=np.array(dates, dtype=np.int64),
        )

        # Create data variables
        for var_name, var_data in [("Latitude", latitude), ("Longitude", longitude)]:
            cdf_file.write_var(
                var_spec={
                    "Variable": var_name,
                    "Data_Type": cdflib.cdfwrite.CDF.CDF_FLOAT,
                    "Num_Elements": 1,
                    "Rec_Vary": True,
                    "Var_Type": "zVariable",
                    "Dim_Sizes": [],
                },
                var_attrs={
                    "FIELDNAM": var_name,
                    "UNITS": "degrees",
                },
                var_data=var_data.astype(np.float32),
            )

        global_attrs = {
            "TITLE": {0: "Temporal CDF with Datetime Data Variable"},
            "DESCRIPTION": {0: "Test CDF file with datetime as data variable"},
        }
        cdf_file.write_globalattrs(global_attrs)

    finally:
        cdf_file.close()

    print(f"✅ Created {output_file}")
    return output_file


def create_temporal_netcdf_with_time_coord():
    """Create a NetCDF file with time coordinate."""
    output_file = "temporal_netcdf_time_coord.nc"

    if os.path.exists(output_file):
        print(f"📄 NetCDF file {output_file} already exists. Skipping creation.")
        return output_file

    print("📅 Creating NetCDF file with time coordinate...")

    # Create time dimension - 48 hours of hourly data
    base_time = datetime(2019, 5, 10, 0, 0, 0)
    dates = [base_time + timedelta(hours=i) for i in range(48)]

    # Create sample data
    np.random.seed(456)
    temperature = (
        20 + 5 * np.sin(2 * np.pi * np.arange(48) / 24) + np.random.normal(0, 1, 48)
    )
    wind_speed = (
        5 + 3 * np.sin(2 * np.pi * np.arange(48) / 12) + np.random.normal(0, 0.5, 48)
    )

    ds = xr.Dataset(
        {
            "temperature": (
                ["time"],
                temperature,
                {"long_name": "Temperature", "units": "Celsius"},
            ),
            "wind_speed": (
                ["time"],
                wind_speed,
                {"long_name": "Wind Speed", "units": "m/s"},
            ),
        },
        coords={
            "time": (
                ["time"],
                dates,
                {"long_name": "Time", "standard_name": "time"},
            ),
        },
    )

    ds.attrs = {
        "title": "Temporal NetCDF with Time Coordinate",
        "description": "Test NetCDF file for datetime variable selection",
    }

    ds.to_netcdf(output_file)
    print(f"✅ Created {output_file}")
    return output_file


def create_temporal_zarr_multigroups():
    """Create a Zarr file with multiple groups and time dimensions."""
    output_file = "temporal_zarr_multigroups.zarr"

    if os.path.exists(output_file):
        print(f"📦 Zarr file {output_file} already exists. Skipping creation.")
        return output_file

    if not optional_pkg_available("zarr"):
        print("  ❌ zarr not available, skipping Zarr file creation.")
        return None

    print("📅 Creating Zarr file with multigroups and time...")

    # Create time dimension - 12 hours of hourly data
    time = np.arange(0, 12, 1)
    dates = [datetime(2019, 5, 10, 0, 0, 0) + timedelta(hours=int(t)) for t in time]

    np.random.seed(789)

    # Create root dataset
    root_ds = xr.Dataset(
        {
            "metadata": (
                ["time"],
                np.arange(12),
                {"long_name": "Metadata index"},
            ),
        },
        coords={
            "time": (
                ["time"],
                dates,
                {"long_name": "Time", "standard_name": "time"},
            ),
        },
    )

    # Create atmosphere group
    temp_data = 20 + 5 * np.sin(2 * np.pi * time / 12) + np.random.normal(0, 1, 12)
    press_data = (
        1013.25 + 10 * np.cos(2 * np.pi * time / 12) + np.random.normal(0, 2, 12)
    )

    atm_ds = xr.Dataset(
        {
            "temperature": (
                ["time"],
                temp_data,
                {"long_name": "Temperature", "units": "Celsius"},
            ),
            "pressure": (
                ["time"],
                press_data,
                {"long_name": "Pressure", "units": "hPa"},
            ),
        },
        coords={
            "time": (
                ["time"],
                dates,
                {"long_name": "Time", "standard_name": "time"},
            ),
        },
    )

    # Create ocean group
    salinity_data = (
        35 + 2 * np.sin(2 * np.pi * time / 12) + np.random.normal(0, 0.5, 12)
    )
    ocean_ds = xr.Dataset(
        {
            "salinity": (
                ["time"],
                salinity_data,
                {"long_name": "Salinity", "units": "psu"},
            ),
        },
        coords={
            "time": (
                ["time"],
                dates,
                {"long_name": "Time", "standard_name": "time"},
            ),
        },
    )

    # Create DataTree structure
    dt = xr.DataTree(name="root")
    dt["root"] = root_ds
    dt["root/atmosphere"] = atm_ds
    dt["root/ocean"] = ocean_ds

    dt.to_zarr(output_file, mode="w")
    print(f"✅ Created {output_file}")
    return output_file


def create_temporal_netcdf_datetime64():
    """Create a NetCDF file with datetime64 coordinate."""
    output_file = "temporal_netcdf_datetime64.nc"

    if os.path.exists(output_file):
        print(f"📄 NetCDF file {output_file} already exists. Skipping creation.")
        return output_file

    print("📅 Creating NetCDF file with datetime64 coordinate...")

    # Create time dimension using datetime64
    base_time = np.datetime64("2019-05-10T00:00:00")
    dates = np.array([base_time + np.timedelta64(i, "h") for i in range(24)])

    # Create sample data
    np.random.seed(321)
    precipitation = np.clip(np.random.exponential(2, 24), 0, 50)
    cloud_cover = np.clip(np.random.uniform(0, 1, 24), 0, 1)

    ds = xr.Dataset(
        {
            "precipitation": (
                ["time"],
                precipitation,
                {"long_name": "Precipitation", "units": "mm"},
            ),
            "cloud_cover": (
                ["time"],
                cloud_cover,
                {"long_name": "Cloud Cover", "units": "1"},
            ),
        },
        coords={
            "time": (
                ["time"],
                dates,
                {"long_name": "Time", "standard_name": "time"},
            ),
        },
    )

    ds.attrs = {
        "title": "Temporal NetCDF with Datetime64 Coordinate",
        "description": "Test NetCDF file with datetime64 coordinate",
    }

    ds.to_netcdf(output_file)
    print(f"✅ Created {output_file}")
    return output_file


def create_temporal_cdf_multiple_datetime():
    """Create a CDF file with multiple datetime variables."""
    output_file = "temporal_cdf_multiple_datetime.cdf"

    if os.path.exists(output_file):
        print(f"📄 CDF file {output_file} already exists. Skipping creation.")
        return output_file

    try:
        import cdflib
    except ImportError:
        print("⚠️  cdflib is not installed. Skipping CDF file creation.")
        return None

    print("📅 Creating CDF file with multiple datetime variables...")

    # Create time dimensions
    base_time = datetime(2019, 5, 10, 0, 0, 0)
    dates1 = [
        int(
            (base_time + timedelta(hours=i) - datetime(2000, 1, 1)).total_seconds()
            * 1e9
        )
        for i in range(12)
    ]
    dates2 = [
        int(
            (
                base_time + timedelta(minutes=i * 30) - datetime(2000, 1, 1)
            ).total_seconds()
            * 1e9
        )
        for i in range(24)
    ]

    np.random.seed(654)
    data1 = np.random.normal(0, 1, 12)
    data2 = np.random.normal(0, 1, 24)

    import cdflib.cdfwrite

    cdf_file = cdflib.cdfwrite.CDF(output_file)

    try:
        # Create first datetime variable
        cdf_file.write_var(
            var_spec={
                "Variable": "time_hourly",
                "Data_Type": cdflib.cdfwrite.CDF.CDF_TIME_TT2000,
                "Num_Elements": 1,
                "Rec_Vary": True,
                "Var_Type": "zVariable",
                "Dim_Sizes": [],
            },
            var_attrs={"FIELDNAM": "Time Hourly", "UNITS": "ns"},
            var_data=np.array(dates1, dtype=np.int64),
        )

        # Create second datetime variable
        cdf_file.write_var(
            var_spec={
                "Variable": "time_30min",
                "Data_Type": cdflib.cdfwrite.CDF.CDF_TIME_TT2000,
                "Num_Elements": 1,
                "Rec_Vary": True,
                "Var_Type": "zVariable",
                "Dim_Sizes": [],
            },
            var_attrs={"FIELDNAM": "Time 30min", "UNITS": "ns"},
            var_data=np.array(dates2, dtype=np.int64),
        )

        # Create data variables
        cdf_file.write_var(
            var_spec={
                "Variable": "variable1",
                "Data_Type": cdflib.cdfwrite.CDF.CDF_FLOAT,
                "Num_Elements": 1,
                "Rec_Vary": True,
                "Var_Type": "zVariable",
                "Dim_Sizes": [],
            },
            var_attrs={"FIELDNAM": "Variable 1", "UNITS": "1"},
            var_data=data1.astype(np.float32),
        )

        cdf_file.write_var(
            var_spec={
                "Variable": "variable2",
                "Data_Type": cdflib.cdfwrite.CDF.CDF_FLOAT,
                "Num_Elements": 1,
                "Rec_Vary": True,
                "Var_Type": "zVariable",
                "Dim_Sizes": [],
            },
            var_attrs={"FIELDNAM": "Variable 2", "UNITS": "1"},
            var_data=data2.astype(np.float32),
        )

        global_attrs = {
            "TITLE": {0: "Temporal CDF with Multiple Datetime Variables"},
            "DESCRIPTION": {0: "Test CDF file with multiple datetime variables"},
        }
        cdf_file.write_globalattrs(global_attrs)

    finally:
        cdf_file.close()

    print(f"✅ Created {output_file}")
    return output_file


def create_temporal_cdf_unordered_time():
    """Create a CDF file with unordered time variable to test time selection with non-chronological data."""
    output_file = "temporal_cdf_unordered_time.cdf"

    if os.path.exists(output_file):
        print(f"📄 CDF file {output_file} already exists. Skipping creation.")
        return output_file

    try:
        import cdflib
    except ImportError:
        print("⚠️  cdflib is not installed. Skipping CDF file creation.")
        return None

    print("📅 Creating CDF file with unordered time variable...")

    # Create time dimension - 20 time points, but in random order
    base_time = datetime(2019, 5, 10, 0, 0, 0)
    # Create ordered time points first
    ordered_dates = [
        int(
            (base_time + timedelta(hours=i) - datetime(2000, 1, 1)).total_seconds()
            * 1e9
        )
        for i in range(20)
    ]

    # Shuffle the time points to create unordered sequence
    # But keep track of the original order for data alignment
    np.random.seed(999)  # Fixed seed for reproducibility
    shuffled_indices = np.random.permutation(20)
    unordered_dates = [ordered_dates[i] for i in shuffled_indices]

    # Create sample data variables that correspond to the original ordered time
    # When we shuffle time, we need to shuffle data in the same way
    np.random.seed(42)
    temperature_ordered = (
        20 + 5 * np.sin(2 * np.pi * np.arange(20) / 20) + np.random.normal(0, 1, 20)
    )
    pressure_ordered = (
        1013.25
        + 10 * np.cos(2 * np.pi * np.arange(20) / 20)
        + np.random.normal(0, 2, 20)
    )
    humidity_ordered = (
        50 + 20 * np.sin(2 * np.pi * np.arange(20) / 20) + np.random.normal(0, 5, 20)
    )

    # Shuffle data in the same way as time
    temperature = temperature_ordered[shuffled_indices]
    pressure = pressure_ordered[shuffled_indices]
    humidity = humidity_ordered[shuffled_indices]

    import cdflib.cdfwrite

    cdf_file = cdflib.cdfwrite.CDF(output_file)

    try:
        # Create unordered time variable (zVariable, 0D - scalar per record)
        cdf_file.write_var(
            var_spec={
                "Variable": "time",
                "Data_Type": cdflib.cdfwrite.CDF.CDF_TIME_TT2000,
                "Num_Elements": 1,
                "Rec_Vary": True,
                "Var_Type": "zVariable",
                "Dim_Sizes": [],
            },
            var_attrs={
                "FIELDNAM": "Time",
                "UNITS": "ns",
                "LABLAXIS": "Time",
                "NOTE": "Time values are intentionally unordered for testing purposes",
            },
            var_data=np.array(unordered_dates, dtype=np.int64),
        )

        # Create data variables (also shuffled to match time order)
        for var_name, var_data in [
            ("temperature", temperature),
            ("pressure", pressure),
            ("humidity", humidity),
        ]:
            cdf_file.write_var(
                var_spec={
                    "Variable": var_name,
                    "Data_Type": cdflib.cdfwrite.CDF.CDF_FLOAT,
                    "Num_Elements": 1,
                    "Rec_Vary": True,
                    "Var_Type": "zVariable",
                    "Dim_Sizes": [],
                },
                var_attrs={
                    "FIELDNAM": var_name.title(),
                    "UNITS": "Celsius"
                    if var_name == "temperature"
                    else ("hPa" if var_name == "pressure" else "%"),
                },
                var_data=var_data.astype(np.float32),
            )

        # Add global attributes
        global_attrs = {
            "TITLE": {0: "Temporal CDF with Unordered Time Variable"},
            "DESCRIPTION": {
                0: "Test CDF file with intentionally unordered time values to test time selection functionality"
            },
            "NOTE": {
                0: "Time values are not in chronological order. This tests that time filtering works correctly even when data is not sorted by time."
            },
        }
        cdf_file.write_globalattrs(global_attrs)

    finally:
        cdf_file.close()

    # Calculate time range for display
    base_epoch = datetime(2000, 1, 1)
    min_time = base_epoch + timedelta(seconds=min(ordered_dates) / 1e9)
    max_time = base_epoch + timedelta(seconds=max(ordered_dates) / 1e9)

    print(f"✅ Created {output_file}")
    print(f"   Time points: {len(unordered_dates)} (unordered)")
    print(f"   Time range: {min_time} to {max_time}")
    return output_file
