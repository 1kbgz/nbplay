import json

import pytest

pytest.importorskip("starlette")
pytest.importorskip("spaday_regular_layout")

from starlette.testclient import TestClient

import nbplay
from nbplay.app import Standalone, build, default_layout, demo_session, main, panel_widgets


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
            assert list(panels) == ["transport", "launcher", "timeline", "mixer", "lead-synth-sequencer", "lead-synth-synth", "lead-synth-synth-2"]
            assert panels["lead-synth-synth"] is session.tracks[0].sound_source
            layout = default_layout(list(panels))
            assert layout["children"][2]["tabs"] == ["lead-synth-sequencer", "lead-synth-synth", "lead-synth-synth-2"]
            assert layout["children"][0]["tabs"] == ["transport"] and layout["children"][1]["children"][1]["tabs"] == ["timeline"]
            assert len(default_layout(["transport", "launcher", "timeline", "mixer"])["children"]) == 2
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
                assert "/ws/transport" in html and "/ws/drums-sampler" in html
                assert 'namespace: "transport.config", url: "/ws/transport"' in html
                bundle = client.get("/components/nbplay/index.js")
                assert bundle.status_code == 200 and bundle.headers["cache-control"] == "no-cache"
                assert "cache-control" not in client.get("/state").headers
                tree = client.get("/tree.json").json()
                assert tree["tag"] == "div" and tree["bindings"]["root-attr:data-nbplay-theme"]["field"] == "transport.config.theme"
                bar, layout = tree["slots"]["default"]
                assert bar["tag"] == "header" and layout["tag"] == "spaday-regular-layout"
                select = bar["slots"]["default"][1]["slots"]["default"][1]
                assert select["tag"] == "select" and select["bindings"]["value"] == {"field": "transport.config.theme", "mode": "two-way"}
                assert [option["props"]["value"]["Str"] for option in select["slots"]["default"]] == list(nbplay.THEMES)
                transport = _instrument(tree, "transport")
                assert transport["tag"] == "nbplay-transport" and transport["bindings"]["bpm"]["field"] == "transport.config.bpm"
                sampler = _instrument(tree, "drums-sampler")
                assert sampler["bindings"]["sampleData"]["field"] == "drums-sampler.config.sample_data"
                state = client.get("/state").json()
                assert state["lead-sequencer"]["config"]["length"] == 16 and state["transport"]["status"]["is_playing"] is False
                assert state["drums-sampler"]["config"]["sample_data"] == {"bytes": 4000 * 4}
                assert client.post("/set/transport/bpm", json={"value": 99}).json() == {"value": 99.0}
                assert session.transport.config.bpm == 99.0
                assert isinstance(client.post("/command/transport/play").json()["result"], int)
        finally:
            session.close()

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
            assert "transport" in replies and "mixer" in replies and "drums-sampler" in replies
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
