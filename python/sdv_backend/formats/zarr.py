"""Zarr store detection, zipped Zarr and metadata-file resolution."""

import functools
import zipfile
from pathlib import Path
from typing import Any

from sdv_backend._bootstrap import logger

# Metadata entries that identify a directory as a Zarr store: "zarr.json" for
# v3, the others for v2 (".zmetadata" being consolidated metadata).
ZARR_STORE_MARKERS: tuple[str, ...] = (
    "zarr.json",
    ".zgroup",
    ".zarray",
    ".zmetadata",
)


def is_zarr_store(path: Path) -> bool:
    """Check whether a directory is a Zarr store, regardless of its name.

    Zarr identifies a store by metadata files, not by a ``.zarr`` suffix:
    v3 stores carry ``zarr.json``, v2 stores ``.zgroup`` / ``.zarray``
    (or consolidated ``.zmetadata``). Stores produced by pipelines and by
    Icechunk are often plain directories.

    Parameters
    ----------
    path : Path
        Path to inspect

    Returns
    -------
    bool
        True if the path is a directory holding Zarr metadata
    """
    if not path.is_dir():
        return False

    return any((path / marker).exists() for marker in ZARR_STORE_MARKERS)


def looks_like_zip(path: Path) -> bool:
    """True when the path is a file whose name claims to be a ZIP archive."""
    if not path.is_file():
        return False
    name = path.name.lower()
    return name.endswith(".zip")


def _zip_member_names(path: Path) -> tuple[str, ...] | None:
    """Member names of a ZIP archive (``/`` separators), None if unreadable.

    Format detection, version detection and opening all need them: the
    listing is cached so the archive's central directory is read once.
    """
    try:
        stat = path.stat()
    except OSError as exc:
        logger.warning(f"Could not read ZIP archive {path}: {exc!r}")
        return None
    return _cached_zip_member_names(str(path), stat.st_mtime_ns, stat.st_size)


@functools.lru_cache(maxsize=8)
def _cached_zip_member_names(
    path: str, _mtime_ns: int, _size: int
) -> tuple[str, ...] | None:
    try:
        with zipfile.ZipFile(path) as archive:
            return tuple(name.replace("\\", "/") for name in archive.namelist())
    except zipfile.BadZipFile:
        logger.warning(f"{path} is not a valid ZIP archive")
    except OSError as exc:
        logger.warning(f"Could not read ZIP archive {path}: {exc!r}")
    return None


def zip_zarr_root_prefix(path: Path) -> str | None:
    """Return the zip-internal prefix of a Zarr store, or None if none is found.

    An empty string means the store is at the archive root. A nested store
    such as ``ocean.zarr/zarr.json`` returns ``ocean.zarr``. Only metadata
    members are inspected; array chunks are not read.

    When several markers exist (root ``zarr.json`` plus per-array
    ``temperature/zarr.json``), the shortest prefix wins so the store root
    is selected rather than a child array.
    """
    names = _zip_member_names(path)
    if names is None:
        return None

    prefixes: list[str] = []
    for name in names:
        if name.startswith("./"):
            name = name[2:]
        # Array-level ``.zarray`` / per-array ``zarr.json`` would point at
        # children; only group metadata identifies the store root.
        for marker in ("zarr.json", ".zgroup", ".zmetadata"):
            if name == marker:
                prefixes.append("")
            elif name.endswith(f"/{marker}"):
                prefixes.append(name[: -len(marker)].rstrip("/"))

    if not prefixes:
        return None

    prefixes.sort(key=lambda prefix: (prefix.count("/"), len(prefix)))
    return prefixes[0]


def detect_zarr_format_version(path: Path) -> int | None:
    """Detect whether a Zarr store uses the v3 or v2 layout.

    The metadata layout is the only reliable signal: v3 stores carry a
    ``zarr.json`` document, v2 stores ``.zgroup`` / ``.zarray``.

    Parameters
    ----------
    path : Path
        Path to a Zarr store

    Returns
    -------
    int or None
        3, 2, or None when the version cannot be determined
    """
    if looks_like_zip(path):
        prefix = zip_zarr_root_prefix(path)
        if prefix is None:
            return None
        v3_member = "zarr.json" if prefix == "" else f"{prefix}/zarr.json"
        v2_member = ".zgroup" if prefix == "" else f"{prefix}/.zgroup"
        names = _zip_member_names(path) or ()
        if v3_member in names:
            return 3
        if v2_member in names:
            return 2
        return None

    if not path.is_dir():
        return None
    if (path / "zarr.json").exists():
        return 3
    if (path / ".zgroup").exists() or (path / ".zarray").exists():
        return 2

    return None


def resolve_store_path(path: Path) -> Path:
    """Resolve a Zarr metadata file to the store directory that contains it.

    Opening ``zarr.json`` (or a v2 equivalent) should open the store it
    belongs to, since the metadata file on its own is not readable by xarray.

    Parameters
    ----------
    path : Path
        Path provided by the caller

    Returns
    -------
    Path
        The store directory when ``path`` is Zarr metadata, else ``path``
    """
    if (
        path.is_file()
        and path.name in ZARR_STORE_MARKERS
        and is_zarr_store(path.parent)
    ):
        logger.info(f"Resolving Zarr metadata file {path.name} to store {path.parent}")
        return path.parent

    return path


def zarr_open_location(file_path: Path) -> tuple[Any, dict[str, Any]]:
    """Return the object and extra kwargs xarray needs to open a Zarr store.

    Directory stores are passed through as paths. ZIP archives must go through
    ``zarr.storage.ZipStore``; zarr-python 3 no longer treats ``*.zip`` paths
    as stores. A nested store (``ocean.zarr/zarr.json`` inside the archive)
    is selected with xarray's ``group`` argument.
    """
    if not looks_like_zip(file_path):
        return file_path, {}

    prefix = zip_zarr_root_prefix(file_path)
    if prefix is None:
        return file_path, {}

    from zarr.storage import ZipStore

    extra: dict[str, Any] = {"consolidated": False}
    if prefix:
        extra["group"] = prefix
    logger.info(
        f"Opening ZIP Zarr store {file_path}"
        + (f" group={prefix!r}" if prefix else " at archive root")
    )
    return ZipStore(str(file_path), mode="r"), extra
