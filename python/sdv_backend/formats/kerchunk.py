"""Kerchunk reference file detection."""

import json
from pathlib import Path

KERCHUNK_JSON_NAME_SUFFIXES: tuple[str, ...] = (
    ".kerchunk.json",
    ".ref.json",
)


# Entries of a reference store that describe groups and arrays
ZARR_METADATA_KEYS = frozenset(
    {".zgroup", ".zarray", ".zattrs", ".zmetadata", "zarr.json"}
)


def looks_like_kerchunk_filename(path: Path) -> bool:
    """True for names that opt in to Kerchunk without a context-menu command.

    Ordinary ``.json`` files are not treated as scientific data. Only
    ``*.kerchunk.json`` and ``*.ref.json`` auto-open.
    """
    name = path.name.lower()
    return any(name.endswith(suffix) for suffix in KERCHUNK_JSON_NAME_SUFFIXES)


def looks_like_kerchunk_parquet(path: Path) -> bool:
    """True when the path looks like a Parquet Kerchunk reference file."""
    name = path.name.lower()
    return name.endswith(".parquet") or name.endswith(".parq")


def kerchunk_json_error(path: Path) -> str | None:
    """Return an error if ``path`` is not Kerchunk JSON with a ``refs`` object.

    ``None`` means the document looks like a reference store and may be opened.
    """
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        return f"This file is not valid JSON Kerchunk references: {exc}"
    if not isinstance(payload, dict) or "refs" not in payload:
        return (
            "This JSON file is not a Kerchunk / virtual Zarr reference "
            "(expected a mapping with a 'refs' key)."
        )
    refs = payload["refs"]
    if not isinstance(refs, dict):
        return "Kerchunk 'refs' must be a JSON object."
    if not any(key.rsplit("/", 1)[-1] in ZARR_METADATA_KEYS for key in refs):
        return (
            "This Kerchunk reference file has no Zarr metadata "
            "(no .zgroup, .zarray or zarr.json entry in 'refs'): nothing to open."
        )
    return None


def kerchunk_refs_with_absolute_paths(path: Path) -> dict:
    """Load Kerchunk JSON references, resolving relative target paths.

    References may point at their source files with relative paths
    (``["sample_data.nc", offset, length]``). fsspec resolves those against the
    process working directory, which is not the reference file's folder when the
    extension runs the backend, so reading data fails with
    ``ReferenceNotReachable``. Resolve them against ``path``'s folder instead.
    URLs (``scheme://``), absolute paths and templated targets are kept.
    """
    payload = json.loads(path.read_text(encoding="utf-8"))
    base = path.resolve().parent
    for key, value in payload["refs"].items():
        if not (isinstance(value, list) and value and isinstance(value[0], str)):
            continue
        target = value[0]
        if (
            not target
            or "://" in target
            or "{{" in target
            or Path(target).is_absolute()
        ):
            continue
        payload["refs"][key] = [str(base / target), *value[1:]]
    return payload
