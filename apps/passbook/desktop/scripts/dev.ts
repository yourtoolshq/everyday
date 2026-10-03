import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveDesktopPaths } from "../electron/config.js";

const desktopRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const passbookRoot = path.resolve(desktopRoot, "..");
const paths = resolveDesktopPaths();

function run(
  command: string,
  args: string[],
  cwd: string,
  env?: Record<string, string>,
) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, PASSBOOK_HOST_URL: paths.hostUrl, ...env },
    stdio: "inherit",
  });
  child.on("exit", (code) => {
    if (code && code !== 0) process.exit(code);
  });
  return child;
}

const client = run("pnpm", ["dev"], path.join(passbookRoot, "client"), {
  PASSBOOK_HOST_URL: paths.hostUrl,
});

setTimeout(() => {
  run("pnpm", ["exec", "electron", "."], desktopRoot);
}, 4_000);

client.on("exit", () => process.exit(0));
