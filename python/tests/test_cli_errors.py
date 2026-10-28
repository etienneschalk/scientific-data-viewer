"""Every failure of the CLI must still print one JSON line the extension can read."""

import json
import sys
from pathlib import Path

import pytest

from sdv_backend import cli


def _run_cli(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture, *argv: str
) -> tuple[int, dict]:
    monkeypatch.setattr(sys, "argv", ["get_data_info.py", *argv])
    code = cli.main()
    lines = [line for line in capsys.readouterr().out.splitlines() if line.strip()]
    return code, json.loads(lines[-1])


def test_missing_file_gives_json_error(monkeypatch, capsys, tmp_path: Path) -> None:
    """Missing / corrupt files used to end in a traceback with empty stdout (P1)."""
    code, out = _run_cli(monkeypatch, capsys, "info", str(tmp_path / "nope.nc"))
    assert code == 0
    assert out["error"]["error_type"]
    assert out["error"]["error"]
    assert out["error"]["format_info"]["extension"] == ".nc"


def test_corrupt_file_gives_json_error(monkeypatch, capsys, tmp_path: Path) -> None:
    broken = tmp_path / "broken.nc"
    broken.write_bytes(b"not a netcdf file")
    code, out = _run_cli(monkeypatch, capsys, "info", str(broken))
    assert code == 0
    assert "result" not in out
    assert out["error"]["suggestion"].startswith("Check if the file is corrupted")


def test_unexpected_exception_gives_json_error(monkeypatch, capsys, tmp_path) -> None:
    """Last-resort handler: ``{"error": "<message>"}`` and exit code 1, the shape
    PythonManager already reads from a failed run."""

    def boom(*_args, **_kwargs):
        raise RuntimeError("kaboom")

    monkeypatch.setattr(cli, "get_file_info", boom)
    code, out = _run_cli(monkeypatch, capsys, "info", str(tmp_path / "x.nc"))
    assert code == 1
    assert out == {"error": "RuntimeError: kaboom"}


def test_unknown_extension_is_unsupported_format(
    monkeypatch, capsys, tmp_path: Path
) -> None:
    """Not "Missing dependencies for Unknown files" + "pip install " (P11)."""
    text_file = tmp_path / "notes.txt"
    text_file.write_text("hello")
    code, out = _run_cli(monkeypatch, capsys, "info", str(text_file))
    assert code == 0
    error = out["error"]
    assert error["error"] == "Unsupported file format: .txt"
    assert "pip install" not in error["suggestion"]
    assert "Missing dependencies" not in error["error"]

    code, out = _run_cli(monkeypatch, capsys, "plot", str(text_file), "/x")
    assert out["error"]["error"] == "Unsupported file format: .txt"
