#!/usr/bin/env node
/**
 * Starts the Passbook host and Vite client for Playwright E2E (non-foundation).
 * Playwright kills this process (and its children) when tests finish.
 */
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const passbookRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hostRoot = join(passbookRoot, "host");
const hostEntry = join(hostRoot, "src/index.ts");
const clientRoot = join(passbookRoot, "client");
const dataDir = join(passbookRoot, ".data/e2e");
const backupDir = join(dataDir, "backups");
const hostPort = process.env.PORT ?? "3101";
const clientPort = process.env.VITE_DEV_PORT ?? "3100";
const hostUrl = `http://127.0.0.1:${hostPort}`;
const clientUrl = `http://127.0.0.1:${clientPort}`;

const children = [];

function track(child) {
  children.push(child);
  return child;
}

async function waitForUrl(url, label, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`${label} did not become ready at ${url}`);
}

async function main() {
  await rm(dataDir, { recursive: true, force: true });
  await mkdir(dataDir, { recursive: true });
  await mkdir(backupDir, { recursive: true });

  const host = track(
    spawn("node", ["--import", "tsx", hostEntry], {
      cwd: hostRoot,
      env: {
        ...process.env,
        DATA_DIR: dataDir,
        BACKUP_DIR: backupDir,
        HOST: "127.0.0.1",
        PORT: hostPort,
        NODE_ENV: "test",
      },
      stdio: "inherit",
    }),
  );

  await waitForUrl(`${hostUrl}/api/health`, "host");

  const client = track(
    spawn(
      "node",
      [
        join(clientRoot, "node_modules/vite/bin/vite.js"),
        "--port",
        clientPort,
        "--host",
        "127.0.0.1",
      ],
      {
        cwd: clientRoot,
        env: {
          ...process.env,
          PASSBOOK_HOST_URL: hostUrl,
          VITE_DEV_PORT: clientPort,
        },
        stdio: "inherit",
      },
    ),
  );

  await waitForUrl(clientUrl, "client");

  const shutdown = () => {
    for (const child of children) {
      if (!child.killed) child.kill("SIGTERM");
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  host.on("exit", (code) => {
    if (code !== 0 && code !== null) process.exit(code);
  });
  client.on("exit", (code) => {
    if (code !== 0 && code !== null) process.exit(code);
  });

  await new Promise(() => {});
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
