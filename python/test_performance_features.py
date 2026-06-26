#!/usr/bin/env python3
"""Tests for performance features (Issue #131): skip-reprs, lazy repr CLI, worker."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

import xarray as xr

sys.path.insert(0, str(Path(__file__).parent))
from get_data_info import dispatch_argv

REPO_ROOT = Path(__file__).resolve().parent.parent
WORKER_SCRIPT = REPO_ROOT / "python" / "python_worker.py"

# JavaScript JSON.parse rejects bare NaN/Infinity tokens (Python json.loads accepts them).
_BARE_NON_JSON_NUMBER = re.compile(r"(?<=[:\[,])\s*(NaN|-?Infinity)\s*(?=[,\]}])")


def assert_strict_json_line(line: str) -> dict:
    """Fail if payload is not valid for JSON.parse in Node (Issue #131 worker bug)."""
    if _BARE_NON_JSON_NUMBER.search(line):
        raise AssertionError("JSON line contains bare NaN/Infinity")
    return json.loads(line)


def _write_minimal_netcdf(path: Path) -> None:
    ds = xr.Dataset(
        {"temperature": (["time", "lat"], [[1.0, 2.0], [3.0, 4.0]])},
        coords={"time": [0, 1], "lat": [10.0, 20.0]},
    )
    ds.to_netcdf(path)


class TestDispatchArgvInfoSkipReprs:
    """Initial load path: metadata without xarray repr strings."""

    def test_skip_reprs_leaves_repr_fields_empty(self, tmp_path: Path) -> None:
        nc_path = tmp_path / "minimal.nc"
        _write_minimal_netcdf(nc_path)

        payload = dispatch_argv(
            ["info", str(nc_path), "--skip-reprs", "--small-variable-bytes", "0"]
        )

        assert "result" in payload
        result = payload["result"]
        assert result["xarray_html_repr"] == ""
        assert result["xarray_text_repr"] == ""
        assert result["xarray_html_repr_flattened"] == {}
        assert result["xarray_text_repr_flattened"] == {}
        assert "temperature" in str(result["variables_flattened"])

    def test_without_skip_reprs_populates_root_reprs(self, tmp_path: Path) -> None:
        nc_path = tmp_path / "minimal.nc"
        _write_minimal_netcdf(nc_path)

        payload = dispatch_argv(["info", str(nc_path), "--small-variable-bytes", "0"])

        assert "result" in payload
        result = payload["result"]
        assert len(result["xarray_html_repr"]) > 0
        assert len(result["xarray_text_repr"]) > 0


class TestDispatchArgvReprMode:
    """Lazy repr loading: fetch reprs on demand."""

    def test_repr_root_scope(self, tmp_path: Path) -> None:
        nc_path = tmp_path / "minimal.nc"
        _write_minimal_netcdf(nc_path)

        payload = dispatch_argv(["repr", str(nc_path), "--scope", "root"])

        assert "result" in payload
        result = payload["result"]
        assert result["scope"] == "root"
        assert result["group"] is None
        assert len(result["xarray_html_repr"]) > 0
        assert len(result["xarray_text_repr"]) > 0

    def test_repr_group_scope_unknown_group_errors(self, tmp_path: Path) -> None:
        nc_path = tmp_path / "minimal.nc"
        _write_minimal_netcdf(nc_path)

        payload = dispatch_argv(
            [
                "repr",
                str(nc_path),
                "--scope",
                "group",
                "--group",
                "/missing",
            ]
        )

        assert "error" in payload
        assert "Unknown group" in payload["error"]["error"]


class TestPythonWorker:
    """Persistent worker JSON-lines protocol."""

    def test_worker_ready_ping_and_shutdown(self) -> None:
        proc = subprocess.Popen(
            [sys.executable, str(WORKER_SCRIPT)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=str(REPO_ROOT),
        )
        assert proc.stdin is not None
        assert proc.stdout is not None

        try:
            ready_line = proc.stdout.readline()
            ready = json.loads(ready_line)
            assert ready.get("event") == "ready"

            proc.stdin.write(json.dumps({"id": "ping-1", "method": "ping"}) + "\n")
            proc.stdin.flush()
            ping_line = proc.stdout.readline()
            ping = json.loads(ping_line)
            assert ping.get("id") == "ping-1"
            assert ping.get("result", {}).get("ok") is True

            proc.stdin.write(
                json.dumps({"id": "shutdown-1", "method": "shutdown"}) + "\n"
            )
            proc.stdin.flush()
            shutdown_line = proc.stdout.readline()
            shutdown = json.loads(shutdown_line)
            assert shutdown.get("result", {}).get("ok") is True
        finally:
            proc.wait(timeout=10)

    def test_worker_execute_info_skip_reprs(self, tmp_path: Path) -> None:
        nc_path = tmp_path / "worker_minimal.nc"
        _write_minimal_netcdf(nc_path)

        proc = subprocess.Popen(
            [sys.executable, str(WORKER_SCRIPT)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=str(REPO_ROOT),
        )
        assert proc.stdin is not None
        assert proc.stdout is not None

        try:
            proc.stdout.readline()  # ready

            request = {
                "id": "exec-1",
                "method": "execute",
                "params": {
                    "argv": [
                        "info",
                        str(nc_path),
                        "--skip-reprs",
                        "--small-variable-bytes",
                        "0",
                    ]
                },
            }
            proc.stdin.write(json.dumps(request) + "\n")
            proc.stdin.flush()
            response_line = proc.stdout.readline()
            response = assert_strict_json_line(response_line)
            assert response.get("id") == "exec-1"
            assert "result" in response
            result = response["result"]["result"]
            assert result["xarray_html_repr"] == ""
            assert result["xarray_text_repr"] == ""

            proc.stdin.write(
                json.dumps({"id": "shutdown-2", "method": "shutdown"}) + "\n"
            )
            proc.stdin.flush()
            proc.stdout.readline()
        finally:
            proc.wait(timeout=30)


class TestGetFileInfoTypes:
    """Sanity check typed results used by lazy repr path."""

    def test_dispatch_returns_file_info_result_shape(self, tmp_path: Path) -> None:
        nc_path = tmp_path / "typed.nc"
        _write_minimal_netcdf(nc_path)
        payload = dispatch_argv(
            ["info", str(nc_path), "--skip-reprs", "--small-variable-bytes", "0"]
        )
        assert "result" in payload
        # Rehydrate via dataclass field names present in JSON
        assert isinstance(payload["result"]["fileSize"], int)
