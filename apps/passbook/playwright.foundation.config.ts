import { defineConfig, devices } from "@playwright/test";

const clientPort = process.env.VITE_DEV_PORT ?? "5174";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "foundation.spec.ts",
  fullyParallel: false,
  workers: 1,
  projects: [
    {
      name: "foundation-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  use: {
    baseURL: `http://127.0.0.1:${clientPort}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/start-foundation-stack.mjs",
    url: `http://127.0.0.1:${clientPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
