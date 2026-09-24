import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFileRouter } from "../files/router";
import { createDataHandlers } from "../next/handlers";
import { defineDataPlatform } from "../platform";
import { filesTable } from "../schema";
import {
  createTestPlatform,
  pdfBytes,
  platformMigration,
  writeMigrations,
} from "../test-platform";
import { runCli } from "./run";

let context: Awaited<ReturnType<typeof createTestPlatform>>;
let output: { stdout: string[]; stderr: string[] };

async function addFile(name: string) {
  const staged = await context.platform.files.stage({
    endpoint: "statement",
    originalFilename: name,
    bytes: pdfBytes,
    type: { group: "pdf", mimeType: "application/pdf", extension: "pdf" },
  });
  return context.platform.files.withFiles(context.db, (_tx, files) =>
    files.claim(staged.token),
  );
}

function cli(...args: string[]) {
  return runCli(
    [
      ...args,
      "--app",
      "test",
      "--migrations",
      context.migrationsFolder,
      "--data-dir",
      context.dataDir,
    ],
    {
      env: {},
      stdout: (line) => output.stdout.push(line),
      stderr: (line) => output.stderr.push(line),
    },
  );
}

function reopenPlatform() {
  context.platform = defineDataPlatform({
    app: "test",
    dataDir: context.dataDir,
    db: { schema: { filesTable }, migrationsFolder: context.migrationsFolder },
  });
  context.db = context.platform.db;
  return context.platform;
}

// Serves the platform's handlers the way the Next.js catch-all route does.
async function serveApplication() {
  const handlers = createDataHandlers(context.platform, {
    fileRouter: createFileRouter({}),
  });
  const server = createServer((request, response) => {
    void (async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(chunk as Buffer);
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const path = url.pathname.replace(/^\/api\/data\//, "").split("/");
      const handler = request.method === "POST" ? handlers.POST : handlers.GET;
      const answer = await handler(
        new Request(url, {
          method: request.method,
          headers: request.headers as Record<string, string>,
          body: request.method === "POST" ? Buffer.concat(chunks) : undefined,
        }),
        { params: Promise.resolve({ path }) },
      );
      response.writeHead(answer.status, Object.fromEntries(answer.headers));
      response.end(Buffer.from(await answer.arrayBuffer()));
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function unusedUrl() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return `http://127.0.0.1:${port}`;
}

beforeEach(async () => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  context = await createTestPlatform();
  output = { stdout: [], stderr: [] };
});

afterEach(async () => {
  vi.restoreAllMocks();
  await context.cleanup();
});

describe("with the application running", () => {
  let application: Awaited<ReturnType<typeof serveApplication>>;

  beforeEach(async () => {
    application = await serveApplication();
  });

  afterEach(async () => {
    await application.close();
  });

  it("backs up, lists, verifies, and restores through the application", async () => {
    const kept = await addFile("Kept.pdf");

    expect(await cli("backup", "--url", application.url)).toBe(0);
    const [created] = await context.platform.backups.list();
    expect(output.stdout).toEqual([`Created backup ${created?.id}: verified`]);
    expect(output.stderr).toEqual([
      `Using the application at ${application.url}`,
    ]);
    const added = await addFile("Added later.pdf");

    output.stdout = [];
    expect(await cli("list", "--url", application.url)).toBe(0);
    expect(output.stdout).toEqual([
      expect.stringMatching(
        new RegExp(`^${created?.id}\tmanual\t[\\d.]+ KB\tverified$`),
      ),
    ]);

    expect(
      await cli("verify", created?.id ?? "", "--url", application.url),
    ).toBe(0);
    expect(
      await cli("restore", created?.path ?? "", "--url", application.url),
    ).toBe(0);
    expect(output.stdout.at(-1)).toMatch(
      new RegExp(`^Restored backup ${created?.id}, created `),
    );
    expect(await context.platform.files.get(kept.id)).toEqual(kept);
    expect(await context.platform.files.get(added.id)).toBeNull();
  });

  it("asks for archives outside the backup directory to be copied in", async () => {
    await context.platform.backups.create();
    const [backup] = await context.platform.backups.list();
    const elsewhere = await mkdtemp(join(tmpdir(), "yt-data-elsewhere-"));
    const copy = join(elsewhere, `${backup?.id}.ytbackup`);
    await copyFile(backup?.path ?? "", copy);

    try {
      expect(await cli("restore", copy, "--url", application.url)).toBe(1);
      expect(output.stderr.at(-1)).toMatch(
        /only restores and verifies backups in .*; copy .* there first$/,
      );
    } finally {
      await rm(elsewhere, { recursive: true, force: true });
    }
  });

  it("refuses to work on another application", async () => {
    const code = await runCli(
      ["list", "--app", "other", "--migrations", context.migrationsFolder],
      {
        env: { DATA_DIR: context.dataDir, PORT: new URL(application.url).port },
        stdout: (line) => output.stdout.push(line),
        stderr: (line) => output.stderr.push(line),
      },
    );

    expect(code).toBe(1);
    expect(output.stderr).toEqual([
      `yt-data: ${application.url} is test, not other`,
    ]);
  });

  it("reports errors from the application", async () => {
    expect(await cli("restore", "test-missing", "--url", application.url)).toBe(
      1,
    );
    expect(output.stderr.at(-1)).toBe("yt-data: Backup test-missing not found");
  });
});

describe("with the application stopped", () => {
  it("works on the data directory directly", async () => {
    const kept = await addFile("Kept.pdf");
    context.platform.close();
    const url = await unusedUrl();

    expect(await cli("backup", "--url", url)).toBe(0);
    expect(output.stderr[0]).toBe(
      `No application answers at ${url}; working on ${context.dataDir} directly. The application must be stopped.`,
    );
    const [created] = await reopenPlatform().backups.list();
    const added = await addFile("Added later.pdf");
    context.platform.close();

    expect(await cli("restore", created?.id ?? "", "--direct")).toBe(0);

    const platform = reopenPlatform();
    expect(await platform.files.get(kept.id)).toEqual(kept);
    expect(await platform.files.get(added.id)).toBeNull();
  });

  it("restores into an empty data directory", async () => {
    await addFile("Kept.pdf");
    const backup = await context.platform.backups.create();
    const elsewhere = await mkdtemp(join(tmpdir(), "yt-data-archive-"));
    const archive = join(elsewhere, `${backup.id}.ytbackup`);
    await copyFile(backup.path, archive);
    context.platform.close();
    await rm(context.dataDir, { recursive: true, force: true });

    try {
      expect(await cli("restore", archive, "--direct")).toBe(0);
      expect(await reopenPlatform().db.select().from(filesTable)).toHaveLength(
        1,
      );
    } finally {
      await rm(elsewhere, { recursive: true, force: true });
    }
  });

  it("restores a database this version cannot open", async () => {
    const backup = await context.platform.backups.create();
    context.platform.close();
    await writeMigrations(context.migrationsFolder, [
      platformMigration,
      { tag: "0001_notes", sql: "CREATE TABLE notes (id text PRIMARY KEY);" },
    ]);
    await reopenPlatform().boot();
    context.platform.close();
    await writeMigrations(context.migrationsFolder, [platformMigration]);

    expect(await cli("restore", backup.id, "--direct")).toBe(0);
    expect(output.stderr).toContainEqual(
      expect.stringContaining("yt-data: This database was upgraded by"),
    );
    await expect(reopenPlatform().boot()).resolves.toBeUndefined();
  });
});

describe("usage", () => {
  it.each([
    [[]],
    [["prune"]],
    [["restore"]],
    [["list", "extra"]],
    [["list", "--unknown"]],
  ])("rejects %j", async (args) => {
    expect(await cli(...args)).toBe(2);
    expect(output.stderr.at(-1)).toContain("Usage: yt-data");
  });
});
