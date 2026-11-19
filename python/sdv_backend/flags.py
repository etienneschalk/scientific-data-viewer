"""CF flag variables: ``flag_values`` / ``flag_masks`` / ``flag_meanings``.

CF conventions section 3.5 describes an integer variable whose numbers stand
for named conditions:

- ``flag_values`` alone: mutually exclusive codes (classes, status),
  flag *i* is true where ``v == values[i]``;
- ``flag_masks`` alone: independent bit fields, true where
  ``v & masks[i] != 0``;
- both: bit fields holding a boolean or an enumeration (a repeated mask),
  true where ``v & masks[i] == values[i]``.

``read_flag_spec`` parses and checks the attributes. A problem (counts that
differ, a value the variable cannot hold, a mixed value outside its mask...)
makes the spec unusable: the viewer then shows the variable as plain numbers,
with the problem as a note, never an error. Notes are informational (e.g.
``flag_colors`` ignored).

``flag_colors`` is not CF: some producers (ESA CCI Land Cover) add it with one
color per meaning; it is used when it has one valid color per meaning.

The codes must be read *raw* (see ``needs_raw_codes``): xarray's default
``mask_and_scale`` turns an integer variable with a ``_FillValue`` into
floats, which loses the low bits of 64-bit masks and hides a code equal to the
fill value even when it is a declared meaning.
"""

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any, Literal

import numpy as np

FlagKind = Literal["values", "masks", "mixed"]

FLAG_ATTRIBUTES: tuple[str, ...] = ("flag_values", "flag_masks", "flag_meanings")

# Colors accepted from ``flag_colors``: hex (#rgb, #rgba, #rrggbb, #rrggbbaa)
# or a plain color name (checked again by matplotlib when drawing). Nothing
# else reaches the webview, where they become CSS colors.
_COLOR_RE = re.compile(
    r"^(#[0-9a-fA-F]{3,4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|[a-zA-Z]+)$"
)


@dataclass(frozen=True)
class Flag:
    """One meaning: its value (``flag_values``) and / or mask (``flag_masks``)."""

    meaning: str
    value: int | float | None = None
    mask: int | None = None

    @property
    def label(self) -> str:
        """``flag_meanings`` joins words with ``_``: shown with spaces."""
        return self.meaning.replace("_", " ")

    def test(self, codes: np.ndarray) -> np.ndarray:
        """Boolean array: where the flag is set in ``codes`` (raw values)."""
        if self.mask is None:
            return codes == _as_code(self.value, codes.dtype)
        anded = codes & _as_code(self.mask, codes.dtype)
        if self.value is None:
            return anded != 0
        return anded == _as_code(self.value, codes.dtype)


@dataclass(frozen=True)
class FlagSpec:
    """The flags of one variable, or why they cannot be used (``problems``)."""

    kind: FlagKind
    flags: tuple[Flag, ...]
    # Raw dtype the values / masks were checked against
    dtype: str
    # Valid ``flag_colors``, one per flag; None when absent or ignored
    colors: tuple[str, ...] | None = None
    problems: tuple[str, ...] = ()
    notes: tuple[str, ...] = field(default=())

    @property
    def is_valid(self) -> bool:
        return not self.problems

    def to_json(self) -> dict[str, Any]:
        """For File Information. Values and masks are strings: a uint64 mask
        does not fit in a JavaScript number."""
        bits = _dtype_bits(self.dtype)
        return {
            "kind": self.kind,
            "flags": [
                {
                    "meaning": flag.meaning,
                    "value": None if flag.value is None else _number_text(flag.value),
                    "mask": None if flag.mask is None else str(flag.mask),
                    "bits": None
                    if flag.mask is None
                    else mask_bits_text(flag.mask, bits),
                    "color": None if self.colors is None else self.colors[i],
                }
                for i, flag in enumerate(self.flags)
            ],
            "colors_source": None if self.colors is None else "flag_colors",
            "problems": list(self.problems),
            "notes": list(self.notes),
        }


def has_flag_attributes(attrs: Mapping[Any, Any]) -> bool:
    return any(name in attrs for name in FLAG_ATTRIBUTES)


def read_flag_spec(attrs: Mapping[Any, Any], raw_dtype: Any) -> FlagSpec | None:
    """The flags described by ``attrs``, checked against ``raw_dtype``.

    ``raw_dtype`` is the dtype stored in the file (``encoding["dtype"]``
    when xarray decoded the variable). Returns None when no flag attribute is
    present; otherwise a spec, with ``problems`` when it cannot be used.
    """
    if not has_flag_attributes(attrs):
        return None
    dtype = np.dtype(raw_dtype)
    kind = _kind(attrs)
    meanings = _meanings(attrs.get("flag_meanings")) or []
    values, values_problem = _numbers(attrs, "flag_values")
    masks, masks_problem = _numbers(attrs, "flag_masks")
    problems = [p for p in (values_problem, masks_problem) if p]
    problems += _structure_problems(attrs, meanings, values, masks)
    if masks is not None and not problems:
        fractional = [m for m in masks if float(m) != int(m)]
        if fractional:
            problems.append(f"flag_masks must be integers: {fractional[0]}")
    if problems:
        flags = tuple(Flag(m) for m in meanings)
        return FlagSpec(kind, flags, str(dtype), problems=tuple(problems))

    notes: list[str] = []
    flags = tuple(
        Flag(
            meaning,
            None if values is None else values[i],
            None if masks is None else int(masks[i]),
        )
        for i, meaning in enumerate(meanings)
    )
    problems += _check_dtype(kind, flags, dtype)
    if not problems:
        problems += _check_consistency(kind, flags)
    duplicates = sorted({m for m in meanings if meanings.count(m) > 1})
    if duplicates:
        notes.append(f"meanings listed twice: {', '.join(duplicates)}")
    colors = _colors(attrs.get("flag_colors"), len(flags), notes)
    return FlagSpec(
        kind,
        flags,
        str(dtype),
        colors=colors,
        problems=tuple(problems),
        notes=tuple(notes),
    )


def raw_dtype_of(encoding: Mapping[Any, Any], dtype: Any) -> np.dtype:
    """dtype stored in the file: xarray keeps it in ``encoding`` when it decoded
    the variable to another one (float after ``_FillValue`` masking)."""
    return np.dtype(encoding.get("dtype", dtype))


def needs_raw_codes(dtype: Any, encoding: Mapping[Any, Any]) -> bool:
    """Whether the decoded values differ from the stored codes (the variable
    must then be read again without ``mask_and_scale``)."""
    return np.dtype(dtype) != raw_dtype_of(encoding, dtype)


def mask_bits_text(mask: int, bits: int | None = None) -> str:
    """``12`` -> ``bits 2-3``, ``1`` -> ``bit 0``, ``5`` -> ``bits 0, 2``.

    A negative mask (signed type) is read in two's complement on ``bits`` bits.
    """
    if mask < 0:
        mask &= (1 << (bits or 64)) - 1
    positions = [i for i in range(mask.bit_length()) if mask >> i & 1]
    if not positions:
        return "no bit"
    if len(positions) == 1:
        return f"bit {positions[0]}"
    if positions == list(range(positions[0], positions[-1] + 1)):
        return f"bits {positions[0]}-{positions[-1]}"
    return "bits " + ", ".join(map(str, positions))


# --- parsing ---------------------------------------------------------------


def _kind(attrs: Mapping[Any, Any]) -> FlagKind:
    if "flag_masks" not in attrs:
        return "values"
    return "mixed" if "flag_values" in attrs else "masks"


def _structure_problems(
    attrs: Mapping[Any, Any],
    meanings: list[str],
    values: list[int | float] | None,
    masks: list[int | float] | None,
) -> list[str]:
    """Attributes missing, or counts that differ from the meanings."""
    problems: list[str] = []
    if not meanings:
        problems.append("flag_meanings is missing or empty")
    if "flag_values" not in attrs and "flag_masks" not in attrs:
        problems.append("flag_meanings without flag_values or flag_masks")
    for name, numbers in (("flag_values", values), ("flag_masks", masks)):
        if numbers is not None and meanings and len(numbers) != len(meanings):
            problems.append(
                f"{len(numbers)} {name} for {len(meanings)} flag_meanings "
                "(one each expected)"
            )
    return problems


def _meanings(raw: Any) -> list[str] | None:
    """``flag_meanings``: a blank-separated string (CF), or a list of words
    (Zarr JSON attributes)."""
    if raw is None:
        return None
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", "replace")
    if isinstance(raw, str):
        words = raw.split()
    elif isinstance(raw, (Sequence, np.ndarray)):
        words = [str(w).strip() for w in np.asarray(raw).ravel().tolist()]
        words = [w for w in words if w]
    else:
        return None
    return words or None


def _numbers(
    attrs: Mapping[Any, Any], name: str
) -> tuple[list[int | float] | None, str | None]:
    """``flag_values`` / ``flag_masks`` as Python numbers (exact for uint64).

    Accepts an array, a scalar (one flag), or a string of numbers separated by
    blanks or commas (written by some HDF tools).
    """
    if name not in attrs:
        return None, None
    raw = attrs[name]
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", "replace")
    if isinstance(raw, str):
        try:
            return [
                _parse_number(t) for t in re.split(r"[\s,]+", raw.strip()) if t
            ], None
        except ValueError:
            return None, f"{name} is not a list of numbers: {raw!r}"
    array = np.asarray(raw).ravel()
    if array.dtype.kind == "b":
        array = array.astype(np.uint8)
    if array.dtype.kind not in "iuf":
        return None, f"{name} is not a list of numbers ({array.dtype})"
    if array.size == 0:
        return None, f"{name} is empty"
    return array.tolist(), None


def _parse_number(text: str) -> int | float:
    base = 16 if text.lower().startswith(("0x", "-0x")) else 10
    try:
        return int(text, base)
    except ValueError:
        return float(text)


def _colors(raw: Any, count: int, notes: list[str]) -> tuple[str, ...] | None:
    if raw is None:
        return None
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", "replace")
    colors = (
        raw.split()
        if isinstance(raw, str)
        else [str(c) for c in np.asarray(raw).ravel().tolist()]
    )
    if len(colors) != count:
        notes.append(
            f"flag_colors ignored: {len(colors)} colors for {count} flag_meanings"
        )
        return None
    invalid = [c for c in colors if not _COLOR_RE.match(c)]
    if invalid:
        notes.append(f"flag_colors ignored: not a color: {', '.join(invalid[:3])}")
        return None
    return tuple(colors)


# --- checks ----------------------------------------------------------------


def _check_dtype(kind: FlagKind, flags: Sequence[Flag], dtype: np.dtype) -> list[str]:
    if dtype.kind == "b":
        dtype = np.dtype(np.uint8)
    if dtype.kind not in "iuf":
        return [f"flags need a numeric variable, not {dtype}"]
    problems: list[str] = []
    if dtype.kind == "f":
        if kind != "values":
            return [f"flag_masks need an integer variable, not {dtype}"]
        return problems
    info = np.iinfo(dtype)
    for name, numbers in (
        ("flag_values", [f.value for f in flags]),
        ("flag_masks", [f.mask for f in flags]),
    ):
        numbers = [n for n in numbers if n is not None]
        not_integers = [n for n in numbers if float(n) != int(n)]
        if not_integers:
            problems.append(f"{name} must be integers: {_number_text(not_integers[0])}")
            continue
        # Masks of a signed type may be written as unsigned (bit 7 of a byte:
        # 128 or -128)
        high = info.max if name == "flag_values" else (1 << info.bits) - 1
        outside = [n for n in numbers if not info.min <= int(n) <= high]
        if outside:
            problems.append(
                f"{name} {_number_text(outside[0])} does not fit the variable's "
                f"type ({dtype})"
            )
    return problems


def _check_consistency(kind: FlagKind, flags: Sequence[Flag]) -> list[str]:
    problems: list[str] = []
    if kind == "values":
        values = [f.value for f in flags]
        repeated = sorted({_number_text(v) for v in values if values.count(v) > 1})
        if repeated:
            problems.append(f"flag_values listed twice: {', '.join(repeated)}")
    if kind in ("masks", "mixed"):
        zero = [f.meaning for f in flags if f.mask == 0]
        if zero:
            problems.append(f"mask 0 can never be set: {', '.join(zero)}")
    if kind == "mixed":
        impossible = [
            f
            for f in flags
            if f.mask and f.value is not None and int(f.value) & f.mask != int(f.value)
        ]
        if impossible:
            f = impossible[0]
            problems.append(
                f"{f.meaning}: value {_number_text(f.value)} has bits outside "
                f"its mask {f.mask}, it can never match"
                + (f" ({len(impossible)} such flags)" if len(impossible) > 1 else "")
            )
    return problems


# --- helpers ---------------------------------------------------------------


def _as_code(number: int | float | None, dtype: np.dtype) -> Any:
    """``number`` in the dtype of the codes. Integers wrap on purpose: a mask
    of a signed type written as unsigned (128 for bit 7 of a byte) is the
    same bit pattern."""
    if dtype.kind == "f":
        return dtype.type(number)
    value = int(number)  # type: ignore[arg-type]
    bits = dtype.itemsize * 8
    value &= (1 << bits) - 1
    if dtype.kind == "i" and value >= 1 << (bits - 1):
        value -= 1 << bits
    return dtype.type(value)


def _dtype_bits(dtype: str) -> int | None:
    try:
        return np.dtype(dtype).itemsize * 8
    except TypeError:
        return None


def _number_text(number: int | float | None) -> str:
    if isinstance(number, float) and number.is_integer():
        return str(int(number))
    return str(number)
