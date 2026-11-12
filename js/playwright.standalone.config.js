import { defineConfig, devices } from "@playwright/test";

// The static web app: the exported site (docs/html/app) with the session
// running in Pyodide inside a Web Worker. Export it first with
// `make standalone` (needs the Pyodide wheel), then run
// `pnpm run test:standalone`. Pyodide and the dependency wheels are fetched
// from their CDNs.
export default defineConfig({
  testDir: "tests",
  testMatch: "standalone.spec.js",
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
    command: "http-server ../docs/html -p 8878 -s -c-1",
    url: "http://127.0.0.1:8878/app/index.html",
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
  },
});
