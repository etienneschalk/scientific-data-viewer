"""Tests for display feature flags (Issue #140 group order, xarray encoding attrs)."""

from __future__ import annotations

import xarray as xr
from get_data_info import (
    FileInfoResult,
    _collect_dataarray_attributes,
    _flatten_datatree_groups,
    create_coord_info,
    create_variable_info,
    get_file_info,
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

    shown = create_variable_info("a", var, show_xarray_encoding_attributes=True)
    hidden = create_variable_info("a", var, show_xarray_encoding_attributes=False)

    assert any(k.startswith("__xarray_encoding.") for k in shown.attributes)
    assert hidden.attributes == {}


def test_create_coord_info_respects_encoding_flag() -> None:
    coord = xr.DataArray([0, 1], dims=("x",), name="x")
    coord.encoding["dtype"] = "int32"

    shown = create_coord_info("x", coord, show_xarray_encoding_attributes=True)
    hidden = create_coord_info("x", coord, show_xarray_encoding_attributes=False)

    assert any(k.startswith("__xarray_encoding.") for k in shown.attributes)
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


def test_get_file_info_group_order_flag(tmp_path) -> None:
    root = xr.Dataset({"root_var": 1})
    first = xr.Dataset({"first_var": 1})
    second = xr.Dataset({"second_var": 1})
    xdt = xr.DataTree.from_dict(
        {
            "/": root,
            "/sector_b": second,
            "/sector_a": first,
        }
    )
    nc_path = tmp_path / "ordered_groups.nc"
    xdt.to_netcdf(nc_path)

    sorted_result = get_file_info(
        nc_path,
        small_variable_bytes=0,
        order_groups_alphabetically=True,
    )
    file_order_result = get_file_info(
        nc_path,
        small_variable_bytes=0,
        order_groups_alphabetically=False,
    )

    assert isinstance(sorted_result, FileInfoResult)
    assert isinstance(file_order_result, FileInfoResult)

    assert list(sorted_result.dimensions_flattened.keys()) == [
        "/",
        "/sector_a",
        "/sector_b",
    ]
    assert list(file_order_result.dimensions_flattened.keys()) == [
        "/",
        "/sector_b",
        "/sector_a",
    ]


def test_get_file_info_hides_encoding_attributes_when_disabled(
    tmp_path,
) -> None:
    var = xr.DataArray(
        [1.0, 2.0],
        dims=("x",),
        name="temp",
        attrs={"units": "K"},
    )
    var.encoding["_FillValue"] = -999
    ds = xr.Dataset({"temp": var})
    nc_path = tmp_path / "encoding_attrs.nc"
    ds.to_netcdf(nc_path)

    with_encoding = get_file_info(
        nc_path,
        small_variable_bytes=0,
        show_xarray_encoding_attributes=True,
    )
    without_encoding = get_file_info(
        nc_path,
        small_variable_bytes=0,
        show_xarray_encoding_attributes=False,
    )

    assert isinstance(with_encoding, FileInfoResult)
    assert isinstance(without_encoding, FileInfoResult)

    var_attrs_on = with_encoding.variables_flattened["/"][0].attributes
    var_attrs_off = without_encoding.variables_flattened["/"][0].attributes

    assert any(k.startswith("__xarray_encoding.") for k in var_attrs_on)
    assert not any(k.startswith("__xarray_encoding.") for k in var_attrs_off)
    assert var_attrs_off.get("units") == "K"
