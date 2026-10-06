import { baseConfig } from "@yourtoolshq/eslint-config/base";

export default [
  ...baseConfig,
  {
    ignores: ["dist/**", "release/**"],
  },
];
