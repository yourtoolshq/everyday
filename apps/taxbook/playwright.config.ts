import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/prepare-e2e.mjs && pnpm dev --port 3100",
    url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: "file:./.data/e2e.db",
    },
    timeout: 120_000,
  },
});
