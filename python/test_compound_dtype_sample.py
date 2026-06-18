#!/usr/bin/env python3
"""Tests for compound-dtype sample data (issue #137 reproduction)."""

from __future__ import annotations

import tempfile
from pathlib import Path

import xarray as xr
from create_sample_data import create_sample_netcdf_compound_dtype_variable
from get_data_info import get_file_info


def test_compound_dtype_sample_opens_and_encoding_dtype_has_angle_brackets() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp)
        cwd = Path.cwd()
        try:
            import os

            os.chdir(path)
            output = create_sample_netcdf_compound_dtype_variable()
            assert output == "compound_dtype_variable.nc"
            nc_path = path / output

            xr.open_datatree(nc_path).close()

            result = get_file_info(nc_path)
            pets = next(v for v in result.variables_flattened["/"] if v.name == "pets")
            dtype_attr = pets.attributes["__xarray_encoding.dtype"]
            dtype_str = str(dtype_attr)
            assert "<" in dtype_str, (
                "encoding dtype should contain '<' (endianness) to reproduce #137"
            )
        finally:
            os.chdir(cwd)
