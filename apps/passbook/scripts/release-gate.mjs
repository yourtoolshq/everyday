#!/usr/bin/env node
/**
 * Verifies Passbook release mechanics: bundled host startup, backup checkpoint,
 * versioned restart, and recovery from a failed update attempt.
 */
import { spawn } from "node:child_process";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const passbookRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hostRoot = join(passbookRoot, "host");
const hostBundle = join(hostRoot, "dist/passbook-host.cjs");
const dataDir = resolve(passbookRoot, ".data/release-gate");
const backupDir = join(dataDir, "backups");
const ytData = join(
  passbookRoot,
  "node_modules/@yourtoolshq/data/dist/yt-data.cjs",
);

function log(step, message) {
  console.log(`[release-gate] ${step}: ${message}`);
}

function fail(message) {
  console.error(`[release-gate] FAIL: ${message}`);
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

async function buildHostBundle() {
  log("build", "bundling passbook host");
  await new Promise((resolveBuild, reject) => {
    const child = spawn("node", ["build.mjs"], {
      cwd: hostRoot,
      stdio: "inherit",
    });
    child.on("close", (code) =>
      code === 0
        ? resolveBuild()
        : reject(new Error(`host build failed (${code})`)),
    );
  });
}

function spawnBundledHost(port, version) {
  return spawn("node", [hostBundle], {
    cwd: passbookRoot,
    env: {
      ...process.env,
      PASSBOOK_ROOT: passbookRoot,
      DATA_DIR: dataDir,
      BACKUP_DIR: backupDir,
      HOST: "127.0.0.1",
      PORT: String(port),
      APP_VERSION: version,
      NODE_ENV: "test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function waitForReady(baseUrl, child) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Host exited with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/data/status`);
      const body = await response.json();
      if (response.ok && body.state === "ready") return body;
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

async function trpc(baseUrl, path, input) {
  const response =
    input === undefined
      ? await fetch(`${baseUrl}/api/trpc/${path}`)
      : await fetch(`${baseUrl}/api/trpc/${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ json: input }),
        });
  const body = await response.json();
  if (!body.result) {
    throw new Error(`${path} failed: ${JSON.stringify(body)}`);
  }
  return body.result.data.json;
}

function runYtData(args, env) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(
      "node",
      [ytData, "--app", "passbook", "--migrations", "drizzle", ...args],
      {
        cwd: passbookRoot,
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolveRun(stdout);
        return;
      }
      reject(
        new Error(
          `yt-data ${args.join(" ")} failed (${code})\n${stdout}\n${stderr}`,
        ),
      );
    });
  });
}

async function main() {
  log("setup", `cleaning ${dataDir}`);
  await rm(dataDir, { recursive: true, force: true });
  await mkdir(dataDir, { recursive: true });
  await mkdir(backupDir, { recursive: true });

  await buildHostBundle();

  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const host = spawnBundledHost(port, "0.1.0");

  try {
    const health = await waitForReady(baseUrl, host);
    if (health.version !== "0.1.0") {
      fail(`expected version 0.1.0, got ${health.version}`);
    }

    await trpc(baseUrl, "setup.initialize", {
      householdName: "Release gate household",
      people: ["Alex"],
    });
    const before = await trpc(baseUrl, "people.list");
    if (before.length !== 1) fail("expected one person before update");

    log("checkpoint", "creating verified backup");
    const backupOutput = await runYtData(["backup"], {
      DATA_DIR: dataDir,
      BACKUP_DIR: backupDir,
      PORT: String(port),
    });
    const backupMatch = backupOutput.match(/Created backup ([^:]+): verified/);
    if (!backupMatch)
      fail(`backup output missing verified id: ${backupOutput}`);
    const backupId = backupMatch[1];
    await runYtData(["verify", backupId], {
      DATA_DIR: dataDir,
      BACKUP_DIR: backupDir,
      PORT: String(port),
    });

    const intent = {
      targetVersion: "0.2.0",
      previousVersion: "0.1.0",
      stage: "trial",
      backupId,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updateDir = join(dataDir, ".update");
    await mkdir(updateDir, { recursive: true });
    await writeFile(
      join(updateDir, "intent.json"),
      JSON.stringify(intent, null, 2),
    );

    await stopHost(host);

    const upgraded = spawnBundledHost(port, "0.2.0");
    try {
      const upgradedHealth = await waitForReady(baseUrl, upgraded);
      if (upgradedHealth.version !== "0.2.0") {
        fail(
          `expected version 0.2.0 after restart, got ${upgradedHealth.version}`,
        );
      }
      const after = await trpc(baseUrl, "people.list");
      if (
        after.length !== before.length ||
        after[0]?.name !== before[0]?.name
      ) {
        fail("records did not survive versioned restart");
      }
    } finally {
      await stopHost(upgraded);
    }

    log("recovery", "simulating failed update and restoring backup");
    for (const entry of await readdir(dataDir)) {
      if (entry === "backups") continue;
      await rm(join(dataDir, entry), { recursive: true, force: true });
    }
    await runYtData(["restore", backupId, "--direct"], {
      DATA_DIR: dataDir,
      BACKUP_DIR: backupDir,
    });

    const recovered = spawnBundledHost(port, "0.2.0");
    try {
      await waitForReady(baseUrl, recovered);
      const restored = await trpc(baseUrl, "people.list");
      if (restored.length !== before.length) {
        fail("records were not recovered from backup");
      }
    } finally {
      await stopHost(recovered);
    }

    log("done", "release gate passed");
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
