"""Tests for v0.13 NetCDF engine order, HDF5 filters, and inherited coords."""

from __future__ import annotations

import numpy as np
import xarray as xr
from get_data_info import (
    FileInfoResult,
    _collect_dataarray_attributes,
    _engines_for_extension,
    _flatten_datatree_groups,
    get_file_info,
    inherited_coord_sources,
    normalize_netcdf_engine_order,
)


def test_normalize_netcdf_engine_order_fills_defaults() -> None:
    assert normalize_netcdf_engine_order(None) == [
        "netcdf4",
        "h5netcdf",
        "scipy",
    ]
    assert normalize_netcdf_engine_order("h5netcdf") == [
        "h5netcdf",
        "netcdf4",
        "scipy",
    ]
    assert normalize_netcdf_engine_order(["scipy", "bogus", "h5netcdf"]) == [
        "scipy",
        "h5netcdf",
        "netcdf4",
    ]


def test_engines_for_extension_ignores_order_for_cdf_and_nc4_scipy() -> None:
    assert _engines_for_extension(".cdf", ["h5netcdf", "netcdf4"]) == ["cdflib"]
    assert _engines_for_extension(".nc4", ["scipy", "h5netcdf", "netcdf4"]) == [
        "h5netcdf",
        "netcdf4",
    ]


def test_get_file_info_used_engine_follows_netcdf_order(tmp_path) -> None:
    nc_path = tmp_path / "engine_order.nc"
    xr.Dataset({"temp": ("x", np.arange(4))}).to_netcdf(nc_path)

    netcdf4_first = get_file_info(nc_path, small_variable_bytes=0)
    h5_first = get_file_info(
        nc_path,
        small_variable_bytes=0,
        netcdf_engine_order=["h5netcdf", "netcdf4", "scipy"],
    )
    assert isinstance(netcdf4_first, FileInfoResult)
    assert isinstance(h5_first, FileInfoResult)
    assert netcdf4_first.used_engine == "netcdf4"
    assert h5_first.used_engine == "h5netcdf"


def test_gzip_netcdf_exposes_complevel_filters(tmp_path) -> None:
    nc_path = tmp_path / "gzip.nc"
    ds = xr.Dataset({"temp": ("x", np.arange(8, dtype="float32"))})
    ds.to_netcdf(
        nc_path,
        encoding={"temp": {"zlib": True, "complevel": 4}},
    )

    result = get_file_info(nc_path, small_variable_bytes=0)
    assert isinstance(result, FileInfoResult)
    attrs = result.variables_flattened["/"][0].attributes
    assert attrs["__xarray_encoding.filters.zlib"] is True
    assert attrs["__xarray_encoding.filters.complevel"] == 4

    hidden = _collect_dataarray_attributes(
        xr.open_dataset(nc_path)["temp"],
        show_xarray_encoding_attributes=False,
    )
    assert not any(k.startswith("__xarray_encoding.filters.") for k in hidden)


def test_inherited_coordinates_on_child_groups(tmp_path) -> None:
    root = xr.Dataset(
        coords={
            "time": ("time", np.arange(3)),
            "x": ("x", np.arange(2)),
        }
    )
    root = root.assign_coords(label=("time", list("abc")))
    child = xr.Dataset({"temp": (("time", "x"), np.zeros((3, 2)))})
    xdt = xr.DataTree.from_dict({"/": root, "/temp": child})
    zarr_path = tmp_path / "inherited.zarr"
    xdt.to_zarr(zarr_path)

    shown = get_file_info(
        zarr_path,
        small_variable_bytes=0,
        show_inherited_coordinates=True,
    )
    hidden = get_file_info(
        zarr_path,
        small_variable_bytes=0,
        show_inherited_coordinates=False,
    )
    assert isinstance(shown, FileInfoResult)
    assert isinstance(hidden, FileInfoResult)

    shown_names = {c.name: c for c in shown.coordinates_flattened["/temp"]}
    assert {"time", "x", "label"} <= set(shown_names)
    assert shown_names["label"].attributes["inherited_from"] == "/"
    assert shown_names["time"].attributes["inherited_from"] == "/"

    hidden_names = {c.name for c in hidden.coordinates_flattened.get("/temp", [])}
    assert "label" not in hidden_names
    assert "time" not in hidden_names


def test_flatten_inherit_modes_match_xarray() -> None:
    root = xr.Dataset(coords={"time": np.arange(3), "x": np.arange(2)})
    root = root.assign_coords(label=("time", list("abc")))
    child = xr.Dataset({"temp": (("time", "x"), np.zeros((3, 2)))})
    xdt = xr.DataTree.from_dict({"/": root, "/temp": child})

    inherited = _flatten_datatree_groups(
        xdt, order_groups_alphabetically=True, show_inherited_coordinates=True
    )
    local_only = _flatten_datatree_groups(
        xdt, order_groups_alphabetically=True, show_inherited_coordinates=False
    )
    assert set(inherited["/temp"].coords) == {"time", "x", "label"}
    assert set(local_only["/temp"].coords) == set()

    sources = inherited_coord_sources(xdt, show_inherited_coordinates=True)
    assert sources["/temp"]["label"] == "/"
