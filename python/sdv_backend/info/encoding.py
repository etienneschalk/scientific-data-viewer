"""Codec / HDF5 filter description and attribute collection."""

from typing import Any

import xarray as xr

from sdv_backend._bootstrap import logger

# Compression / checksum keys that netCDF4-python and h5netcdf Variable.filters() share.
HDF5_FILTER_ENCODING_KEYS: tuple[str, ...] = (
    "zlib",
    "szip",
    "zstd",
    "bzip2",
    "blosc",
    "shuffle",
    "fletcher32",
    "complevel",
)


def _describe_codec(value: Any) -> Any:
    """Describe a Zarr codec by name, leaving other values untouched.

    Zarr v3 codecs (``compressors``, ``filters``, ``serializer`` in the
    encoding) are dataclasses, so the ``asdict`` applied to the result would
    keep their configuration but drop their identity: ``ZstdCodec(level=0)``
    would reach the UI as ``{"level": 0, "checksum": false}``, which does not
    say which codec was used. Zarr's own ``to_dict`` keeps the
    ``{"name", "configuration"}`` form from the store metadata, and numcodecs
    (Zarr v2) exposes the equivalent through ``get_config``.

    Parameters
    ----------
    value
        A single encoding value, or a codec

    Returns
    -------
    Any
        Zarr's mapping for a codec, else ``value`` unchanged
    """
    if isinstance(value, tuple):
        return tuple(_describe_codec(item) for item in value)
    if isinstance(value, list):
        return [_describe_codec(item) for item in value]

    for method_name in ("to_dict", "get_config"):
        method = getattr(value, method_name, None)
        if not callable(method):
            continue
        try:
            return method()
        except Exception as exc:
            logger.warning(f"Could not describe codec {value!r}: {exc!r}")
            return repr(value)

    return value


def _hdf5_filters_from_encoding(
    data_array: xr.DataArray | xr.Dataset,
) -> dict[str, Any]:
    """Build a filters() -shaped mapping from xarray encoding keys.

    h5netcdf 1.8 exposes ``Variable.filters()``; netCDF4-python already copies
    the same keys onto ``DataArray.encoding``. Reconstructing from encoding
    avoids reopening the file per variable and stays silent when filters() is
    missing.
    """
    try:
        encoding = getattr(data_array, "encoding", None) or {}
        return {
            key: encoding[key] for key in HDF5_FILTER_ENCODING_KEYS if key in encoding
        }
    except Exception as exc:
        logger.debug("Could not collect HDF5 filter encoding: %r", exc)
        return {}


def collect_dataarray_attributes(
    data_array: xr.DataArray | xr.Dataset,
    *,
    show_xarray_encoding_attributes: bool,
) -> dict[str, Any]:
    """Merge attrs and optional xarray encoding metadata for UI display."""
    items: list[tuple[str, Any]] = [(str(k), v) for k, v in data_array.attrs.items()]
    if show_xarray_encoding_attributes:
        items.extend(
            ("__xarray_encoding." + str(k), _describe_codec(v))
            for k, v in data_array.encoding.items()
        )
        items.extend(
            ("__xarray_encoding.filters." + str(k), v)
            for k, v in _hdf5_filters_from_encoding(data_array).items()
        )
    return dict(items)
