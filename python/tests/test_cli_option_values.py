"""Option values starting with "-" (QA 0.13.0 bugs 1 and 6)."""

import base64
import json
import sys
from pathlib import Path

import numpy as np
import pytest
import xarray as xr

from sdv_backend import cli


@pytest.mark.parametrize(
    ("argv", "attribute", "expected"),
    [
        (["--vmin", "-1e-7"], "vmin", -1e-7),
        (["--vmax", "-1e+21"], "vmax", -1e21),
        (["--vmin", "-0.5"], "vmin", -0.5),
        (["--vmin=-2e-9"], "vmin", -2e-9),
        (["--plot-x", "-x"], "plot_x", "-x"),
        (["--facet-col", "--weird"], "facet_col", "--weird"),
        (["--style", "-x"], "style", "-x"),
        (["--style", ""], "style", ""),
        (["--cmap", "-viridis"], "cmap", "-viridis"),
        (["--datetime-variable", "-t"], "datetime_variable", "-t"),
    ],
)
def test_option_values_starting_with_dash(argv, attribute, expected) -> None:
    args = cli.parse_cli_args(["plot", "f.nc", "/v", *argv])
    assert getattr(args, attribute) == expected
    assert args.variable_name == "/v"


def test_flags_without_value_are_kept() -> None:
    args = cli.parse_cli_args(
        ["plot", "f.nc", "/v", "--robust", "--vmin", "-1e-7", "--no-add-colorbar"]
    )
    assert args.robust is True
    assert args.no_add_colorbar is True
    assert args.vmin == -1e-7


def test_plot_with_tiny_negative_vmin_and_dash_dimension(
    monkeypatch, capsys, tmp_path: Path
) -> None:
    """The arguments the extension builds for -1e-7 used to end the CLI with
    "argument --vmin: expected one argument" and no JSON."""
    path = tmp_path / "dash.zarr"
    xr.Dataset(
        {"v": (("-x", "y"), np.arange(6.0).reshape(2, 3))},
        coords={"-x": [0, 1], "y": [0, 1, 2]},
    ).to_zarr(path, zarr_format=3)
    argv = ["plot", str(path), "/v", "--vmin", "-1e-7", "--plot-x", "-x"]
    monkeypatch.setattr(sys, "argv", ["get_data_info.py", *argv])
    assert cli.main() == 0
    lines = [line for line in capsys.readouterr().out.splitlines() if line.strip()]
    out = json.loads(lines[-1])
    assert out["result"]["applied_plot_kwargs"]["vmin"] == -1e-7
    assert base64.b64decode(out["result"]["plot_data"]).startswith(b"\x89PNG")
