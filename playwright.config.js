const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  workers: 1,
  expect: { timeout: 15000 },
  timeout: 180000,
  use: {
    actionTimeout: 15000,
    baseURL: "http://localhost:3100",
    channel: "msedge",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "backend\\.venv\\Scripts\\python.exe tests/start_backend.py",
      url: "http://127.0.0.1:8001/api/auth/session/",
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: "npm run dev -- --port 3100",
      url: "http://localhost:3100",
      env: {
        DJANGO_API_ORIGIN: "http://127.0.0.1:8001",
        NEXT_DIST_DIR: ".next-e2e",
      },
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
