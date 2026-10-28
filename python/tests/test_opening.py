"""Engine selection and opening (DataTree vs single-Dataset engines)."""

import zipfile
from pathlib import Path

import numpy as np
import pytest
import xarray as xr

from sdv_backend.environment.engines import FORMAT_ENGINE_MAP, can_use_datatree
from sdv_backend.formats import zarr as zarr_format
from sdv_backend.formats.detect import detect_file_format
from sdv_backend.info.extract import get_file_info
from sdv_backend.info.options import InfoOptions
from sdv_backend.opening import OpenedData
from sdv_backend.results import FileInfoResult


def test_h5py_is_not_an_xarray_engine() -> None:
    """h5py is a dependency of h5netcdf, not an xarray backend (P9)."""
    assert all("h5py" not in engines for engines in FORMAT_ENGINE_MAP.values())
    assert "h5py" not in detect_file_format(Path("x.h5")).available_engines


def test_scipy_opens_netcdf3_as_single_root_dataset(tmp_path: Path) -> None:
    """scipy has no open_datatree: its NotImplementedError used to hit a
    fallback returning a bare Dataset where a dict was expected (P10)."""
    path = tmp_path / "classic.nc"
    xr.Dataset({"v": ("x", np.arange(3.0))}).to_netcdf(path, format="NETCDF3_64BIT")
    assert not can_use_datatree("scipy")

    info = detect_file_format(path, netcdf_engine_order="scipy")
    opened = OpenedData.open(path, info)
    try:
        assert opened.used_engine == "scipy"
        assert not opened.is_tree
        assert list(opened.datasets) == ["/"]
        assert "v" in opened.group("/", "all_coords")
    finally:
        opened.close()

    result = get_file_info(path, InfoOptions(netcdf_engine_order="scipy"))
    assert isinstance(result, FileInfoResult)
    assert result.used_engine == "scipy"
    assert [v.name for v in result.variables_flattened["/"]] == ["v"]


def test_zip_archive_listing_read_once(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Detection, version detection and opening share one ZIP listing."""
    pytest.importorskip("zarr")
    store = tmp_path / "store.zarr"
    xr.Dataset({"v": ("x", np.arange(3.0))}).to_zarr(store, zarr_format=3)
    archive = tmp_path / "store.zarr.zip"
    with zipfile.ZipFile(archive, "w") as zf:
        for file in store.rglob("*"):
            if file.is_file():
                zf.write(file, file.relative_to(store).as_posix())

    zarr_format._cached_zip_member_names.cache_clear()
    opened_archives: list[str] = []
    real_zipfile = zipfile.ZipFile

    def counting_zipfile(file, *args, **kwargs):
        opened_archives.append(str(file))
        return real_zipfile(file, *args, **kwargs)

    monkeypatch.setattr(zarr_format.zipfile, "ZipFile", counting_zipfile)
    info = detect_file_format(archive)
    assert info.display_name == "Zarr v3 (ZIP)"
    zarr_format.zarr_open_location(archive)
    assert opened_archives == [str(archive)]
