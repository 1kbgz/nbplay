import { defineConfig, devices } from "@playwright/test";

// The standalone Pyodide example: the static site in dist/app with the session
// running in Pyodide inside a Web Worker. Build it first with
// `make pyodide-example` (needs the Pyodide wheel), then run
// `pnpm run test:pyodide`. Pyodide and nbplay's pure-Python dependencies are
// fetched from their CDNs.
export default defineConfig({
  testDir: "tests",
  testMatch: "pyodide.spec.js",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 300 * 1000,
  reporter: [["line"]],
  use: {
    baseURL: "http://127.0.0.1:8878",
    trace: "on-first-retry",
    launchOptions: {
      args: ["--autoplay-policy=no-user-gesture-required"],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "http-server ../dist/app -p 8878 -s -c-1",
    url: "http://127.0.0.1:8878/index.html",
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
  },
});
