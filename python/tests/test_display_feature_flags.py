"""Tests for display feature flags (Issue #140 group order, xarray encoding)."""

from __future__ import annotations

import xarray as xr

from sdv_backend.info.datatree import flatten_datatree_groups
from sdv_backend.info.encoding import collect_attributes, collect_encoding
from sdv_backend.info.extract import get_file_info
from sdv_backend.info.options import InfoOptions
from sdv_backend.info.variables import create_coord_info, create_variable_info
from sdv_backend.results import FileInfoResult


def test_attributes_and_encoding_are_collected_separately() -> None:
    var = xr.DataArray(
        [1, 2],
        dims=("x",),
        attrs={"units": "m"},
        name="temp",
    )
    var.encoding["_FillValue"] = -999

    assert collect_attributes(var) == {"units": "m"}
    assert collect_encoding(var) == {"_FillValue": -999}


def test_create_variable_info_respects_encoding_flag() -> None:
    var = xr.DataArray([1], dims=("x",), name="a", attrs={"units": "m"})
    var.encoding["dtype"] = "int32"

    shown = create_variable_info("a", var, show_xarray_encoding_attributes=True)
    hidden = create_variable_info("a", var, show_xarray_encoding_attributes=False)

    assert shown.encoding == {"dtype": "int32"}
    assert shown.attributes == {"units": "m"}
    assert hidden.encoding == {}
    assert hidden.attributes == {"units": "m"}


def test_create_coord_info_respects_encoding_flag() -> None:
    coord = xr.DataArray([0, 1], dims=("x",), name="x")
    coord.encoding["dtype"] = "int32"

    shown = create_coord_info("x", coord, show_xarray_encoding_attributes=True)
    hidden = create_coord_info("x", coord, show_xarray_encoding_attributes=False)

    assert shown.encoding == {"dtype": "int32"}
    assert shown.attributes == {}
    assert hidden.encoding == {}


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

    alphabetical = flatten_datatree_groups(xdt, order_groups_alphabetically=True)
    file_order = flatten_datatree_groups(xdt, order_groups_alphabetically=False)

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
        nc_path, InfoOptions(small_variable_bytes=0, order_groups_alphabetically=True)
    )
    file_order_result = get_file_info(
        nc_path, InfoOptions(small_variable_bytes=0, order_groups_alphabetically=False)
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


def test_get_file_info_hides_encoding_when_disabled(
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
        InfoOptions(small_variable_bytes=0, show_xarray_encoding_attributes=True),
    )
    without_encoding = get_file_info(
        nc_path,
        InfoOptions(small_variable_bytes=0, show_xarray_encoding_attributes=False),
    )

    assert isinstance(with_encoding, FileInfoResult)
    assert isinstance(without_encoding, FileInfoResult)

    var_on = with_encoding.variables_flattened["/"][0]
    var_off = without_encoding.variables_flattened["/"][0]

    assert var_on.attributes == var_off.attributes == {"units": "K"}
    assert var_on.encoding["_FillValue"] == -999
    assert var_off.encoding == {}
    assert "source" in with_encoding.encoding_flattened["/"]
    assert without_encoding.encoding_flattened == {}
