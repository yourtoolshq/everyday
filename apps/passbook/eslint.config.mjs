import { createNextAppConfig } from "@yourtoolshq/eslint-config/next-app";

export default createNextAppConfig(import.meta.dirname, {
  extraIgnores: ["client/**", "desktop/**", "fixtures/**", "host/**"],
});
