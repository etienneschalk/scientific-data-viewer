"""Plot layout: user choices are kept, the others are chosen automatically."""

import numpy as np
import pytest
import xarray as xr

from sdv_backend.plotting.layout import resolve_layout
from sdv_backend.plotting.options import PlotOptions
from sdv_backend.plotting.selection import DatetimeSelection


def _var(**sizes: int) -> xr.DataArray:
    return xr.DataArray(np.zeros(tuple(sizes.values())), dims=tuple(sizes), name="v")


def _layout(var: xr.DataArray, **options):
    return resolve_layout(var, PlotOptions(**options))[1]


def _choices(layout) -> dict[str, tuple]:
    return {role: (c.value, c.source) for role, c in layout.choices.items()}


def test_3d_automatic_layout() -> None:
    layout = _layout(_var(time=10, lat=20, lon=20))
    assert layout.kind == "image"
    assert _choices(layout) == {
        "x": ("lon", "auto"),
        "y": ("lat", "auto"),
        "col": ("time", "auto"),
        "col_wrap": (4, "auto"),
        "size": (4.0, "auto"),
        "aspect": (1.0, "auto"),
    }


def test_4d_automatic_layout() -> None:
    layout = _layout(_var(t=2, z=3, lat=4, lon=5))
    assert layout.value("row") == "t"
    assert layout.value("col") == "z"
    assert "col_wrap" not in layout.choices  # wraps column facets only


def test_one_option_changed_keeps_the_others_automatic() -> None:
    layout = _layout(_var(time=10, lat=20, lon=20), col_wrap=2)
    assert _choices(layout)["col_wrap"] == (2, "user")
    assert _choices(layout)["col"] == ("time", "auto")
    assert _choices(layout)["x"] == ("lon", "auto")


def test_user_x_takes_its_dimension_out_of_the_free_ones() -> None:
    layout = _layout(_var(time=10, lat=20, lon=20), plot_x="time")
    assert _choices(layout)["x"] == ("time", "user")
    assert layout.value("y") == "lon"
    assert layout.value("col") == "lat"


def test_user_col_moves_the_extra_dimension_to_row() -> None:
    layout = _layout(_var(t=2, z=3, lat=4, lon=5), facet_col="t")
    assert _choices(layout)["col"] == ("t", "user")
    assert _choices(layout)["row"] == ("z", "auto")


def test_user_row_alone() -> None:
    layout = _layout(_var(time=3, lat=4, lon=5), facet_row="time")
    assert _choices(layout)["row"] == ("time", "user")
    assert "col" not in layout.choices


def test_hue_makes_lines_and_facets_the_rest() -> None:
    layout = _layout(_var(time=3, lat=2, lon=5), plot_hue="time")
    assert layout.kind == "line"
    assert _choices(layout)["x"] == ("lon", "auto")
    assert _choices(layout)["col"] == ("lat", "auto")


def test_hue_without_another_dimension_is_ignored() -> None:
    layout = _layout(_var(time=3), plot_hue="time")
    assert layout.kind == "line"
    assert _choices(layout) == {"x": ("time", "auto")}
    assert "hue=time ignored" in layout.notes[0]


def test_hue_ignores_y_when_x_is_set() -> None:
    layout = _layout(_var(t=3, z=2, x=5), plot_hue="t", plot_x="x", plot_y="z")
    assert layout.notes == ["y=z ignored: a line plot has one axis"]
    assert layout.kind == "line"
    assert _choices(layout)["col"] == ("z", "auto")


def test_axes_win_over_hue_and_facets_for_the_same_name() -> None:
    layout = _layout(_var(t=3, x=5), plot_y="t", plot_hue="t")
    assert layout.notes == ["hue=t ignored: already used as y"]
    assert layout.kind == "image"


def test_size_1_dimensions_are_dropped_unless_chosen() -> None:
    var, layout = resolve_layout(_var(band=1, y=3, x=4), PlotOptions())
    assert layout.squeezed == ["band"]
    assert var.dims == ("y", "x")
    assert "col" not in layout.choices

    _, layout = resolve_layout(_var(band=1, y=3, x=4), PlotOptions(facet_col="band"))
    assert layout.squeezed == []
    assert _choices(layout)["col"] == ("band", "user")


def test_two_dimensions_are_an_image_one_a_line() -> None:
    assert _layout(_var(y=3, x=4)).kind == "image"
    line = _layout(_var(x=4))
    assert line.kind == "line"
    assert _choices(line) == {"x": ("x", "auto")}


def test_too_many_dimensions_give_a_histogram_with_a_hint() -> None:
    layout = _layout(_var(a=2, b=2, c=2, y=3, x=4))
    assert layout.kind == "histogram"
    assert "Slice one of them" in layout.notes[0]


def test_bins_draw_a_histogram_and_say_what_is_dropped() -> None:
    layout = _layout(_var(time=3, y=4, x=5), bins=10, facet_col="time")
    assert layout.kind == "histogram"
    assert _choices(layout) == {"bins": (10, "user")}
    assert layout.notes == ["col not used: bins draws a histogram of all values"]


def test_single_value_is_a_histogram() -> None:
    layout = _layout(_var(time=1))
    assert layout.kind == "histogram"
    assert layout.notes == ["A single value is selected: nothing to lay out"]


@pytest.mark.parametrize(
    ("options", "note"),
    [
        ({"facet_col": "nope"}, "col=nope ignored: not a dimension"),
        ({"plot_x": "nope"}, "x=nope ignored: not a dimension or coordinate"),
        ({"plot_x": "t", "facet_col": "t"}, "col=t ignored: already used as x"),
    ],
)
def test_unusable_user_choices_are_explained(options, note) -> None:
    layout = _layout(_var(t=3, y=4, x=5), **options)
    assert layout.kind == "image"
    assert any(n.startswith(note) for n in layout.notes)


def test_col_wrap_needs_column_facets_only() -> None:
    layout = _layout(_var(y=3, x=4), col_wrap=3)
    assert "col_wrap" not in layout.choices
    assert layout.notes == [
        "col_wrap ignored: it wraps column facets, and there is no col facet"
    ]


def test_aspect_alone_gets_a_size_on_a_single_plot() -> None:
    """xarray refuses ``aspect`` without ``size`` outside facet grids."""
    layout = _layout(_var(y=3, x=4), aspect=2)
    assert _choices(layout)["aspect"] == (2.0, "user")
    assert _choices(layout)["size"][1] == "auto"


def test_1d_line_against_datetime_variable() -> None:
    var = _var(obs=3)
    when = xr.DataArray(
        np.array(["2020-01-01", "2020-01-02", "2020-01-03"], dtype="datetime64[ns]"),
        dims=("obs",),
    )
    selection = DatetimeSelection(var=var, datetime_var=when, datetime_var_name="when")
    _, layout = resolve_layout(var, PlotOptions(), selection)
    assert layout.against_datetime
    assert _choices(layout)["x"] == ("when", "auto")


def test_to_json_lists_choices_in_role_order() -> None:
    data = _layout(_var(time=3, lat=4, lon=5), plot_x="lon").to_json()
    assert data["kind"] == "image"
    assert [c["role"] for c in data["choices"]] == [
        "col",
        "col_wrap",
        "y",
        "x",
        "size",
        "aspect",
    ]
    assert data["choices"][3] == {"role": "x", "value": "lon", "source": "user"}


@pytest.mark.parametrize(
    ("value", "text"),
    [(slice(5, 15), "5:15"), (slice(None, 3), ":3"), (slice(2, None, -1), "2::-1")],
)
def test_applied_slices_use_the_typed_notation(value, text) -> None:
    from sdv_backend.plotting.api import slice_text

    assert slice_text(value) == text
