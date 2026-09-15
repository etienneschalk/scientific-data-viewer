"""Tests for facetgrid_figsize plot option (P2.7)."""

from __future__ import annotations

import argparse

import pytest
from get_data_info import parse_facetgrid_figsize


def test_parse_facetgrid_figsize_accepts_width_height() -> None:
    assert parse_facetgrid_figsize("4,3") == (4.0, 3.0)
    assert parse_facetgrid_figsize(" 4.5 , 2 ") == (4.5, 2.0)


def test_parse_facetgrid_figsize_rejects_invalid() -> None:
    with pytest.raises(argparse.ArgumentTypeError):
        parse_facetgrid_figsize("4")
    with pytest.raises(argparse.ArgumentTypeError):
        parse_facetgrid_figsize("a,b")
    with pytest.raises(argparse.ArgumentTypeError):
        parse_facetgrid_figsize("0,3")
