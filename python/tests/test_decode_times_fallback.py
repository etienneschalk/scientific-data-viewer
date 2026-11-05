#!/usr/bin/env python3
"""Degraded mode for broken CF time units (issue #136): only time decoding is
turned off, scale_factor / add_offset and masking still apply."""

from __future__ import annotations

from typing import TYPE_CHECKING

import netCDF4
import numpy as np
import pytest
import xarray as xr

from sdv_backend.decoding import DecodingOptions
from sdv_backend.formats.detect import detect_file_format
from sdv_backend.info.extract import get_file_info
from sdv_backend.info.options import InfoOptions
from sdv_backend.opening import _is_decode_cf_time_error, open_datatree_with_fallback
from sdv_backend.results import FileInfoResult

if TYPE_CHECKING:
    from pathlib import Path


def _write_broken_time_units_nc(path: Path) -> None:
    """A variable with unparseable time units, next to a packed variable."""
    with netCDF4.Dataset(path, "w") as ds:
        ds.createDimension("x", 2)
        var = ds.createVariable("delta", "f4", ("x",))
        var[:] = np.array([1.0, 2.0], dtype=np.float32)
        var.units = "(days since 2000-01-01 00:00:00)-1"
        packed = ds.createVariable("temp", "i2", ("x",))
        packed.scale_factor = 0.5
        packed.add_offset = 10.0
        packed.set_auto_maskandscale(False)
        packed[:] = np.array([2, 4], dtype="i2")


@pytest.fixture
def broken_nc(tmp_path: Path) -> Path:
    path = tmp_path / "broken.nc"
    _write_broken_time_units_nc(path)
    return path


def test_is_decode_cf_time_error_matches_value_error_message() -> None:
    exc = ValueError(
        "unable to decode time units '(days since 2000-01-01 00:00:00)-1' "
        "with 'the default calendar'."
    )
    assert _is_decode_cf_time_error(exc)
    assert not _is_decode_cf_time_error(ValueError("other error"))


def test_fallback_turns_off_time_decoding_only(broken_nc: Path) -> None:
    with pytest.raises(ValueError, match="unable to decode time units"):
        xr.open_datatree(broken_nc)

    fmt = detect_file_format(broken_nc)
    xdt, engine, report = open_datatree_with_fallback(broken_nc, fmt)
    try:
        assert engine == "netcdf4"
        assert isinstance(xdt, xr.DataTree)
        assert report.degraded_decoders == ["decode_times", "decode_timedelta"]
        assert "unable to decode time units" in (report.fallback_reason or "")
        # mask_and_scale still on: the packed variable is unpacked
        np.testing.assert_allclose(xdt["temp"].values, [11.0, 12.0])
    finally:
        xdt.close()


def test_get_file_info_reports_degraded_decoders(broken_nc: Path) -> None:
    result = get_file_info(broken_nc)
    assert isinstance(result, FileInfoResult)
    assert result.open_report is not None
    assert result.open_report.degraded_decoders == [
        "decode_times",
        "decode_timedelta",
    ]
    assert "decode_times=False,  # time fallback" in result.open_report.call
    assert result.used_engine == "netcdf4"
    assert "delta" in {v.name for v in result.variables_flattened["/"]}


def test_raw_mode_skips_the_fallback_and_keeps_packed_values(broken_nc: Path) -> None:
    fmt = detect_file_format(broken_nc)
    xdt, _, report = open_datatree_with_fallback(
        broken_nc, fmt, decoding=DecodingOptions(raw=True)
    )
    try:
        assert report.raw is True
        assert report.degraded_decoders == []
        assert report.fallback_reason is None
        assert xdt["temp"].dtype == np.int16
        np.testing.assert_array_equal(xdt["temp"].values, [2, 4])
    finally:
        xdt.close()


def test_time_setting_off_needs_no_fallback(broken_nc: Path) -> None:
    result = get_file_info(
        broken_nc, InfoOptions(decoding=DecodingOptions(decode_times=False))
    )
    assert isinstance(result, FileInfoResult)
    assert result.open_report is not None
    assert result.open_report.degraded_decoders == []
    sources = {k.name: k.source for k in result.open_report.kwargs}
    assert sources["decode_times"] == "setting"
    assert sources["decode_timedelta"] == "setting"
