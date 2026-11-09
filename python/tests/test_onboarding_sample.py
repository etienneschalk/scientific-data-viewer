#!/usr/bin/env python3
"""Tests for the sample file shipped with the extension (Getting Started walkthrough)."""

from __future__ import annotations

import os
from pathlib import Path

import numpy as np
import pytest
import xarray as xr
from sample_data.onboarding import (
    BUNDLED_SAMPLE_PATH,
    SAMPLE_FILE_NAME,
    STATIONS_GROUP,
    check_bundled_sample,
    create_sample_onboarding,
    open_sample_groups,
    write_onboarding_sample,
)

from sdv_backend.info.extract import get_file_info

pytest.importorskip("netCDF4")


def test_generator_is_deterministic(tmp_path: Path) -> None:
    first = write_onboarding_sample(tmp_path / "first.nc")
    # Another global numpy seed must not change the output
    np.random.seed(1)
    second = write_onboarding_sample(tmp_path / "second.nc")
    assert first.read_bytes() == second.read_bytes()


def test_bundled_sample_is_up_to_date() -> None:
    """The committed copy matches the generator (content, not bytes: the bytes
    record the netCDF-C / HDF5 versions)."""
    assert BUNDLED_SAMPLE_PATH.exists()
    assert BUNDLED_SAMPLE_PATH.stat().st_size < 200 * 1024
    assert check_bundled_sample() == [], (
        "Regenerate it: python python/create_sample_data.py --bundled-sample"
    )


def test_bundled_sample_content() -> None:
    groups = open_sample_groups(BUNDLED_SAMPLE_PATH)
    assert set(groups) == {"/", STATIONS_GROUP}

    root = groups["/"]
    assert set(root.data_vars) == {"tas", "tas_global_mean", "sftlf"}
    assert dict(root.sizes) == {"time": 24, "lat": 36, "lon": 72}
    assert root["tas"].dims == ("time", "lat", "lon")
    assert root["tas"].attrs["units"] == "K"
    assert root["tas"].attrs["standard_name"] == "air_temperature"
    assert root["tas"].encoding["dtype"] == np.dtype("int16")
    assert root["tas"].encoding["scale_factor"] == pytest.approx(0.01)
    assert root["tas_global_mean"].dims == ("time",)
    assert np.issubdtype(root["time"].dtype, np.datetime64)
    assert root["lat"].attrs["units"] == "degrees_north"
    assert root.attrs["Conventions"] == "CF-1.8"
    assert "2025-01-01" in root.attrs["history"]
    # Plausible temperatures, no fill values left
    assert 200 < float(root["tas"].min()) < float(root["tas"].max()) < 320
    assert not root["tas"].isnull().any()
    assert 0 <= float(root["sftlf"].min()) <= float(root["sftlf"].max()) <= 100

    stations = groups[STATIONS_GROUP]
    assert stations["tas"].dims == ("station", "time")
    assert stations.attrs["featureType"] == "timeSeries"
    assert list(stations["station_name"].values) == [
        "Northern mid-latitudes",
        "Equatorial",
        "Southern high latitudes",
    ]


def test_bundled_sample_opens_as_datatree() -> None:
    tree = xr.open_datatree(BUNDLED_SAMPLE_PATH, engine="netcdf4")
    try:
        assert set(tree.groups) == {"/", f"/{STATIONS_GROUP}"}
    finally:
        tree.close()


def test_bundled_sample_backend_info() -> None:
    """What the viewer shows when the walkthrough opens the sample."""
    result = get_file_info(BUNDLED_SAMPLE_PATH)
    variables = {
        group: [v.name for v in rows]
        for group, rows in result.variables_flattened.items()
    }
    assert variables == {
        "/": ["tas", "tas_global_mean", "sftlf"],
        f"/{STATIONS_GROUP}": ["tas"],
    }


def test_create_sample_onboarding_in_current_folder(tmp_path: Path) -> None:
    cwd = Path.cwd()
    try:
        os.chdir(tmp_path)
        assert create_sample_onboarding() == SAMPLE_FILE_NAME
        mtime = (tmp_path / SAMPLE_FILE_NAME).stat().st_mtime_ns
        # Kept when it exists, like the other generators
        assert create_sample_onboarding() == SAMPLE_FILE_NAME
        assert (tmp_path / SAMPLE_FILE_NAME).stat().st_mtime_ns == mtime
    finally:
        os.chdir(cwd)
