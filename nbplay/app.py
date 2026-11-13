"""Serve a :class:`Session` as a web page with every instrument in a resizable panel.

The widgets are the same objects a notebook displays: each hosts its models in
its own transports session, which the app serves over one WebSocket per
instrument, and the page binds each element to those models under the panel's
namespace. The panels are a `regular-layout` split/tab tree that the browser
can rearrange.

``python -m nbplay.app`` serves a demo session on http://127.0.0.1:8020.

The same page also runs with no server: :class:`Standalone` is the Python side
for a Pyodide Web Worker, with ``postMessage`` in place of the WebSockets
(``js/examples/pyodide.html``, built by ``make pyodide-example``).
"""

from __future__ import annotations

import argparse
import asyncio
import io
import json
import re
import zipfile

import transports
from spaday import Invoke, by_id, element, event_prop
from spaday_regular_layout import RegularLayout, RegularLayoutFrame, package as layout_package

from .components import package as nbplay_package
from .descriptors import THEMES
from .widget import InstrumentWidget, SamplerWidget, SequencerWidget, Session, SynthWidget

__all__ = ("Standalone", "build", "default_layout", "demo_session", "panel_titles", "panel_widgets")

#: The session archive on the served app: ``GET`` downloads it, ``PUT`` replaces the session.
SESSION_URL = "session.nbplay"

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
  display: flex; align-items: center; gap: 6px;
  font-family: var(--nbplay-font-mono); font-size: var(--nbplay-font-size-small); color: var(--nbplay-fg-muted);
}
.nbplay-app-bar nbplay-palette-hint { margin-left: auto; }
.nbplay-app-bar a {
  display: inline-flex; align-items: center; height: var(--nbplay-control-height); box-sizing: border-box; padding: 0 6px;
  font-family: var(--nbplay-font-mono); font-size: var(--nbplay-font-size-small); color: var(--nbplay-fg-muted); text-decoration: none;
  background: var(--nbplay-bg-control); border: 1px solid var(--nbplay-border); border-radius: var(--nbplay-radius-control);
}
.nbplay-app-bar a:hover { color: var(--nbplay-fg); }
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


def _panels(session):
    """(name, title, widget) per panel: the session views, then each track's sequencer and sound source."""
    panels: list[tuple[str, str, InstrumentWidget]] = [
        (name, name.capitalize(), getattr(session, name)) for name in ("transport", "launcher", "timeline", "mixer")
    ]
    taken = {name for name, _, _ in panels}
    for track in session.tracks:
        for widget in (track.sequencer, track.sound_source):
            if not isinstance(widget, InstrumentWidget):
                continue
            kind = widget.TAG.removeprefix("nbplay-")
            name, title, index = f"{_slug(track.name)}-{kind}", f"{track.name} {kind.replace('-', ' ')}", 2
            while name in taken:
                name, title = f"{_slug(track.name)}-{kind}-{index}", f"{track.name} {kind.replace('-', ' ')} {index}"
                index += 1
            taken.add(name)
            panels.append((name, title, widget))
    return panels


def panel_widgets(session):
    """Panel name to widget: the session views, then each track's sequencer and sound source."""
    return {name: widget for name, _, widget in _panels(session)}


def panel_titles(session):
    """Panel name to the title on its tab: ``Mixer``, or the track's name and the instrument (``Lead synth``)."""
    return {name: title for name, title, _ in _panels(session)}


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


def _app_bar(title, files):
    """Title, a button that opens the panel palette and shows its shortcut, and a theme select.

    The select is bound to the transport's theme, which the session mirrors to every widget.
    ``files`` adds save (a download link) and load (an upload button) for the session archive
    at :data:`SESSION_URL`, which only a server answers.
    """
    files = (
        [
            element("a", href=SESSION_URL, download=SESSION_URL, title="Download the session").text("save"),
            element("nbplay-upload", url=SESSION_URL, label="load", accept=".nbplay", title="Replace the session with a saved one"),
        ]
        if files
        else []
    )
    select = element("select", title="Theme").bind("value", "transport.config.theme", mode="two-way")
    for theme in THEMES:
        select.child(element("option", value=theme).text(theme or "default"))
    return (
        element("header")
        .classes("nbplay-app-bar")
        .child(
            element("span").classes("nbplay-app-title").text(title),
            element("nbplay-palette-hint", label="panels").on("click", Invoke(by_id("nbplay-palette"), "show")),
            *files,
            element("label").child(element("span").text("theme"), select),
        )
    )


def _page(panels, titles, layout, title, files=False):
    """The top bar over the panel layout, each panel's element bound under its own namespace.

    The palette (Ctrl+K or Cmd+K) lists every panel and reopens one the user closed.
    regular-layout labels a tab with the panel name unless the layout sets
    ``--regular-layout-<name>--title`` to a CSS string, which is how the tabs get their titles.
    """
    frames = [RegularLayoutFrame(widget.tree(f"{name}."), name=name) for name, widget in panels.items()]
    commands = [{"id": name, "label": titles[name]} for name in panels]
    palette = element("nbplay-palette", id="nbplay-palette", placeholder="Open a panel", commands=commands)
    tab_titles = {f"regular-layout-{name}--title": json.dumps(titles[name], ensure_ascii=False) for name in panels}
    return (
        element("div")
        .classes("nbplay-app")
        .child(
            _app_bar(title, files),
            RegularLayout(*frames, layout=layout or default_layout(list(panels)), id="nbplay-layout").classes("spa nbplay").css(**tab_titles),
            palette.on("nbplay-request", Invoke(by_id("nbplay-layout"), "openPanel", event_prop("detail.name"))),
        )
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

    The page is a top bar (``title``, the panel palette, save and load, and a
    theme select) over the panels. ``layout`` is a regular-layout split/tab
    tree over the panel names from :func:`panel_widgets`; ``probes`` adds the
    JSON routes the browser tests drive. Other keyword options go to
    :func:`spaday.backends.starlette.build_routes`.

    ``GET /session.nbplay`` downloads the session as a ``.nbplay`` archive and
    ``PUT /session.nbplay`` replaces the served session with an uploaded one,
    after which the page has to be reloaded. ``app.state.session`` is the
    session being served.
    """
    from contextlib import asynccontextmanager

    from spaday.backends.starlette import build_routes
    from starlette.applications import Starlette
    from starlette.responses import JSONResponse, Response
    from starlette.routing import Route, WebSocketRoute

    styles = [APP_CSS, *options.pop("styles", ())]
    servers, tasks = [], []

    def install(session, layout=None):
        """Point the app's routes at ``session``: its page, a WebSocket per panel, and the session archive."""
        panels = panel_widgets(session)
        servers[:] = [transports.Server(widget.session) for widget in panels.values()]
        wires = [wire for name, widget in panels.items() for wire in widget.wires(f"{name}.", url=f"/ws/{name}")]
        routes: list = [WebSocketRoute(f"/ws/{name}", transports.ws_endpoint(server)) for name, server in zip(panels, servers)]
        routes += [Route(f"/{SESSION_URL}", save), Route(f"/{SESSION_URL}", load, methods=["PUT"])]
        if probes:
            routes.extend(_probe_routes(panels))
        page = _page(panels, panel_titles(session), layout, title, files=True)
        app.router.routes[:] = build_routes(
            lambda: page, packages=[nbplay_package, layout_package], wire=wires, routes=routes, title=title, styles=styles, **options
        )
        app.state.session = session

    def sync(running):
        """Start or stop the tasks that flush each panel's server."""
        for task in tasks:
            task.cancel()
        tasks[:] = [asyncio.ensure_future(transports.autosync(server)) for server in servers] if running else []

    async def save(request):
        session = app.state.session
        # Recorded clip audio stays in the browser until it is exported; give a connected page five seconds.
        session.timeline.export_all_clips()
        waits = 100
        while session.timeline.pending_exports and waits:
            await asyncio.sleep(0.05)
            waits -= 1
        archive = io.BytesIO()
        session.save(archive)
        headers = {"content-disposition": f'attachment; filename="{SESSION_URL}"'}
        return Response(archive.getvalue(), media_type="application/zip", headers=headers)

    async def load(request):
        try:
            session = Session.load(io.BytesIO(await request.body()))
        except (zipfile.BadZipFile, KeyError, TypeError, ValueError) as error:
            return JSONResponse({"error": f"Not a session archive: {error}"}, status_code=400)
        sync(False)
        app.state.session.close()
        install(session)
        sync(True)
        return JSONResponse({"panels": list(panel_widgets(session))})

    @asynccontextmanager
    async def lifespan(app):
        sync(True)
        try:
            yield
        finally:
            sync(False)

    app = Starlette(lifespan=lifespan)
    install(session, layout)
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
        self._page = _page(self.panels, panel_titles(session), layout, title)

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
    args = parser.parse_args(argv)
    import uvicorn

    uvicorn.run(build(demo_session(), probes=args.probes), host=args.host, port=args.port)


if __name__ == "__main__":
    main()
