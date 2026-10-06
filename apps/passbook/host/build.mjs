#!/usr/bin/env node
import { cp, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const hostRoot = dirname(fileURLToPath(import.meta.url));
const passbookRoot = resolve(hostRoot, "..");
const distRoot = resolve(hostRoot, "dist");
const require = createRequire(import.meta.url);

await rm(distRoot, { force: true, recursive: true });
await build({
  entryPoints: [resolve(hostRoot, "src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: resolve(distRoot, "passbook-host.cjs"),
  alias: {
    "~": resolve(passbookRoot, "src"),
  },
  logLevel: "warning",
});

if (process.env.PASSBOOK_BUNDLE_NATIVE_RUNTIME === "1") {
  const nativePackage = `@libsql/${process.platform}-${process.arch}`;
  const clientEntry = require.resolve("@libsql/client");
  const nativeEntry = require.resolve(nativePackage, {
    paths: [dirname(clientEntry)],
  });
  const nativeTarget = resolve(distRoot, "node_modules", nativePackage);
  await mkdir(resolve(nativeTarget, ".."), { recursive: true });
  await cp(dirname(nativeEntry), nativeTarget, { recursive: true });
}
