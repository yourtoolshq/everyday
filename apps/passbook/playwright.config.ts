import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "**/foundation.spec.ts",
  fullyParallel: false,
  workers: 1,
  projects: [
    {
      name: "setup",
      testMatch: "**/setup.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "desktop-chromium",
      testIgnore: ["**/setup.spec.ts", "**/foundation.spec.ts"],
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/prepare-e2e.mjs && node scripts/start-e2e-stack.mjs",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
