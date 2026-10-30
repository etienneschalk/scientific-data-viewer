#!/usr/bin/env python3
"""
Script to create sample scientific data files for testing the VSCode extension.

Creates samples for NetCDF, HDF5, Zarr (v2/v3, unsuffixed dirs, ZIP), Kerchunk
references, GRIB, GeoTIFF (including COG), and JPEG-2000.

Writes to ``artefacts/sample-data/`` (git-ignored). The generators live in the
``sample_data`` package next to this file.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sample_data.main import cli

if __name__ == "__main__":
    sys.exit(cli())
