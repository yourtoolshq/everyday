import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  allowedDevOrigins: ["127.0.0.1"],
  output: "standalone",
  transpilePackages: ["@yourtoolshq/data", "@yourtoolshq/data-ui"],
  outputFileTracingIncludes: {
    "/*": ["./drizzle/**/*"],
  },
};

export default config;
