"""GeoTIFF and Cloud Optimized GeoTIFF (COG) detection."""

from pathlib import Path

from sdv_backend._bootstrap import logger

GEOTIFF_EXTENSIONS: frozenset[str] = frozenset({".tif", ".tiff", ".geotiff"})


COG_DISPLAY_NAME = "Cloud Optimized GeoTIFF (COG)"


def looks_like_cloud_optimized_geotiff(path: Path) -> bool:
    """Return True when GDAL/rasterio reports a Cloud Optimized GeoTIFF.

    Detection is best-effort: ``LAYOUT=COG`` (profile or IMAGE_STRUCTURE tags),
    or a tiled GeoTIFF with internal overviews. Failures fall back to GeoTIFF.
    """
    if path.suffix.lower() not in GEOTIFF_EXTENSIONS:
        return False
    try:
        import rasterio
    except ImportError:
        return False
    try:
        with rasterio.open(path) as src:
            if src.driver != "GTiff":
                return False
            if src.profile.get("layout") == "COG":
                return True
            image_structure = src.tags(ns="IMAGE_STRUCTURE")
            if image_structure.get("LAYOUT") == "COG":
                return True
            return bool(src.profile.get("tiled") and src.overviews(1))
    except Exception as exc:
        logger.debug("Could not inspect GeoTIFF for COG layout: %r", exc)
        return False


def refine_geotiff_display_name(path: Path, display_name: str) -> str:
    """Upgrade generic GeoTIFF label to COG when rasterio detects one."""
    if display_name != "GeoTIFF":
        return display_name
    if looks_like_cloud_optimized_geotiff(path):
        return COG_DISPLAY_NAME
    return display_name
