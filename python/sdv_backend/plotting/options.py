"""Parsing of user plot options (dimension slices, col_wrap, figsize)."""

import argparse
from typing import Any, Literal

import xarray as xr

from sdv_backend.types import ColWrap


def _parse_dimension_slice_spec(spec: str | int) -> int | slice:
    """Parse a single dimension slice spec (Issue #117). Returns int or slice()."""
    if isinstance(spec, int):
        return spec
    s = str(spec).strip()
    if not s:
        raise ValueError("Empty slice spec")
    if ":" not in s:
        return int(s)
    parts = s.split(":")
    if len(parts) == 2:
        start_s, stop_s = parts
        start = int(start_s) if start_s else None
        stop = int(stop_s) if stop_s else None
        return slice(start, stop)
    if len(parts) == 3:
        start_s, stop_s, step_s = parts
        start = int(start_s) if start_s else None
        stop = int(stop_s) if stop_s else None
        step = int(step_s) if step_s else None
        return slice(start, stop, step)
    raise ValueError(f"Invalid slice spec: {s!r}")


def _parse_dimension_slices(
    slices_dict: dict[str, Any] | None,
) -> dict[str, int | slice] | None:
    """Parse dimension_slices from JSON/CLI into isel-compatible dict (Issue #117)."""
    if not slices_dict:
        return None
    out: dict[str, int | slice] = {}
    for dim, spec in slices_dict.items():
        if spec is None or (isinstance(spec, str) and not spec.strip()):
            continue
        try:
            out[str(dim)] = _parse_dimension_slice_spec(spec)
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid slice for dimension {dim!r}: {e}") from e
    return out if out else None


def parse_col_wrap(value: str) -> int | Literal["auto"]:
    """Parse ``--col-wrap``: a positive integer or the token ``auto``."""
    text = str(value).strip()
    if text.lower() == "auto":
        return "auto"
    try:
        parsed = int(text)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            "col_wrap must be a positive integer or 'auto'"
        ) from exc
    if parsed < 1:
        raise argparse.ArgumentTypeError("col_wrap must be >= 1")
    return parsed


def parse_facetgrid_figsize(value: str) -> tuple[float, float]:
    """Parse ``--facetgrid-figsize WIDTH,HEIGHT`` for xarray faceted plot panels."""
    parts = [part.strip() for part in value.split(",")]
    if len(parts) != 2:
        raise argparse.ArgumentTypeError(
            "facetgrid_figsize must be two comma-separated numbers (width,height)"
        )
    try:
        width, height = float(parts[0]), float(parts[1])
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            "facetgrid_figsize must be two numbers"
        ) from exc
    if width <= 0 or height <= 0:
        raise argparse.ArgumentTypeError("facetgrid_figsize values must be > 0")
    return (width, height)


def xarray_supports_col_wrap_auto() -> bool:
    """xarray 2026.04.0 added ``col_wrap='auto'`` for faceted plots."""
    parts = xr.__version__.split(".")
    try:
        year, month = int(parts[0]), int(parts[1])
    except (ValueError, IndexError):
        return False
    return (year, month) >= (2026, 4)


def col_wrap_is_set(col_wrap: ColWrap) -> bool:
    return col_wrap == "auto" or (isinstance(col_wrap, int) and col_wrap >= 1)
