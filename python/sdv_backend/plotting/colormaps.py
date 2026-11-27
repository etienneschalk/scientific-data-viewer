"""Colormap names of the ``cmap`` plot control.

A name without prefix is a matplotlib colormap, left to xarray / matplotlib
as before. ``seaborn:<name>`` is a seaborn colormap or palette string
(``seaborn:rocket``, ``seaborn:mako_r``, ``seaborn:light:seagreen``,
``seaborn:ch:s=.25,rot=-.25``): anything ``seaborn.color_palette(<name>,
as_cmap=True)`` accepts. Only the first colon separates the prefix.

seaborn is optional: it is imported only for a ``seaborn:`` name (it imports
pandas and takes time), and a missing seaborn or an unknown name gives a
one-line error instead of a traceback. Importing seaborn does not change the
matplotlib style (only ``seaborn.set_theme()`` does).
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from matplotlib.colors import Colormap

SEABORN_PREFIX = "seaborn:"

SEABORN_EXAMPLES = "seaborn:rocket, seaborn:mako_r, seaborn:light:seagreen"


class ColormapError(ValueError):
    """A ``cmap`` name that cannot be resolved; the message says what to do."""

    def __init__(self, cmap: str, reason: str) -> None:
        super().__init__(f"cmap={cmap}: {reason}")
        self.cmap = cmap
        self.reason = reason


def seaborn_name(cmap: str | None) -> str | None:
    """The seaborn part of a ``seaborn:`` name (prefix in any case), else None."""
    if cmap is None:
        return None
    text = cmap.strip()
    if text[: len(SEABORN_PREFIX)].lower() != SEABORN_PREFIX:
        return None
    return text[len(SEABORN_PREFIX) :].strip()


def resolve_cmap(cmap: str | None) -> "Colormap | None":
    """The colormap object of a ``seaborn:`` name, None for any other name.

    Other names are passed to xarray as text (matplotlib resolves them).

    Raises
    ------
    ColormapError
        seaborn is not installed, or does not know the name.
    """
    name = seaborn_name(cmap)
    if name is None:
        return None
    if not name:
        raise ColormapError(
            SEABORN_PREFIX,
            f"no colormap name after the prefix (e.g. {SEABORN_EXAMPLES})",
        )
    try:
        import seaborn
    except ImportError as exc:
        raise ColormapError(
            SEABORN_PREFIX + name,
            "needs the seaborn package: install it in the viewer's Python "
            "environment (pip install seaborn), or use the extension's own "
            "environment (scientificDataViewer.python.useExtensionOwnEnvironment)",
        ) from exc
    try:
        palette = seaborn.color_palette(name, as_cmap=True)
    except Exception as exc:  # seaborn raises ValueError, palette strings others
        raise ColormapError(
            SEABORN_PREFIX + name,
            f"not a seaborn colormap or palette ({exc}). Examples: {SEABORN_EXAMPLES}",
        ) from exc
    from matplotlib.colors import Colormap, ListedColormap

    if isinstance(palette, Colormap):
        return palette
    # Qualitative palettes (deep, pastel, Set2...) come back as a color list
    return ListedColormap(list(palette), name=name)


def get_colormap(cmap: str) -> "Colormap":
    """The colormap of any ``cmap`` name, for code that needs the colors.

    Raises
    ------
    ColormapError
        Unknown matplotlib name, or a ``seaborn:`` name that cannot be resolved.
    """
    resolved = resolve_cmap(cmap)
    if resolved is not None:
        return resolved
    import matplotlib as mpl

    try:
        return mpl.colormaps[cmap.strip()]
    except KeyError as exc:
        raise ColormapError(cmap.strip(), "not a matplotlib colormap") from exc
