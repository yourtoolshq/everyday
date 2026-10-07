import { build } from "esbuild";

const common = {
  bundle: true,
  external: ["electron", "electron-updater"],
  platform: "node",
  target: "node22",
};

await Promise.all([
  build({
    ...common,
    entryPoints: ["electron/main.ts"],
    format: "esm",
    outfile: "dist/main.js",
  }),
  build({
    ...common,
    entryPoints: ["electron/preload.ts"],
    format: "cjs",
    outfile: "dist/preload.cjs",
  }),
]);
