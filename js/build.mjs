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

<<<<<<< before updating
// Each widget TypeScript file → standalone ESM module in ../nbplay/static/
const WIDGET_NAMES = [
  "widget",
  "mixer",
  "sampler",
  "sequencer",
  "transport",
  "settings",
  "keyboard",
];

const WIDGET_BUILD = WIDGET_NAMES.map((name) => ({
  define: COMMON_DEFINE,
  entryPoints: [`src/ts/${name}.ts`],
  plugins: [],
  format: "esm",
  loader: {
    ".css": "text",
    ".html": "text",
  },
  outfile: `dist/widgets/${name}.js`,
  bundle: true,
}));

async function compile_css() {
  fs.mkdirSync("dist/css", { recursive: true });

  // Copy widget CSS files for each widget using WIDGET_NAMES
  // These were pre-compiled from LESS to CSS
  for (const name of WIDGET_NAMES) {
    const cssFile = `src/css/${name}.css`;
    if (!fs.existsSync(cssFile)) continue;
    const source = fs.readFileSync(cssFile);
    const { code } = transform({
      filename: cssFile,
      code: source,
      minify: !DEBUG,
      sourceMap: false,
    });
    fs.writeFileSync(`dist/css/${name}.css`, code);
  }

  // Process raw CSS files from src/css
  const process_path = (path) => {
    const outpath = path.replace("src/css", "dist/css");
    fs.mkdirSync(outpath, { recursive: true });

    if (fs.existsSync(path)) {
      fs.readdirSync(path, { withFileTypes: true }).forEach((entry) => {
        const input = `${path}/${entry.name}`;
        const output = `${outpath}/${entry.name}`;

        if (entry.isDirectory()) {
          process_path(input);
        } else if (entry.isFile() && entry.name.endsWith(".css")) {
          const source = fs.readFileSync(input);
          const { code } = transform({
            filename: entry.name,
            code: source,
            minify: !DEBUG,
            sourceMap: false,
          });
          fs.writeFileSync(output, code);
        }
      });
    }
  };

  process_path("src/css");
}
=======
async function build() {
  // Bundle css
  await bundle_css();
>>>>>>> after updating

  // Copy HTML
  cpy("src/html/*", "dist/");

  // Copy images
  fs.mkdirSync("dist/img", { recursive: true });
  cpy("src/img/*", "dist/img");

  await Promise.all(BUNDLES.map(bundle)).catch(() => process.exit(1));

<<<<<<< before updating
async function copy_widgets_to_python() {
  fs.mkdirSync("../nbplay/static", { recursive: true });
  // Copy compiled widget JS
  await cpy("dist/widgets/*.js", "../nbplay/static");
  // Copy compiled widget CSS
  for (const name of WIDGET_NAMES) {
    const cssPath = `dist/css/${name}.css`;
    if (fs.existsSync(cssPath)) {
      fs.copyFileSync(cssPath, `../nbplay/static/${name}.css`);
    }
  }
}

async function build_all() {
  await compile_css();
  await copy_html();
  await copy_img();
  await Promise.all([...BUILD, ...WIDGET_BUILD].map(build)).catch(() =>
    process.exit(1),
  );
  await copy_to_python();
  await copy_widgets_to_python();
=======
  // Copy servable assets to python extension (exclude esm/)
  fs.mkdirSync("../nbplay/extension", { recursive: true });
  cpy("dist/**/*", "../nbplay/extension", {
    filter: (file) => !file.relativePath.startsWith("esm"),
  });
>>>>>>> after updating
}

build();
