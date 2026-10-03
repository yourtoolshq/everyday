#!/usr/bin/env node
/**
 * Rehearses container-to-desktop data movement using the previous-release
 * fixture as a representative old deployment and the bundled host as the
 * desktop runtime. Writers never run against the same data directory.
 *
 * Uses disposable data only — never production Docker volumes.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

const passbookRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hostRoot = join(passbookRoot, "host");
const hostBundle = join(hostRoot, "dist/passbook-host.cjs");
const fixtureRoot = join(
  passbookRoot,
  "src/server/db/fixtures/previous-release",
);
const sourceDataDir = resolve(passbookRoot, ".data/migration-rehearsal-source");
const desktopDataDir = resolve(
  passbookRoot,
  ".data/migration-rehearsal-desktop",
);
const backupDir = join(sourceDataDir, "backups");
const ytData = join(
  passbookRoot,
  "node_modules/@yourtoolshq/data/dist/yt-data.cjs",
);

const expectedSummary = {
  householdName: "Rivera household",
  memberCount: 2,
  institutionCount: 2,
  accountCount: 3,
};

const expectedAccounts = [
  "Everyday Chequing",
  "High Interest Savings",
  "Rewards Visa",
];

const expectedStatements = {
  "5abe6b7c-2f8d-4eaf-9b4c-6d7e8f9a0b06": {
    "2025-01": "a0f3b0c1-7ed2-4df4-8a9b-1c2d3e4f5a11",
    "2025-03": "b104c1d2-8fe3-4e05-9bac-2d3e4f5a6b12",
  },
};

function log(step, message) {
  console.log(`[migration-rehearsal] ${step}: ${message}`);
}

function fail(message) {
  console.error(`[migration-rehearsal] FAIL: ${message}`);
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

async function seedPreviousRelease(dataDir) {
  await rm(dataDir, { recursive: true, force: true });
  await mkdir(join(dataDir, "backups"), { recursive: true });
  await cp(join(fixtureRoot, "documents"), join(dataDir, "documents"), {
    recursive: true,
  });
  const client = createClient({ url: `file:${join(dataDir, "passbook.db")}` });
  await client.executeMultiple(
    await readFile(join(fixtureRoot, "passbook.sql"), "utf8"),
  );
  client.close();
}

function spawnBundledHost(port, dataDir, backupPath) {
  return spawn("node", [hostBundle], {
    cwd: passbookRoot,
    env: {
      ...process.env,
      PASSBOOK_ROOT: passbookRoot,
      DATA_DIR: dataDir,
      BACKUP_DIR: backupPath,
      HOST: "127.0.0.1",
      PORT: String(port),
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
      const response = await fetch(`${baseUrl}/api/health`);
      const body = await response.json();
      if (response.ok && body.status === "ok") return body;
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

async function captureDocumentDigests(baseUrl) {
  const documents = await trpc(baseUrl, "documents.overview");
  const digests = new Map();

  for (const document of documents) {
    const response = await fetch(
      `${baseUrl}/api/data/files/${document.fileId}`,
    );
    if (response.status !== 200) {
      fail(`file GET failed for ${document.fileId}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    digests.set(document.fileId, {
      digest: createHash("sha256").update(bytes).digest("hex"),
      originalFilename: document.originalFilename,
    });
  }

  return digests;
}

async function verifyRecords(baseUrl, label) {
  log("verify", `checking migrated records on ${label}`);

  const setupState = await trpc(baseUrl, "setup.state");
  if (!setupState.initialized) fail(`${label}: expected initialized household`);

  const summary = await trpc(baseUrl, "overview.summary");
  if (JSON.stringify(summary) !== JSON.stringify(expectedSummary)) {
    fail(`${label}: summary mismatch: ${JSON.stringify(summary)}`);
  }

  const accounts = await trpc(baseUrl, "accounts.list");
  const names = accounts.map((account) => account.displayName).sort();
  if (JSON.stringify(names) !== JSON.stringify(expectedAccounts.sort())) {
    fail(`${label}: account names mismatch: ${JSON.stringify(names)}`);
  }

  const statements = await trpc(
    baseUrl,
    "documents.statementDocumentsByAccount",
  );
  if (JSON.stringify(statements) !== JSON.stringify(expectedStatements)) {
    fail(`${label}: statement map mismatch: ${JSON.stringify(statements)}`);
  }

  const documents = await trpc(baseUrl, "documents.overview");
  if (documents.length !== 4) {
    fail(`${label}: expected 4 documents, got ${documents.length}`);
  }
}

async function verifyDocumentDigests(baseUrl, label, expectedDigests) {
  const digests = await captureDocumentDigests(baseUrl);
  if (digests.size !== expectedDigests.size) {
    fail(
      `${label}: expected ${expectedDigests.size} document digests, got ${digests.size}`,
    );
  }

  for (const [fileId, expected] of expectedDigests) {
    const actual = digests.get(fileId);
    if (!actual) {
      fail(`${label}: missing document file ${fileId}`);
    }
    if (actual.digest !== expected.digest) {
      fail(
        `${label}: digest mismatch for ${expected.originalFilename} (${fileId})`,
      );
    }
    log(
      "verify",
      `${label}: ${expected.originalFilename} sha256=${actual.digest.slice(0, 12)}…`,
    );
  }
}

async function main() {
  log("setup", "seeding previous-release fixture as container source");
  await seedPreviousRelease(sourceDataDir);
  await rm(desktopDataDir, { recursive: true, force: true });

  await buildHostBundle();

  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  log("source", `starting bundled host against ${sourceDataDir}`);
  let sourceHost = spawnBundledHost(port, sourceDataDir, backupDir);
  try {
    await waitForReady(baseUrl, sourceHost);
    await verifyRecords(baseUrl, "source");
    const sourceDigests = await captureDocumentDigests(baseUrl);

    log("backup", "creating verified export from migrated source");
    const backupOutput = await runYtData(["backup"], {
      DATA_DIR: sourceDataDir,
      BACKUP_DIR: backupDir,
      PORT: String(port),
    });
    const backupMatch = backupOutput.match(/Created backup ([^:]+): verified/);
    if (!backupMatch) {
      fail(`backup output missing verified id: ${backupOutput}`);
    }
    const backupId = backupMatch[1];
    await runYtData(["verify", backupId], {
      DATA_DIR: sourceDataDir,
      BACKUP_DIR: backupDir,
      PORT: String(port),
    });

    log("source", "stopping source writer before restore");
    await stopHost(sourceHost);
    sourceHost = null;

    log("desktop", `restoring backup ${backupId} into ${desktopDataDir}`);
    await mkdir(desktopDataDir, { recursive: true });
    await runYtData(["restore", backupId, "--direct"], {
      DATA_DIR: desktopDataDir,
      BACKUP_DIR: backupDir,
    });

    const desktopHost = spawnBundledHost(
      port,
      desktopDataDir,
      join(desktopDataDir, "backups"),
    );
    try {
      await waitForReady(baseUrl, desktopHost);
      await verifyRecords(baseUrl, "desktop destination");
      await verifyDocumentDigests(
        baseUrl,
        "desktop destination",
        sourceDigests,
      );
    } finally {
      await stopHost(desktopHost);
    }

    log("done", "migration rehearsal gate passed");
    log(
      "evidence",
      `fixture=previous-release backup=${backupId} source=${sourceDataDir} destination=${desktopDataDir}`,
    );
  } finally {
    await stopHost(sourceHost);
    if (process.env.PASSBOOK_KEEP_GATE_DATA !== "1") {
      await rm(sourceDataDir, { recursive: true, force: true });
      await rm(desktopDataDir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
