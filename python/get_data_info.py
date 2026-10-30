#!/usr/bin/env python3
"""Backward-compatible entry point for the Scientific Data Viewer backend.

The implementation lives in the ``sdv_backend`` package next to this file;
prefer ``python -m sdv_backend`` (see ``sdv_backend/cli.py`` for usage).
"""

import json
import sys
from pathlib import Path

if sys.version_info < (3, 10):  # noqa: UP036 (runs on interpreters older than the target)
    # Before importing the package, whose syntax needs Python 3.10
    found = ".".join(str(part) for part in sys.version_info[:3])
    print(
        json.dumps(
            {
                "error": "Python 3.10 or newer is required by Scientific Data "
                f"Viewer (this interpreter is Python {found}: {sys.executable})"
            }
        )
    )
    sys.exit(1)

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sdv_backend.cli import main

if __name__ == "__main__":
    sys.exit(main())
