import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./qa/dashboard-v2",
  testMatch: "*.spec.mjs",
  fullyParallel: true,
  workers: 2,
  retries: 0,
  timeout: 30000,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/dashboard-v2-results.json" }],
  ],
  use: {
    browserName: "chromium",
    baseURL: "http://127.0.0.1:5175",
    viewport: { width: 1440, height: 1050 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        "node node_modules/vite/bin/vite.js --config vite.dashboard-v2.config.js",
      url: "http://127.0.0.1:5175/preview-v2.html",
      env: { FUNNELPILOT_DASHBOARD_V2_PREVIEW: "1" },
      reuseExistingServer: false,
    },
    {
      command:
        "node node_modules/vite/bin/vite.js --config vite.dashboard-v2.config.js --port 5176",
      url: "http://127.0.0.1:5176/preview-v2.html",
      env: { FUNNELPILOT_DASHBOARD_V2_PREVIEW: "0" },
      reuseExistingServer: false,
    },
    {
      command:
        "node node_modules/vite/bin/vite.js --port 5177 --host 127.0.0.1 --strictPort",
      url: "http://127.0.0.1:5177",
      reuseExistingServer: false,
    },
  ],
});
