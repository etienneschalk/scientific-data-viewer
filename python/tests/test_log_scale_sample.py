"""``sample_log_scale.nc``: each variable reaches the case of the log scale it
was made for (``sample_data/log_scale.py``, ``plotting/norm.py``)."""

from __future__ import annotations

import os
from pathlib import Path

import matplotlib
import numpy as np
import pytest
from sample_data.log_scale import FILE_NAME, create_sample_netcdf_log_scale
from sample_data.main import Generator, seed_for

from sdv_backend.decoding import DecodingOptions
from sdv_backend.plotting.api import create_plot
from sdv_backend.plotting.options import PlotOptions
from sdv_backend.results import CreatePlotResult

matplotlib.use("Agg")


@pytest.fixture(scope="module")
def sample(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """The file ``create_sample_data.py`` writes (same seed: the values the
    manual test plan quotes)."""
    folder = tmp_path_factory.mktemp("log_scale")
    cwd = Path.cwd()
    try:
        os.chdir(folder)
        np.random.seed(seed_for(Generator(create_sample_netcdf_log_scale, "")))
        assert create_sample_netcdf_log_scale() == FILE_NAME
    finally:
        os.chdir(cwd)
    return folder / FILE_NAME


# (variable, extra options, plot kind, norm item, start of a note or None,
# extend of the colorbar or None)
CASES = [
    ("chlorophyll", {}, "image", "log, 0.00487 to 2.41e+03", "norm=log: 192 of 19064", "neither"),
    ("particle_count", {}, "line", "log (y axis)", "norm=log: 1 of 120", None),
    ("net_flux", {}, "image", "log, ", "norm=log: 2483 of 4941", "neither"),
    ("depth_negative", {}, "image", None, "norm=log ignored: no value above 0", None),
    ("photon_counts", {}, "image", "log, 1 to ", "norm=log: ", "neither"),
    ("rain_rate", {}, "image", "log, ", "norm=log: ", "neither"),
    ("rain_rate", {"robust": True}, "image", "log, ", "norm=log: ", "both"),
    ("aerosol_tiny", {}, "image", "log, ", None, "neither"),
    ("no2_column_huge", {}, "image", "log, ", None, "neither"),
    ("backscatter_with_inf", {}, "image", "log, ", None, "neither"),
    ("constant_positive", {}, "image", "log, 3 to 3", None, "neither"),
    ("chlorophyll_profile", {}, "line", "log (y axis)", None, None),
    ("chlorophyll_profile", {"plot_y": "depth"}, "line", "log (x axis)", None, None),
    ("chlorophyll_packed", {}, "image", "log, 0.0049 to 431", "norm=log: 48 of 4766", "neither"),
    ("water_class", {}, "image", None, "norm=log ignored: a CF flag variable", None),
    ("is_bloom", {}, "image", None, "norm=log ignored: the values are not numbers", None),
    ("photon_counts", {"bins": 50}, "histogram", None, "norm=log ignored: not used by a histogram", None),
]  # fmt: skip


@pytest.mark.parametrize(
    ("variable", "extra", "kind", "norm", "note", "extend"),
    CASES,
    ids=[f"{c[0]}{'-' + '-'.join(c[1]) if c[1] else ''}" for c in CASES],
)
def test_each_variable_reaches_its_case(
    sample: Path,
    variable: str,
    extra: dict,
    kind: str,
    norm: str | None,
    note: str | None,
    extend: str | None,
) -> None:
    result = create_plot(sample, f"/{variable}", PlotOptions(norm="log", **extra))
    assert isinstance(result, CreatePlotResult), result
    layout = result.plot_layout
    assert layout["kind"] == kind
    items = {c["role"]: c["value"] for c in layout["choices"]}
    if norm is None:
        assert "norm" not in items
    else:
        assert items["norm"].startswith(norm), items["norm"]
    notes = [n for n in layout["notes"] if n.startswith("norm=log")]
    if note is None:
        assert notes == []
    else:
        assert len(notes) == 1 and notes[0].startswith(note), notes
    assert result.applied_plot_kwargs.get("extend") == extend


def test_packed_variable_raw_counts_the_fill_values(sample: Path) -> None:
    """``maskAndScale`` off: the packed integers, fill values (-1) counted as ≤ 0."""
    options = PlotOptions(norm="log", decoding=DecodingOptions(mask_and_scale=False))
    result = create_plot(sample, "/chlorophyll_packed", options)
    assert isinstance(result, CreatePlotResult), result
    items = {c["role"]: c["value"] for c in result.plot_layout["choices"]}
    assert items["norm"] == "log, 49 to 4.31e+06"
    assert (
        "norm=log: 223 of 4941 values ≤ 0 not shown (4.5%)"
        in (result.plot_layout["notes"])
    )
