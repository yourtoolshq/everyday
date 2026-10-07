import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["shared/**/*.test.ts", "scripts/release/**/*.test.mjs"],
    exclude: [
      "e2e/**",
      "host/**",
      "client/**",
      "desktop/**",
      "node_modules/**",
    ],
    env: {
      DATA_DIR: "./.data/test",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["shared/server/**/*.ts", "shared/lib/**/*.ts"],
    },
  },
  resolve: {
    alias: {
      "~": path.resolve(import.meta.dirname, "./shared"),
    },
  },
});
