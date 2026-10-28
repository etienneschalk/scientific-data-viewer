"""JSON serialization of backend results (non-finite floats, numpy values)."""

import json

import numpy as np

from sdv_backend.serialization import to_json_best_effort


def test_infinities_and_nan_become_strings() -> None:
    """``inf`` / ``-inf`` used to crash ``allow_nan=False`` (P2)."""
    out = json.loads(
        to_json_best_effort({"a": float("inf"), "b": float("-inf"), "c": float("nan")})
    )
    assert out == {"a": "inf", "b": "-inf", "c": "nan"}


def test_non_finite_inside_tuples() -> None:
    out = json.loads(to_json_best_effort({"range": (float("nan"), 1.0)}))
    assert out == {"range": ["nan", 1.0]}


def test_numpy_non_finite_scalars() -> None:
    out = json.loads(
        to_json_best_effort(
            {
                "f64": np.float64("inf"),
                "f32": np.float32("nan"),
                "f16": np.float16("-inf"),
            }
        )
    )
    assert out == {"f64": "np.float64(inf)", "f32": "nan", "f16": "-inf"}


def test_numpy_numbers_stay_numbers() -> None:
    """``default=str`` used to shadow the encoder: np.int16(5) -> "5" (P3)."""
    out = json.loads(
        to_json_best_effort(
            {
                "int16": np.int16(5),
                "uint64": np.uint64(7),
                "float32": np.float32(1.5),
                "bool": np.bool_(True),
            }
        )
    )
    assert out == {"int16": 5, "uint64": 7, "float32": 1.5, "bool": True}
    assert isinstance(out["int16"], int)


def test_numpy_arrays_become_lists() -> None:
    out = json.loads(
        to_json_best_effort(
            {
                "valid_range": np.array([0, 100], dtype=np.int16),
                "with_nan": np.array([1.0, np.nan, np.inf]),
                "nested": [np.array([[1, 2], [3, 4]])],
            }
        )
    )
    assert out == {
        "valid_range": [0, 100],
        "with_nan": [1.0, "nan", "inf"],
        "nested": [[[1, 2], [3, 4]]],
    }


def test_other_objects_fall_back_to_str() -> None:
    out = json.loads(
        to_json_best_effort(
            {
                "date": np.datetime64("2020-01-01"),
                "set": {1},
                "bytes": b"x",
                "complex": 1 + 2j,
            }
        )
    )
    assert out == {
        "date": "2020-01-01",
        "set": "{1}",
        "bytes": "b'x'",
        "complex": "(1+2j)",
    }
