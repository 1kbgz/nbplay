import { NodeModulesExternal } from "@finos/perspective-esbuild-plugin/external.js";
import { build } from "@finos/perspective-esbuild-plugin/build.js";
<<<<<<< before updating
import { BuildCss } from "@prospective.co/procss/target/cjs/procss.js";
import less from "less";
=======
import { transform } from "lightningcss";
>>>>>>> after updating
import { getarg } from "./tools/getarg.mjs";
import fs from "fs";
import cpy from "cpy";

const DEBUG = getarg("--debug");

const COMMON_DEFINE = {
  global: "window",
  "process.env.DEBUG": `${DEBUG}`,
};

const BUILD = [
  {
    define: COMMON_DEFINE,
    entryPoints: ["src/ts/index.ts"],
    plugins: [NodeModulesExternal()],
    format: "esm",
    loader: {
      ".css": "text",
      ".html": "text",
    },
    outfile: "dist/esm/index.js",
  },
  {
    define: COMMON_DEFINE,
    entryPoints: ["src/ts/index.ts"],
    plugins: [],
    format: "esm",
    loader: {
      ".css": "text",
      ".html": "text",
    },
    outfile: "dist/cdn/index.js",
  },
];

// ── Widget ESM builds ────────────────────────────────────────────
// Each widget TypeScript file → standalone ESM module in ../nbplay/static/
const WIDGET_NAMES = [
  "widget",
  "mixer",
  "sampler",
  "sequencer",
  "transport",
  "settings",
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
<<<<<<< before updating
  // Use procss for the original index.less (if non-empty)
  const indexLess = path_mod.join("src/less", "index.less");
  const indexContent = fs.readFileSync(indexLess).toString().trim();
  fs.mkdirSync("dist/css", { recursive: true });
  if (indexContent) {
    const builder = new BuildCss("");
    builder.add(indexLess, indexContent);
    fs.writeFileSync("dist/css/index.css", builder.compile().get("index.css"));
  }

  // Use the less package for widget Less files (supports variables, mixins, @import)
  for (const name of WIDGET_NAMES) {
    const lessFile = path_mod.join("src/less", `${name}.less`);
    if (!fs.existsSync(lessFile)) continue;
    const content = fs.readFileSync(lessFile).toString();
    const result = await less.render(content, {
      filename: lessFile,
      paths: ["src/less"],
    });
    fs.writeFileSync(`dist/css/${name}.css`, result.css);
  }

  // Copy any raw CSS files from src/css
  if (fs.existsSync("src/css")) {
    cpy("src/css/*", "dist/css/");
  }
=======
  const process_path = (path) => {
    const outpath = path.replace("src/css", "dist/css");
    fs.mkdirSync(outpath, { recursive: true });

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
  };

  process_path("src/css");
>>>>>>> after updating
}

async function copy_html() {
  fs.mkdirSync("dist/html", { recursive: true });
  cpy("src/html/*", "dist/html");
  // also copy to top level
  cpy("src/html/*", "dist/");
}

async function copy_img() {
  fs.mkdirSync("dist/img", { recursive: true });
  cpy("src/img/*", "dist/img");
}

async function copy_to_python() {
  fs.mkdirSync("../nbplay/extension", { recursive: true });
  cpy("dist/**/*", "../nbplay/extension");
}

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
}

build_all();
