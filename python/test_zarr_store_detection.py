"""Tests for detecting Zarr stores that are not named ``*.zarr``."""

from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np
import pytest
import xarray as xr
from get_data_info import (
    _collect_dataarray_attributes,
    detect_file_format,
    detect_zarr_format_version,
    is_zarr_store,
    resolve_store_path,
)

if TYPE_CHECKING:
    from pathlib import Path


def _write_store(path: Path, zarr_format: int) -> Path:
    ds = xr.Dataset(
        {"temperature": (("t", "x"), np.zeros((2, 3), dtype="float32"))},
        coords={"t": np.arange(2), "x": np.arange(3)},
    )
    ds.to_zarr(path, zarr_format=zarr_format, consolidated=False)
    return path


@pytest.mark.parametrize("zarr_format", [2, 3])
def test_store_without_zarr_suffix_is_detected(
    tmp_path: Path, zarr_format: int
) -> None:
    store = _write_store(tmp_path / "ocean_reanalysis", zarr_format)

    assert is_zarr_store(store)

    format_info = detect_file_format(store)
    assert format_info.extension == ".zarr"
    assert format_info.display_name == f"Zarr v{zarr_format}"


def test_store_with_zarr_suffix_still_detected(tmp_path: Path) -> None:
    store = _write_store(tmp_path / "ocean.zarr", zarr_format=3)

    format_info = detect_file_format(store)
    assert format_info.extension == ".zarr"


def test_plain_directory_is_not_a_store(tmp_path: Path) -> None:
    plain = tmp_path / "outputs"
    plain.mkdir()
    (plain / "notes.txt").write_text("not a store")

    assert not is_zarr_store(plain)
    assert detect_file_format(plain).extension == ""


def test_known_suffix_takes_precedence_over_store_markers(tmp_path: Path) -> None:
    # A directory carrying a recognised data suffix must keep that format,
    # so Zarr detection never hijacks another engine's path.
    store = _write_store(tmp_path / "scene.tif", zarr_format=3)

    assert detect_file_format(store).extension == ".tif"


@pytest.mark.parametrize("marker", ["zarr.json", ".zgroup", ".zmetadata"])
def test_metadata_file_resolves_to_store_directory(tmp_path: Path, marker: str) -> None:
    store = tmp_path / "store"
    store.mkdir()
    (store / marker).write_text("{}")

    assert resolve_store_path(store / marker) == store


def test_resolve_store_path_leaves_other_paths_untouched(tmp_path: Path) -> None:
    dataset = tmp_path / "sample.nc"
    dataset.write_bytes(b"")

    assert resolve_store_path(dataset) == dataset

    store = _write_store(tmp_path / "ocean", zarr_format=3)
    assert resolve_store_path(store) == store


@pytest.mark.parametrize(("zarr_format", "expected"), [(2, 2), (3, 3)])
def test_detect_zarr_format_version(
    tmp_path: Path, zarr_format: int, expected: int
) -> None:
    store = _write_store(tmp_path / "store", zarr_format)

    assert detect_zarr_format_version(store) == expected


def test_detect_zarr_format_version_is_none_for_non_store(tmp_path: Path) -> None:
    plain = tmp_path / "plain"
    plain.mkdir()

    assert detect_zarr_format_version(plain) is None


def test_encoding_reports_codec_names_and_shards(tmp_path: Path) -> None:
    # Zarr v3 codecs are dataclasses, so without describing them by name the
    # UI would show a bare configuration such as {"level": 0}.
    store = tmp_path / "sharded"
    ds = xr.Dataset(
        {"temp": (("t", "x"), np.zeros((8, 8), dtype="float32"))},
        coords={"t": np.arange(8), "x": np.arange(8)},
    )
    ds.to_zarr(
        store,
        zarr_format=3,
        consolidated=False,
        encoding={"temp": {"chunks": (2, 2), "shards": (4, 4)}},
    )

    opened = xr.open_dataset(store, engine="zarr", consolidated=False)
    attributes = _collect_dataarray_attributes(
        opened["temp"], show_xarray_encoding_attributes=True
    )

    assert attributes["__xarray_encoding.shards"] == (4, 4)
    compressors = attributes["__xarray_encoding.compressors"]
    assert [codec["name"] for codec in compressors] == ["zstd"]
    assert attributes["__xarray_encoding.serializer"]["name"] == "bytes"


def test_encoding_values_that_are_not_codecs_are_untouched() -> None:
    variable = xr.DataArray([1, 2], dims=("x",), name="a")
    variable.encoding["chunks"] = (2,)
    variable.encoding["dtype"] = "int32"

    attributes = _collect_dataarray_attributes(
        variable, show_xarray_encoding_attributes=True
    )

    assert attributes["__xarray_encoding.chunks"] == (2,)
    assert attributes["__xarray_encoding.dtype"] == "int32"


def test_unrelated_json_file_is_not_resolved_to_its_directory(tmp_path: Path) -> None:
    # Only Zarr metadata names redirect to the parent, so ordinary JSON files
    # keep pointing at themselves and fail as an unsupported format.
    stray = tmp_path / "config.json"
    stray.write_text("{}")

    assert resolve_store_path(stray) == stray
