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
  "transport",
  "settings",
  "keyboard",
];

const WIDGET_BUNDLES = WIDGET_NAMES.map((name) => ({
  entryPoints: [`src/ts/${name}.ts`],
  outfile: `dist/widgets/${name}.js`,
}));

async function copy_widgets_to_python() {
  fs.mkdirSync("../nbplay/static", { recursive: true });
  await cpy("dist/widgets/*.js", "../nbplay/static");

  for (const name of WIDGET_NAMES) {
    const cssPath = `dist/css/${name}.css`;
    if (fs.existsSync(cssPath)) {
      fs.copyFileSync(cssPath, `../nbplay/static/${name}.css`);
    }
  }
}

async function copy_extension_assets() {
  // Copy servable assets to python extension (exclude esm/)
  fs.mkdirSync("../nbplay/extension", { recursive: true });
  await cpy("dist/**/*", "../nbplay/extension", {
    filter: (file) => !file.relativePath.startsWith("esm"),
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
