"""Tests for minimum package version handling (xarray 2026 requires zarr >= 3)."""

from __future__ import annotations

from importlib.metadata import PackageNotFoundError

import get_data_info
import pytest
from get_data_info import (
    check_package_is_usable,
    get_available_engines,
    get_missing_packages,
    get_package_requirement,
)


def test_get_package_requirement_includes_minimum_version() -> None:
    assert get_package_requirement("zarr") == "zarr>=3"


def test_get_package_requirement_without_minimum_is_bare_name() -> None:
    assert get_package_requirement("h5py") == "h5py"


@pytest.mark.parametrize("installed", ["2.18.4", "2.18.4.dev0"])
def test_zarr_below_minimum_is_not_usable(
    monkeypatch: pytest.MonkeyPatch, installed: str
) -> None:
    monkeypatch.setattr(get_data_info, "package_version", lambda _name: installed)

    assert check_package_is_usable("zarr") is False
    assert get_available_engines(".zarr") == []
    assert get_missing_packages(".zarr") == ["zarr>=3"]


@pytest.mark.parametrize("installed", ["3.0.0", "3.1.3", "4.0.0"])
def test_zarr_at_or_above_minimum_is_usable(
    monkeypatch: pytest.MonkeyPatch, installed: str
) -> None:
    monkeypatch.setattr(get_data_info, "package_version", lambda _name: installed)

    assert check_package_is_usable("zarr") is True
    assert get_available_engines(".zarr") == ["zarr"]
    assert get_missing_packages(".zarr") == []


def test_unparseable_version_is_assumed_usable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(get_data_info, "package_version", lambda _name: "unknown")

    assert check_package_is_usable("zarr") is True


def test_missing_distribution_metadata_is_assumed_usable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def raise_not_found(_name: str) -> str:
        raise PackageNotFoundError(_name)

    monkeypatch.setattr(get_data_info, "package_version", raise_not_found)

    assert check_package_is_usable("zarr") is True


def test_uninstalled_package_is_not_usable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_data_info, "find_spec", lambda _name: None)

    assert check_package_is_usable("zarr") is False
