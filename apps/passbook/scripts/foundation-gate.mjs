#!/usr/bin/env node
/**
 * Passbook foundation integration gate.
 *
 * Proves the real host serves the baseline workflow, persists across restart,
 * and supports backup creation, verification, and restore via yt-data.
 *
 * Uses disposable data only — never production volumes.
 */
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const passbookRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hostRoot = join(passbookRoot, "host");
const hostEntry = join(hostRoot, "src/index.ts");
const dataDir = resolve(
  process.env.DATA_DIR ?? join(passbookRoot, ".data/foundation-gate"),
);
const backupDir = resolve(
  process.env.BACKUP_DIR ?? join(dataDir, "backups"),
);
const restoreDataDir = join(dirname(dataDir), "foundation-gate-restore");
const ytData = join(
  passbookRoot,
  "node_modules/@yourtoolshq/data/dist/yt-data.cjs",
);

const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

function log(step, message) {
  console.log(`[foundation-gate] ${step}: ${message}`);
}

function fail(message) {
  console.error(`[foundation-gate] FAIL: ${message}`);
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
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolvePort(port)));
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

function spawnHost(port) {
  return spawn("node", ["--import", "tsx", hostEntry], {
    cwd: hostRoot,
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      BACKUP_DIR: backupDir,
      HOST: "127.0.0.1",
      PORT: String(port),
      NODE_ENV: "test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function waitForHealth(baseUrl, child) {
  let stderr = "";
  child.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });

  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(
        `Host exited with code ${child.exitCode}${stderr ? `\n${stderr}` : ""}`,
      );
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      const body = await response.json();
      if (response.ok && body.status === "ok") return;
    } catch {
      // Host is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(
    `Host did not become ready at ${baseUrl}${stderr ? `\n${stderr}` : ""}`,
  );
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

async function runWorkflow(baseUrl) {
  log("workflow", "checking health");
  const health = await fetch(`${baseUrl}/api/health`);
  if (health.status !== 200) fail("health check returned non-200");
  const healthBody = await health.json();
  if (healthBody.status !== "ok" || healthBody.state !== "ready") {
    fail(`unexpected health payload: ${JSON.stringify(healthBody)}`);
  }

  log("workflow", "setup");
  const setupState = await trpc(baseUrl, "setup.state");
  if (setupState.initialized) fail("expected uninitialized setup state");

  await trpc(baseUrl, "setup.initialize", {
    householdName: "Test household",
    people: ["Alex", "Jordan"],
  });

  const duplicate = await fetch(`${baseUrl}/api/trpc/setup.initialize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      json: { householdName: "Other", people: ["Sam"] },
    }),
  });
  if (duplicate.status !== 409) {
    fail(`expected setup conflict, got ${duplicate.status}`);
  }

  log("workflow", "institution and account");
  const people = await trpc(baseUrl, "people.list");
  const person = people[0];
  if (!person) fail("expected at least one person");

  const institution = await trpc(baseUrl, "institutions.create", {
    name: "Northwind Bank",
  });
  const account = await trpc(baseUrl, "accounts.create", {
    institutionId: institution.id,
    displayName: "Everyday Chequing",
    accountType: "chequing",
    openedDate: "2026-01-15",
    ownerIds: [person.id],
  });

  log("workflow", "statement upload");
  const form = new FormData();
  form.set(
    "file",
    new File([pdf], "statement-jan-2026.pdf", { type: "application/pdf" }),
  );
  const upload = await fetch(`${baseUrl}/api/data/upload/document`, {
    method: "POST",
    body: form,
  });
  if (upload.status !== 201) fail(`statement upload failed: ${upload.status}`);
  const staged = await upload.json();

  await trpc(baseUrl, "documents.create", {
    accountId: account.id,
    type: "statement",
    periodKey: "2026-01",
    file: staged.token,
  });

  const statementStatus = await trpc(baseUrl, "overview.statementStatus");
  const stillMissing = statementStatus.missingStatements.some(
    (entry) =>
      entry.accountId === account.id && entry.periodKey === "2026-01",
  );
  if (stillMissing) fail("statement period still marked missing");

  log("workflow", "account document upload");
  const docForm = new FormData();
  docForm.set(
    "file",
    new File([pdf], "welcome.pdf", { type: "application/pdf" }),
  );
  const docUpload = await fetch(`${baseUrl}/api/data/upload/document`, {
    method: "POST",
    body: docForm,
  });
  const docStaged = await docUpload.json();
  const document = await trpc(baseUrl, "documents.create", {
    accountId: account.id,
    type: "other",
    title: "Welcome letter",
    file: docStaged.token,
  });

  const fileResponse = await fetch(
    `${baseUrl}/api/data/files/${document.fileId}`,
  );
  if (fileResponse.status !== 200) fail("file GET failed");
  const fileBytes = Buffer.from(await fileResponse.arrayBuffer());
  if (!fileBytes.equals(pdf)) fail("file bytes mismatch");

  const summary = await trpc(baseUrl, "overview.summary");
  if (summary.accountCount !== 1) {
    fail(`expected 1 account, got ${summary.accountCount}`);
  }

  return { account, document, summary };
}

async function main() {
  log("setup", `cleaning ${dataDir}`);
  await rm(dataDir, { recursive: true, force: true });
  await rm(restoreDataDir, { recursive: true, force: true });
  await mkdir(dataDir, { recursive: true });
  await mkdir(backupDir, { recursive: true });

  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  log("setup", `starting host on ${baseUrl}`);

  let host = spawnHost(port);
  try {
    await waitForHealth(baseUrl, host);
    const beforeRestart = await runWorkflow(baseUrl);

    log("backup", "creating verified backup via yt-data");
    const backupOutput = await runYtData(["backup"], {
      DATA_DIR: dataDir,
      BACKUP_DIR: backupDir,
      PORT: String(port),
    });
    const backupMatch = backupOutput.match(
      /Created backup ([^:]+): verified/,
    );
    if (!backupMatch) fail(`backup output missing verified id: ${backupOutput}`);
    const backupId = backupMatch[1];

    log("backup", `verifying backup ${backupId}`);
    await runYtData(["verify", backupId], {
      DATA_DIR: dataDir,
      BACKUP_DIR: backupDir,
      PORT: String(port),
    });

    log("restart", "stopping host to test persistence");
    await stopHost(host);
    host = null;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));

    host = spawnHost(port);
    await waitForHealth(baseUrl, host);

    const summaryAfter = await trpc(baseUrl, "overview.summary");
    if (summaryAfter.accountCount !== beforeRestart.summary.accountCount) {
      fail("account count changed after restart");
    }

    const fileAfter = await fetch(
      `${baseUrl}/api/data/files/${beforeRestart.document.fileId}`,
    );
    if (fileAfter.status !== 200) fail("file missing after restart");
    const fileAfterBytes = Buffer.from(await fileAfter.arrayBuffer());
    if (!fileAfterBytes.equals(pdf)) fail("file bytes changed after restart");

    log("restore", "stopping host for restore into fresh data directory");
    await stopHost(host);
    host = null;
    await mkdir(restoreDataDir, { recursive: true });

    log("restore", `restoring backup ${backupId} into ${restoreDataDir}`);
    await runYtData(["restore", backupId, "--direct"], {
      DATA_DIR: restoreDataDir,
      BACKUP_DIR: backupDir,
    });

    host = spawn("node", ["--import", "tsx", hostEntry], {
      cwd: hostRoot,
      env: {
        ...process.env,
        DATA_DIR: restoreDataDir,
        BACKUP_DIR: backupDir,
        HOST: "127.0.0.1",
        PORT: String(port),
        NODE_ENV: "test",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await waitForHealth(baseUrl, host);

    const restoredState = await trpc(baseUrl, "setup.state");
    if (!restoredState.initialized) fail("restored data is not initialized");

    const restoredSummary = await trpc(baseUrl, "overview.summary");
    if (restoredSummary.accountCount !== beforeRestart.summary.accountCount) {
      fail("restored account count mismatch");
    }

    const restoredFile = await fetch(
      `${baseUrl}/api/data/files/${beforeRestart.document.fileId}`,
    );
    if (restoredFile.status !== 200) fail("restored file missing");
    const restoredBytes = Buffer.from(await restoredFile.arrayBuffer());
    if (!restoredBytes.equals(pdf)) fail("restored file bytes mismatch");

    log("done", "all foundation gate assertions passed");
  } finally {
    await stopHost(host);
    if (process.env.PASSBOOK_KEEP_GATE_DATA !== "1") {
      await rm(dataDir, { recursive: true, force: true });
      await rm(restoreDataDir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
