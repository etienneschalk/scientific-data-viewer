"""Intentionally broken files for error handling."""

import os


def create_broken_files():
    """Create broken files for all supported extensions to test error handling."""
    print("💥 Creating broken files for error handling testing...")

    broken_files = []
    file_extensions = [".nc", ".nc4", ".h5", ".grib", ".tif", ".jp2", ".zarr"]

    for ext in file_extensions:
        filename = f"broken_file{ext}"
        if ext == ".zarr":
            # Create empty directory for Zarr
            os.makedirs(filename, exist_ok=True)
        else:
            # Create empty file for other formats
            with open(filename, "w"):
                pass  # Empty file

        broken_files.append(filename)
        print(f"  💥 Created {filename} (empty file/directory)")

    return broken_files
