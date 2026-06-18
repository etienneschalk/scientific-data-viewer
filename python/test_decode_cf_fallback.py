#!/usr/bin/env python3
"""Tests for decode_cf degraded-mode fallback (issue #136)."""

from __future__ import annotations

import tempfile
from pathlib import Path

import netCDF4
import numpy as np
import pytest
import xarray as xr
from get_data_info import (
    _is_decode_cf_time_error,
    detect_file_format,
    get_file_info,
    open_datatree_with_fallback,
)


def _write_broken_time_units_nc(path: Path) -> None:
    with netCDF4.Dataset(path, "w") as ds:
        ds.createDimension("x", 2)
        var = ds.createVariable("delta", "f4", ("x",))
        var[:] = np.array([1.0, 2.0], dtype=np.float32)
        var.units = "(days since 2000-01-01 00:00:00)-1"


def test_is_decode_cf_time_error_matches_value_error_message() -> None:
    exc = ValueError(
        "unable to decode time units '(days since 2000-01-01 00:00:00)-1' "
        "with 'the default calendar'."
    )
    assert _is_decode_cf_time_error(exc)
    assert not _is_decode_cf_time_error(ValueError("other error"))


def test_open_datatree_with_fallback_uses_decode_cf_false() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "broken.nc"
        _write_broken_time_units_nc(path)

        with pytest.raises(ValueError, match="unable to decode time units"):
            xr.open_datatree(path)

        fmt = detect_file_format(path)
        xdt, engine, degraded = open_datatree_with_fallback(path, fmt)
        try:
            assert degraded is True
            assert engine == "netcdf4"
            assert isinstance(xdt, xr.DataTree)
        finally:
            xdt.close()


def test_get_file_info_reports_decode_cf_degraded() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "broken.nc"
        _write_broken_time_units_nc(path)

        result = get_file_info(path)
        assert result.decode_cf_degraded is True
        assert result.used_engine == "netcdf4"
        assert "delta" in {v.name for v in result.variables_flattened["/"]}
