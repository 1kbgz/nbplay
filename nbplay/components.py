"""The nbplay elements as a spaday component package.

Select it with ``packages="nbplay"`` (the installed entry point) or
``packages="nbplay.components:package"``. The assets are the element bundle
with the ``nbplay-wire`` command bridge and the shared stylesheet, written
by the JavaScript build into ``nbplay/static/spaday/``.
"""

from pathlib import Path

from spaday import ComponentPackage

__all__ = ("package",)

ASSETS = Path(__file__).parent / "static" / "spaday"

package = ComponentPackage(
    name="nbplay",
    assets_dir=ASSETS,
    assets=(("css", "nbplay.css"), ("js", "index.js")),
)
