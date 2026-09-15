"""Tests for xarray col_wrap='auto' (xarray 2026.04+)."""

from __future__ import annotations

import argparse

import pytest
from get_data_info import (
    PlotKwargsBundle,
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


def test_plot_kwargs_include_col_wrap_auto(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("get_data_info.xarray_supports_col_wrap_auto", lambda: True)
    bundle = PlotKwargsBundle.build(
        bins=None,
        robust=None,
        xincrease=None,
        yincrease=None,
        aspect=None,
        size=None,
        cmap=None,
        col_wrap="auto",
    )
    assert bundle.raw["col_wrap"] == "auto"


def test_plot_kwargs_omit_auto_on_old_xarray(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("get_data_info.xarray_supports_col_wrap_auto", lambda: False)
    bundle = PlotKwargsBundle.build(
        bins=None,
        robust=None,
        xincrease=None,
        yincrease=None,
        aspect=None,
        size=None,
        cmap=None,
        col_wrap="auto",
    )
    assert "col_wrap" not in bundle.raw


def test_current_xarray_supports_col_wrap_auto() -> None:
    assert xarray_supports_col_wrap_auto() is True
