"""Tests for display feature flags (Issue #140 group order, xarray encoding attrs)."""

from __future__ import annotations

import xarray as xr
from get_data_info import (
    _collect_dataarray_attributes,
    _flatten_datatree_groups,
    create_variable_info,
)


def test_collect_dataarray_attributes_omits_encoding_when_disabled() -> None:
    var = xr.DataArray(
        [1, 2],
        dims=("x",),
        attrs={"units": "m"},
        name="temp",
    )
    var.encoding["_FillValue"] = -999

    with_encoding = _collect_dataarray_attributes(
        var, show_xarray_encoding_attributes=True
    )
    without_encoding = _collect_dataarray_attributes(
        var, show_xarray_encoding_attributes=False
    )

    assert with_encoding["units"] == "m"
    assert any(k.startswith("__xarray_encoding.") for k in with_encoding)
    assert without_encoding == {"units": "m"}


def test_create_variable_info_respects_encoding_flag() -> None:
    var = xr.DataArray([1], dims=("x",), name="a")
    var.encoding["dtype"] = "int32"

    hidden = create_variable_info("a", var, show_xarray_encoding_attributes=False)
    assert hidden.attributes == {}


def test_flatten_datatree_groups_alphabetical_vs_file_order() -> None:
    root = xr.Dataset({"a": 1})
    child_z = xr.Dataset({"z": 1})
    child_a = xr.Dataset({"b": 1})
    xdt = xr.DataTree.from_dict(
        {
            "/": root,
            "/z_group": child_z,
            "/a_group": child_a,
        }
    )

    alphabetical = _flatten_datatree_groups(xdt, order_groups_alphabetically=True)
    file_order = _flatten_datatree_groups(xdt, order_groups_alphabetically=False)

    assert list(alphabetical.keys()) == ["/", "/a_group", "/z_group"]
    assert list(file_order.keys()) == ["/", "/z_group", "/a_group"]
