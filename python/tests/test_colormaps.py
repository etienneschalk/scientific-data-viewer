"""``seaborn:<name>`` colormaps in the ``cmap`` control (plotting/colormaps.py)."""

import json
import subprocess
import sys
from importlib.util import find_spec
from pathlib import Path

import matplotlib
import numpy as np
import pytest
import xarray as xr

from sdv_backend.plotting.api import create_plot
from sdv_backend.plotting.colormaps import (
    ColormapError,
    get_colormap,
    resolve_cmap,
    seaborn_name,
)
from sdv_backend.plotting.options import PlotOptions
from sdv_backend.results import CreatePlotError, CreatePlotResult

matplotlib.use("Agg")

PYTHON_DIR = Path(__file__).resolve().parents[1]

needs_seaborn = pytest.mark.skipif(
    find_spec("seaborn") is None, reason="seaborn not installed"
)


@pytest.fixture
def sample(tmp_path: Path) -> Path:
    path = tmp_path / "c.nc"
    xr.Dataset(
        {
            "field": (("time", "lat", "lon"), np.arange(24.0).reshape(2, 3, 4)),
            "series": (("x",), np.arange(5.0)),
        },
        coords={"time": [0, 1], "lat": [0.0, 1.0, 2.0], "lon": np.arange(4.0)},
    ).to_netcdf(path)
    return path


@pytest.fixture
def figures(monkeypatch) -> list:
    """The figures drawn by ``create_plot`` (it closes them once saved)."""
    from sdv_backend.plotting import api

    seen: list = []
    original = api.figure_to_base64_png

    def keep(plt, suptitle):
        seen.append(plt.gcf())
        return original(plt, suptitle)

    monkeypatch.setattr(api, "figure_to_base64_png", keep)
    return seen


def _images(figure) -> list:
    return [
        image
        for ax in figure.axes
        if ax.get_label() != "<colorbar>"
        for image in ax.images
    ]


@pytest.mark.parametrize(
    ("text", "name"),
    [
        ("viridis", None),
        (None, None),
        ("seaborn:rocket", "rocket"),
        (" Seaborn: mako_r ", "mako_r"),
        ("seaborn:light:seagreen", "light:seagreen"),
        ("seaborn:", ""),
    ],
)
def test_prefix(text, name) -> None:
    assert seaborn_name(text) == name


def test_matplotlib_names_are_left_to_matplotlib() -> None:
    assert resolve_cmap("viridis") is None
    assert resolve_cmap(None) is None
    assert get_colormap("viridis").name == "viridis"
    with pytest.raises(ColormapError, match="cmap=nope: not a matplotlib colormap"):
        get_colormap("nope")


@needs_seaborn
@pytest.mark.parametrize(
    "name",
    [
        "rocket",
        "mako_r",
        "icefire",
        "light:seagreen",
        "dark:salmon_r",
        "blend:#7AB,#EDA",
        "ch:s=.25,rot=-.25",
        "deep",  # a qualitative palette: a list of colors, made a ListedColormap
    ],
)
def test_seaborn_names(name) -> None:
    from matplotlib.colors import Colormap

    colormap = resolve_cmap(f"seaborn:{name}")
    assert isinstance(colormap, Colormap)
    assert get_colormap(f"seaborn:{name}") is not None


@needs_seaborn
def test_seaborn_rocket_is_seaborns() -> None:
    import seaborn

    expected = seaborn.color_palette("rocket", as_cmap=True)
    assert resolve_cmap("seaborn:rocket")(0.5) == expected(0.5)


@needs_seaborn
def test_unknown_seaborn_name() -> None:
    with pytest.raises(ColormapError) as info:
        resolve_cmap("seaborn:rockett")
    assert str(info.value).startswith(
        "cmap=seaborn:rockett: not a seaborn colormap or palette"
    )
    assert "seaborn:rocket," in str(info.value)  # examples


def test_empty_seaborn_name() -> None:
    with pytest.raises(ColormapError, match="no colormap name after the prefix"):
        resolve_cmap("seaborn:")


def test_seaborn_missing(monkeypatch) -> None:
    monkeypatch.setitem(sys.modules, "seaborn", None)  # import raises ImportError
    with pytest.raises(ColormapError) as info:
        resolve_cmap("seaborn:rocket")
    assert str(info.value) == (
        "cmap=seaborn:rocket: needs the seaborn package: install it in the "
        "viewer's Python environment (pip install seaborn), or use the "
        "extension's own environment "
        "(scientificDataViewer.python.useExtensionOwnEnvironment)"
    )


def test_seaborn_missing_is_a_one_line_plot_error(monkeypatch, sample: Path) -> None:
    monkeypatch.setitem(sys.modules, "seaborn", None)
    result = create_plot(sample, "/field", PlotOptions(cmap="seaborn:rocket"))
    assert isinstance(result, CreatePlotError)
    assert result.error.startswith("cmap=seaborn:rocket: needs the seaborn package")
    assert "\n" not in result.error


@needs_seaborn
def test_image_with_facets_uses_the_seaborn_colormap(
    sample: Path, figures: list
) -> None:
    result = create_plot(sample, "/field", PlotOptions(cmap="seaborn:mako_r"))
    assert isinstance(result, CreatePlotResult), result
    assert result.applied_plot_kwargs["cmap"] == "seaborn:mako_r"
    json.dumps(result.applied_plot_kwargs)
    images = _images(figures[-1])
    assert len(images) == 2  # one per time, one colormap
    assert {image.get_cmap().name for image in images} == {"mako_r"}


@needs_seaborn
def test_line_still_ignores_cmap(sample: Path) -> None:
    result = create_plot(sample, "/series", PlotOptions(cmap="seaborn:rocket"))
    assert isinstance(result, CreatePlotResult), result
    assert "cmap" not in result.applied_plot_kwargs


@needs_seaborn
def test_histogram_still_ignores_cmap(sample: Path) -> None:
    result = create_plot(sample, "/field", PlotOptions(cmap="seaborn:rocket", bins=5))
    assert isinstance(result, CreatePlotResult), result
    assert result.applied_plot_kwargs == {"bins": 5}


@needs_seaborn
def test_flag_variable_takes_its_colors_from_seaborn(tmp_path: Path) -> None:
    path = tmp_path / "flags.nc"
    xr.Dataset(
        {
            "quality": (
                ("lat", "lon"),
                np.array([[0, 1], [2, 1]], dtype="int8"),
                {
                    "flag_values": np.array([0, 1, 2], "int8"),
                    "flag_meanings": "bad fair good",
                },
            )
        }
    ).to_netcdf(path)
    result = create_plot(path, "/quality", PlotOptions(cmap="seaborn:rocket"))
    assert isinstance(result, CreatePlotResult), result
    assert result.applied_plot_kwargs["cmap"] == (
        "ListedColormap(3 colors: cmap seaborn:rocket)"
    )


def test_matplotlib_names_do_not_import_seaborn(tmp_path: Path) -> None:
    """seaborn imports pandas and takes time: only a seaborn: name loads it."""
    path = tmp_path / "c.nc"
    xr.Dataset({"v": (("y", "x"), np.ones((2, 2)))}).to_netcdf(path)
    code = (
        "import sys\n"
        "from pathlib import Path\n"
        "from sdv_backend.plotting.api import create_plot\n"
        "from sdv_backend.plotting.options import PlotOptions\n"
        f"r = create_plot(Path({str(path)!r}), '/v', PlotOptions(cmap='magma'))\n"
        "assert r.plot_data, r\n"
        "print('seaborn' in sys.modules)\n"
    )
    out = subprocess.run(
        [sys.executable, "-c", code],
        cwd=PYTHON_DIR,
        capture_output=True,
        text=True,
        check=True,
    )
    assert out.stdout.strip().splitlines()[-1] == "False"


@needs_seaborn
def test_importing_seaborn_keeps_the_matplotlib_style() -> None:
    """Only ``seaborn.set_theme()`` changes rcParams; resolving a name does not."""
    code = (
        "import matplotlib as mpl\n"
        "before = {k: repr(v) for k, v in mpl.rcParams.items()}\n"
        "from sdv_backend.plotting.colormaps import resolve_cmap\n"
        "resolve_cmap('seaborn:rocket')\n"
        "after = {k: repr(v) for k, v in mpl.rcParams.items()}\n"
        "print(sorted(k for k in before if before[k] != after[k]))\n"
    )
    out = subprocess.run(
        [sys.executable, "-c", code],
        cwd=PYTHON_DIR,
        capture_output=True,
        text=True,
        check=True,
    )
    assert out.stdout.strip().splitlines()[-1] == "[]"
