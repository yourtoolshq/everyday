import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["e2e/**", "node_modules/**", ".context/**"],
    env: {
      DATABASE_URL: "file::memory:",
      DOCUMENTS_DIR: "./.data/test-documents",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/server/**/*.ts", "src/lib/**/*.ts"],
    },
  },
  resolve: {
    alias: {
      "~": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
