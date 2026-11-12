"""Serve a :class:`Session` as a web page with every instrument in a resizable panel.

The widgets are the same objects a notebook displays: each hosts its models in
its own transports session, which the app serves over one WebSocket per
instrument, and the page binds each element to those models under the panel's
namespace. The panels are a `regular-layout` split/tab tree that the browser
can rearrange.

``python -m nbplay.app`` serves a demo session on http://127.0.0.1:8020.

The same page also runs with no server: :func:`export` writes a static site
whose Python side (the session and its models) runs in Pyodide inside a Web
Worker, with ``postMessage`` in place of the WebSockets
(``python -m nbplay.app --export DIR --wheel nbplay-...wasm32.whl``).
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
from importlib import import_module
from pathlib import Path

import transports
from spaday import element
from spaday_regular_layout import RegularLayout, RegularLayoutFrame, package as layout_package

from .components import package as nbplay_package
from .descriptors import THEMES
from .widget import InstrumentWidget, SamplerWidget, SequencerWidget, Session, SynthWidget

__all__ = ("Standalone", "build", "default_layout", "demo_session", "export", "panel_widgets")

#: The page chrome follows the nbplay tokens: the document root carries the
#: session theme, and regular-layout's own tokens map onto nbplay's.
APP_CSS = """
html, body { margin: 0; height: 100%; background: var(--nbplay-bg); color: var(--nbplay-fg); }
.nbplay-app {
  display: flex; flex-direction: column; height: 100vh;
  font-family: var(--nbplay-font); font-size: var(--nbplay-font-size); color: var(--nbplay-fg);
}
.nbplay-app-bar {
  display: flex; align-items: center; gap: 12px; padding: 6px 12px;
  background: var(--nbplay-bg-panel); border-bottom: 1px solid var(--nbplay-border);
}
.nbplay-app-title { font-weight: 700; letter-spacing: 0.5px; }
.nbplay-app-bar label {
  display: flex; align-items: center; gap: 6px; margin-left: auto;
  font-family: var(--nbplay-font-mono); font-size: var(--nbplay-font-size-small); color: var(--nbplay-fg-muted);
}
.nbplay-app-bar select {
  height: var(--nbplay-control-height); padding: 0 6px; font: inherit;
  background: var(--nbplay-bg-control); color: var(--nbplay-fg);
  border: 1px solid var(--nbplay-border); border-radius: var(--nbplay-radius-control);
}
spaday-regular-layout.nbplay {
  flex: 1 1 auto; min-height: 0; box-sizing: border-box; padding: 4px;
  background: var(--nbplay-bg);
  --spa-regular-layout-surface: var(--nbplay-bg-panel);
  --spa-regular-layout-surface-2: var(--nbplay-bg-raised);
  --spa-regular-layout-border: var(--nbplay-border);
  --spa-regular-layout-muted: var(--nbplay-fg-muted);
  --spa-regular-layout-shadow: transparent;
}
spaday-regular-layout.nbplay regular-layout-frame::part(tab) { font-family: var(--nbplay-font); }
spaday-regular-layout.nbplay regular-layout-frame::part(active-tab) { box-shadow: inset 0 3px var(--nbplay-accent); }
spaday-regular-layout.nbplay regular-layout-frame::part(container) { padding: 6px; }
"""


class _NoCache:
    """Have the browser revalidate the bundles on every load, so a rebuild shows up on reload."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        from starlette.datastructures import MutableHeaders

        if scope["type"] != "http" or not scope["path"].startswith(("/components/", "/js/")):
            return await self.app(scope, receive, send)

        async def send_no_cache(message):
            if message["type"] == "http.response.start":
                MutableHeaders(scope=message)["cache-control"] = "no-cache"
            await send(message)

        await self.app(scope, receive, send_no_cache)


def _slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "track"


def panel_widgets(session):
    """Panel name to widget: the session views, then each track's sequencer and sound source."""
    panels = {"transport": session.transport, "launcher": session.launcher, "timeline": session.timeline, "mixer": session.mixer}
    for track in session.tracks:
        base = _slug(track.name)
        for widget in (track.sequencer, track.sound_source):
            if not isinstance(widget, InstrumentWidget):
                continue
            name = f"{base}-{widget.TAG.removeprefix('nbplay-')}"
            index = 2
            while name in panels:
                name = f"{base}-{widget.TAG.removeprefix('nbplay-')}-{index}"
                index += 1
            panels[name] = widget
    return panels


def default_layout(names):
    """The transport across the top, launcher, timeline and mixer in the middle, instruments below."""
    instruments = [name for name in names if name not in ("transport", "launcher", "timeline", "mixer")]
    rows = [
        {"type": "tab-layout", "tabs": ["transport"]},
        {
            "type": "split-layout",
            "orientation": "horizontal",
            "sizes": [0.25, 0.5, 0.25],
            "children": [
                {"type": "tab-layout", "tabs": ["launcher"]},
                {"type": "tab-layout", "tabs": ["timeline"]},
                {"type": "tab-layout", "tabs": ["mixer"]},
            ],
        },
    ]
    sizes = [0.14, 0.86]
    if instruments:
        rows.append({"type": "tab-layout", "tabs": instruments})
        sizes = [0.12, 0.48, 0.4]
    return {"type": "split-layout", "orientation": "vertical", "sizes": sizes, "children": rows}


def _app_bar(title):
    """Title and a theme select bound to the transport's theme, which the session mirrors to every widget."""
    select = element("select", title="Theme").bind("value", "transport.config.theme", mode="two-way")
    for theme in THEMES:
        select.child(element("option", value=theme).text(theme or "default"))
    return (
        element("header")
        .classes("nbplay-app-bar")
        .child(
            element("span").classes("nbplay-app-title").text(title),
            element("label").child(element("span").text("theme"), select),
        )
    )


def _page(panels, layout, title):
    """The top bar over the panel layout, each panel's element bound under its own namespace."""
    frames = [RegularLayoutFrame(widget.tree(f"{name}."), name=name) for name, widget in panels.items()]
    return (
        element("div")
        .classes("nbplay-app")
        .child(_app_bar(title), RegularLayout(*frames, layout=layout or default_layout(list(panels))).classes("spa nbplay"))
        .bind_root_attr("data-nbplay-theme", "transport.config.theme")
    )


def _jsonable(value):
    if isinstance(value, (bytes, bytearray, memoryview)):
        return {"bytes": len(value)}
    if isinstance(value, dict):
        return {key: _jsonable(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_jsonable(item) for item in value]
    return value


def _probe_routes(panels):
    """Test hooks: read every panel's models, call a widget method, assign a config field."""
    from starlette.responses import JSONResponse
    from starlette.routing import Route

    async def state(request):
        return JSONResponse(
            {
                name: {
                    "config": _jsonable(widget.config.model_dump()),
                    "status": _jsonable(widget.status.model_dump()) if widget.status is not None else None,
                }
                for name, widget in panels.items()
            }
        )

    async def command(request):
        widget = panels[request.path_params["panel"]]
        result = getattr(widget, request.path_params["method"])()
        return JSONResponse({"result": result})

    async def assign(request):
        widget = panels[request.path_params["panel"]]
        body = await request.json()
        setattr(widget.config, request.path_params["field"], body["value"])
        return JSONResponse({"value": getattr(widget.config, request.path_params["field"])})

    return [
        Route("/state", state),
        Route("/command/{panel}/{method}", command, methods=["POST"]),
        Route("/set/{panel}/{field}", assign, methods=["POST"]),
    ]


def build(session, *, layout=None, title="nbplay", probes=False, **options):
    """A Starlette app serving ``session``: one WebSocket per instrument and a panel layout page.

    The page is a top bar (``title`` and a theme select) over the panels.
    ``layout`` is a regular-layout split/tab tree over the panel names from
    :func:`panel_widgets`; ``probes`` adds the JSON routes the browser tests
    drive. Other keyword options go to :func:`spaday.backends.starlette.serve`.
    """
    from spaday.backends.starlette import serve
    from starlette.routing import WebSocketRoute

    panels = panel_widgets(session)
    wires, routes, background = [], [], []
    for name, widget in panels.items():
        url = f"/ws/{name}"
        server = transports.Server(widget.session)
        wires.extend(widget.wires(f"{name}.", url=url))
        routes.append(WebSocketRoute(url, transports.ws_endpoint(server)))
        background.append(transports.autosync(server))
    if probes:
        routes.extend(_probe_routes(panels))
    page = _page(panels, layout, title)
    app = serve(
        lambda: page,
        packages=[nbplay_package, layout_package],
        wire=wires,
        routes=routes,
        background=background,
        title=title,
        styles=[APP_CSS, *options.pop("styles", ())],
        **options,
    )
    app.add_middleware(_NoCache)
    return app


class Standalone:
    """The Python side of the page with no server: what a Pyodide Web Worker runs.

    Each panel's transports server talks to one in-browser connection; the
    worker passes wire frames between this object and the page with
    ``postMessage``. Every method takes and returns JSON text, the form that
    crosses the worker boundary.
    """

    def __init__(self, session, *, layout=None, title="nbplay"):
        self.session = session
        self.panels = panel_widgets(session)
        self.servers = {name: transports.Server(widget.session) for name, widget in self.panels.items()}
        self._page = _page(self.panels, layout, title)

    @classmethod
    def load(cls, spec):
        """Build from ``"module:function"``, a zero-argument callable returning the :class:`Session`."""
        module, _, name = spec.partition(":")
        return cls(getattr(import_module(module), name)())

    def page(self):
        """The tree, the page styles, and each panel's model-to-namespace wires."""
        return json.dumps(
            {
                "tree": self._page.to_node(),
                "style": APP_CSS,
                "panels": {name: widget.wires(f"{name}.") for name, widget in self.panels.items()},
            }
        )

    def open(self):
        """Connect the page to every panel; the frames that bring it up to date, by panel."""
        return json.dumps({name: list(server.open(name, "json", ownership=True)) for name, server in self.servers.items()})

    def receive(self, panel, frame):
        """Apply one frame from the page; the frames to send back, by panel.

        A browser edit can change other widgets' models (the session mirrors
        theme, mute and solo), so every server is flushed.
        """
        return self._flush({panel: list(self.servers[panel].recv(panel, frame).get(panel, []))})

    def call(self, panel, method):
        """Call a widget method (``"transport"``, ``"play"``) the way Python driving the session would; the frames to send."""
        getattr(self.panels[panel], method)()
        return self._flush({})

    def _flush(self, out):
        for name, server in self.servers.items():
            frames = server.flush().get(name, [])
            if frames:
                out.setdefault(name, []).extend(frames)
        return json.dumps(out)


def export(directory, *, session="nbplay.app:demo_session", wheels=(), requirements=()):
    """Write the app as a static site that runs its Python in Pyodide.

    ``session`` names a zero-argument callable (``"module:function"``) that the
    worker imports and calls for the :class:`Session`. ``wheels`` are local
    wheel files to bundle and install first (the nbplay Pyodide wheel, until
    one is on PyPI); ``requirements`` are further micropip requirements. The
    site needs no server beyond static file hosting.
    """
    from spaday import bootstrap

    out = Path(directory)
    out.mkdir(parents=True, exist_ok=True)
    source = Path(__file__).parent / "standalone"
    for name in ("index.html", "worker.js"):
        shutil.copyfile(source / name, out / name)
    # The spaday and transports browser runtimes, at the paths spaday serves them under /js.
    runtime = {key: f"js{path}" for key, path in bootstrap._ASSETS[bootstrap._layout()].items()}
    for path in runtime.values():
        target = out / path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(bootstrap.bundles_dir() / path.removeprefix("js/"), target)
    assets = []
    for package in (nbplay_package, layout_package):
        shutil.copytree(package.assets_dir, out / "components" / package.name, dirs_exist_ok=True)
        assets.extend({"type": kind, "path": f"components/{package.name}/{path}"} for kind, path in package.assets)
    (out / "wheels").mkdir(exist_ok=True)
    bundled = []
    for wheel in map(Path, wheels):
        shutil.copyfile(wheel, out / "wheels" / wheel.name)
        bundled.append(f"wheels/{wheel.name}")
    config = {
        "session": session,
        "wheels": bundled,
        "requirements": ["spaday-regular-layout", *requirements] if bundled else ["nbplay", "spaday-regular-layout", *requirements],
        "runtime": runtime,
        "assets": assets,
    }
    (out / "config.json").write_text(json.dumps(config, indent=2) + "\n")
    return out


def demo_session():
    """Two tracks: a saw lead on a sequencer and a sampler kit with a kick."""
    session = Session(bpm=120.0, theme="studio")
    session.transport.config.loop_enabled = True
    lead_seq = SequencerWidget(length=16, num_voices=2)
    for i, note in enumerate([72, 76, 79, 84, 83, 79, 76, 72, 71, 74, 78, 83, 81, 78, 74, 71]):
        lead_seq.set_step(i, note=note, velocity=88 + (i % 4) * 6, active=i % 2 == 0, voice=0)
    session.add_track("Lead", lead_seq, SynthWidget(oscillator_type="saw", frequency=440.0, amplitude=0.4))
    drums = SamplerWidget(attack=0.002, decay=0.06, sustain=0.2, release=0.08, max_voices=8)
    frames = 4000
    drums.load_sample([((i * 7919) % 200 / 100 - 1) * (1 - i / frames) for i in range(frames)], sample_rate=44100, root_note=36, name="Kick-ish")
    drum_seq = SequencerWidget(length=16)
    for i in range(0, 16, 4):
        drum_seq.set_step(i, note=36, velocity=110)
    session.add_track("Drums", drum_seq, drums)
    session.launcher.add_scene("A")
    session.launcher.set_slot(0, 0, lead_seq, name="Lead A")
    session.launcher.set_slot(1, 0, drum_seq, name="Drums A")
    return session


def main(argv=None):
    parser = argparse.ArgumentParser(description="Serve the nbplay demo session as a web app")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8020)
    parser.add_argument("--probes", action="store_true", help="add the JSON routes the browser tests use")
    parser.add_argument("--export", metavar="DIR", help="write a static site that runs in Pyodide instead of serving")
    parser.add_argument("--wheel", action="append", default=[], help="a wheel to bundle with --export (repeatable)")
    args = parser.parse_args(argv)
    if args.export:
        print(export(args.export, wheels=args.wheel))
        return
    import uvicorn

    uvicorn.run(build(demo_session(), probes=args.probes), host=args.host, port=args.port)


if __name__ == "__main__":
    main()
