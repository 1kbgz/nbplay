// The Python side of the static nbplay app: Pyodide in a Web Worker. It
// installs the wheels, builds the session, and passes transports wire frames
// between the page and nbplay.app.Standalone.
const PYODIDE_VERSION = "314.0.4";
let pyodide;
let app;

const status = (message) => self.postMessage({ type: "status", message });

const ready = (async () => {
  const config = await (await fetch(new URL("config.json", self.location.href))).json();
  status("Loading Pyodide…");
  const { loadPyodide } = await import(`https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.mjs`);
  pyodide = await loadPyodide();
  await pyodide.loadPackage("micropip");
  status("Installing nbplay…");
  const micropip = pyodide.pyimport("micropip");
  const wheels = config.wheels.map((path) => new URL(path, self.location.href).href);
  await micropip.install([...wheels, ...config.requirements]);
  status("Building the session…");
  app = pyodide.pyimport("nbplay.app").Standalone.load(config.session);
  return JSON.parse(app.page());
})();

let queue = Promise.resolve();

async function handle(message) {
  const page = await ready;
  if (message.type === "start") {
    self.postMessage({ type: "page", page });
  } else if (message.type === "open") {
    self.postMessage({ type: "wires", wires: JSON.parse(app.open()) });
  } else if (message.type === "wire") {
    self.postMessage({ type: "wires", wires: JSON.parse(app.receive(message.panel, message.frame)) });
  } else if (message.type === "call") {
    self.postMessage({ type: "wires", wires: JSON.parse(app.call(message.panel, message.method)) });
  }
}

self.addEventListener("message", (event) => {
  queue = queue
    .then(() => handle(event.data))
    .catch((error) => self.postMessage({ type: "error", message: String(error) }));
});
