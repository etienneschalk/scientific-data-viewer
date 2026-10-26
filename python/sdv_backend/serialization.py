"""JSON serialization of backend results (NaN/complex/numpy-safe)."""

import json
from collections.abc import Callable
from dataclasses import asdict, is_dataclass
from typing import Any

import numpy as np
import xarray as xr

# <JSON Serialization Section>


def sanitize_nan(obj, default: Callable[[Any], str]):
    if isinstance(obj, dict):
        return {k: sanitize_nan(v, default) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_nan(v, default) for v in obj]
    elif isinstance(obj, float) and np.isnan(obj):
        # str gives 'nan', repr gives eg np.float64(nan)
        return default(obj)
    return obj


class ComplexEncoder(json.JSONEncoder):
    def encode(self, obj, *args, **kwargs):
        return super().encode(sanitize_nan(obj, repr), *args, **kwargs)

    def default(self, obj: Any) -> Any:
        """
        Best effort to try to convert non-native Python objects to strings when serialization to JSON,
        with a fallback on calling ``str`` on the object to serialized

        Parameters
        ----------
        obj
            Object to convert to

        Returns
        -------
            Serializable representation of the object
        """
        if is_dataclass(obj):
            return asdict(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, (xr.Dataset, xr.DataArray)):
            return obj.to_dict()
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.integer):
            return int(obj)
        # Let the base class default method raise the TypeError
        # The default=str kwarg can still be passed to json.dumps
        # to catch all and convert to string.
        return super().default(obj)


def to_json_best_effort(
    obj: Any,
    *,
    encoder: type[json.JSONEncoder] = ComplexEncoder,
    **kwargs: Any,
) -> str:
    """
    Best effort to convert a complex object to JSON.

    Parameters
    ----------
    obj
        Object to convert
    encoder, optional
        JSONEncoder to use, by default ComplexEncoderDefaultStr
        The default should be able to convert most common complex objects encountered in the project to JSON.
    kwargs
        Additional keyword arguments to pass to the ``json.dumps`` function, eg ``indent``
    Returns
    -------
        JSON string
    """
    return json.dumps(obj, cls=encoder, allow_nan=False, default=str, **kwargs)
