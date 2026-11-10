"""Create hostile / degenerate data files for QA (see scripts/qa/README.md).

Usage: python scripts/qa/fixtures/make_fixtures.py [out_dir]

Default out_dir: $SDV_QA_OUT/fixtures (SDV_QA_OUT defaults to <repo>/artefacts/qa). The
folder is deleted and created again. Needs xarray, netCDF4, h5netcdf, h5py,
zarr, rasterio and kerchunk (the repository .venv has them).
"""

import json
import os
import shutil
import sys
import zipfile
from pathlib import Path

import h5py
import netCDF4
import numpy as np
import pandas as pd
import xarray as xr

REPO = Path(__file__).resolve().parents[3]
OUT = (
    Path(sys.argv[1])
    if len(sys.argv) > 1
    else Path(os.environ.get("SDV_QA_OUT", REPO / "artefacts" / "qa")) / "fixtures"
)
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)

XSS = '<img src=x onerror="alert(1)">'
XSS2 = "</script><script>alert(2)</script>"
XSS3 = '" onmouseover="alert(3)" x="'
XSS4 = "${alert(4)}`'\\"


def nc(name, ds, **kw):
    ds.to_netcdf(OUT / name, **kw)


# 1. hostile names everywhere (variable, dim, coord, attribute key + value, group)
ds = xr.Dataset(
    {
        "v" + XSS: (
            ("x",),
            np.arange(4.0),
            {"k" + XSS: XSS2, "units": XSS3, "long_name": XSS4},
        ),
        "normal": (
            ("x", "y"),
            np.arange(12.0).reshape(4, 3),
            {"desc": "<b>bold</b> & <i>it</i>"},
        ),
        "javascript_link": (
            ("x",),
            np.arange(4.0),
            {
                "url": "javascript:alert(5)",
                "href": "<a href='javascript:alert(6)'>click</a>",
            },
        ),
    },
    coords={"x": np.arange(4), "y": [10, 20, 30]},
    attrs={"title": XSS, "history": XSS2, "k<script>": "key xss"},
)
nc("xss_names.nc", ds)
ds.rename({"v" + XSS: XSS}).to_zarr(OUT / "xss_names.zarr", zarr_format=3, mode="w")
with netCDF4.Dataset(OUT / "xss_groups.nc", "w") as f:
    g = f.createGroup("g" + XSS)
    g.createDimension("t", 3)
    v = g.createVariable("v<svg onload=alert(7)>", "f4", ("t",))
    v[:] = [1, 2, 3]
    v.setncattr("note", XSS)
    g2 = g.createGroup("child \"quoted\" 'single' `tick`")
    g2.createDimension("d", 2)
    g2.createVariable("w", "i4", ("d",))[:] = [1, 2]

# 2. unicode / weird-but-legal names
ds = xr.Dataset(
    {
        "température_°C": (("x",), np.arange(3.0)),
        "降水量": (("x",), np.arange(3.0)),
        "emoji_🌊": (("x",), np.arange(3.0)),
        "rtl_‮evil": (("x",), np.arange(3.0)),
        "with space": (("x",), np.arange(3.0)),
        "dot.name": (("x",), np.arange(3.0)),
        "_-dash_leading": (("x",), np.arange(3.0)),
        "a:b": (("x",), np.arange(3.0)),
        "a#b%20c?d": (("x",), np.arange(3.0)),
        "x" * 300: (("x",), np.arange(3.0)),
    },
    attrs={"multi\nline": "line1\nline2\n\ttabbed", "nul_ish": "a\x01b"},
)
nc("unicode_names.nc", ds, engine="h5netcdf")
xr.Dataset(
    {
        "-dash_leading": (("x",), np.arange(3.0)),
        "--help": (("x",), np.arange(3.0)),
        "-1": (("x",), np.arange(3.0)),
        "-1e-5": (("x",), np.arange(3.0)),
    },
    coords={"-x": [0, 1, 2]},
).rename({"x": "-x"}).to_zarr(OUT / "dash_names.zarr", zarr_format=3, mode="w")

# 3. attribute zoo
ds = xr.Dataset(
    {
        "v": (
            ("x",),
            np.arange(5.0),
            {
                "inf": np.inf,
                "ninf": -np.inf,
                "nan": np.nan,
                "big_array": np.arange(20000, dtype="int32"),
                "float_array": np.array([0.1, np.nan, np.inf]),
                "int8": np.int8(-5),
                "uint64": np.uint64(2**64 - 1),
                "empty_str": "",
                "long_str": "L" * 200_000,
                "bytes_like": np.bytes_(b"\xff\xfe raw"),
                "bool_like": np.int8(1),
                "list_str": ["a", "b", "c"],
                "valid_range": np.array([0.0, 2.0], dtype="float32"),
            },
        )
    },
    attrs={"global_inf": np.inf, "global_list": [1, 2, 3]},
)
nc("attr_zoo.nc", ds, engine="netcdf4")

# 4. dtype zoo and degenerate shapes
t = pd.date_range("2020-01-01", periods=6, freq="D")
ds = xr.Dataset(
    {
        "all_nan": (("t", "x"), np.full((6, 4), np.nan)),
        "constant": (("t", "x"), np.ones((6, 4))),
        "bool_var": (("t",), np.array([True, False] * 3)),
        "int8_fill": (("t",), np.array([1, -128, 3, 4, 5, 6], dtype="int8")),
        "str_var": (("t",), np.array(["a", "bb", "ccc", "d", "e", "f"], dtype=object)),
        "timedelta_var": (("t",), pd.to_timedelta(np.arange(6), unit="h")),
        "scalar": ((), 3.5),
        "empty_dim_var": (("e",), np.array([], dtype="float64")),
        "tiny_values": (("t", "x"), np.random.default_rng(0).random((6, 4)) * 1e-12),
        "huge_values": (("t", "x"), np.random.default_rng(1).random((6, 4)) * 1e30),
        "neg_values": (("t", "x"), -np.random.default_rng(2).random((6, 4)) * 1e-6),
        "with_nan_inf": (("t", "x"), np.array([[np.inf, -np.inf, np.nan, 1.0]] * 6)),
        "five_d": (
            ("a", "b", "c", "d", "f"),
            np.random.default_rng(3).random((2, 2, 2, 3, 3)),
        ),
        "datetime_var": (("t",), t),
        "nonmono_x": (("nm",), np.arange(4.0)),
    },
    coords={"t": t, "x": [0.0, 1.0, 2.0, 3.0], "nm": [3, 1, 2, 0]},
)
ds["int8_fill"].encoding["_FillValue"] = -128
nc("dtype_zoo.nc", ds)
xr.Dataset({"c": (("x",), np.array([1 + 2j, 3 - 1j]))}).to_netcdf(
    OUT / "complex.nc", engine="h5netcdf", invalid_netcdf=True
)

# 5. cftime calendars
for cal in ("noleap", "360_day", "julian"):
    times = xr.date_range(
        "2000-01-01", periods=4, freq="MS", calendar=cal, use_cftime=True
    )
    xr.Dataset(
        {"tas": (("time", "x"), np.arange(8.0).reshape(4, 2))},
        coords={"time": times, "x": [0, 1]},
    ).to_netcdf(OUT / f"cftime_{cal}.nc")

# 6. curvilinear 2D coordinates, dims without coords
ny, nx = 5, 6
lat = np.linspace(-10, 10, ny)[:, None] + np.zeros((1, nx))
lon = np.linspace(0, 20, nx)[None, :] + np.zeros((ny, 1)) + lat * 0.1
xr.Dataset(
    {"sst": (("j", "i"), np.random.default_rng(4).random((ny, nx)))},
    coords={"lat": (("j", "i"), lat), "lon": (("j", "i"), lon)},
).to_netcdf(OUT / "curvilinear.nc")

# 7. paths that need URI / shell care
base = xr.Dataset({"v": (("x",), np.arange(3.0))})
for fname in [
    "-starts-with-dash.nc",
    "has#hash.nc",
    "has%25percent.nc",
    "has?question.nc",
    "ünïcødé 名前.nc",
    "semi;colon $(touch PWNED).nc",
    "quote'single\".nc",
]:
    base.to_netcdf(OUT / fname)
(OUT / "dir_named.nc").mkdir()
(OUT / "empty.nc").write_bytes(b"")
(OUT / "empty.zarr").mkdir()
(OUT / "text_as.nc").write_text("this is not netcdf\n")
src = (OUT / "-starts-with-dash.nc").read_bytes()
(OUT / "truncated.nc").write_bytes(src[: len(src) // 2])
os.symlink(OUT / "dtype_zoo.nc", OUT / "symlink_to_zoo.nc")
os.symlink(OUT / "does_not_exist.nc", OUT / "dangling_link.nc")
(OUT / "UPPER.NC").write_bytes(src)
(OUT / "double.nc.zarr").mkdir()

# 8. NetCDF3, unlimited dims, pure HDF5 (not netCDF)
base.to_netcdf(OUT / "netcdf3_classic.nc", format="NETCDF3_CLASSIC")
xr.Dataset({"v": (("time",), np.arange(5.0))}).to_netcdf(
    OUT / "unlimited.nc", unlimited_dims=["time"]
)
with h5py.File(OUT / "pure_hdf5.h5", "w") as f:
    f.create_dataset("raw/data", data=np.arange(12).reshape(3, 4))
    f["raw/data"].attrs["unit"] = "m"
    f.create_dataset("table", data=np.zeros(3, dtype=[("a", "i4"), ("b", "f8")]))
    f.attrs["root_attr"] = "hdf5"
with h5py.File(OUT / "vlen_enum.nc", "w") as f:
    pass
with netCDF4.Dataset(OUT / "vlen_enum.nc", "w") as f:
    f.createDimension("n", 3)
    et = f.createEnumType("u1", "cloud_t", {"clear": 0, "cloudy": 1})
    v = f.createVariable("cloud", et, ("n",))
    v[:] = [0, 1, 0]
    s = f.createVariable("names", str, ("n",))
    s[:] = np.array(["α", "beta", ""], dtype=object)  # noqa: RUF001 (non-ASCII on purpose)
    vl = f.createVLType("i4", "vl_t")
    w = f.createVariable("ragged", vl, ("n",))
    w[0] = np.array([1], "i4")
    w[1] = np.array([1, 2], "i4")
    w[2] = np.array([], "i4")

# 9. Zarr oddities
z = xr.Dataset(
    {"temp": (("y", "x"), np.arange(6.0).reshape(2, 3))},
    coords={"x": [0, 1, 2]},
    attrs={"nested": "n"},
)
z.to_zarr(OUT / "v3store.zarr", zarr_format=3, mode="w")
z.to_zarr(OUT / "v2store.zarr", zarr_format=2, mode="w")
shutil.copytree(OUT / "v3store.zarr", OUT / "scene.tif")  # zarr dir with .tif suffix
shutil.copytree(OUT / "v3store.zarr", OUT / "plain dir with spaces")
z.to_zarr(OUT / "zarr_with_nested_attrs.zarr", zarr_format=3, mode="w")
import zarr  # noqa: E402

g = zarr.open_group(OUT / "zarr_with_nested_attrs.zarr", mode="a")
g.attrs["dict_attr"] = {"a": {"b": [1, 2, {"c": None}]}, "html": XSS}
g["temp"].attrs["null_attr"] = None
g["temp"].attrs["list_of_dicts"] = [{"k": 1}, {"k": XSS}]


def zipdir(src_dir, zpath, prefix=""):
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_STORED) as zf:
        for p in Path(src_dir).rglob("*"):
            if p.is_file():
                zf.write(p, prefix + str(p.relative_to(src_dir)))


zipdir(OUT / "v3store.zarr", OUT / "root_v3.zip")
zipdir(OUT / "v2store.zarr", OUT / "root_v2.zarr.zip")
zipdir(OUT / "v3store.zarr", OUT / "prefixed.zip", prefix="deep/inner/store.zarr/")
with zipfile.ZipFile(OUT / "two_stores.zip", "w") as zf:
    for p in (OUT / "v3store.zarr").rglob("*"):
        if p.is_file():
            zf.write(p, "a.zarr/" + str(p.relative_to(OUT / "v3store.zarr")))
            zf.write(p, "b.zarr/" + str(p.relative_to(OUT / "v3store.zarr")))
with zipfile.ZipFile(OUT / "deflated_v3.zip", "w", zipfile.ZIP_DEFLATED) as zf:
    for p in (OUT / "v3store.zarr").rglob("*"):
        if p.is_file():
            zf.write(p, str(p.relative_to(OUT / "v3store.zarr")))
(OUT / "corrupt.zip").write_bytes(b"PK\x03\x04garbage" * 10)
zipfile.ZipFile(OUT / "empty.zip", "w").close()

# 10. Kerchunk oddities
(OUT / "invalid.kerchunk.json").write_text("{not json")
(OUT / "array.kerchunk.json").write_text("[1,2,3]")
(OUT / "empty_refs.kerchunk.json").write_text(json.dumps({"version": 1, "refs": {}}))
(OUT / "missing_target.kerchunk.json").write_text(
    json.dumps(
        {
            "version": 1,
            "refs": {
                ".zgroup": '{"zarr_format":2}',
                "v/.zarray": json.dumps(
                    {
                        "chunks": [3],
                        "compressor": None,
                        "dtype": "<f8",
                        "fill_value": None,
                        "filters": None,
                        "order": "C",
                        "shape": [3],
                        "zarr_format": 2,
                    }
                ),
                "v/.zattrs": '{"_ARRAY_DIMENSIONS":["x"]}',
                "v/0": ["nonexistent_file.bin", 0, 24],
            },
        }
    )
)
inline = {
    "version": 1,
    "refs": {
        ".zgroup": '{"zarr_format":2}',
        ".zattrs": json.dumps({"title": XSS}),
        "v/.zarray": json.dumps(
            {
                "chunks": [3],
                "compressor": None,
                "dtype": "<f8",
                "fill_value": None,
                "filters": None,
                "order": "C",
                "shape": [3],
                "zarr_format": 2,
            }
        ),
        "v/.zattrs": '{"_ARRAY_DIMENSIONS":["x"]}',
        "v/0": "base64:"
        + __import__("base64").b64encode(np.arange(3.0).tobytes()).decode(),
    },
}
(OUT / "inline.kerchunk.json").write_text(json.dumps(inline))
(OUT / "inline.ref.json").write_text(json.dumps(inline))
(OUT / "inline_plain.json").write_text(json.dumps(inline))

# 11. GeoTIFF oddities
import rasterio  # noqa: E402
from rasterio.transform import from_origin  # noqa: E402

with rasterio.open(
    OUT / "nodata_float.tif",
    "w",
    driver="GTiff",
    height=8,
    width=8,
    count=2,
    dtype="float32",
    nodata=-9999,
    transform=from_origin(0, 8, 1, 1),
    crs="EPSG:3857",
) as dst:
    a = np.arange(64, dtype="float32").reshape(8, 8)
    a[0, :] = -9999
    dst.write(a, 1)
    dst.write(np.full((8, 8), np.nan, dtype="float32"), 2)
    dst.set_band_description(1, XSS)
    dst.update_tags(evil=XSS)
with rasterio.open(
    OUT / "no_crs.tif", "w", driver="GTiff", height=4, width=4, count=1, dtype="uint16"
) as dst:
    dst.write(np.arange(16, dtype="uint16").reshape(4, 4), 1)

# 12. Plots that take ~20 s each (160 facets): cancel / Plot All scenarios
t = pd.date_range("2021-01-01", periods=160, freq="D")
rng = np.random.default_rng(0)
slow = xr.Dataset(
    {
        f"slow{i}": (("time", "lat", "lon"), rng.random((160, 30, 30)).astype("f4"))
        for i in range(4)
    },
    coords={"time": t, "lat": np.arange(30.0), "lon": np.arange(30.0)},
)
slow["fast"] = (("lat", "lon"), rng.random((30, 30)))
slow.to_netcdf(OUT / "slow.nc")

# 13. Names that collapse to the same outline / element id
xr.Dataset(
    {name: (("x",), np.arange(3.0)) for name in ("a.b", "a-b", "a_b", "a b")}
).to_netcdf(OUT / "dup_ids.nc")

# 14. Kerchunk references to a NetCDF file by relative / absolute paths
kdir = OUT / "kerchunk_refs" / "sub"
kdir.mkdir(parents=True)
xr.Dataset(
    {"temp": (("x", "y"), np.arange(200, dtype="float32").reshape(10, 20))}
).to_netcdf(kdir / "src.nc", engine="h5netcdf")
from kerchunk.hdf import SingleHdf5ToZarr  # noqa: E402

base_refs = SingleHdf5ToZarr(str(kdir / "src.nc"), inline_threshold=0).translate()
for name, url in [
    ("rel", "src.nc"),
    ("rel_dot", "./src.nc"),
    ("parent", "../sub/src.nc"),
    ("abs", str(kdir / "src.nc")),
    ("fileurl", (kdir / "src.nc").as_uri()),
]:
    refs = json.loads(json.dumps(base_refs))
    for value in refs["refs"].values():
        if isinstance(value, list):
            value[0] = url
    (kdir / f"{name}.kerchunk.json").write_text(json.dumps(refs))
(kdir / "plainrefs.json").write_text((kdir / "rel.kerchunk.json").read_text())

print("created", len(list(OUT.iterdir())), "entries in", OUT)
