#!/usr/bin/env python3
"""Decoder / backend_kwargs resolution (settings, allowlist, raw mode) and the
rasterio time handling."""

from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np
import pytest

from sdv_backend.cli import _decoding_options, parse_cli_args
from sdv_backend.decoding import (
    SOURCE_FALLBACK,
    SOURCE_RAW,
    SOURCE_SETTING,
    SOURCE_VIEWER,
    DecodingOptions,
    format_open_call,
    parse_engine_backend_kwargs,
    resolve_open_kwargs,
)

if TYPE_CHECKING:
    from pathlib import Path

NETCDF4_PARAMS = frozenset(
    {
        "mask_and_scale",
        "decode_times",
        "decode_timedelta",
        "concat_characters",
        "use_cftime",
        "decode_coords",
        "auto_complex",
        "mode",
    }
)
RASTERIO_PARAMS = frozenset(
    {
        "mask_and_scale",
        "decode_times",
        "decode_timedelta",
        "decode_coords",
        "parse_coordinates",
        "masked",
        "band_as_variable",
    }
)


def _sources(resolved) -> dict[str, str]:
    return {kwarg.name: kwarg.source for kwarg in resolved.kwargs}


def test_defaults_pass_nothing_but_viewer_defaults() -> None:
    netcdf = resolve_open_kwargs("netcdf4", DecodingOptions(), NETCDF4_PARAMS)
    assert netcdf.decoders == {} and netcdf.backend_kwargs == {}
    raster = resolve_open_kwargs("rasterio", DecodingOptions(), RASTERIO_PARAMS)
    assert raster.decoders == {"mask_and_scale": False}
    assert _sources(raster) == {"mask_and_scale": SOURCE_VIEWER}
    grib = resolve_open_kwargs("cfgrib", DecodingOptions(), None)
    assert grib.backend_kwargs == {"indexpath": ""}


def test_settings_override_viewer_defaults() -> None:
    options = DecodingOptions(mask_and_scale=True, decode_times=False)
    raster = resolve_open_kwargs("rasterio", options, RASTERIO_PARAMS)
    assert raster.decoders == {
        "mask_and_scale": True,
        "decode_times": False,
        "decode_timedelta": False,
    }
    assert set(_sources(raster).values()) == {SOURCE_SETTING}


def test_decoders_the_engine_does_not_take_are_dropped_with_a_note() -> None:
    options = DecodingOptions(use_cftime=True, decode_coords="coordinates")
    raster = resolve_open_kwargs("rasterio", options, RASTERIO_PARAMS)
    assert "use_cftime" not in raster.decoders  # rioxarray has no use_cftime
    assert "decode_coords" not in raster.decoders  # rioxarray: only "all"
    assert len(raster.notes) == 2


def test_time_fallback_and_raw_precedence() -> None:
    options = DecodingOptions(mask_and_scale=True, use_cftime=True)
    fallback = resolve_open_kwargs(
        "netcdf4", options, NETCDF4_PARAMS, time_fallback=True
    )
    assert fallback.decoders["mask_and_scale"] is True
    assert fallback.decoders["decode_times"] is False
    assert _sources(fallback)["decode_times"] == SOURCE_FALLBACK

    raw = resolve_open_kwargs("netcdf4", DecodingOptions(raw=True), NETCDF4_PARAMS)
    assert raw.decoders == {
        "mask_and_scale": False,
        "decode_times": False,
        "decode_timedelta": False,
        "concat_characters": False,
        "decode_coords": False,
    }
    assert set(_sources(raw).values()) == {SOURCE_RAW}
    # Raw wins over the time fallback and drops use_cftime
    raw_fallback = resolve_open_kwargs(
        "netcdf4",
        DecodingOptions(raw=True, use_cftime=True),
        NETCDF4_PARAMS,
        time_fallback=True,
    )
    assert "use_cftime" not in raw_fallback.decoders
    assert set(_sources(raw_fallback).values()) == {SOURCE_RAW}


def test_user_backend_kwargs_allowlist() -> None:
    options = DecodingOptions(
        engine_backend_kwargs={
            "netcdf4": {"auto_complex": True, "mode": "w"},
            "h5netcdf": {"phony_dims": "sort"},
        }
    )
    resolved = resolve_open_kwargs("netcdf4", options, NETCDF4_PARAMS)
    assert resolved.backend_kwargs == {"auto_complex": True}  # "mode" refused
    assert any("netcdf4.mode ignored" in note for note in resolved.notes)
    # Another engine's keys do not leak
    assert "phony_dims" not in resolved.backend_kwargs


def test_user_backend_kwargs_cannot_replace_viewer_keys() -> None:
    options = DecodingOptions(
        engine_backend_kwargs={
            "zarr": {"consolidated": True},
            "cfgrib": {"indexpath": "/x"},
        }
    )
    zarr = resolve_open_kwargs(
        "zarr", options, None, reserved=frozenset({"consolidated", "group"})
    )
    assert "consolidated" not in zarr.backend_kwargs
    grib = resolve_open_kwargs("cfgrib", options, None)
    assert grib.backend_kwargs == {"indexpath": ""}  # indexpath is not allowed
    assert grib.notes


def test_user_backend_kwargs_unknown_to_installed_engine() -> None:
    options = DecodingOptions(engine_backend_kwargs={"netcdf4": {"auto_complex": True}})
    resolved = resolve_open_kwargs(
        "netcdf4", options, frozenset({"mask_and_scale", "decode_times"})
    )
    assert resolved.backend_kwargs == {}
    assert "does not take it" in resolved.notes[0]


def test_format_open_call_comments_each_source() -> None:
    options = DecodingOptions(
        decode_times=False,
        engine_backend_kwargs={"cfgrib": {"filter_by_keys": {"a": 1}}},
    )
    resolved = resolve_open_kwargs("cfgrib", options, None)
    call = format_open_call(
        "xarray.open_dataset", "'f.grib'", "cfgrib", resolved.kwargs
    )
    assert call.splitlines()[0] == "xarray.open_dataset("
    assert "    decode_times=False,  # setting" in call
    assert "        'indexpath': '',  # viewer default" in call
    assert "        'filter_by_keys': {'a': 1},  # setting" in call


@pytest.mark.parametrize(
    "text",
    ["[]", '{"netcdf4": 1}', "not json"],
)
def test_parse_engine_backend_kwargs_rejects_bad_shapes(text: str) -> None:
    with pytest.raises(ValueError):
        parse_engine_backend_kwargs(text)


def test_cli_decoding_flags() -> None:
    args = parse_cli_args(
        [
            "info",
            "f.nc",
            "--mask-and-scale",
            "off",
            "--decode-coords",
            "all",
            "--use-cftime",
            "on",
            "--raw",
            "--engine-backend-kwargs",
            '{"scipy": {"mmap": false}}',
        ]
    )
    options = _decoding_options(args)
    assert options == DecodingOptions(
        mask_and_scale=False,
        decode_times=None,
        decode_coords="all",
        use_cftime=True,
        raw=True,
        engine_backend_kwargs={"scipy": {"mmap": False}},
    )
    assert _decoding_options(parse_cli_args(["info", "f.nc"])) == DecodingOptions()


# --- rasterio times ---------------------------------------------------------

rasterio = pytest.importorskip("rasterio")
pytest.importorskip("rioxarray")


@pytest.fixture
def time_tagged_tif(tmp_path: Path) -> Path:
    """GeoTIFF whose bands are a time axis, as GDAL writes it from NetCDF."""
    from rasterio.transform import from_origin

    path = tmp_path / "time_tags.tif"
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=4,
        height=3,
        count=2,
        dtype="int16",
        transform=from_origin(0, 3, 1, 1),
        crs="EPSG:4326",
    ) as ds:
        ds.write(np.arange(24, dtype="int16").reshape(2, 3, 4))
        ds.update_tags(
            NETCDF_DIM_EXTRA="{time}",
            NETCDF_DIM_time_DEF="{2,6}",
            NETCDF_DIM_time_VALUES="{0,31}",
            **{"time#units": "days since 2000-01-01", "time#calendar": "standard"},
        )
    return path


def _open(path: Path, convert_bands: bool, decoding: DecodingOptions | None = None):
    from sdv_backend.formats.detect import detect_file_format
    from sdv_backend.opening import OpenedData

    return OpenedData.open(path, detect_file_format(path), convert_bands, decoding)


def test_raster_times_are_datetime64(time_tagged_tif: Path) -> None:
    opened = _open(time_tagged_tif, convert_bands=False)
    try:
        time = opened.datasets["/"]["time"]
        assert np.issubdtype(time.dtype, np.datetime64)
        assert str(time.values[1])[:10] == "2000-02-01"
        assert any("converted from cftime" in note for note in opened.report.notes)
    finally:
        opened.close()


def test_raster_use_cftime_on_keeps_cftime(time_tagged_tif: Path) -> None:
    opened = _open(time_tagged_tif, False, DecodingOptions(use_cftime=True))
    try:
        assert opened.datasets["/"]["time"].dtype == object
    finally:
        opened.close()


def test_raster_bands_as_variables_is_honoured_and_explained(
    time_tagged_tif: Path,
) -> None:
    opened = _open(time_tagged_tif, convert_bands=True)
    try:
        ds = opened.datasets["/"]
        assert set(ds.data_vars) == {"band_1", "band_2"}  # Setting honoured
        assert "time" not in ds.coords
        assert any("NETCDF_DIM_EXTRA" in note for note in opened.report.notes)
    finally:
        opened.close()


def test_raster_raw_mode(time_tagged_tif: Path) -> None:
    opened = _open(time_tagged_tif, False, DecodingOptions(raw=True))
    try:
        ds = opened.datasets["/"]
        assert ds["time"].dtype.kind == "f"  # Raw "days since" values
        assert ds["band_data"].dtype == np.int16
        assert opened.report.raw is True
    finally:
        opened.close()
