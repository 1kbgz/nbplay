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
  // UI primitives on their own (future standalone package) and their gallery
  {
    entryPoints: ["src/ts/components/index.ts"],
    outfile: "dist/components/index.js",
  },
  {
    entryPoints: ["src/ts/gallery.ts"],
    outfile: "dist/gallery/index.js",
  },
  // The spaday component package: every element plus the nbplay-wire bridge
  {
    entryPoints: ["src/ts/spaday.ts"],
    outfile: "dist/spaday/index.js",
  },
  // Test-only: the instrument elements behind a trait-shaped mock model
  {
    entryPoints: ["tests/support/instruments.ts"],
    outfile: "dist/tests/instruments.js",
  },
];

async function build() {
  if (fs.existsSync("dist")) {
    for (const entry of fs.readdirSync("dist")) {
      if (entry !== "pkg") {
        fs.rmSync(`dist/${entry}`, { recursive: true, force: true });
      }
    }
  }
  fs.rmSync("../nbplay/extension", {
    recursive: true,
    force: true,
  });
  fs.rmSync("../nbplay/static", {
    recursive: true,
    force: true,
  });

  // Bundle css
  await bundle_css("src/css");

  // Copy HTML
  await cpy("src/html/*", "dist/");

  // Copy images
  if (fs.existsSync("src/img")) {
    fs.mkdirSync("dist/img", { recursive: true });
    await cpy("src/img/*", "dist/img");
  }

  await Promise.all(BUNDLES.map(bundle)).catch(() => process.exit(1));

  // Copy servable assets to python extension (exclude esm/, gallery/, tests/)
  fs.mkdirSync("../nbplay/extension", { recursive: true });
  await cpy("dist/**/*", "../nbplay/extension", {
    filter: (file) =>
      !/^(dist\/)?(esm|gallery|tests)\//.test(file.relativePath),
  });

  // The spaday component package assets (nbplay.components:package): every
  // widget shares one stylesheet, the elements plus the theme sets.
  fs.mkdirSync("../nbplay/static/spaday", { recursive: true });
  fs.copyFileSync("dist/spaday/index.js", "../nbplay/static/spaday/index.js");
  fs.copyFileSync("dist/css/nbplay.css", "../nbplay/static/spaday/nbplay.css");
}

await build();
