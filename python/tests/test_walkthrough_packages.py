#!/usr/bin/env python3
"""The "Set up Python" page of the Getting Started walkthrough names every
package the backend can ask for.

The TypeScript test (test/suite/onboarding/walkthrough.test.ts) checks the
packages of the extension's own environment (ALL_REQUIREMENTS); this one checks
the engines of the backend, which include packages that environment does not
install (kerchunk).
"""

from __future__ import annotations

import re
from pathlib import Path

from sdv_backend.environment.packages import ENGINE_PACKAGES

SETUP_PYTHON_PAGE = (
    Path(__file__).resolve().parents[2] / "media" / "walkthrough" / "setup-python.md"
)


def test_setup_python_page_names_every_backend_package() -> None:
    text = SETUP_PYTHON_PAGE.read_text(encoding="utf-8")
    mentioned = set(re.findall(r"`([A-Za-z0-9_.-]+)(?:[<>=!~][^`]*)?`", text))
    required = {"xarray", "matplotlib", *ENGINE_PACKAGES.values()}
    missing = sorted(required - mentioned)
    assert not missing, f"setup-python.md does not name: {', '.join(missing)}"
