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

async function waitForClient(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (client.exitCode !== null) {
      throw new Error(`Vite exited during startup (${client.exitCode}).`);
    }
    try {
      const response = await fetch(paths.clientDevUrl);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Vite did not become ready at ${paths.clientDevUrl}.`);
}

try {
  await waitForClient();
  run("pnpm", ["exec", "electron", "."], desktopRoot);
} catch (error) {
  client.kill("SIGTERM");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

client.on("exit", () => process.exit(0));
