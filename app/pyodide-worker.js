// The Python side of the static nbplay example: Pyodide in a Web Worker. It
// installs the wheels, builds the demo session, and passes transports wire
// frames between the page and nbplay.app.Standalone.
const PYODIDE_VERSION = "314.0.4";
// A session the page loads is checked here, kept in the Cache API across the
// page reload, and used once by the next worker in place of the demo session.
const CACHE = "nbplay-session";
const LOADED = "./loaded.nbplay";
let app;
let check;

async function takeLoaded() {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(LOADED);
  if (!hit) return undefined;
  await cache.delete(LOADED);
  return new Uint8Array(await hit.arrayBuffer());
}

const ready = (async () => {
  self.postMessage({ type: "status", message: "Loading Pyodide…" });
  const { loadPyodide } = await import(
    `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.mjs`
  );
  const pyodide = await loadPyodide();
  await pyodide.loadPackage("micropip");

  self.postMessage({ type: "status", message: "Installing nbplay…" });
  const response = await fetch(new URL("./wheels.json", self.location.href));
  if (!response.ok)
    throw new Error(`wheel manifest returned ${response.status}`);
  const wheels = Object.values(await response.json()).map(
    (path) => new URL(path, self.location.href).href,
  );
  pyodide.globals.set("wheels_json", JSON.stringify(wheels));
  await pyodide.runPythonAsync(`
import json
import micropip

await micropip.install(json.loads(wheels_json))

from nbplay.app import Standalone, demo_session


def start(archive=None):
    return Standalone(demo_session()) if archive is None else Standalone.load(archive.to_bytes())


def check(archive):
    try:
        Standalone.load(archive.to_bytes()).session.close()
    except ValueError as error:
        return str(error)
    return ""
`);
  check = pyodide.globals.get("check");
  app = pyodide.globals.get("start")(await takeLoaded());
  return JSON.parse(app.page());
})();

let queue = Promise.resolve();

async function handle(message) {
  const page = await ready;
  if (message.type === "start") {
    self.postMessage({ type: "snapshot", payload: page });
  } else if (message.type === "open") {
    self.postMessage({ type: "wires", wires: JSON.parse(app.open()) });
  } else if (message.type === "wire") {
    const wires = JSON.parse(app.receive(message.panel, message.frame));
    self.postMessage({ type: "wires", wires });
  } else if (message.type === "call") {
    const wires = JSON.parse(app.call(message.panel, message.method));
    self.postMessage({ type: "wires", wires });
  } else if (message.type === "save") {
    // Recorded clip audio stays in the page until it is exported: ask for
    // it, then give the page five seconds to send it.
    const wires = JSON.parse(app.call("timeline", "export_all_clips"));
    self.postMessage({ type: "wires", wires });
    collect(100);
  } else if (message.type === "load") {
    const error = check(message.bytes);
    if (!error) {
      const cache = await caches.open(CACHE);
      await cache.put(LOADED, new Response(message.bytes));
    }
    self.postMessage({ type: "loaded", error });
  }
}

// Wait outside the queue, so the page's export frames are applied in between.
function collect(waits) {
  setTimeout(() => {
    queue = queue
      .then(() => {
        if (app.pending_exports() && waits) return collect(waits - 1);
        const archive = app.save();
        const bytes = archive.toJs();
        archive.destroy();
        self.postMessage({ type: "archive", bytes }, [bytes.buffer]);
      })
      .catch(report);
  }, 50);
}

function report(error) {
  self.postMessage({ type: "error", message: String(error) });
}

self.addEventListener("message", (event) => {
  queue = queue.then(() => handle(event.data)).catch(report);
});
