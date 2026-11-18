"""Paths and helpers shared by the backend differential tests (scripts/qa/README.md).

The baseline is another checkout of the repository, by default
``$SDV_QA_OUT/baseline`` (create it with ``scripts/qa/backend/make_baseline.sh``).
Both versions run with the same interpreter, so differences come from the code.
"""

import functools
import os
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
QA_OUT = Path(os.environ.get("SDV_QA_OUT", REPO / "artefacts" / "qa"))
NEW_SCRIPT = REPO / "python" / "get_data_info.py"
SAMPLES = REPO / "artefacts" / "sample-data"
FIXTURES = QA_OUT / "fixtures"
EXTENSION_ENV_PY = (
    Path.home()
    / ".config/Code/User/globalStorage/eschalk0.scientific-data-viewer"
    / "python-environment/bin/python"
)


def default_python() -> str:
    """$SDV_PYTHON, else the extension's uv environment, else the repo .venv."""
    if os.environ.get("SDV_PYTHON"):
        return os.environ["SDV_PYTHON"]
    if EXTENSION_ENV_PY.exists():
        return str(EXTENSION_ENV_PY)
    return str(REPO / ".venv" / "bin" / "python")


def baseline_script(baseline: str | None = None) -> Path:
    """get_data_info.py of the baseline checkout."""
    root = Path(baseline or os.environ.get("SDV_QA_BASELINE", QA_OUT / "baseline"))
    script = root / "python" / "get_data_info.py"
    if not script.exists():
        raise SystemExit(
            f"{script} is missing: run scripts/qa/backend/make_baseline.sh <git-ref>"
        )
    return script


@functools.cache
def takes_plot_type(python: str, script: str) -> bool:
    """True for backends up to v0.12, whose plot mode wants a `plot_type` argument."""
    out = subprocess.run(
        [python, script, "--help"], capture_output=True, text=True, timeout=60
    ).stdout
    return "plot_type" in out


def plot_argv(python: str, script: Path, file: str, variable: str) -> list[str]:
    """Positional plot arguments for `script` (old CLIs need `auto`)."""
    extra = ["auto"] if takes_plot_type(python, str(script)) else []
    return ["plot", file, variable, *extra]
