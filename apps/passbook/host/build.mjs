#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const hostRoot = dirname(fileURLToPath(import.meta.url));
const passbookRoot = resolve(hostRoot, "..");

await build({
  entryPoints: [resolve(hostRoot, "src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: resolve(hostRoot, "dist/passbook-host.cjs"),
  external: ["@libsql/client"],
  alias: {
    "~": resolve(passbookRoot, "src"),
  },
  logLevel: "warning",
});
