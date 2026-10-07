import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ChildProcess } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const hostRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const hostEntry = join(hostRoot, "src/index.ts");
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

async function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate a port"));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function trpc<T>(
  baseUrl: string,
  path: string,
  input?: unknown,
  asQuery = false,
): Promise<T> {
  let response: Response;
  if (input !== undefined && !asQuery) {
    response = await fetch(`${baseUrl}/api/trpc/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: input }),
    });
  } else if (input !== undefined) {
    response = await fetch(
      `${baseUrl}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`,
    );
  } else {
    response = await fetch(`${baseUrl}/api/trpc/${path}`);
  }
  const body = (await response.json()) as {
    result?: { data: { json: T } };
    error?: { message: string };
  };
  if (!body.result) {
    throw new Error(`${path} failed: ${JSON.stringify(body)}`);
  }
  return body.result.data.json;
}

async function waitForHealth(baseUrl: string, child?: ChildProcess) {
  let stderr = "";
  child?.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });

  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      const body = (await response.json()) as { status?: string };
      if (response.ok && body.status === "ok") return;
    } catch {
      // Host is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `Host did not become ready at ${baseUrl}${stderr ? `\n${stderr}` : ""}`,
  );
}

function spawnHostProcess(env: Record<string, string>) {
  return spawn("node", ["--import", "tsx", hostEntry], {
    cwd: hostRoot,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function stopHostProcess(child: ChildProcess) {
  if (child.killed) return;
  child.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 5_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

describe("passbook host integration", () => {
  let dataDir: string;
  let childHost: ChildProcess | undefined;
  let baseUrl: string;

  afterEach(async () => {
    if (childHost) await stopHostProcess(childHost);
    await rm(dataDir, { recursive: true, force: true });
  });

  it("serves health, setup workflow, uploads, and persists across restart", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "passbook-host-"));
    const port = String(await freePort());
    baseUrl = `http://127.0.0.1:${port}`;

    childHost = spawnHostProcess({
      DATA_DIR: dataDir,
      BACKUP_DIR: join(dataDir, "backups"),
      HOST: "127.0.0.1",
      PORT: port,
      NODE_ENV: "test",
    });
    await waitForHealth(baseUrl, childHost);

    const health = await fetch(`${baseUrl}/api/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({
      status: "ok",
      state: "ready",
    });

    const setupState = await trpc<{ initialized: boolean }>(
      baseUrl,
      "setup.state",
    );
    expect(setupState.initialized).toBe(false);

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
    expect(duplicate.status).toBe(409);

    const people = await trpc<{ id: string }[]>(baseUrl, "people.list");
    const person = people[0];
    if (!person) throw new Error("Expected at least one person");
    const institution = await trpc<{ id: string }>(
      baseUrl,
      "institutions.create",
      { name: "Northwind Bank" },
    );
    const account = await trpc<{ id: string }>(baseUrl, "accounts.create", {
      institutionId: institution.id,
      displayName: "Everyday Chequing",
      accountType: "chequing",
      openedDate: "2026-01-15",
      ownerIds: [person.id],
    });

    const form = new FormData();
    form.set(
      "file",
      new File([pdf], "statement-jan-2026.pdf", { type: "application/pdf" }),
    );
    const upload = await fetch(`${baseUrl}/api/data/upload/document`, {
      method: "POST",
      body: form,
    });
    expect(upload.status).toBe(201);
    const staged = (await upload.json()) as { token: string };

    await trpc(baseUrl, "documents.create", {
      accountId: account.id,
      type: "statement",
      periodKey: "2026-01",
      file: staged.token,
    });

    const statementStatus = await trpc<{
      missingStatements: { accountId: string; periodKey: string }[];
    }>(baseUrl, "overview.statementStatus");
    const stillMissing = statementStatus.missingStatements.some(
      (entry) =>
        entry.accountId === account.id && entry.periodKey === "2026-01",
    );
    expect(stillMissing).toBe(false);

    const docForm = new FormData();
    docForm.set(
      "file",
      new File([pdf], "welcome.pdf", { type: "application/pdf" }),
    );
    const docUpload = await fetch(`${baseUrl}/api/data/upload/document`, {
      method: "POST",
      body: docForm,
    });
    const docStaged = (await docUpload.json()) as { token: string };
    const document = await trpc<{ fileId: string }>(
      baseUrl,
      "documents.create",
      {
        accountId: account.id,
        type: "other",
        title: "Welcome letter",
        file: docStaged.token,
      },
    );

    const fileResponse = await fetch(
      `${baseUrl}/api/data/files/${document.fileId}`,
    );
    expect(fileResponse.status).toBe(200);
    expect(Buffer.from(await fileResponse.arrayBuffer())).toEqual(pdf);

    const summaryBefore = await trpc<{ accountCount: number }>(
      baseUrl,
      "overview.summary",
    );
    expect(summaryBefore.accountCount).toBe(1);

    await stopHostProcess(childHost);
    childHost = undefined;
    await new Promise((resolve) => setTimeout(resolve, 500));
    childHost = spawnHostProcess({
      DATA_DIR: dataDir,
      BACKUP_DIR: join(dataDir, "backups"),
      HOST: "127.0.0.1",
      PORT: port,
      NODE_ENV: "test",
    });
    await waitForHealth(baseUrl, childHost);

    const summaryAfter = await trpc<{ accountCount: number }>(
      baseUrl,
      "overview.summary",
    );
    expect(summaryAfter.accountCount).toBe(1);

    const fileAfter = await fetch(
      `${baseUrl}/api/data/files/${document.fileId}`,
    );
    expect(fileAfter.status).toBe(200);
    expect(Buffer.from(await fileAfter.arrayBuffer())).toEqual(pdf);
  });

  it("deletes an account, removes stored files, and clears inventory", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "passbook-host-"));
    const port = String(await freePort());
    baseUrl = `http://127.0.0.1:${port}`;

    childHost = spawnHostProcess({
      DATA_DIR: dataDir,
      BACKUP_DIR: join(dataDir, "backups"),
      HOST: "127.0.0.1",
      PORT: port,
      NODE_ENV: "test",
    });
    await waitForHealth(baseUrl, childHost);

    await trpc(baseUrl, "setup.initialize", {
      householdName: "Delete test household",
      people: ["Alex"],
    });

    const people = await trpc<{ id: string }[]>(baseUrl, "people.list");
    const person = people[0];
    if (!person) throw new Error("Expected at least one person");

    const institution = await trpc<{ id: string }>(
      baseUrl,
      "institutions.create",
      { name: "Delete Test Bank" },
    );
    const account = await trpc<{ id: string }>(baseUrl, "accounts.create", {
      institutionId: institution.id,
      displayName: "Temporary Chequing",
      accountType: "chequing",
      ownerIds: [person.id],
    });

    const form = new FormData();
    form.set(
      "file",
      new File([pdf], "temp-statement.pdf", { type: "application/pdf" }),
    );
    const upload = await fetch(`${baseUrl}/api/data/upload/document`, {
      method: "POST",
      body: form,
    });
    const staged = (await upload.json()) as { token: string };

    const document = await trpc<{ fileId: string }>(baseUrl, "documents.create", {
      accountId: account.id,
      type: "other",
      title: "Temp upload",
      file: staged.token,
    });

    const preview = await trpc<{
      documentCount: number;
      displayName: string;
    }>(baseUrl, "accounts.deletePreview", { id: account.id }, true);
    expect(preview.displayName).toBe("Temporary Chequing");
    expect(preview.documentCount).toBe(1);

    const deleted = await trpc<{ id: string; deletedDocumentCount: number }>(
      baseUrl,
      "accounts.delete",
      { id: account.id },
    );
    expect(deleted.deletedDocumentCount).toBe(1);

    await expect(
      trpc(baseUrl, "accounts.get", { id: account.id }, true),
    ).rejects.toThrow();

    const fileResponse = await fetch(
      `${baseUrl}/api/data/files/${document.fileId}`,
    );
    expect(fileResponse.status).toBe(404);

    const summary = await trpc<{ accountCount: number }>(
      baseUrl,
      "overview.summary",
    );
    expect(summary.accountCount).toBe(0);
  });
});
