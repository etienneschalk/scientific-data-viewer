#!/usr/bin/env python3
"""Long-lived Python worker for Scientific Data Viewer.

Reads newline-delimited JSON requests from stdin and writes JSON responses to stdout.
Amortizes import cost across file opens and repr requests.
"""

from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path
from typing import Any

WORKER_DIR = Path(__file__).resolve().parent


def _write_message(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, default=str) + "\n")
    sys.stdout.flush()


def _warmup() -> None:
    import numpy as _np  # noqa: F401
    import xarray as _xr  # noqa: F401


def _handle_execute(params: dict[str, Any]) -> Any:
    argv = params.get("argv")
    if not isinstance(argv, list) or not argv:
        raise ValueError("execute params must include non-empty argv list")

    if str(WORKER_DIR) not in sys.path:
        sys.path.insert(0, str(WORKER_DIR))

    from get_data_info import dispatch_argv

    return dispatch_argv([str(arg) for arg in argv])


def _handle_request(req: dict[str, Any]) -> bool:
    req_id = req.get("id")
    method = req.get("method")
    params = req.get("params") or {}

    try:
        if method == "ping":
            _write_message({"id": req_id, "result": {"ok": True}})
        elif method == "shutdown":
            _write_message({"id": req_id, "result": {"ok": True}})
            return False
        elif method == "execute":
            result = _handle_execute(params)
            _write_message({"id": req_id, "result": result})
        else:
            _write_message(
                {
                    "id": req_id,
                    "error": f"Unknown method: {method}",
                }
            )
    except Exception as exc:
        _write_message(
            {
                "id": req_id,
                "error": str(exc),
                "traceback": traceback.format_exc(),
            }
        )
    return True


def main() -> int:
    _warmup()
    _write_message({"event": "ready"})

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError as exc:
            _write_message({"error": f"Invalid JSON request: {exc}"})
            continue

        if not _handle_request(req):
            break

    return 0


if __name__ == "__main__":
    sys.exit(main())
