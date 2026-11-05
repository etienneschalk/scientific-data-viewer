"""The Python format list matches the custom editors of package.json (TO_REMOVE R5)."""

import json
from pathlib import Path
from typing import get_args

from sdv_backend.types import SupportedExtensionType

REPO = Path(__file__).resolve().parents[2]
# Editors whose file name patterns map to one Python-side name
KERCHUNK_PATTERNS = {"*.kerchunk.json", "*.ref.json"}


def _editor_extensions() -> set[str]:
    package = json.loads((REPO / "package.json").read_text(encoding="utf-8"))
    extensions = set()
    for editor in package["contributes"]["customEditors"]:
        for selector in editor["selector"]:
            pattern = selector["filenamePattern"]
            if pattern in KERCHUNK_PATTERNS:
                extensions.add(".kerchunk")
            else:
                assert pattern.startswith("*."), pattern
                extensions.add(pattern[1:])
    return extensions


def test_python_formats_match_package_json_editors() -> None:
    assert set(get_args(SupportedExtensionType)) == _editor_extensions()
