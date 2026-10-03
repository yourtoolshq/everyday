import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "~": path.resolve(import.meta.dirname, "../src"),
    },
  },
  define: {
    __PASSBOOK_HOST_URL__: JSON.stringify("http://127.0.0.1:3847"),
  },
});
