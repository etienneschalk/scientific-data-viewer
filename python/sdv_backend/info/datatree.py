"""DataTree traversal helpers (paths, inherited coordinates, flattening)."""

from typing import Literal

import xarray as xr

from sdv_backend.types import DictOfDatasets


def _datatree_inherit_mode(
    show_inherited_coordinates: bool,
) -> bool | Literal["all_coords"]:
    """xarray DataTree.to_dataset inherit argument for the viewer setting."""
    return "all_coords" if show_inherited_coordinates else False


def _datatree_node_path(node: xr.DataTree) -> str:
    """Absolute group path as used in flattened viewer keys (``/``, ``/group``)."""
    path = getattr(node, "path", None) or "/"
    if path in (".", ""):
        return "/"
    if not str(path).startswith("/"):
        return "/" + str(path)
    return str(path)


def _coord_defined_at(node: xr.DataTree, coord_name: str) -> str:
    """Path of the nearest ancestor (or self) that defines ``coord_name``."""
    local = node.to_dataset(inherit=False)
    if coord_name in local.coords:
        return _datatree_node_path(node)
    for ancestor in node.parents:
        if coord_name in ancestor.to_dataset(inherit=False).coords:
            return _datatree_node_path(ancestor)
    return "/"


def inherited_coord_sources(
    xdt: xr.DataTree,
    *,
    show_inherited_coordinates: bool,
) -> dict[str, dict[str, str]]:
    """Map group path → {coord name → defining group path} for inherited coords."""
    if not show_inherited_coordinates:
        return {}
    sources: dict[str, dict[str, str]] = {}
    for _key, node in xdt.subtree_with_keys:
        group = _datatree_node_path(node)
        local_names = set(node.to_dataset(inherit=False).coords)
        inherited = node.to_dataset(inherit="all_coords")
        mapping: dict[str, str] = {}
        for name in inherited.coords:
            coord_name = str(name)
            if coord_name in local_names:
                continue
            mapping[coord_name] = _coord_defined_at(node, coord_name)
        if mapping:
            sources[group] = mapping
    return sources


def _flatten_datatree_groups(
    xdt: xr.DataTree,
    *,
    order_groups_alphabetically: bool,
    show_inherited_coordinates: bool = True,
) -> DictOfDatasets:
    """Flatten a DataTree to datasets, optionally sorting group paths.

    Uses ``DataTree.to_dataset(inherit=...)`` so child groups can include
    parent coordinates (``inherit='all_coords'``, xarray 2026.04+).
    """
    inherit = _datatree_inherit_mode(show_inherited_coordinates)
    items: list[tuple[str, xr.Dataset]] = [
        (_datatree_node_path(node), node.to_dataset(inherit=inherit))
        for _key, node in xdt.subtree_with_keys
    ]
    if order_groups_alphabetically:
        items.sort(key=lambda item: item[0])
    return dict(items)
