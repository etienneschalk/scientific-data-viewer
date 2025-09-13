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

    try:
        import zarr
    except ImportError:
        print("  zarr not available, skipping Zarr file creation.")
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


def create_sample_grib():
    """Create a sample GRIB file with weather data."""
    output_file = "sample_data.grib"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"GRIB file {output_file} already exists. Skipping creation.")
        print("  To regenerate, please delete the existing file first.")
        return output_file

    print("Creating sample GRIB file...")

    try:
        import cfgrib
        # cfgrib is available, but it's read-only, so we'll create a NetCDF file instead
        print("  Note: cfgrib is read-only, creating NetCDF file with .grib extension for testing")
    except ImportError:
        print("  cfgrib not available, creating NetCDF file with .grib extension for testing")

    # Create time dimension
    time = np.arange(0, 24, 6)  # 6-hourly data for 24 hours
    dates = [datetime(2020, 1, 1) + timedelta(hours=int(t)) for t in time]

    # Create lat/lon grid
    lat = np.linspace(30, 60, 30)  # Smaller grid for GRIB
    lon = np.linspace(-30, 30, 60)

    # Create sample weather data
    np.random.seed(789)
    time_3d = time[:, np.newaxis, np.newaxis]
    temperature = (
        15 + 10 * np.sin(2 * np.pi * time_3d / 24) + np.random.normal(0, 2, (4, 30, 60))
    )
    pressure = (
        1013.25
        + 20 * np.sin(2 * np.pi * time_3d / 24)
        + np.random.normal(0, 5, (4, 30, 60))
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

    # Save to GRIB - cfgrib is read-only, so we'll save as NetCDF instead
    # and rename it to .grib for testing purposes
    temp_file = output_file.replace('.grib', '_temp.nc')
    ds.to_netcdf(temp_file, engine="netcdf4")
    
    # Rename to .grib for testing (this creates a NetCDF file with .grib extension)
    import shutil
    shutil.move(temp_file, output_file)
    
    print(f"Created {output_file} (NetCDF format with .grib extension for testing)")
    return output_file


def create_sample_geotiff():
    """Create a sample GeoTIFF file with satellite imagery data."""
    output_file = "sample_data.tif"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"GeoTIFF file {output_file} already exists. Skipping creation.")
        print("  To regenerate, please delete the existing file first.")
        return output_file

    print("Creating sample GeoTIFF file...")

    try:
        import rioxarray
    except ImportError:
        print("  rioxarray not available, skipping GeoTIFF file creation.")
        return None

    # Create spatial dimensions
    height = 100
    width = 100

    # Create sample satellite imagery data
    np.random.seed(101)

    # Create RGB bands
    red = np.random.randint(0, 255, (height, width), dtype=np.uint8)
    green = np.random.randint(0, 255, (height, width), dtype=np.uint8)
    blue = np.random.randint(0, 255, (height, width), dtype=np.uint8)

    # Add some spatial patterns
    x, y = np.meshgrid(np.linspace(0, 1, width), np.linspace(0, 1, height))
    red = np.clip(
        red + 50 * np.sin(4 * np.pi * x) * np.cos(4 * np.pi * y), 0, 255
    ).astype(np.uint8)
    green = np.clip(
        green + 30 * np.cos(6 * np.pi * x) * np.sin(6 * np.pi * y), 0, 255
    ).astype(np.uint8)
    blue = np.clip(
        blue + 40 * np.sin(8 * np.pi * x) * np.cos(8 * np.pi * y), 0, 255
    ).astype(np.uint8)

    # Create dataset
    ds = xr.Dataset(
        {
            "red": (["y", "x"], red, {"long_name": "Red band", "units": "DN"}),
            "green": (["y", "x"], green, {"long_name": "Green band", "units": "DN"}),
            "blue": (["y", "x"], blue, {"long_name": "Blue band", "units": "DN"}),
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
    }

    # Save to GeoTIFF
    ds.rio.to_raster(output_file)
    print(f"Created {output_file}")
    return output_file


def create_sample_jp2():
    """Create a sample JPEG-2000 file with satellite data."""
    output_file = "sample_data.jp2"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"JPEG-2000 file {output_file} already exists. Skipping creation.")
        print("  To regenerate, please delete the existing file first.")
        return output_file

    print("Creating sample JPEG-2000 file...")

    try:
        import rioxarray
    except ImportError:
        print("  rioxarray not available, skipping JPEG-2000 file creation.")
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
    print(f"Created {output_file}")
    return output_file


def create_sample_sentinel():
    """Create a sample Sentinel-1 SAFE directory structure."""
    output_file = "sample_data.safe"

    # Check if directory already exists
    if os.path.exists(output_file):
        print(f"Sentinel-1 SAFE file {output_file} already exists. Skipping creation.")
        print("  To regenerate, please delete the existing directory first.")
        return output_file

    print("Creating sample Sentinel-1 SAFE file...")

    try:
        import xarray_sentinel
    except ImportError:
        print(
            "  xarray-sentinel not available, skipping Sentinel-1 SAFE file creation."
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

    print(f"Created {output_file}")
    return output_file


def create_sample_netcdf4():
    """Create a sample NetCDF4 file with advanced features."""
    output_file = "sample_data.nc4"

    # Check if file already exists
    if os.path.exists(output_file):
        print(f"NetCDF4 file {output_file} already exists. Skipping creation.")
        print("  To regenerate, please delete the existing file first.")
        return output_file

    print("Creating sample NetCDF4 file...")

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
    print(f"Created {output_file}")
    return output_file


def main():
    """Create all sample data files."""
    print("Creating sample scientific data files for VSCode extension testing...")
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

        print("\n📁 Creating Zarr files...")
        zarr_file = create_sample_zarr()
        if zarr_file:
            created_files.append((zarr_file, "Zarr"))
        else:
            skipped_files.append("Zarr (zarr not available)")

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
