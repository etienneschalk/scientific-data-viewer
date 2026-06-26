#!/usr/bin/env python3
"""Tests for lightweight many-group NetCDF samples (Issue #131 load/UI testing)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))
from get_data_info import dispatch_argv

REPO_ROOT = Path(__file__).resolve().parent.parent

SAMPLES = (
    {
        "path": REPO_ROOT / "sample-data" / "sample_data_many_groups_light.nc",
        "min_groups": 25,
        "max_size_kb": 512,
    },
    {
        "path": REPO_ROOT / "sample-data" / "sample_data_many_groups_light_x5.nc",
        "min_groups": 130,
        "max_size_kb": 3072,
    },
)


@pytest.mark.parametrize("sample", SAMPLES, ids=["light", "light_x5"])
def test_many_groups_light_metadata_shape(sample: dict) -> None:
    path: Path = sample["path"]
    if not path.is_file():
        pytest.skip("sample file not generated yet")

    payload = dispatch_argv(
        ["info", str(path), "--skip-reprs", "--small-variable-bytes", "0"]
    )
    assert "result" in payload
    result = payload["result"]
    groups = list(result.get("dimensions_flattened", {}).keys())
    min_groups = sample["min_groups"]
    assert len(groups) >= min_groups, (
        f"expected at least {min_groups} groups, got {len(groups)}: {groups[:5]}..."
    )
    assert result.get("xarray_html_repr") == ""
    assert result.get("xarray_text_repr") == ""


@pytest.mark.parametrize("sample", SAMPLES, ids=["light", "light_x5"])
def test_many_groups_light_file_is_small(sample: dict) -> None:
    path: Path = sample["path"]
    if not path.is_file():
        pytest.skip("sample file not generated yet")

    size_kb = path.stat().st_size / 1024
    max_size_kb = sample["max_size_kb"]
    assert size_kb < max_size_kb, (
        f"expected sample <{max_size_kb} KiB, got {size_kb:.1f} KiB"
    )
