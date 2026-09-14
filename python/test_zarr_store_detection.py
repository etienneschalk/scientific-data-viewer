"""Tests for detecting Zarr stores that are not named ``*.zarr``."""

from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np
import pytest
import xarray as xr
from get_data_info import (
    detect_file_format,
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
    assert format_info.display_name == "Zarr"


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


def test_unrelated_json_file_is_not_resolved_to_its_directory(tmp_path: Path) -> None:
    # Only Zarr metadata names redirect to the parent, so ordinary JSON files
    # keep pointing at themselves and fail as an unsupported format.
    stray = tmp_path / "config.json"
    stray.write_text("{}")

    assert resolve_store_path(stray) == stray
