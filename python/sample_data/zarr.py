"""Zarr samples (v2/v3, nested groups, sharded, zipped)."""

import os
import zipfile

import numpy as np
import xarray as xr

from sample_data.common import CREATION_DATETIME, optional_pkg_available


def create_sample_zarr_single_group_from_dataset():
    """Create a sample Zarr file with ocean data."""
    output_file = "sample_zarr_single_group_from_dataset.zarr"

    # Check if directory already exists
    if os.path.exists(output_file):
        print(f"📦 Zarr file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing directory first.")
        return output_file

    print("🌊 Creating sample Zarr file...")

    if not optional_pkg_available("zarr"):
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
        "history": f"Created on {CREATION_DATETIME.strftime('%Y-%m-%d %H:%M:%S')}",
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

    if not optional_pkg_available("zarr"):
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
        "history": f"Created on {CREATION_DATETIME.strftime('%Y-%m-%d %H:%M:%S')}",
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

    if not optional_pkg_available("zarr"):
        print("  ❌ zarr not available, skipping nested Zarr file creation.")
        return None

    import zarr

    # Create the root group
    root = zarr.open(output_file, mode="w")

    # Add global attributes to root
    root.attrs.update(
        {
            "title": "Sample Nested Zarr Data",
            "description": "Sample Zarr file with nested groups for testing VSCode extension",
            "institution": "Ocean Test Institute",
            "source": "Generated for testing",
            "history": f"Created on {CREATION_DATETIME.strftime('%Y-%m-%d %H:%M:%S')}",
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


def create_sample_zarr_deeply_nested_attributes():
    """Create a Zarr store with extremely nested group attributes for testing Issue #120.

    Zarr stores attributes in JSON (.zattrs). This produces a store with 5-10 levels
    of nested dicts so the collapsible nested-attributes view can be tested and
    regressions avoided. Uses xarray to write the store so dimension metadata
    (dimension_names / _ARRAY_DIMENSIONS) is correct for reopening with xarray.
    """
    output_file = "sample_zarr_deeply_nested_attrs.zarr"

    if os.path.exists(output_file):
        print(f"📦 Zarr file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing directory first.")
        return output_file

    print(
        "🌊 Creating sample Zarr file with deeply nested group attributes (Issue #120)..."
    )

    # Deeply nested attributes (10 levels) - typical of complex .zattrs from producers
    nested_attrs = {
        "title": "Zarr with deeply nested attributes (Issue #120)",
        "description": "Test data for collapsible nested attributes view in SDV",
        "deep": {
            "level1": {
                "level2": {
                    "level3": {
                        "level4": {
                            "level5": {
                                "level6": {
                                    "level7": {
                                        "level8": {
                                            "level9": {
                                                "level10": "leaf_value",
                                                "count": 42,
                                            },
                                            "name": "deep_node_8",
                                        },
                                        "name": "deep_node_7",
                                    },
                                    "name": "deep_node_6",
                                },
                                "name": "deep_node_5",
                            },
                            "name": "deep_node_4",
                        },
                        "name": "deep_node_3",
                    },
                    "name": "deep_node_2",
                },
                "name": "deep_node_1",
            },
            "summary": "Use Nested Attributes View setting to expand this tree",
        },
        "metadata": {
            "creator": {"name": "SDV test", "version": "0.10.0"},
            "nested_list": [1, 2, {"a": "b", "c": [10, 20]}, "four"],
            "sections": {
                "instruments": {"sensor": "thermometer", "accuracy": 0.1},
                "quality": {"flags": [0, 1, 2], "meaning": "good questionable bad"},
            },
        },
    }

    # Create with xarray so dimension metadata is written correctly (works with zarr v2 and v3)
    ds = xr.Dataset(
        {"value": (["x"], [1.0, 2.0, 3.0])},
        coords={"x": [0, 1, 2]},
        attrs=nested_attrs,
    )
    ds.to_zarr(output_file, mode="w")

    print(
        f"✅ Created {output_file} with deeply nested .zattrs for nested-attributes UI testing"
    )
    return output_file


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

    if not optional_pkg_available("zarr"):
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
        "history": f"Created on {CREATION_DATETIME.strftime('%Y-%m-%d %H:%M:%S')}",
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

    if not optional_pkg_available("zarr"):
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
        "history": f"Created on {CREATION_DATETIME.strftime('%Y-%m-%d %H:%M:%S')}",
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


def create_sample_zarr_v3_plain_directory():
    """Create a Zarr v3 store in a directory without a ``.zarr`` suffix (v0.13 P0.2)."""
    output_dir = "sample_ocean_grid_v3"

    if os.path.exists(output_dir):
        print(
            f"📦 Zarr v3 plain directory {output_dir}/ already exists. Skipping creation."
        )
        print("  🔄 To regenerate, please delete the existing directory first.")
        return output_dir

    print("🌊 Creating Zarr v3 store without .zarr suffix...")

    if not optional_pkg_available("zarr"):
        print("  ❌ zarr not available, skipping plain-directory Zarr v3 sample.")
        return None

    x = np.arange(24, dtype="float32")
    y = np.arange(16, dtype="float32")
    temp = np.random.default_rng(42).normal(18, 2, (16, 24)).astype(np.float32)

    ds = xr.Dataset(
        {
            "sea_surface_temperature": (
                ["y", "x"],
                temp,
                {
                    "long_name": "Sea surface temperature",
                    "units": "degC",
                    "description": "Small grid for unsuffixed Zarr v3 detection",
                },
            ),
        },
        coords={
            "x": (["x"], x, {"long_name": "X index", "units": "1"}),
            "y": (["y"], y, {"long_name": "Y index", "units": "1"}),
        },
    )
    ds.attrs = {
        "title": "Unsuffixed Zarr v3 sample",
        "description": "Directory has zarr.json but no .zarr in the name (v0.13)",
        "zarr_format": 3,
        "history": f"Created on {CREATION_DATETIME.strftime('%Y-%m-%d %H:%M:%S')}",
    }

    ds.to_zarr(output_dir, mode="w", zarr_format=3)
    print(f"✅ Created {output_dir}/ (Zarr v3, no .zarr suffix)")
    return output_dir


def create_sample_zarr_v3_sharded():
    """Create a small Zarr v3 store with sharded arrays (v0.13 P0.4 encoding metadata)."""
    output_file = "sample_zarr_v3_sharded.zarr"

    if os.path.exists(output_file):
        print(f"📦 Zarr file {output_file} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing directory first.")
        return output_file

    print("🧱 Creating Zarr v3 store with sharded encoding...")

    if not optional_pkg_available("zarr"):
        print("  ❌ zarr not available, skipping sharded Zarr v3 sample.")
        return None

    data = np.random.default_rng(7).random((48, 48), dtype=np.float32)
    ds = xr.Dataset(
        {
            "reflectance": (
                ["y", "x"],
                data,
                {
                    "long_name": "Surface reflectance",
                    "units": "1",
                },
            ),
        },
        coords={
            "x": np.arange(48, dtype="float32"),
            "y": np.arange(48, dtype="float32"),
        },
    )
    ds.attrs = {
        "title": "Zarr v3 sharded sample",
        "description": "Exercises shard/codec metadata in __xarray_encoding.* tables",
        "zarr_format": 3,
        "history": f"Created on {CREATION_DATETIME.strftime('%Y-%m-%d %H:%M:%S')}",
    }

    ds.to_zarr(
        output_file,
        mode="w",
        zarr_format=3,
        encoding={
            "reflectance": {
                "chunks": (16, 16),
                "shards": (32, 32),
                "compressors": "auto",
            },
        },
    )
    print(f"✅ Created {output_file} with Zarr v3 sharding")
    return output_file


def create_sample_zarr_v3_zip_archive():
    """Package a Zarr v3 store as a ZIP archive (v0.13 P0.3 ZipStore)."""
    store_dir = "sample_zarr_v3_zip_inner.zarr"
    output_zip = "sample_zarr_v3.zarr.zip"

    if os.path.exists(output_zip):
        print(f"📦 ZIP archive {output_zip} already exists. Skipping creation.")
        print("  🔄 To regenerate, please delete the existing file first.")
        return output_zip

    print("🗜️ Creating Zarr v3 ZIP archive sample...")

    if not optional_pkg_available("zarr"):
        print("  ❌ zarr not available, skipping Zarr ZIP sample.")
        return None

    if not os.path.exists(store_dir):
        ds = xr.Dataset(
            {"chlorophyll": (("x",), np.linspace(0.1, 2.0, 12, dtype=np.float32))},
            coords={"x": np.arange(12)},
        )
        ds.attrs = {
            "title": "Zarr v3 store packaged as ZIP",
            "description": "Inner store for sample_zarr_v3.zarr.zip",
            "zarr_format": 3,
        }
        ds.to_zarr(store_dir, mode="w", zarr_format=3)

    from pathlib import Path

    store_path = Path(store_dir)
    with zipfile.ZipFile(output_zip, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_path in sorted(store_path.rglob("*")):
            if file_path.is_file():
                # Fixed entry timestamp so the archive is byte-reproducible
                info = zipfile.ZipInfo(
                    file_path.as_posix(), date_time=CREATION_DATETIME.timetuple()[:6]
                )
                info.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(info, file_path.read_bytes())

    print(f"✅ Created {output_zip} (Zarr v3 inside ZIP, prefix {store_dir}/)")
    return output_zip
