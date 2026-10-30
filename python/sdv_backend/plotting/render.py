"""Matplotlib setup and figure rendering to a base64 PNG."""

import base64
import datetime
from io import BytesIO
from types import ModuleType

from sdv_backend._bootstrap import logger
from sdv_backend.plotting.selection import DatetimeSelection


def setup_pyplot(style: str) -> tuple[ModuleType, ModuleType]:
    """Import matplotlib headless and apply ``style``; returns ``(mpl, plt)``.

    Imported lazily because matplotlib is only needed in plot mode.
    """
    import matplotlib as mpl

    # Use non-interactive backend so plotting works headless (e.g. in VSCode)
    # and we avoid "Current Serial #N" / figure-manager errors from GUI backends.
    mpl.use("Agg")
    import matplotlib.pyplot as plt

    # Apply matplotlib style provided by VSCode extension
    if style and style.strip():
        try:
            logger.info(f"Using matplotlib style: {style}")
            plt.style.use(style)
        except Exception as exc:
            logger.warning(f"Failed to apply style '{style}': {exc}, using default")
            plt.style.use("default")
    else:
        logger.info("No style specified, using default")
        plt.style.use("default")
    return mpl, plt


def build_suptitle(
    variable_name: str,
    selection: DatetimeSelection,
    start_datetime: str | None,
    end_datetime: str | None,
) -> str:
    """Title with variable name, creation date and the time range when it applies."""
    now = datetime.datetime.now(datetime.timezone.utc)
    lines = [
        f"Variable: {variable_name}",
        f"Creation date: {now.isoformat().replace('+00:00', 'Z')}",
    ]
    # Only include start/end time if the datetime variable is actually being used
    if selection.is_used():
        if start_datetime:
            lines.append(
                f"Start Time: {start_datetime} ({selection.datetime_var_name})"
            )
        if end_datetime:
            lines.append(f"End Time: {end_datetime} ({selection.datetime_var_name})")
    return "\n".join(lines)


def figure_to_base64_png(plt: ModuleType, suptitle: str) -> str:
    """Add the suptitle, save the current figure as PNG and close all figures."""
    plt.suptitle(suptitle, y=1.20)
    buffer = BytesIO()
    plt.savefig(buffer, format="png", dpi=100, bbox_inches="tight")
    buffer.seek(0)
    image_base64 = base64.b64encode(buffer.getvalue()).decode()
    plt.close("all")
    return image_base64
