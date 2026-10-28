"""JSON serialization of backend results (non-finite-float/numpy-safe)."""

import json
import math
from typing import Any

import numpy as np


def sanitize_non_finite(obj: Any) -> Any:
    """Replace NaN / ±inf floats by their ``repr`` (JSON has no such numbers).

    Walks dicts, lists and tuples (tuples become lists, as JSON would make
    them anyway). Covers ``float`` subclasses such as ``np.float64``, whose
    ``repr`` is e.g. ``np.float64(nan)``; other numpy floats are handled by
    ``ComplexEncoder.default``.
    """
    if isinstance(obj, dict):
        return {k: sanitize_non_finite(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [sanitize_non_finite(v) for v in obj]
    if isinstance(obj, float) and not math.isfinite(obj):
        return repr(obj)
    return obj


class ComplexEncoder(json.JSONEncoder):
    """JSON encoder for backend results: numpy scalars and arrays become JSON
    numbers / lists, non-finite floats become strings, anything else ``str``.

    Dataclasses are converted by ``asdict`` before encoding (which also
    converts nested ones, hence ``_describe_codec`` for Zarr codecs).
    """

    def encode(self, o: Any) -> str:
        return super().encode(sanitize_non_finite(o))

    def default(self, o: Any) -> Any:
        if isinstance(o, np.bool_):
            return bool(o)
        if isinstance(o, np.integer):
            return int(o)
        if isinstance(o, np.floating):
            return float(o) if math.isfinite(o) else str(o)
        if isinstance(o, np.ndarray):
            return sanitize_non_finite(o.tolist())
        return str(o)


def to_json_best_effort(obj: Any, **kwargs: Any) -> str:
    """Serialize ``obj`` to JSON, never failing on numpy or non-finite values.

    ``kwargs`` are passed to ``json.dumps`` (e.g. ``indent``).
    """
    return json.dumps(obj, cls=ComplexEncoder, allow_nan=False, **kwargs)
