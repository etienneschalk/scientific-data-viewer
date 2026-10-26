"""Entry point: create every sample file under sample-data/."""

import os

from sample_data.broken import create_broken_files
from sample_data.disposable import (
    cleanup_disposable_files,
    create_disposable_netcdf_files,
    create_disposable_zarr_files,
)
from sample_data.geotiff import (
    create_sample_geotiff,
    create_sample_geotiff_cog,
    create_sample_geotiff_geotiff,
    create_sample_geotiff_tiff,
    create_sample_multiband_geotiff,
)
from sample_data.grib import (
    create_sample_grib,
    create_sample_grib_grb,
    create_sample_grib_grb2_file,
    create_sample_grib_grib2,
)
from sample_data.hdf5 import create_sample_hdf5, create_sample_hdf5_hdf5
from sample_data.jp2 import create_sample_jp2, create_sample_jp2_jpeg2000
from sample_data.kerchunk import create_sample_kerchunk_reference
from sample_data.netcdf import (
    create_sample_file_with_spaces,
    create_sample_netcdf,
    create_sample_netcdf4,
    create_sample_netcdf_broken_datetime_variable,
    create_sample_netcdf_cdf,
    create_sample_netcdf_compound_dtype_variable,
    create_sample_netcdf_gzip,
    create_sample_netcdf_large_4d,
    create_sample_netcdf_netcdf,
    create_sample_netcdf_no_attributes,
)
from sample_data.netcdf_encoding import create_sample_netcdf_many_encoding
from sample_data.netcdf_groups import (
    create_sample_netcdf_multiple_groups,
    create_sample_netcdf_unordered_groups,
)
from sample_data.netcdf_names import (
    create_sample_netcdf_complex_long_names,
    create_sample_netcdf_long_variable_names,
    create_sample_netcdf_many_vars,
)
from sample_data.temporal import create_temporal_datasets
from sample_data.zarr import (
    create_sample_zarr_arborescence,
    create_sample_zarr_deeply_nested_attributes,
    create_sample_zarr_inherited_coords,
    create_sample_zarr_single_group_from_dataset,
    create_sample_zarr_v3_plain_directory,
    create_sample_zarr_v3_sharded,
    create_sample_zarr_v3_zip_archive,
    create_sample_zarr_with_nested_groups_from_datatree,
    create_sample_zarr_with_nested_groups_from_zarr,
)


def main(do_create_disposable_files: bool = False):
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
            created_files.append((netcdf_cdf_file, "CDF (NASA)"))

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

        unordered_groups_netcdf_file = create_sample_netcdf_unordered_groups()
        if unordered_groups_netcdf_file:
            created_files.append(
                (unordered_groups_netcdf_file, "NetCDF (Unordered Groups)")
            )
        else:
            skipped_files.append("NetCDF Unordered Groups (netCDF4 not available)")

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

        # Large 4D dataset for timeout testing (issue #97)
        large_4d_netcdf_file = create_sample_netcdf_large_4d()
        if large_4d_netcdf_file:
            created_files.append(
                (large_4d_netcdf_file, "NetCDF (Large 4D - Timeout Test)")
            )

        many_encoding_netcdf_file = create_sample_netcdf_many_encoding()
        if many_encoding_netcdf_file:
            created_files.append((many_encoding_netcdf_file, "NetCDF (Many Encoding)"))

        no_attrs_netcdf_file = create_sample_netcdf_no_attributes()
        if no_attrs_netcdf_file:
            created_files.append((no_attrs_netcdf_file, "NetCDF (No Attributes)"))

        broken_datetime_netcdf_file = create_sample_netcdf_broken_datetime_variable()
        if broken_datetime_netcdf_file:
            created_files.append(
                (broken_datetime_netcdf_file, "NetCDF (Broken Datetime Units)")
            )

        compound_dtype_netcdf_file = create_sample_netcdf_compound_dtype_variable()
        if compound_dtype_netcdf_file:
            created_files.append(
                (compound_dtype_netcdf_file, "NetCDF (Compound Dtype)")
            )

        gzip_netcdf_file = create_sample_netcdf_gzip()
        if gzip_netcdf_file:
            created_files.append((gzip_netcdf_file, "NetCDF (gzip / filters)"))

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

        grib_grb2_file = create_sample_grib_grb2_file()
        if grib_grb2_file:
            created_files.append((grib_grb2_file, "GRIB GRB2"))
        else:
            skipped_files.append("GRIB GRB2 (eccodes not available)")

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

        multiband_geotiff_file = create_sample_multiband_geotiff()
        if multiband_geotiff_file:
            created_files.append((multiband_geotiff_file, "Multi-band GeoTIFF"))
        else:
            skipped_files.append("Multi-band GeoTIFF (rioxarray not available)")

        cog_geotiff_file = create_sample_geotiff_cog()
        if cog_geotiff_file:
            created_files.append((cog_geotiff_file, "Cloud Optimized GeoTIFF (COG)"))
        else:
            skipped_files.append("COG GeoTIFF (rasterio not available)")

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

        deeply_nested_attrs_zarr_file = create_sample_zarr_deeply_nested_attributes()
        if deeply_nested_attrs_zarr_file:
            created_files.append(
                (deeply_nested_attrs_zarr_file, "Zarr deeply nested attrs (Issue #120)")
            )
        else:
            skipped_files.append("Zarr deeply nested attrs (zarr not available)")

        print("\n📁 Creating v0.13 Zarr / Kerchunk samples...")
        zarr_v3_plain_dir = create_sample_zarr_v3_plain_directory()
        if zarr_v3_plain_dir:
            created_files.append((zarr_v3_plain_dir, "Zarr v3 (unsuffixed directory)"))
        else:
            skipped_files.append("Zarr v3 unsuffixed directory (zarr not available)")

        zarr_v3_sharded_file = create_sample_zarr_v3_sharded()
        if zarr_v3_sharded_file:
            created_files.append((zarr_v3_sharded_file, "Zarr v3 (sharded)"))
        else:
            skipped_files.append("Zarr v3 sharded (zarr not available)")

        zarr_v3_zip_file = create_sample_zarr_v3_zip_archive()
        if zarr_v3_zip_file:
            created_files.append((zarr_v3_zip_file, "Zarr v3 (ZIP archive)"))
        else:
            skipped_files.append("Zarr v3 ZIP (zarr not available)")

        kerchunk_ref_file = create_sample_kerchunk_reference()
        if kerchunk_ref_file:
            created_files.append((kerchunk_ref_file, "Kerchunk (virtual Zarr)"))
        else:
            skipped_files.append("Kerchunk reference (kerchunk not available)")

        print("\n📄 Creating file with spaces in name...")
        spaces_file = create_sample_file_with_spaces()
        if spaces_file:
            created_files.append((spaces_file, "File with Spaces"))

        print("\n💥 Creating broken files for error handling...")
        broken_files = create_broken_files()
        if broken_files:
            for broken_file in broken_files:
                created_files.append((broken_file, "Broken File"))

        if do_create_disposable_files:
            print("\n🗑️ Creating disposable files for deletion testing...")
            cleanup_disposable_files()

            disposable_netcdf_files = create_disposable_netcdf_files()
            if disposable_netcdf_files:
                for disposable_file in disposable_netcdf_files:
                    created_files.append((disposable_file, "Disposable NetCDF"))

            disposable_zarr_files = create_disposable_zarr_files()
            if disposable_zarr_files:
                for disposable_file in disposable_zarr_files:
                    created_files.append((disposable_file, "Disposable Zarr"))
        else:
            print("\n🗑️ Skipping disposable files for deletion testing...")

        print("\n" + "=" * 80)
        print("✅ Sample data files created successfully!")
        print(f"\n📊 Created {len(created_files)} files:")
        for filename, format_name in created_files:
            print(f"  • {filename} ({format_name} format)")

        if skipped_files:
            print(f"\n⚠️  Skipped {len(skipped_files)} formats (missing dependencies):")
            for format_name in skipped_files:
                print(f"  • {format_name}")

        print("\n🎯 You can now test the VSCode extension with these files!")
        print("   Right-click on any file in VS Code and select 'Open in Data Viewer'")

        # Create temporal datasets
        print("\n" + "=" * 80)
        print("📅 Creating temporal test datasets...")
        temporal_files = create_temporal_datasets()
        if temporal_files:
            print(
                f"\n✅ Created {len(temporal_files)} temporal test datasets in temporal-datasets/"
            )

    except Exception as e:
        print(f"\n❌ Error creating sample data: {e}")
        import traceback

        print(traceback.format_exc())
        return 1

    return 0
