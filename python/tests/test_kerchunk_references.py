"""Tests for experimental Kerchunk / virtual Zarr opening (P1.5)."""

from __future__ import annotations

import json

import numpy as np
import pytest
import xarray as xr

from sdv_backend.formats.detect import detect_file_format
from sdv_backend.formats.kerchunk import looks_like_kerchunk_filename
from sdv_backend.info.extract import get_file_info
from sdv_backend.info.options import InfoOptions
from sdv_backend.results import FileInfoError, FileInfoResult


def test_ordinary_json_is_not_treated_as_kerchunk(tmp_path) -> None:
    path = tmp_path / "notes.json"
    path.write_text(json.dumps({"hello": "world"}))
    info = detect_file_format(path)
    assert info.extension == ".json"
    assert info.available_engines == []
    assert not looks_like_kerchunk_filename(path)


def test_kerchunk_filename_with_invalid_json_is_value_error(tmp_path) -> None:
    path = tmp_path / "broken.kerchunk.json"
    path.write_text("{not json")
    result = get_file_info(path, InfoOptions(small_variable_bytes=0))
    assert isinstance(result, FileInfoError)
    assert result.error_type == "ValueError"
    assert "Kerchunk" in result.error or "JSON" in result.error


def test_open_as_kerchunk_rejects_non_reference_json(tmp_path) -> None:
    path = tmp_path / "config.json"
    path.write_text(json.dumps({"version": 1}))
    result = get_file_info(
        path, InfoOptions(small_variable_bytes=0, open_as_kerchunk=True)
    )
    assert isinstance(result, FileInfoError)
    assert result.error_type == "ValueError"


def _write_kerchunk_json(tmp_path):
    pytest.importorskip("kerchunk")
    from kerchunk.hdf import SingleHdf5ToZarr

    nc_path = tmp_path / "src.nc"
    xr.Dataset(
        {"temp": ("x", np.arange(6, dtype="float32"))},
        attrs={"title": "kerchunk fixture"},
    ).to_netcdf(nc_path)
    refs = SingleHdf5ToZarr(
        str(nc_path), str(nc_path), inline_threshold=200
    ).translate()
    ref_path = tmp_path / "src.kerchunk.json"
    ref_path.write_text(json.dumps(refs))
    return nc_path, ref_path


def test_named_kerchunk_json_opens_without_copying_netcdf(tmp_path) -> None:
    nc_path, ref_path = _write_kerchunk_json(tmp_path)
    result = get_file_info(ref_path, InfoOptions(small_variable_bytes=0))
    assert isinstance(result, FileInfoResult)
    assert result.used_engine == "kerchunk"
    assert result.format_info.display_name == "Kerchunk (virtual Zarr)"
    names = {var.name for var in result.variables_flattened["/"]}
    assert "temp" in names
    assert nc_path.exists()


def test_unnamed_json_opens_with_open_as_kerchunk_flag(tmp_path) -> None:
    _nc_path, named = _write_kerchunk_json(tmp_path)
    generic = tmp_path / "refs.json"
    generic.write_text(named.read_text())
    without_flag = detect_file_format(generic)
    assert without_flag.extension == ".json"
    with_flag = get_file_info(
        generic, InfoOptions(small_variable_bytes=0, open_as_kerchunk=True)
    )
    assert isinstance(with_flag, FileInfoResult)
    assert with_flag.used_engine == "kerchunk"


def test_relative_reference_paths_resolve_from_reference_folder(
    tmp_path, monkeypatch
) -> None:
    """Relative targets ("src.nc") are read from the JSON's folder, whatever the cwd."""
    pytest.importorskip("kerchunk")
    from kerchunk.hdf import SingleHdf5ToZarr

    from sdv_backend.plotting.api import create_plot
    from sdv_backend.results import CreatePlotResult

    data_dir = tmp_path / "data"
    data_dir.mkdir()
    nc_path = data_dir / "src.nc"
    xr.Dataset(
        {"temp": (("y", "x"), np.arange(64, dtype="float32").reshape(8, 8))}
    ).to_netcdf(nc_path)
    # Built from inside data/ (like create_sample_data.py) so the stored target
    # is the relative "src.nc"; inline_threshold=0 keeps chunks as references.
    monkeypatch.chdir(data_dir)
    refs = SingleHdf5ToZarr("src.nc", "src.nc", inline_threshold=0).translate()
    assert refs["refs"]["temp/0.0"][0] == "src.nc"
    ref_path = data_dir / "src.kerchunk.json"
    ref_path.write_text(json.dumps(refs))

    monkeypatch.chdir(tmp_path)  # not the reference folder
    result = create_plot(ref_path, "/temp")
    assert isinstance(result, CreatePlotResult), result


@pytest.mark.parametrize(
    ("content", "expected"),
    [
        ("{not json", "not valid JSON"),
        ("[1, 2, 3]", "expected a mapping with a 'refs' key"),
        (json.dumps({"version": 1, "refs": []}), "'refs' must be a JSON object"),
        (json.dumps({"version": 1, "refs": {}}), "no Zarr metadata"),
    ],
)
def test_invalid_reference_files_say_why(tmp_path, content, expected) -> None:
    """The reason was computed then replaced by a generic "no 'refs' mapping"
    (QA 0.13.0 bug 12)."""
    path = tmp_path / "refs.kerchunk.json"
    path.write_text(content)
    result = get_file_info(path, InfoOptions(small_variable_bytes=0))
    assert isinstance(result, FileInfoError)
    assert result.error_type == "ValueError"
    assert expected in result.error


def test_missing_reference_target_names_the_file(tmp_path) -> None:
    pytest.importorskip("kerchunk")
    from sdv_backend.plotting.api import create_plot
    from sdv_backend.plotting.options import PlotOptions
    from sdv_backend.results import CreatePlotError

    zarray = {
        "chunks": [3],
        "compressor": None,
        "dtype": "<f8",
        "fill_value": None,
        "filters": None,
        "order": "C",
        "shape": [3],
        "zarr_format": 2,
    }
    path = tmp_path / "missing.kerchunk.json"
    path.write_text(
        json.dumps(
            {
                "version": 1,
                "refs": {
                    ".zgroup": '{"zarr_format": 2}',
                    "v/.zarray": json.dumps(zarray),
                    "v/.zattrs": '{"_ARRAY_DIMENSIONS": ["x"]}',
                    "v/0": ["gone.bin", 0, 24],
                },
            }
        )
    )
    result = create_plot(path, "/v", PlotOptions())
    assert isinstance(result, CreatePlotError)
    assert "ReferenceNotReachable()" not in result.error
    assert "gone.bin" in result.error
