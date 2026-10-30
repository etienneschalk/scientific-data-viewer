"""Matplotlib rc settings used for every plot."""

# Set globally for all plots: use scientific notation for large/small numbers
MATPLOTLIB_RC_CONTEXT = {
    "interactive": False,
    "axes.formatter.limits": (-3, 3),
    "axes.formatter.use_mathtext": True,
}
