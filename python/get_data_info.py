#!/usr/bin/env python3
"""Backward-compatible entry point for the Scientific Data Viewer backend.

The implementation lives in the ``sdv_backend`` package next to this file;
prefer ``python -m sdv_backend`` (see ``sdv_backend/cli.py`` for usage).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sdv_backend.cli import main

if __name__ == "__main__":
    sys.exit(main())
