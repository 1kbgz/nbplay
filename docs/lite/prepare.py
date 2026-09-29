"""Stage the example notebooks for the JupyterLite demo.

Copies ``examples/*.ipynb`` into ``docs/lite/contents`` and prepends one cell
that installs the bundled nbplay wheel with piplite. The repository notebooks
are left untouched: in a regular Jupyter kernel nbplay is already installed,
and a ``%pip install`` line there would reach out to PyPI.
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXAMPLES = ROOT / "examples"
CONTENTS = Path(__file__).resolve().parent / "contents"

INSTALL_SOURCE = [
    "# nbplay runs entirely in your browser: install the bundled wheel first.\n",
    "%pip install -q nbplay\n",
]

README_SOURCE = """# nbplay in your browser

These are the nbplay example notebooks running on JupyterLite with the
Pyodide kernel: the Rust core is compiled to WebAssembly, the widgets are
plain anywidget classes, and audio and MIDI go through your browser's Web
Audio and Web MIDI APIs. Nothing is installed on your machine.

Open any notebook and run it top to bottom. The first cell installs the
bundled nbplay wheel; the first run takes a few seconds while Pyodide loads.
Click a play button before expecting sound: browsers only start audio after
a user gesture. On an iPhone or iPad, Web Audio follows the ringer switch, so
a muted phone stays silent even while the transport runs.
"""


def install_cell() -> dict:
    return {
        "cell_type": "code",
        "execution_count": None,
        "id": "nbplay-install",
        "metadata": {"id": "nbplay-install", "language": "python"},
        "outputs": [],
        "source": INSTALL_SOURCE,
    }


def stage(notebook_path: Path, target: Path) -> None:
    notebook = json.loads(notebook_path.read_text())
    cells = notebook.get("cells", [])
    if not any(cell.get("id") == "nbplay-install" for cell in cells):
        notebook["cells"] = [install_cell(), *cells]
    target.write_text(json.dumps(notebook, indent=1, ensure_ascii=False) + "\n")


LITE_DIR = Path(__file__).resolve().parent
CONFIG = LITE_DIR / "jupyter_lite_config.json"

# Frontend extensions the site needs: the Pyodide kernel itself, the
# ipywidgets manager, and anywidget's module that the manager loads models from.
LABEXTENSIONS = (
    "@jupyterlite/pyodide-kernel-extension",
    "@jupyter-widgets/jupyterlab-manager",
    "anywidget",
)


def labextension_dirs() -> list[str]:
    """Resolve lab extension directories that ``jupyter lite build`` would miss.

    The build only scans ``sys.prefix``; on installs where Jupyter data lives
    elsewhere (Homebrew, user site) the kernel and widget frontends would be
    missing from the site. Extensions under ``sys.prefix`` are left to the
    build's own discovery so they are not listed twice.
    """
    from jupyter_core.paths import jupyter_path

    prefix = Path(sys.prefix).resolve()
    found = []
    for name in LABEXTENSIONS:
        for base in jupyter_path("labextensions"):
            candidate = Path(base) / name
            if not (candidate / "package.json").exists():
                continue
            if not candidate.resolve().is_relative_to(prefix):
                found.append(str(candidate))
            break
        else:
            raise SystemExit(f"lab extension {name} is not installed; pip install anywidget ipywidgets jupyterlite-pyodide-kernel")
    return found


def write_config() -> None:
    config = {
        "LiteBuildConfig": {
            "apps": ["lab", "tree"],
            "no_sourcemaps": True,
            "federated_extensions": labextension_dirs(),
        }
    }
    CONFIG.write_text(json.dumps(config, indent=2) + "\n")


def main() -> int:
    if CONTENTS.exists():
        shutil.rmtree(CONTENTS)
    CONTENTS.mkdir(parents=True)
    write_config()
    notebooks = sorted(EXAMPLES.glob("[0-9][0-9]_*.ipynb"))
    if not notebooks:
        print("no example notebooks found", file=sys.stderr)
        return 1
    for notebook_path in notebooks:
        stage(notebook_path, CONTENTS / notebook_path.name)
    (CONTENTS / "README.md").write_text(README_SOURCE)
    print(f"staged {len(notebooks)} notebooks in {CONTENTS.relative_to(ROOT)}; config in {CONFIG.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
