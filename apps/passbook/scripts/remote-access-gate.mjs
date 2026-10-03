#!/usr/bin/env node
/**
 * Verifies Passbook remote-access auth: pairing, bearer tokens, revocation,
 * and denial of unauthenticated requests when auth is required.
 */
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const passbookRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hostRoot = join(passbookRoot, "host");
const hostEntry = join(hostRoot, "src/index.ts");
const dataDir = resolve(passbookRoot, ".data/remote-access-gate");

function log(step, message) {
  console.log(`[remote-access-gate] ${step}: ${message}`);
}

function fail(message) {
  console.error(`[remote-access-gate] FAIL: ${message}`);
  process.exit(1);
}

async function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate a port"));
        return;
      }
      server.close((error) =>
        error ? reject(error) : resolvePort(address.port),
      );
    });
  });
}

function spawnHost(port) {
  return spawn("node", ["--import", "tsx", hostEntry], {
    cwd: hostRoot,
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      BACKUP_DIR: join(dataDir, "backups"),
      HOST: "127.0.0.1",
      PORT: String(port),
      NODE_ENV: "test",
      PASSBOOK_REQUIRE_AUTH: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function waitForHealth(baseUrl, child) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Host exited with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Host is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`Host did not become ready at ${baseUrl}`);
}

async function stopHost(child) {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
  await new Promise((resolveStop) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolveStop();
    }, 5_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolveStop();
    });
  });
}

async function main() {
  log("setup", `cleaning ${dataDir}`);
  await rm(dataDir, { recursive: true, force: true });
  await mkdir(dataDir, { recursive: true });

  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const host = spawnHost(port);

  try {
    await waitForHealth(baseUrl, host);

    const denied = await fetch(`${baseUrl}/api/trpc/setup.state`);
    if (denied.status !== 401) {
      fail(`expected unauthenticated denial, got ${denied.status}`);
    }

    const pairing = await fetch(`${baseUrl}/api/auth/pairing-codes`, {
      method: "POST",
    });
    if (!pairing.ok) fail("could not create pairing code on loopback");
    const { code } = await pairing.json();

    const paired = await fetch(`${baseUrl}/api/auth/pair`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, label: "Gate phone" }),
    });
    if (paired.status !== 201) fail("pairing failed");
    const { token, id } = await paired.json();

    const authorized = await fetch(`${baseUrl}/api/trpc/setup.state`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!authorized.ok) fail("authorized request failed");

    const revoked = await fetch(`${baseUrl}/api/auth/tokens/${id}`, {
      method: "DELETE",
    });
    if (revoked.status !== 204) fail("token revocation failed");

    const deniedAfter = await fetch(`${baseUrl}/api/trpc/setup.state`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (deniedAfter.status !== 401) {
      fail("revoked token should be denied");
    }

    log("done", "remote access gate passed");
  } finally {
    await stopHost(host);
    if (process.env.PASSBOOK_KEEP_GATE_DATA !== "1") {
      await rm(dataDir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
