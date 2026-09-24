// Copy the host smoke notebook into dist/hosts so JupyterLab's autosave
// writes to a scratch copy instead of the tracked fixture.
import fs from "fs";
import path from "path";

const source = path.resolve("tests/fixtures/host_smoke.ipynb");
const outDir = path.resolve("dist/hosts");
fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(source, path.join(outDir, "host_smoke.ipynb"));
