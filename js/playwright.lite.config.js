import { defineConfig, devices } from "@playwright/test";

// JupyterLite demo check: serves the built site (docs/html/lite) and runs
// a staged example notebook on the Pyodide kernel with the bundled wheel.
// Build the site first (see docs/lite/prepare.py and the docs workflow), then
// run with `pnpm run test:lite`. Pyodide itself is fetched from its CDN.
export default defineConfig({
  testDir: "tests",
  testMatch: "jupyterlite.spec.js",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 300 * 1000,
  reporter: [["line"]],
  use: {
    baseURL: "http://127.0.0.1:8877",
    trace: "on-first-retry",
    launchOptions: {
      args: ["--autoplay-policy=no-user-gesture-required"],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "http-server ../docs/html -p 8877 -s",
    url: "http://127.0.0.1:8877/lite/lab/index.html",
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
  },
});
