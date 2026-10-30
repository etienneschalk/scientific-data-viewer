"""Attribute and xarray encoding collection (codecs described by name)."""

from typing import Any

import xarray as xr

from sdv_backend._bootstrap import logger


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


def collect_attributes(data_array: xr.DataArray | xr.Dataset) -> dict[str, Any]:
    """``attrs`` of a variable, coordinate or group, with string keys."""
    return {str(k): v for k, v in data_array.attrs.items()}


def collect_encoding(data_array: xr.DataArray | xr.Dataset) -> dict[str, Any]:
    """xarray ``encoding`` of a variable, coordinate or group, for UI display.

    Shown in its own "Xarray Encoding" section, apart from the attributes.
    Codecs are described by name (see ``_describe_codec``). HDF5 filters
    (``zlib``, ``complevel``, ``shuffle``...) are already encoding keys with
    both the netcdf4 and h5netcdf engines.
    """
    return {str(k): _describe_codec(v) for k, v in data_array.encoding.items()}
