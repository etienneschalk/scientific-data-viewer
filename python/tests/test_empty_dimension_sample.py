#!/usr/bin/env python3
"""Tests for the empty-dimension sample data (variables of 0 bytes)."""

from __future__ import annotations

import os
from pathlib import Path

from sample_data.netcdf import create_sample_netcdf_empty_dimension

from sdv_backend.info.extract import get_file_info


def test_empty_dimension_sample_reports_zero_size_bytes(tmp_path: Path) -> None:
    cwd = Path.cwd()
    try:
        os.chdir(tmp_path)
        output = create_sample_netcdf_empty_dimension()
    finally:
        os.chdir(cwd)
    assert output == "sample_data_empty_dimension.nc"

    result = get_file_info(tmp_path / output)
    assert result.dimensions_flattened["/"]["obs"] == 0
    rows = result.coordinates_flattened["/"] + result.variables_flattened["/"]
    sizes = {v.name: (v.shape, v.size_bytes) for v in rows}
    assert sizes["obs"] == ([0], 0)
    assert sizes["measurement"] == ([0], 0)
    assert sizes["flag"] == ([4, 0], 0)
    # The webview shows "Empty" for these; a non-empty variable keeps its size
    assert sizes["temperature"] == ([4], 32)
