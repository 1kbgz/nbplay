import { defineConfig, devices } from "@playwright/test";

// Host compatibility checks: boot real Jupyter hosts (Voila, JupyterLab)
// with a live kernel and drive the rendered session widgets. Both hosts
// serve a scratch copy of the fixture notebook (dist/hosts) so JupyterLab's
// autosave never modifies the tracked file.
// Run with `pnpm run test:hosts`.
export default defineConfig({
  testDir: "tests",
  testMatch: ["voila.spec.js", "jupyterlab.spec.js"],
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 180 * 1000,
  reporter: [["line"]],
  use: {
    trace: "on-first-retry",
    launchOptions: {
      args: ["--autoplay-policy=no-user-gesture-required"],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        "node tools/host-notebook.mjs && python -m voila dist/hosts/host_smoke.ipynb --no-browser --port=8866 --Voila.ip=127.0.0.1 --VoilaConfiguration.show_tracebacks=True",
      url: "http://127.0.0.1:8866/voila/static/main.js",
      reuseExistingServer: !process.env.CI,
      timeout: 180 * 1000,
    },
    {
      command:
        "node tools/host-notebook.mjs && python -m jupyter lab --no-browser --port=8899 --ServerApp.ip=127.0.0.1 --ServerApp.token=\"\" --ServerApp.password=\"\" --ServerApp.disable_check_xsrf=True --ServerApp.root_dir=dist/hosts --LabApp.open_browser=False",
      url: "http://127.0.0.1:8899/lab",
      reuseExistingServer: !process.env.CI,
      timeout: 180 * 1000,
    },
  ],
});
