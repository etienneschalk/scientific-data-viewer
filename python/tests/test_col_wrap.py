"""Tests for xarray col_wrap='auto' (xarray 2026.04+)."""

from __future__ import annotations

import argparse

import numpy as np
import pytest
import xarray as xr

from sdv_backend.plotting.layout import Choice, resolve_layout
from sdv_backend.plotting.options import (
    PlotOptions,
    parse_col_wrap,
    xarray_supports_col_wrap_auto,
)


def test_parse_col_wrap_accepts_auto() -> None:
    assert parse_col_wrap("auto") == "auto"
    assert parse_col_wrap("AUTO") == "auto"


def test_parse_col_wrap_accepts_positive_int() -> None:
    assert parse_col_wrap("4") == 4


@pytest.mark.parametrize("value", ["0", "-1", "nope", ""])
def test_parse_col_wrap_rejects_invalid(value: str) -> None:
    with pytest.raises(argparse.ArgumentTypeError):
        parse_col_wrap(value)


def _col_wrap(col_wrap) -> object:
    var = xr.DataArray(np.zeros((6, 2, 3)), dims=("t", "y", "x"))
    _, layout = resolve_layout(var, PlotOptions(col_wrap=col_wrap))
    return layout.choices.get("col_wrap")


def test_layout_keeps_col_wrap_auto(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "sdv_backend.plotting.layout.xarray_supports_col_wrap_auto", lambda: True
    )
    assert _col_wrap("auto") == Choice("auto", "user")


def test_layout_replaces_auto_on_old_xarray(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "sdv_backend.plotting.layout.xarray_supports_col_wrap_auto", lambda: False
    )
    assert _col_wrap("auto") == Choice(4, "auto")


def test_current_xarray_supports_col_wrap_auto() -> None:
    assert xarray_supports_col_wrap_auto() is True
