import { defineConfig, devices } from "@playwright/test";

// The web app: `python -m nbplay.app` serves the demo session over one
// WebSocket per instrument with the panels in a regular-layout. The probe
// routes let the test read the kernel's models and issue commands.
// Run with `pnpm run test:app` (also part of `pnpm test`).
export default defineConfig({
  testDir: "tests",
  testMatch: ["app.spec.js"],
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 120 * 1000,
  reporter: [["line"]],
  use: {
    baseURL: "http://127.0.0.1:8020",
    trace: "on-first-retry",
    launchOptions: {
      args: ["--autoplay-policy=no-user-gesture-required"],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "python -m nbplay.app --port 8020 --probes",
    url: "http://127.0.0.1:8020/state",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
