#!/usr/bin/env python3
"""Tests for datetime_min_max_iso helper."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr

sys.path.insert(0, str(Path(__file__).parent))
from get_data_info import datetime_min_max_iso


def test_datetime_min_max_iso_from_coordinate() -> None:
    dates = pd.date_range("2020-01-01", periods=5, freq="D")
    coord = xr.DataArray(dates, dims=["time"], name="time")
    min_val, max_val = datetime_min_max_iso(coord)
    assert min_val == pd.Timestamp(dates[0]).isoformat()
    assert max_val == pd.Timestamp(dates[-1]).isoformat()


def test_datetime_min_max_iso_empty() -> None:
    coord = xr.DataArray(np.array([], dtype="datetime64[ns]"), dims=["time"])
    min_val, max_val = datetime_min_max_iso(coord)
    assert min_val is None
    assert max_val is None
