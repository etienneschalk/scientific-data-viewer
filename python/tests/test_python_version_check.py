"""An interpreter older than the backend supports says so (QA 0.13.0 H4)."""

import json
import subprocess
import sys
from pathlib import Path

import check_package_availability as cpa

PYTHON_DIR = Path(__file__).resolve().parents[1]


def test_supported_interpreter_has_no_version_error() -> None:
    assert cpa.python_version_error() is None


def test_old_interpreter_gets_a_message(monkeypatch, capsys) -> None:
    monkeypatch.setattr(cpa, "MIN_PYTHON", (99, 0))
    monkeypatch.setattr(sys, "argv", ["check_package_availability.py", "json"])
    cpa.main()
    payload = json.loads(capsys.readouterr().out.strip().splitlines()[-1])
    assert payload["_error"].startswith("Python 99.0 or newer is required")


def test_scripts_load_without_evaluating_annotations() -> None:
    """Python 3.8 evaluates annotations such as ``list[str]`` at definition:
    the check script must not, so it can report the version itself."""
    source = (PYTHON_DIR / "check_package_availability.py").read_text()
    assert "from __future__ import annotations" in source
    out = subprocess.run(
        [sys.executable, str(PYTHON_DIR / "check_package_availability.py"), "json"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    assert json.loads(out.strip().splitlines()[-1]) == {"json": True}
