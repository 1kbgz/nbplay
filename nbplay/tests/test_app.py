import asyncio
import io
import json
import zipfile

import pytest
from starlette.testclient import TestClient

import nbplay
from nbplay.app import Standalone, build, default_layout, demo_session, main, panel_titles, panel_widgets


def _instrument(tree, panel):
    layout = tree["slots"]["default"][1]
    frame = next(child for child in layout["slots"]["default"] if child["props"]["name"] == {"Str": panel})
    return frame["slots"]["default"][0]


class TestApp:
    def test_panels_name_the_session_and_track_widgets(self):
        session = nbplay.Session()
        try:
            session.add_track("Lead Synth", nbplay.SequencerWidget(autosync=False), nbplay.SynthWidget(autosync=False))
            session.add_track("Lead Synth", sound_source=nbplay.SynthWidget(autosync=False))
            session.add_track("Vocals", armed=True)
            panels = panel_widgets(session)
            assert list(panels) == [
                "transport",
                "launcher",
                "timeline",
                "mixer",
                "midi",
                "keyboard",
                "lead-synth-sequencer",
                "lead-synth-synth",
                "lead-synth-synth-2",
            ]
            assert panels["lead-synth-synth"] is session.tracks[0].sound_source and panels["midi"] is session.midi_router
            assert list(panel_titles(session).values()) == [
                "Transport",
                "Launcher",
                "Timeline",
                "Mixer",
                "MIDI",
                "Keyboard",
                "Lead Synth sequencer",
                "Lead Synth synth",
                "Lead Synth synth 2",
            ]
            layout = default_layout(list(panels))
            assert layout["children"][2]["tabs"] == ["lead-synth-sequencer", "lead-synth-synth", "lead-synth-synth-2"]
            assert layout["children"][0]["tabs"] == ["transport"] and layout["children"][1]["children"][1]["tabs"] == ["timeline"]
            assert layout["children"][1]["children"][2]["tabs"] == ["mixer", "midi", "keyboard"]
            assert len(default_layout(["transport", "launcher", "timeline", "mixer", "midi", "keyboard"])["children"]) == 2
        finally:
            session.close()

    def test_widget_tree_and_wires_take_a_prefix(self):
        widget = nbplay.TransportWidget(autosync=False)
        try:
            node = widget.tree("lead.").to_node()
            assert node["bindings"]["bpm"]["field"] == "lead.config.bpm"
            assert node["bindings"]["undoRequest"] == {"field": "lead.status.undo_request", "mode": "two-way", "event": "nbplay-request"}
            assert [child["props"]["namespace"] for child in node["slots"]["default"] if child["tag"] == "nbplay-wire"] == [{"Str": "lead.status"}]
            wires = widget.wires("lead.", url="/ws/lead")
            assert [(w.url, w.namespace, w.model) for w in wires] == [
                ("/ws/lead", "lead.config", widget.config_id),
                ("/ws/lead", "lead.status", widget.status_id),
            ]
            assert widget.wires() == [{"model": widget.config_id, "namespace": "config"}, {"model": widget.status_id, "namespace": "status"}]
        finally:
            widget.close()

    def test_served_page_binds_every_panel_and_provides_its_wires(self):
        session = demo_session()
        try:
            app = build(session, probes=True)
            with TestClient(app) as client:
                html = client.get("/").text
                assert "/ws/transport" in html and "/ws/beat-drums" in html
                assert 'namespace: "transport.config", url: "/ws/transport"' in html
                bundle = client.get("/components/nbplay/index.js")
                assert bundle.status_code == 200 and bundle.headers["cache-control"] == "no-cache"
                assert "cache-control" not in client.get("/state").headers
                tree = client.get("/tree.json").json()
                assert tree["tag"] == "div" and tree["bindings"]["root-attr:data-nbplay-theme"]["field"] == "transport.config.theme"
                bar, layout, palette = tree["slots"]["default"]
                assert bar["tag"] == "header" and layout["tag"] == "spaday-regular-layout"
                # The palette lists every panel and reopens the picked one; the bar's button opens it.
                assert palette["tag"] == "nbplay-palette"
                commands = [command["Map"] for command in palette["props"]["commands"]["List"]]
                assert {command["id"]["Str"]: command["label"]["Str"] for command in commands} == panel_titles(session)
                # The tabs take their titles from regular-layout's per-panel custom properties.
                assert '--regular-layout-beat-drums--title: "Beat drums"' in layout["props"]["style"]["Str"]
                assert palette["events"]["nbplay-request"] == {
                    "kind": "invoke",
                    "target": {"ref": "id", "id": layout["props"]["id"]["Str"]},
                    "method": "openPanel",
                    "args": [{"expr": "event-prop", "path": "detail.name"}],
                }
                hint = bar["slots"]["default"][1]
                assert hint["tag"] == "nbplay-palette-hint" and hint["props"]["label"] == {"Str": "panels"}
                assert hint["events"]["click"] == {"kind": "invoke", "target": {"ref": "id", "id": palette["props"]["id"]["Str"]}, "method": "show"}
                tracks, save, load = bar["slots"]["default"][2:5]
                assert tracks["tag"] == "nbplay-tracks" and tracks["props"]["url"] == {"Str": "tracks"}
                assert [name["Str"] for name in tracks["props"]["tracks"]["List"]] == ["Lead", "Bass", "Beat"]
                assert save["tag"] == "a" and save["props"]["href"] == {"Str": "session.nbplay"} and "download" in save["props"]
                assert load["tag"] == "nbplay-upload" and load["props"]["url"] == {"Str": "session.nbplay"}
                select = bar["slots"]["default"][5]["slots"]["default"][1]
                assert select["tag"] == "select" and select["bindings"]["value"] == {"field": "transport.config.theme", "mode": "two-way"}
                assert [option["props"]["value"]["Str"] for option in select["slots"]["default"]] == list(nbplay.THEMES)
                transport = _instrument(tree, "transport")
                assert transport["tag"] == "nbplay-transport" and transport["bindings"]["bpm"]["field"] == "transport.config.bpm"
                drums = _instrument(tree, "beat-drums")
                assert drums["bindings"]["samples"]["field"] == "beat-drums.config.samples"
                state = client.get("/state").json()
                assert state["lead-sequencer"]["config"]["length"] == 16 and state["transport"]["status"]["is_playing"] is False
                (sample,) = state["beat-drums"]["config"]["samples"].values()
                assert sample["data"] == {"bytes": 4000 * 4}
                assert client.post("/set/transport/bpm", json={"value": 99}).json() == {"value": 99.0}
                assert session.transport.config.bpm == 99.0
                assert isinstance(client.post("/command/transport/play").json()["result"], int)
        finally:
            session.close()

    def test_served_app_saves_the_session_and_loads_another(self):
        app = build(demo_session(), probes=True)
        with TestClient(app) as client:
            first = app.state.session
            first.bpm = 87.0
            saved = client.get("/session.nbplay")
            assert saved.status_code == 200 and "session.nbplay" in saved.headers["content-disposition"]
            assert nbplay.Session.load(io.BytesIO(saved.content)).bpm == 87.0

            # An upload that is not an archive is refused and the session stays.
            refused = client.put("/session.nbplay", content=b"not a zip")
            assert refused.status_code == 400 and refused.json()["error"].startswith("Not a session archive")
            assert app.state.session is first

            # A different session replaces the served one: its panels, page, sockets and probes.
            other = nbplay.Session(bpm=140.0, theme="grim")
            other.add_track("Bass", nbplay.SequencerWidget(length=8), nbplay.SynthWidget())
            archive = io.BytesIO()
            other.save(archive)
            other.close()
            loaded = client.put("/session.nbplay", content=archive.getvalue())
            assert loaded.json() == {"panels": ["transport", "launcher", "timeline", "mixer", "midi", "keyboard", "bass-sequencer", "bass-synth"]}
            assert app.state.session is not first and app.state.session.bpm == 140.0
            html = client.get("/").text
            assert "/ws/bass-synth" in html and "/ws/beat-drums" not in html
            state = client.get("/state").json()
            assert state["transport"]["config"]["theme"] == "grim" and state["bass-sequencer"]["config"]["length"] == 8
            with client.websocket_connect("/ws/bass-synth?codec=json&ownership=1") as socket:
                assert socket.receive_text()
            # The loaded session saves like the first.
            assert nbplay.Session.load(io.BytesIO(client.get("/session.nbplay").content)).bpm == 140.0
        app.state.session.close()

    def test_the_track_menu_adds_and_removes_tracks(self):
        app = build(demo_session(), probes=True)
        with TestClient(app) as client:
            session = app.state.session
            added = client.post("/tracks", json={"action": "add", "name": "Keys", "instrument": "fm", "notes": "arpeggiator"})
            assert added.status_code == 200 and "keys-arpeggiator" in added.json()["panels"]
            track = session.tracks[-1]
            assert (track.name, type(track.sequencer).__name__, type(track.sound_source).__name__) == ("Keys", "ArpeggiatorWidget", "FMSynthWidget")
            # The rebuilt page has the new panels and the menu lists the track.
            assert "/ws/keys-fm-synth" in client.get("/").text
            assert '"Keys"' in client.get("/tree.json").text
            with client.websocket_connect("/ws/keys-fm-synth?codec=json&ownership=1") as socket:
                assert socket.receive_text()
            # A track with no name is numbered; one with no instrument has none.
            assert client.post("/tracks", json={"action": "add", "instrument": "none", "notes": "sequencer"}).status_code == 200
            assert (session.tracks[-1].name, session.tracks[-1].sound_source) == ("Track 5", None)
            removed = client.post("/tracks", json={"action": "remove", "index": 1})
            assert removed.status_code == 200 and "bass-synth" not in removed.json()["panels"]
            assert [t.name for t in session.tracks] == ["Lead", "Beat", "Keys", "Track 5"]
            for bad in ({"action": "add", "instrument": "theremin"}, {"action": "remove", "index": 9}, {"action": "rename"}, ["add"]):
                refused = client.post("/tracks", json=bad)
                assert refused.status_code == 400 and refused.json()["error"]
        app.state.session.close()

    def test_the_standalone_page_changes_tracks_for_a_reload(self):
        host = Standalone(demo_session())
        try:
            assert host.change_tracks(json.dumps({"action": "add", "name": "Pad", "instrument": "sampler", "notes": "none"})) == ""
            assert host.session.tracks[-1].name == "Pad"
            assert host.change_tracks(json.dumps({"action": "remove", "index": 99})) == "no track 99"
            # The page saves the changed session and reloads onto it.
            reloaded = Standalone.load(host.save())
            try:
                assert "pad-sampler" in reloaded.panels
            finally:
                reloaded.session.close()
        finally:
            host.session.close()

    def test_save_waits_for_the_browser_to_export_recorded_clips(self, monkeypatch):
        from test_widgets import browser_writes

        session = demo_session()
        take = session.timeline.add_clip("Take", audio_url="blob:take")

        sleep = asyncio.sleep

        async def browser_exports(delay):
            # The patch reaches every asyncio.sleep, so it still has to yield to the loop.
            if session.timeline.pending_exports:
                browser_writes(session.timeline, exported_clip={"id": take["id"], "blob_type": "audio/webm"}, exported_clip_data=b"take")
            await sleep(0.001)

        monkeypatch.setattr("nbplay.app.asyncio.sleep", browser_exports)
        app = build(session)
        with TestClient(app) as client:
            saved = zipfile.ZipFile(io.BytesIO(client.get("/session.nbplay").content))
            assert [saved.read(name) for name in saved.namelist() if name.startswith("clips/")] == [b"take"]
        session.close()

    def test_standalone_page_has_the_session_file_controls(self):
        host = Standalone(demo_session())
        try:
            bar = json.loads(host.page())["tree"]["slots"]["default"][0]
            assert [child["tag"] for child in bar["slots"]["default"]] == [
                "span",
                "nbplay-palette-hint",
                "nbplay-tracks",
                "a",
                "nbplay-upload",
                "label",
            ]
        finally:
            host.session.close()

    def test_standalone_saves_and_loads_the_session_archive(self):
        host = Standalone(demo_session())
        try:
            host.session.bpm = 111
            assert host.pending_exports() == 0
            archive = host.save()
            assert "session.json" in zipfile.ZipFile(io.BytesIO(archive)).namelist()
        finally:
            host.session.close()
        loaded = Standalone.load(archive, title="mine")
        try:
            assert loaded.session.transport.config.bpm == 111
            assert list(loaded.panels) == list(panel_widgets(loaded.session))
            assert "mine" in loaded.page()
        finally:
            loaded.session.close()
        with pytest.raises(ValueError, match="Not a session archive"):
            Standalone.load(b"not a zip")

    def test_served_page_provides_its_wires_to_the_root(self):
        session = demo_session()
        try:
            with TestClient(build(session)) as client:
                html = client.get("/").text
                assert 'provideWires(document.body, [{ client: client0, link: link0, store, namespace: "transport.config" }' in html
        finally:
            session.close()

    def test_standalone_host_passes_frames_without_a_server(self):
        host = Standalone(demo_session())
        try:
            page = json.loads(host.page())
            assert page["tree"]["tag"] == "div" and "spaday-regular-layout.nbplay" in page["style"]
            transport = host.panels["transport"]
            assert page["panels"]["transport"] == [
                {"model": transport.config_id, "namespace": "transport.config"},
                {"model": transport.status_id, "namespace": "transport.status"},
            ]
            opening = json.loads(host.open())
            assert set(opening) == set(host.panels) and all(opening.values())
            # A browser edit is validated by the model; the session mirrors the theme to every panel.
            edit = {
                "t": "patch",
                "id": transport.config_id,
                "patch": {"rev": 0, "ops": [{"Set": {"path": [{"Key": "theme"}], "value": {"Str": "grim"}}}]},
            }
            replies = json.loads(host.receive("transport", json.dumps({**edit, "proposal": "p1"})))
            assert host.session.mixer.config.theme == "grim"
            assert "transport" in replies and "mixer" in replies and "beat-drums" in replies
            invalid = {**edit, "patch": {"rev": 0, "ops": [{"Set": {"path": [{"Key": "bpm"}], "value": {"Float": -5.0}}}]}, "proposal": "p2"}
            host.receive("transport", json.dumps(invalid))
            assert transport.config.bpm == 120.0
            # A Python call issues a command frame for the page to deliver.
            assert '"command"' in "".join(json.loads(host.call("transport", "play"))["transport"])
        finally:
            host.session.close()

    def test_command_line_serves_the_demo(self, monkeypatch):
        served = {}
        monkeypatch.setattr("uvicorn.run", lambda app, **options: served.update(options, app=app))
        main(["--port", "8123"])
        assert served["port"] == 8123 and served["host"] == "127.0.0.1" and served["app"] is not None
