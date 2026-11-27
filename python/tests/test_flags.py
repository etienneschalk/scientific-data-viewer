"""CF flag variables: parsing, raw codes, File Information, plots by meaning."""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pytest
import xarray as xr
from sample_data.flags import LAND_COVER_COLORS, build_cf_flags_dataset

from sdv_backend.decoding import DecodingOptions
from sdv_backend.flags import (
    mask_bits_text,
    needs_raw_codes,
    normalize_meaning,
    parse_flag_names,
    read_flag_spec,
)
from sdv_backend.formats.detect import detect_file_format
from sdv_backend.info.variables import create_variable_info
from sdv_backend.opening import OpenedData
from sdv_backend.plotting.api import create_plot
from sdv_backend.plotting.draw import draw_plot
from sdv_backend.plotting.flags import (
    NOT_SET_COLOR,
    NOT_SET_LABEL,
    OTHER_LABEL,
    FlagChoice,
    adjust_layout,
    hide_flagged,
    prepare_flag_plot,
    share_text,
)
from sdv_backend.plotting.kwargs import PlotKwargsBundle
from sdv_backend.plotting.layout import resolve_layout
from sdv_backend.plotting.options import PlotOptions
from sdv_backend.plotting.selection import DatetimeSelection
from sdv_backend.results import CreatePlotResult

CF_3_8 = {
    "flag_masks": np.array([1, 2, 12, 12, 12], np.int8),
    "flag_values": np.array([1, 2, 4, 8, 12], np.int8),
    "flag_meanings": "low_battery hardware_fault offline_mode calibration_mode "
    "maintenance_mode",
}


@pytest.fixture(autouse=True)
def _close_figures():
    yield
    plt.close("all")


@pytest.fixture(scope="module")
def sample(tmp_path_factory) -> Path:
    path = tmp_path_factory.mktemp("flags") / "sample_cf_flags.nc"
    ds, encoding = build_cf_flags_dataset()
    ds.to_netcdf(path, engine="netcdf4", encoding=encoding)
    return path


# --- parsing (CF section 3.5) -------------------------------------------------


def test_flag_values_are_exclusive_codes() -> None:
    spec = read_flag_spec(
        {"flag_values": np.array([0, 1, 2], np.int8), "flag_meanings": "a b c_d"},
        "int8",
    )
    assert spec is not None and spec.is_valid and spec.kind == "values"
    assert [f.label for f in spec.flags] == ["a", "b", "c d"]
    codes = np.array([2, 0, 1, 2], np.int8)
    assert spec.flags[2].test(codes).tolist() == [True, False, False, True]


def test_flag_masks_are_independent_bits() -> None:
    spec = read_flag_spec(
        {"flag_masks": np.array([1, 2, 4], np.uint8), "flag_meanings": "a b c"},
        "uint8",
    )
    assert spec is not None and spec.is_valid and spec.kind == "masks"
    codes = np.array([0, 3, 5, 7], np.uint8)
    assert [f.test(codes).tolist() for f in spec.flags] == [
        [False, True, True, True],
        [False, True, False, True],
        [False, False, True, True],
    ]


def test_cf_example_3_8_masks_and_values() -> None:
    spec = read_flag_spec(CF_3_8, "int8")
    assert spec is not None and spec.is_valid and spec.kind == "mixed"
    codes = np.array([0, 1, 3, 5, 9, 15], np.int8)
    result = {f.meaning: f.test(codes).astype(int).tolist() for f in spec.flags}
    assert result == {
        "low_battery": [0, 1, 1, 1, 1, 1],
        "hardware_fault": [0, 0, 1, 0, 0, 1],
        "offline_mode": [0, 0, 0, 1, 0, 0],
        "calibration_mode": [0, 0, 0, 0, 1, 0],
        "maintenance_mode": [0, 0, 0, 0, 0, 1],
    }
    assert [f["bits"] for f in spec.to_json()["flags"]] == [
        "bit 0",
        "bit 1",
        "bits 2-3",
        "bits 2-3",
        "bits 2-3",
    ]


def test_no_flag_attribute_gives_none() -> None:
    assert read_flag_spec({"units": "K"}, "float32") is None


@pytest.mark.parametrize(
    ("attrs", "dtype", "problem"),
    [
        (
            {"flag_values": [0, 1, 2], "flag_meanings": "a b"},
            "int8",
            "3 flag_values for 2",
        ),
        ({"flag_values": [0, 1]}, "int8", "flag_meanings is missing"),
        ({"flag_meanings": "a b"}, "int8", "without flag_values or flag_masks"),
        (
            {"flag_values": [0, 300], "flag_meanings": "a b"},
            "uint8",
            "300 does not fit",
        ),
        ({"flag_values": [0, 0], "flag_meanings": "a b"}, "int8", "listed twice: 0"),
        ({"flag_masks": [0, 1], "flag_meanings": "a b"}, "int8", "mask 0 can never"),
        ({"flag_masks": [1, 2], "flag_meanings": "a b"}, "float32", "integer variable"),
        ({"flag_masks": [1.5, 2], "flag_meanings": "a b"}, "int8", "must be integers"),
        (
            {"flag_values": "a b", "flag_meanings": "a b"},
            "int8",
            "not a list of numbers",
        ),
        ({"flag_values": [0, 1], "flag_meanings": "a b"}, "<U3", "numeric variable"),
        (
            # The QC samples of sample_many_encoding.nc before 0.14: 3 & 4 != 3
            {
                "flag_values": [0, 1, 2, 3],
                "flag_masks": [1, 2, 4, 8],
                "flag_meanings": "good questionable bad missing",
            },
            "int8",
            "questionable: value 1 has bits outside its mask 2",
        ),
    ],
)
def test_unusable_specs_are_explained(attrs, dtype, problem) -> None:
    spec = read_flag_spec(attrs, dtype)
    assert spec is not None and not spec.is_valid
    assert any(problem in p for p in spec.problems), spec.problems


def test_string_and_list_forms() -> None:
    spec = read_flag_spec(
        {"flag_values": "0, 1, 0x10", "flag_meanings": ["a", "b", "c"]}, "int16"
    )
    assert spec is not None and spec.is_valid
    assert [f.value for f in spec.flags] == [0, 1, 16]
    spec = read_flag_spec({"flag_values": 3, "flag_meanings": b"only"}, "int8")
    assert spec is not None and spec.is_valid and spec.flags[0].value == 3


def test_float_flag_values_on_a_float_variable() -> None:
    spec = read_flag_spec(
        {"flag_values": [0.0, 1.0], "flag_meanings": "a b"}, "float32"
    )
    assert spec is not None and spec.is_valid
    assert spec.flags[1].test(np.array([1.0, 0.0], np.float32)).tolist() == [
        True,
        False,
    ]


def test_signed_byte_mask_of_bit_7() -> None:
    """Bit 7 of a signed byte is written -128 or 128: both are the same bits."""
    for mask in (-128, 128):
        spec = read_flag_spec(
            {"flag_masks": [mask, 1], "flag_meanings": "hi lo"}, "int8"
        )
        assert spec is not None and spec.is_valid, spec.problems
        assert spec.flags[0].test(np.array([-128, 1, -127], np.int8)).tolist() == [
            True,
            False,
            True,
        ]
        assert spec.to_json()["flags"][0]["bits"] == "bit 7"


def test_uint64_masks_are_exact_and_sent_as_text() -> None:
    masks = np.array([1, 1 << 62, 1 << 63], np.uint64)
    spec = read_flag_spec({"flag_masks": masks, "flag_meanings": "a b c"}, "uint64")
    assert spec is not None and spec.is_valid
    codes = np.array([(1 << 63) | 1, 1 << 62], np.uint64)
    assert [f.test(codes).tolist() for f in spec.flags] == [
        [True, False],
        [False, True],
        [True, False],
    ]
    flags = spec.to_json()["flags"]
    assert flags[2]["mask"] == str(1 << 63)
    assert flags[2]["bits"] == "bit 63"


def test_flag_colors() -> None:
    attrs = {"flag_values": [0, 1, 2], "flag_meanings": "a b c"}
    spec = read_flag_spec({**attrs, "flag_colors": "#ff0000 #0f0 blue"}, "int8")
    assert spec is not None and spec.colors == ("#ff0000", "#0f0", "blue")
    for colors, note in (
        ("#ff0000 #00ff00", "2 colors for 3"),
        ("#ff0000 #00ff00 url(x)", "not a color: url(x)"),
    ):
        spec = read_flag_spec({**attrs, "flag_colors": colors}, "int8")
        assert spec is not None and spec.is_valid and spec.colors is None
        assert any(note in n for n in spec.notes), spec.notes


@pytest.mark.parametrize(
    ("mask", "text"),
    [(1, "bit 0"), (12, "bits 2-3"), (5, "bits 0, 2"), (0, "no bit"), (-128, "bit 7")],
)
def test_mask_bits_text(mask, text) -> None:
    assert mask_bits_text(mask, 8) == text


def test_many_encoding_samples_are_valid_cf_after_the_fix() -> None:
    """``sample_many_encoding.nc``: the QC variables are status codes now; the
    humidity flags (on a continuous variable) stay refused."""
    from sample_data import netcdf_encoding

    source = Path(netcdf_encoding.__file__).read_text()
    assert source.count('"flag_masks": [1, 2, 4, 8],') == 0
    spec = read_flag_spec(
        {
            "flag_values": [0, 1, 2, 3, 4],
            "flag_meanings": "good questionable bad missing not_applicable",
            "flag_masks": [1, 2, 4, 8, 16],
        },
        "int16",
    )
    assert spec is not None and not spec.is_valid


# --- raw codes ---------------------------------------------------------------------


@pytest.mark.parametrize("engine", ["netcdf4", "h5netcdf"])
def test_raw_variables_keep_their_codes(sample: Path, engine: str) -> None:
    info = detect_file_format(sample, netcdf_engine_order=[engine])
    opened = OpenedData.open(sample, info, raw_variables=("land_cover", "wqsf"))
    try:
        assert opened.used_engine == engine
        group = opened.group("/", True)
        assert group["land_cover"].dtype == np.uint8
        assert int(group["land_cover"].values.max()) == 255
        assert group["wqsf"].dtype == np.uint64
        assert int(group["wqsf"].values[1].max()) <= (1 << 64) - 1
        # The others are still decoded
        assert group["quality_level"].dtype.kind == "f"
    finally:
        opened.close()


def test_default_decoding_needs_raw_codes(sample: Path) -> None:
    with xr.open_dataset(sample) as ds:
        assert needs_raw_codes(ds["land_cover"].dtype, ds["land_cover"].encoding)
        assert not needs_raw_codes(ds["lccs_class"].dtype, ds["lccs_class"].encoding)


def test_raw_variables_on_zarr(tmp_path: Path) -> None:
    pytest.importorskip("zarr")
    path = tmp_path / "flags.zarr"
    ds, encoding = build_cf_flags_dataset()
    ds[["land_cover"]].to_zarr(path, encoding={"land_cover": encoding["land_cover"]})
    info = detect_file_format(path)
    if "zarr" not in info.available_engines:
        pytest.skip("zarr engine not usable here (the viewer needs zarr>=3)")
    opened = OpenedData.open(path, info, raw_variables=("land_cover",))
    try:
        assert opened.group("/", True)["land_cover"].dtype == np.uint8
    finally:
        opened.close()


# --- File Information ------------------------------------------------------------


def test_variable_info_lists_the_flags(sample: Path) -> None:
    with xr.open_dataset(sample) as ds:
        land_cover = create_variable_info("land_cover", ds["land_cover"]).flags
        quality = create_variable_info("quality_level", ds["quality_level"]).flags
        broken = create_variable_info("broken_mixed", ds["broken_mixed"]).flags
        assert create_variable_info("lat", ds["lat"]).flags is None
    assert land_cover is not None and land_cover["kind"] == "values"
    assert land_cover["colors_source"] == "flag_colors"
    assert land_cover["flags"][0] == {
        "meaning": "cropland",
        "value": "10",
        "mask": None,
        "bits": None,
        "color": LAND_COVER_COLORS.split()[0],
    }
    # Checked against the stored type (int8), not the decoded float
    assert quality is not None and quality["problems"] == []
    assert broken is not None and broken["problems"]


# --- plots by meaning -------------------------------------------------------------


def _raw(sample: Path, name: str) -> xr.DataArray:
    info = detect_file_format(sample, netcdf_engine_order=["netcdf4"])
    opened = OpenedData.open(sample, info, raw_variables=(name,))
    try:
        return opened.group("/", True)[name].load()
    finally:
        opened.close()


def _spec(var: xr.DataArray):
    spec = read_flag_spec(var.attrs, var.encoding.get("dtype", var.dtype))
    assert spec is not None and spec.is_valid
    return spec


def test_categories_from_flag_colors_with_fill_transparent(sample: Path) -> None:
    var = _raw(sample, "land_cover")
    flag_plot = prepare_flag_plot(var, _spec(var))
    assert flag_plot.colors_source == "flag_colors"
    assert [c.color for c in flag_plot.categories] == LAND_COVER_COLORS.split()
    fill = (var.values == 255).sum()
    assert fill > 0
    assert int(np.isnan(flag_plot.index.values).sum()) == fill
    assert flag_plot.total == var.size - fill
    assert sum(c.count for c in flag_plot.categories) == flag_plot.total
    assert flag_plot.index.attrs["long_name"] == "Land cover class"


def test_fill_code_declared_as_meaning_is_shown(sample: Path) -> None:
    """``127`` is both the _FillValue and the meaning ``not_measured``: raw
    reading keeps it; code 9 is not declared and becomes 'other'."""
    var = _raw(sample, "station_status")
    flag_plot = prepare_flag_plot(var, _spec(var))
    by_label = {c.label: c.count for c in flag_plot.categories}
    assert by_label["not measured"] == 4
    assert by_label[OTHER_LABEL] == 1
    assert any("(9)" in note for note in flag_plot.notes)


def test_decoded_floats_still_work(sample: Path) -> None:
    """Engines that cannot read raw: NaN marks no data."""
    with xr.open_dataset(sample) as ds:
        var = ds["land_cover"].load()
    assert var.dtype.kind == "f"
    flag_plot = prepare_flag_plot(var, _spec(var))
    assert flag_plot.total == int(np.isfinite(var.values).sum())


def test_many_classes_list_only_the_present_ones(sample: Path) -> None:
    var = _raw(sample, "lccs_class")
    flag_plot = prepare_flag_plot(var, _spec(var))
    assert len(flag_plot.categories) == 8
    assert flag_plot.notes == [
        "29 of the 37 meanings are absent from the plotted data and not listed"
    ]
    assert set(np.unique(flag_plot.index.values)) == set(range(8))


def test_user_cmap_wins_over_flag_colors(sample: Path) -> None:
    var = _raw(sample, "land_cover")
    flag_plot = prepare_flag_plot(var, _spec(var), cmap="Set2")
    assert flag_plot.colors_source == "cmap Set2"
    unknown = prepare_flag_plot(var, _spec(var), cmap="no_such_cmap")
    assert unknown.colors_source == "flag_colors"
    assert "cmap=no_such_cmap ignored" in unknown.notes[0]


def _draw(var: xr.DataArray, options: PlotOptions = PlotOptions()):
    flag_plot = prepare_flag_plot(var, _spec(var), options.cmap)
    selection = DatetimeSelection(var=var)
    index, layout = resolve_layout(flag_plot.index, options, selection)
    bundle = PlotKwargsBundle.build(bins=options.bins, vmin=options.vmin)
    adjust_layout(flag_plot, layout, bundle.raw)
    draw_plot(index, layout, bundle, selection, str(var.name), flag_plot)
    return plt.gcf(), layout


def test_image_colorbar_names_the_meanings(sample: Path) -> None:
    fig, layout = _draw(_raw(sample, "land_cover"))
    assert layout.kind == "image"
    assert layout.value("flags") == "flag_values, 8 meanings, colors: flag_colors"
    colorbar = fig.axes[-1]
    labels = [t.get_text() for t in colorbar.get_yticklabels()]
    assert labels[0].startswith("10 cropland (") and labels[-1].startswith(
        "210 water ("
    )


def test_facets_share_one_labelled_colorbar(sample: Path) -> None:
    fig, layout = _draw(_raw(sample, "quality_level"))
    assert layout.value("col") == "time"
    images = [ax for ax in fig.axes if ax.images]
    assert len(images) == 3
    labels = [t.get_text() for t in fig.axes[-1].get_yticklabels()]
    assert labels[5].startswith("5 best quality (")


def test_1d_steps_with_meanings_on_the_y_axis(sample: Path) -> None:
    fig, layout = _draw(_raw(sample, "station_status"))
    assert layout.kind == "line"
    labels = [t.get_text() for t in fig.axes[0].get_yticklabels()]
    assert labels[3].startswith("127 not measured (")
    assert labels[-1].startswith(OTHER_LABEL)


def test_bars_replace_the_histogram(sample: Path) -> None:
    fig, layout = _draw(_raw(sample, "land_cover"), PlotOptions(bins=10, vmin=1))
    assert layout.kind == "bars"
    assert "bins" not in layout.choices
    assert layout.notes[:2] == [
        "bins ignored: a CF flag variable is drawn as one bar per meaning",
        "vmin ignored: CF flag meanings have one color each",
    ]
    assert len(fig.axes[0].patches) == 8


@pytest.mark.parametrize(
    ("count", "total", "text"),
    [
        (0, 10, "0%"),
        (1, 1000, "<1%"),
        (999, 1000, ">99%"),
        (5, 10, "50%"),
        (3, 0, "0%"),
    ],
)
def test_share_text(count, total, text) -> None:
    assert share_text(count, total) == text


# --- create_plot end to end ----------------------------------------------------------


def _plot(sample: Path, name: str, **options) -> CreatePlotResult:
    result = create_plot(sample, f"/{name}", PlotOptions(**options))
    assert isinstance(result, CreatePlotResult), result
    return result


def test_create_plot_reads_raw_codes(sample: Path) -> None:
    layout = _plot(sample, "station_status").plot_layout
    assert layout["kind"] == "line"
    roles = {c["role"]: c["value"] for c in layout["choices"]}
    assert roles["flags"] == "flag_values, 4 meanings, colors: tab10"


def test_raw_reopen_keeps_the_decoding_settings(
    sample: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The second open (flag codes read raw) gets the plot's decoding options."""
    calls = []
    original = OpenedData.open.__func__

    def spy(cls, *args, **kwargs):
        calls.append((args, kwargs))
        return original(cls, *args, **kwargs)

    monkeypatch.setattr(OpenedData, "open", classmethod(spy))
    decoding = DecodingOptions(decode_times=False)
    _plot(sample, "station_status", decoding=decoding)
    assert len(calls) == 2
    raw_args, raw_kwargs = calls[1]
    assert raw_args[3] is decoding
    assert raw_kwargs["raw_variables"] == ("station_status",)
    # Reopen raw: the codes are not decoded, no second open
    calls.clear()
    _plot(sample, "station_status", decoding=DecodingOptions(raw=True))
    assert len(calls) == 1


def test_create_plot_kwargs_are_text(sample: Path) -> None:
    kwargs = _plot(sample, "land_cover").applied_plot_kwargs
    assert kwargs["cmap"] == "ListedColormap(8 colors: flag_colors)"
    assert kwargs["norm"] == "BoundaryNorm(-0.5..7.5, 8)"


def test_create_plot_without_flags(sample: Path) -> None:
    layout = _plot(sample, "land_cover", use_flags=False).plot_layout
    assert "flags" not in {c["role"] for c in layout["choices"]}
    assert layout["notes"] == []


@pytest.mark.parametrize(
    ("name", "note"),
    [
        ("broken_mixed", "CF flags not used (questionable: value 1 has bits"),
        ("broken_count", "CF flags not used (3 flag_values for 2 flag_meanings"),
    ],
)
def test_create_plot_explains_unusable_flags(
    sample: Path, name: str, note: str
) -> None:
    layout = _plot(sample, name).plot_layout
    assert "flags" not in {c["role"] for c in layout["choices"]}
    assert any(n.startswith(note) for n in layout["notes"]), layout["notes"]


def test_create_plot_reports_ignored_flag_colors(sample: Path) -> None:
    layout = _plot(sample, "broken_colors").plot_layout
    assert "flag_colors ignored: 2 colors for 3 flag_meanings" in layout["notes"]


# --- bits (flag_masks, masks + values) -----------------------------------------


def _masks_var(codes, masks, meanings, dtype=np.uint8, **attrs) -> xr.DataArray:
    return xr.DataArray(
        np.asarray(codes, dtype=dtype),
        dims=("x",) if np.ndim(codes) == 1 else ("y", "x"),
        name="bits",
        attrs={
            "flag_masks": np.asarray(masks, dtype=dtype),
            "flag_meanings": meanings,
            **attrs,
        },
    )


def test_masks_get_one_entry_per_flag(sample: Path) -> None:
    var = _raw(sample, "pixel_flags")
    flag_plot = prepare_flag_plot(var, _spec(var))
    index = flag_plot.index
    assert index.dims == ("flag", "time", "lat", "lon")
    assert list(index["flag"].values) == [
        "cloud (bit 0)",
        "cloud shadow (bit 1)",
        "snow ice (bit 2)",
        "invalid (bit 3)",
    ]
    labels = flag_plot.tick_labels()
    assert labels[0].startswith("bit 0 cloud (") and labels[-1] == NOT_SET_LABEL
    # Each panel holds its own category where the bit is set, else "not set"
    for f in range(4):
        expected = np.where(var.values & (1 << f), f, 4)
        assert (index.values[f] == expected).all()
    assert flag_plot.categories[0].count == int((var.values & 1 != 0).sum())


def test_uint64_bits_62_and_63_are_counted(sample: Path) -> None:
    var = _raw(sample, "wqsf")
    assert var.dtype == np.uint64
    flag_plot = prepare_flag_plot(var, _spec(var))
    valid = var.values != np.uint64(0xFFFFFFFFFFFFFFFF)
    assert flag_plot.total == int(valid.sum())
    by_label = {c.label: c.count for c in flag_plot.categories}
    assert by_label["cloud"] == int((valid & (var.values >> 63 == 1)).sum()) > 0
    assert by_label["ocl fail"] == int((valid & (var.values >> 62 & 1 == 1)).sum())
    # The fill row stays without data in every panel
    assert np.isnan(flag_plot.index.values[:, 0, :]).all()


def test_mixed_fields_group_the_states_of_a_mask(sample: Path) -> None:
    var = _raw(sample, "sensor_status_qc")
    flag_plot = prepare_flag_plot(var, _spec(var))
    assert [f.label for f in flag_plot.fields] == [
        "low battery (bit 0)",
        "hardware fault (bit 1)",
        "bits 2-3: 3 states",
    ]
    assert [c.value for c in flag_plot.categories] == [
        "bit 0",
        "bit 1",
        "bits 2-3 = 4",
        "bits 2-3 = 8",
        "bits 2-3 = 12",
        "",
    ]
    mode = flag_plot.index.values[2]
    bits = var.values & 12
    assert (mode == np.select([bits == 4, bits == 8, bits == 12], [2, 3, 4], 5)).all()
    assert flag_plot.report_value().startswith(
        "flag_masks + flag_values, 5 meanings in 3 fields"
    )


def test_undeclared_bits_are_noted() -> None:
    var = _masks_var([0, 1, 2, 5, 16 | 1, 32], [1, 2], "a b")
    flag_plot = prepare_flag_plot(var, _spec(var))
    assert "3 values have bits 2, 4, 5 set, in no flag_masks" in flag_plot.notes


def test_signed_mask_of_bit_7() -> None:
    var = _masks_var([0, -128, -127, 1], [1, -128], "low high", dtype=np.int8)
    flag_plot = prepare_flag_plot(var, _spec(var))
    assert [c.count for c in flag_plot.set_categories()] == [2, 2]
    assert flag_plot.fields[1].label == "high (bit 7)"
    assert not any("in no flag_masks" in n for n in flag_plot.notes)


def test_many_bits_draw_only_the_set_ones() -> None:
    masks = [1 << i for i in range(30)]
    meanings = " ".join(f"f{i}" for i in range(30))
    var = _masks_var([1, 2, 1 << 29], masks, meanings, dtype=np.uint32)
    flag_plot = prepare_flag_plot(var, _spec(var))
    assert [f.label for f in flag_plot.fields] == [
        "f0 (bit 0)",
        "f1 (bit 1)",
        "f29 (bit 29)",
    ]
    assert "27 of the 30 flags are never set in the plotted data and not drawn" in (
        flag_plot.notes
    )


def test_too_much_data_keeps_the_first_flags(monkeypatch) -> None:
    import sdv_backend.plotting.flags as flags_module

    monkeypatch.setattr(flags_module, "MAX_FIELD_POINTS", 10)
    var = _masks_var(np.ones((2, 3)), [1, 2, 4], "a b c")
    flag_plot = prepare_flag_plot(var, _spec(var))
    assert flag_plot.index.sizes["flag"] == 1
    assert flag_plot.notes[-1].startswith("only the first 1 of 3 flags drawn")


def test_flag_dimension_name_does_not_clash() -> None:
    var = _masks_var([1, 2], [1, 2], "a b").rename(x="flag")
    flag_plot = prepare_flag_plot(var, _spec(var))
    assert flag_plot.index.dims == ("flag_", "flag")


def test_masks_maps_are_panels_with_full_titles(sample: Path) -> None:
    var = _raw(sample, "wqsf")
    fig, layout = _draw(var)
    assert layout.kind == "image" and layout.value("col") == "flag"
    assert layout.value("flags") == "flag_masks, 6 meanings, colors: tab10"
    titles = [ax.get_title() for ax in fig.axes if ax.images]
    assert titles[3] == "flag = highglint (bit 23)"
    labels = [t.get_text() for t in fig.axes[-1].get_yticklabels()]
    assert labels[-1] == NOT_SET_LABEL


def test_masks_over_time_one_row_per_flag(sample: Path) -> None:
    _, layout = _draw(_raw(sample, "pixel_flags"))
    assert (layout.value("row"), layout.value("col")) == ("flag", "time")


def test_1d_bits_are_a_block_plot(sample: Path) -> None:
    fig, layout = _draw(_raw(sample, "sensor_status_qc"))
    assert layout.kind == "image"
    assert (layout.value("x"), layout.value("y")) == ("status_time", "flag")
    ax = fig.axes[0]
    labels = [t.get_text() for t in ax.get_yticklabels()]
    assert labels == [
        "low battery (bit 0)",
        "hardware fault (bit 1)",
        "bits 2-3: 3 states",
    ]
    # The first flag on top
    assert ax.get_ylim()[0] > ax.get_ylim()[1]


def test_a_single_point_gives_bars(sample: Path) -> None:
    var = _raw(sample, "sensor_status_qc").isel(status_time=20)
    fig, layout = _draw(var)
    assert layout.kind == "bars"
    assert list(layout.choices) == ["flags"]
    assert len(fig.axes[0].patches) == 5
    assert (
        fig.axes[0].get_xlabel() == "% of the 1 value with data where the flag is set"
    )


def test_bins_on_bits_give_bars(sample: Path) -> None:
    fig, layout = _draw(_raw(sample, "pixel_flags"), PlotOptions(bins=5))
    assert layout.kind == "bars"
    labels = [t.get_text() for t in fig.axes[0].get_yticklabels()]
    assert len(labels) == 4 and NOT_SET_LABEL not in labels


@pytest.mark.parametrize(
    ("name", "kind", "flags"),
    [
        ("pixel_flags", "image", "flag_masks, 4 meanings, colors: tab10"),
        ("wqsf", "image", "flag_masks, 6 meanings, colors: tab10"),
        (
            "sensor_status_qc",
            "image",
            "flag_masks + flag_values, 5 meanings in 3 fields, colors: tab10",
        ),
    ],
)
def test_create_plot_draws_bits_by_meaning(
    sample: Path, name: str, kind: str, flags: str
) -> None:
    layout = _plot(sample, name).plot_layout
    assert layout["kind"] == kind
    roles = {c["role"]: c["value"] for c in layout["choices"]}
    assert roles["flags"] == flags
    assert not any("plotted as numbers" in n for n in layout["notes"])


def test_create_plot_single_point_of_bits(sample: Path) -> None:
    result = _plot(
        sample, "pixel_flags", dimension_slices={"time": 0, "lat": 3, "lon": 4}
    )
    assert result.plot_layout["kind"] == "bars"
    assert result.applied_plot_kwargs == {"flags": "bars"}


# --- selection by meaning (flag_select / flag_combine) ------------------------------


def test_names_match_whatever_the_case_and_separators() -> None:
    spec = read_flag_spec(
        {
            "flag_masks": np.array([1, 2], np.uint8),
            "flag_meanings": "cloud cloud_shadow",
        },
        np.uint8,
    )
    assert spec is not None
    assert spec.match(["Cloud Shadow", "CLOUD", "snow"]) == ([0, 1], ["snow"])
    assert parse_flag_names(" cloud, cloud shadow ,, ") == ("cloud", "cloud shadow")
    assert normalize_meaning("cloud-shadow") == "cloud_shadow"


def _choose(var: xr.DataArray, select=(), combine=None):
    return prepare_flag_plot(var, _spec(var), choice=FlagChoice(tuple(select), combine))


def test_select_values_greys_the_others(sample: Path) -> None:
    var = _raw(sample, "land_cover")
    flag_plot = _choose(var, ["Water", "urban"])
    labels = [c.label for c in flag_plot.categories]
    assert labels == ["urban", "water", "the 6 other meanings"]
    assert flag_plot.categories[2].color == NOT_SET_COLOR
    assert sum(c.count or 0 for c in flag_plot.categories) == flag_plot.total
    water = var.values == 210
    assert (flag_plot.index.values[water] == 1).all()
    assert flag_plot.report_value() == (
        "flag_values, 8 meanings, selected: urban, water, colors: flag_colors"
    )


def test_select_unknown_names_are_noted(sample: Path) -> None:
    var = _raw(sample, "land_cover")
    partly = _choose(var, ["water", "glacier"])
    assert "flag_select: glacier not among the meanings of this variable" in (
        partly.notes
    )
    none = _choose(var, ["glacier"])
    assert none.choice_text == ""
    assert len(none.categories) == 8
    assert none.notes[-1].startswith("flag_select ignored: no meaning")


def test_select_bits_keeps_their_panels(sample: Path) -> None:
    var = _raw(sample, "pixel_flags")
    flag_plot = _choose(var, ["snow ice", "cloud"])
    assert list(flag_plot.index["flag"].values) == ["cloud (bit 0)", "snow ice (bit 2)"]
    assert [c.label for c in flag_plot.categories] == [
        "cloud",
        "snow ice",
        NOT_SET_LABEL,
    ]


def test_select_one_state_of_a_field(sample: Path) -> None:
    var = _raw(sample, "sensor_status_qc")
    flag_plot = _choose(var, ["offline_mode"])
    assert [f.label for f in flag_plot.fields] == ["bits 2-3: 3 states"]
    assert [c.label for c in flag_plot.categories] == [
        "offline mode",
        "not set or not selected",
    ]
    mode = flag_plot.index.values[0]
    assert ((mode == 0) == ((var.values & 12) == 4)).all()


@pytest.mark.parametrize(
    ("combine", "label", "rest", "expected"),
    [
        ("any", "cloud OR cloud shadow", "none of them", lambda v: (v & 3) != 0),
        ("all", "cloud AND cloud shadow", "not all of them", lambda v: (v & 3) == 3),
        (
            "none",
            "none of cloud, cloud shadow",
            "at least one of them",
            lambda v: (v & 3) == 0,
        ),
    ],
)
def test_combine_bits_into_one_map(
    sample: Path, combine, label, rest, expected
) -> None:
    var = _raw(sample, "pixel_flags")
    flag_plot = _choose(var, ["cloud", "cloud_shadow"], combine)
    assert flag_plot.flag_dim is None
    assert flag_plot.index.dims == var.dims
    assert [c.label for c in flag_plot.categories] == [label, rest]
    holds = expected(var.values)
    assert (flag_plot.index.values == np.where(holds, 0, 1)).all()
    assert flag_plot.categories[0].count == int(holds.sum())
    assert flag_plot.choice_text == f"{combine}: cloud, cloud shadow"


def test_combine_without_selection_uses_every_flag(sample: Path) -> None:
    var = _raw(sample, "pixel_flags")
    flag_plot = _choose(var, combine="none")
    assert flag_plot.categories[0].label == "none of 4 flags"
    assert flag_plot.categories[0].count == int((var.values == 0).sum())


def test_combine_on_values_is_noted(sample: Path) -> None:
    flag_plot = _choose(_raw(sample, "land_cover"), ["water"], "any")
    assert flag_plot.notes[0].startswith("flag_combine=any ignored")


def test_combined_map_is_drawn_with_two_colors(sample: Path) -> None:
    var = _raw(sample, "pixel_flags").isel(time=0)
    flag_plot = _choose(var, ["cloud", "cloud shadow"], "any")
    selection = DatetimeSelection(var=var)
    index, layout = resolve_layout(flag_plot.index, PlotOptions(), selection)
    adjust_layout(flag_plot, layout, {})
    assert layout.choices["flags"].source == "user"
    draw_plot(
        index, layout, PlotKwargsBundle.build(), selection, "pixel_flags", flag_plot
    )
    labels = [t.get_text() for t in plt.gcf().axes[-1].get_yticklabels()]
    assert labels[0].startswith("cloud OR cloud shadow (") and labels[1].startswith(
        "none of them ("
    )


# --- hide_flags (ancillary_variables) ------------------------------------------------


def test_hide_flagged_points(sample: Path) -> None:
    result = _plot(sample, "sst", hide_flags=("cloud", "Bad data"))
    roles = {c["role"]: c for c in result.plot_layout["choices"]}
    assert roles["hide_flags"] == {
        "role": "hide_flags",
        "value": "cloud (pixel_flags); bad data (quality_level)",
        "source": "user",
    }
    note = result.plot_layout["notes"][0]
    assert note.startswith("hide_flags: ") and "values hidden" in note


def test_hide_flagged_counts_the_right_points(sample: Path) -> None:
    with xr.open_dataset(sample) as ds:
        sst = ds["sst"].load()
    bits = _raw(sample, "pixel_flags")
    hidden = hide_flagged(sst, [("pixel_flags", bits, _spec(bits))], ["cloud"])
    cloud = (bits.values & 1) != 0
    assert np.isnan(hidden.var.values[cloud]).all()
    assert np.isfinite(hidden.var.values[~cloud]).all()
    assert hidden.var.attrs["units"] == "degC"
    assert hidden.report == "cloud (pixel_flags)"


def test_hide_flags_broadcast_a_2d_mask_over_time(sample: Path) -> None:
    with xr.open_dataset(sample) as ds:
        sst = ds["sst"].load()
    land = _raw(sample, "land_cover")
    hidden = hide_flagged(sst, [("land_cover", land, _spec(land))], ["water"])
    water = land.values == 210
    for t in range(sst.sizes["time"]):
        assert np.isnan(hidden.var.values[t][water]).all()


def test_hide_flags_on_another_shape_is_refused(sample: Path) -> None:
    with xr.open_dataset(sample) as ds:
        sst = ds["sst"].load()
    status = _raw(sample, "station_status")
    hidden = hide_flagged(sst, [("station_status", status, _spec(status))], ["nominal"])
    assert hidden.var is sst
    assert hidden.notes[0].startswith(
        "hide_flags: station_status not used, its dimension obs_time"
    )


@pytest.mark.parametrize(
    ("name", "names", "note"),
    [
        (
            "sst",
            ("glacier",),
            "hide_flags ignored: no flag named glacier (pixel_flags, quality_level)",
        ),
        (
            "land_cover",
            ("cloud",),
            "hide_flags ignored: no flag named cloud (no flag variable in ancillary_variables)",
        ),
    ],
)
def test_hide_flags_not_applied_is_noted(sample: Path, name, names, note) -> None:
    layout = _plot(sample, name, hide_flags=names).plot_layout
    assert note in layout["notes"]
    assert "hide_flags" not in {c["role"] for c in layout["choices"]}


def test_hide_flags_follow_the_slices(sample: Path) -> None:
    result = _plot(sample, "sst", hide_flags=("cloud",), dimension_slices={"time": 1})
    assert result.plot_layout["kind"] == "image"
    assert "hide_flags" in {c["role"] for c in result.plot_layout["choices"]}


def test_cli_parses_the_flag_options() -> None:
    from sdv_backend import cli

    args = cli.parse_cli_args(
        [
            "plot",
            "f.nc",
            "/v",
            "--flag-select",
            "cloud, cloud shadow",
            "--flag-combine",
            "any",
            "--hide-flags",
            "land",
        ]
    )
    options = cli._plot_options(args, None)
    assert options.flag_select == ("cloud", "cloud shadow")
    assert options.flag_combine == "any"
    assert options.hide_flags == ("land",)
    with pytest.raises(SystemExit):
        cli.parse_cli_args(["plot", "f.nc", "/v", "--flag-combine", "xor"])
