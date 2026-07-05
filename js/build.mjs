import { bundle } from "./tools/bundle.mjs";
import { bundle_css } from "./tools/css.mjs";
import { node_modules_external } from "./tools/externals.mjs";

import fs from "fs";
import cpy from "cpy";

const BUNDLES = [
  {
    entryPoints: ["src/ts/index.ts"],
    plugins: [node_modules_external()],
    outfile: "dist/esm/index.js",
  },
  {
    entryPoints: ["src/ts/index.ts"],
    outfile: "dist/cdn/index.js",
  },
];

const WIDGET_NAMES = [
  "widget",
  "mixer",
  "sampler",
  "sequencer",
  "timeline",
  "transport",
  "settings",
  "keyboard",
  "midi_keyboard",
  "pad",
];

<<<<<<< before updating
const WIDGET_BUNDLES = WIDGET_NAMES.map((name) => ({
  entryPoints: [`src/ts/${name}.ts`],
  outfile: `dist/widgets/${name}.js`,
}));

async function copy_widgets_to_python() {
  fs.mkdirSync("../nbplay/static", { recursive: true });
  await cpy("dist/widgets/*.js", "../nbplay/static");
=======
  // Copy HTML
  await cpy("src/html/*", "dist/");

  // Copy images
  if (fs.existsSync("src/img")) {
    fs.mkdirSync("dist/img", { recursive: true });
    await cpy("src/img/*", "dist/img");
  }
>>>>>>> after updating

  for (const name of WIDGET_NAMES) {
    const cssPath = `dist/css/${name}.css`;
    if (fs.existsSync(cssPath)) {
      fs.copyFileSync(cssPath, `../nbplay/static/${name}.css`);
    }
  }
}

async function copy_extension_assets() {
  // Copy servable assets to python extension (exclude esm/)
  fs.rmSync("../nbplay/extension", {
    recursive: true,
    force: true,
  });
  fs.mkdirSync("../nbplay/extension", { recursive: true });
  await cpy("dist/**/*", "../nbplay/extension", {
<<<<<<< before updating
    filter: (file) => !file.relativePath.startsWith("esm"),
=======
    filter: (file) =>
      !file.relativePath.startsWith("esm/") &&
      !file.relativePath.startsWith("dist/esm/"),
>>>>>>> after updating
  });
}

async function build() {
  await bundle_css("src/css");
  await cpy("src/html/*", "dist/");

  if (fs.existsSync("src/img")) {
    fs.mkdirSync("dist/img", { recursive: true });
    await cpy("src/img/*", "dist/img");
  }

  await Promise.all([...BUNDLES, ...WIDGET_BUNDLES].map(bundle)).catch(() =>
    process.exit(1),
  );
  await copy_extension_assets();
  await copy_widgets_to_python();
}

build();
