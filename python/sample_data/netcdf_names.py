"""NetCDF samples stressing variable counts and long/complex names."""

import os

import numpy as np
import xarray as xr

from sample_data.common import CREATION_DATETIME


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
        "history": f"Created on {CREATION_DATETIME.strftime('%Y-%m-%d %H:%M:%S')}",
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
        "processing_date": CREATION_DATETIME.strftime("%Y-%m-%d"),
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
        "history": f"Created on {CREATION_DATETIME.strftime('%Y-%m-%d %H:%M:%S')}",
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
        "history": f"Created on {CREATION_DATETIME.strftime('%Y-%m-%d %H:%M:%S')}",
        "Conventions": "CF-1.8",
        "featureType": "grid",
        "data_type": "complex_test_data_long_names",
        "purpose": "testing_complex_long_names_multiple_dimensions",
        "test_type": "comprehensive_ui_display_handling",
        "max_variable_name_length": max(len(name) for name in complex_variable_names),
        "max_dimension_name_length": max(len(name) for name in coords),
        "max_coordinate_name_length": max(len(name) for name in coords),
        "total_variables": len(ds.data_vars),
        "total_dimensions": len(ds.dims),
        "total_coordinates": len(ds.coords),
        "average_variable_name_length": sum(
            len(name) for name in complex_variable_names
        )
        / len(complex_variable_names),
        "average_dimension_name_length": sum(len(name) for name in coords)
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
        f"   Longest dimension name: {max(coords.keys(), key=len)} ({max(len(name) for name in coords)} characters)"
    )
    print(f"   Total data points: {sum(data.size for data in ds.data_vars.values()):,}")
    return output_file
