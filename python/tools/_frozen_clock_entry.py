"""Run a backend entry point with ``datetime.datetime.now()`` frozen.

Plot suptitles embed the current time, which makes PNG snapshots
non-reproducible. Used by ``golden_snapshots.py``:

    python _frozen_clock_entry.py <script.py | -m module> <args...>
"""

import datetime as _dt
import runpy
import sys

_Real = _dt.datetime
_FROZEN = _Real(2000, 1, 1, tzinfo=_dt.timezone.utc)


class _Meta(type):
    def __instancecheck__(cls, obj):
        return isinstance(obj, _Real)

    def __subclasscheck__(cls, sub):
        return issubclass(sub, _Real)


class _FrozenDatetime(_Real, metaclass=_Meta):
    @classmethod
    def now(cls, tz=None):
        return _FROZEN if tz else _FROZEN.replace(tzinfo=None)

    @classmethod
    def utcnow(cls):
        return _FROZEN.replace(tzinfo=None)


_dt.datetime = _FrozenDatetime

if sys.argv[1] == "-m":
    module = sys.argv[2]
    sys.argv = [module, *sys.argv[3:]]
    runpy.run_module(module, run_name="__main__", alter_sys=True)
else:
    script = sys.argv[1]
    sys.argv = sys.argv[1:]
    sys.path.insert(0, str(__import__("pathlib").Path(script).resolve().parent))
    runpy.run_path(script, run_name="__main__")
