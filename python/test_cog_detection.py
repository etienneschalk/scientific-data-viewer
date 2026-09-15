"""Tests for Cloud Optimized GeoTIFF (COG) display naming (P2.3)."""

from __future__ import annotations

import numpy as np
import pytest
from get_data_info import (
    COG_DISPLAY_NAME,
    FileInfoResult,
    detect_file_format,
    get_file_info,
    looks_like_cloud_optimized_geotiff,
    refine_geotiff_display_name,
)


def _write_plain_geotiff(path) -> None:
    pytest.importorskip("rasterio")
    import rasterio
    from rasterio.transform import from_origin

    data = np.arange(100, dtype="uint8").reshape(10, 10)
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=10,
        width=10,
        count=1,
        dtype="uint8",
        transform=from_origin(0, 10, 1, 1),
        crs="EPSG:4326",
    ) as dst:
        dst.write(data, 1)


def _write_cog(path) -> None:
    pytest.importorskip("rasterio")
    import rasterio
    from rasterio.transform import from_origin

    data = np.arange(100, dtype="uint8").reshape(10, 10)
    with rasterio.open(
        path,
        "w",
        driver="COG",
        height=10,
        width=10,
        count=1,
        dtype="uint8",
        transform=from_origin(0, 10, 1, 1),
        crs="EPSG:4326",
        compress="deflate",
    ) as dst:
        dst.write(data, 1)


def test_plain_geotiff_is_not_cog(tmp_path) -> None:
    path = tmp_path / "plain.tif"
    _write_plain_geotiff(path)
    assert not looks_like_cloud_optimized_geotiff(path)
    assert refine_geotiff_display_name(path, "GeoTIFF") == "GeoTIFF"


def test_cog_geotiff_is_detected(tmp_path) -> None:
    path = tmp_path / "scene.tif"
    _write_cog(path)
    assert looks_like_cloud_optimized_geotiff(path)
    assert refine_geotiff_display_name(path, "GeoTIFF") == COG_DISPLAY_NAME


def test_get_file_info_labels_cog_after_rasterio_open(tmp_path) -> None:
    pytest.importorskip("rioxarray")
    cog_path = tmp_path / "scene.tif"
    plain_path = tmp_path / "striped.tif"
    _write_cog(cog_path)
    _write_plain_geotiff(plain_path)

    cog_result = get_file_info(cog_path, small_variable_bytes=0)
    plain_result = get_file_info(plain_path, small_variable_bytes=0)
    assert isinstance(cog_result, FileInfoResult)
    assert isinstance(plain_result, FileInfoResult)
    assert cog_result.format_info.display_name == COG_DISPLAY_NAME
    assert plain_result.format_info.display_name == "GeoTIFF"
    assert cog_result.used_engine == "rasterio"


def test_detect_file_format_before_open_stays_geotiff(tmp_path) -> None:
    path = tmp_path / "scene.tif"
    _write_cog(path)
    info = detect_file_format(path)
    assert info.display_name == "GeoTIFF"
