// The Python side of the static nbplay example: Pyodide in a Web Worker. It
// installs the wheels, builds the demo session, and passes transports wire
// frames between the page and nbplay.app.Standalone.
const PYODIDE_VERSION = "314.0.4";
let app;

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
  app = await pyodide.runPythonAsync(`
import json
import micropip

await micropip.install(json.loads(wheels_json))

from nbplay.app import Standalone, demo_session

Standalone(demo_session())
`);
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
  }
}

self.addEventListener("message", (event) => {
  queue = queue
    .then(() => handle(event.data))
    .catch((error) => {
      self.postMessage({ type: "error", message: String(error) });
    });
});
