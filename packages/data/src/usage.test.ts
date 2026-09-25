import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defineDataPlatform } from "./platform";
import { createDataRouter } from "./router";
import { filesTable } from "./schema";
import { createTestPlatform, pdfBytes, writeMigrations } from "./test-platform";

let context: Awaited<ReturnType<typeof createTestPlatform>>;

function reopen(options: { backupDir?: string } = {}) {
  context.platform.close();
  context.platform = defineDataPlatform({
    app: "test",
    dataDir: context.dataDir,
    backupDir: options.backupDir,
    db: { schema: { filesTable }, migrationsFolder: context.migrationsFolder },
  });
  return context.platform;
}

async function claimPdf() {
  const { files, db } = context.platform;
  const staged = await files.stage({
    endpoint: "statement",
    originalFilename: "Chequing March.pdf",
    bytes: pdfBytes,
    type: { group: "pdf", mimeType: "application/pdf", extension: "pdf" },
  });
  return files.withFiles(db, (_tx, tx) => tx.claim(staged.token));
}

beforeEach(async () => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  context = await createTestPlatform();
});

afterEach(async () => {
  await context.cleanup();
  vi.restoreAllMocks();
});

describe("usage", () => {
  it("reports the database, files by type group, backups, and free space", async () => {
    await claimPdf();
    await claimPdf();
    await context.db.run(
      `INSERT INTO yt_files (id, storage_key, original_filename, mime_type, size_bytes, endpoint)
       VALUES ('4f7d3c2a-1b0e-4a9f-8c6d-5e4f3a2b1c0d', '4f7d3c2a-1b0e-4a9f-8c6d-5e4f3a2b1c0d.bin', 'notes.bin', 'application/octet-stream', 7, 'statement')`,
    );
    const backup = await context.platform.backups.create();

    const usage = await context.platform.usage();

    expect(usage.database.bytes).toBeGreaterThan(0);
    expect(usage.files).toEqual({
      count: 3,
      bytes: 2 * pdfBytes.byteLength + 7,
      byGroup: {
        pdf: { count: 2, bytes: 2 * pdfBytes.byteLength },
        image: { count: 0, bytes: 0 },
        eml: { count: 0, bytes: 0 },
        audio: { count: 0, bytes: 0 },
        other: { count: 1, bytes: 7 },
      },
    });
    const [summary] = await context.platform.backups.list();
    expect(summary?.id).toBe(backup.id);
    expect(usage.backups).toEqual({ count: 1, bytes: summary?.size });
    for (const volume of [usage.volumes.data, usage.volumes.backups]) {
      expect(volume.totalBytes).toBeGreaterThan(0);
      expect(volume.freeBytes).toBeGreaterThan(0);
      expect(volume.freeBytes).toBeLessThanOrEqual(volume.totalBytes);
    }
  });

  it("reports the volume of a backup directory that does not exist yet", async () => {
    const usage = await reopen({
      backupDir: join(context.root, "backups", "test"),
    }).usage();

    expect(usage.backups).toEqual({ count: 0, bytes: 0 });
    expect(usage.volumes.backups.totalBytes).toBeGreaterThan(0);
  });

  it("answers CONFLICT while the data is not ready", async () => {
    await writeMigrations(context.migrationsFolder, []);
    const blocked = reopen();
    expect(await blocked.state()).toMatchObject({ state: "blocked" });

    await expect(
      createDataRouter(blocked).createCaller({}).usage.get(),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("backups.status", () => {
  it("is stale before the first backup and ok after it", async () => {
    expect(await context.platform.backups.status()).toMatchObject({
      status: "stale",
      lastVerifiedBackupAt: null,
    });

    const backup = await context.platform.backups.create();

    expect(await context.platform.backups.status()).toEqual({
      status: "ok",
      lastVerifiedBackupAt: backup.manifest?.createdAt,
      lastError: null,
      sharesDataDir: true,
    });
  });

  it("is failing after a backup throws, until one succeeds", async () => {
    const workDir = join(context.dataDir, "backups", ".work");
    await mkdir(join(context.dataDir, "backups"), { recursive: true });
    await writeFile(workDir, "not a directory");

    await expect(context.platform.backups.create()).rejects.toThrow();
    expect(await context.platform.backups.status()).toMatchObject({
      status: "failing",
      lastError: expect.any(String) as string,
    });

    await rm(workDir);
    await context.platform.backups.create();
    expect(await context.platform.backups.status()).toMatchObject({
      status: "ok",
      lastError: null,
    });
  });

  it("is failing when the backup directory cannot be read", async () => {
    const backupDir = join(context.root, "backups");
    await writeFile(backupDir, "not a directory");

    expect(await reopen({ backupDir }).backups.status()).toMatchObject({
      status: "failing",
      lastError: expect.any(String) as string,
      sharesDataDir: false,
    });
  });

  it("reports a backup directory outside the data directory", async () => {
    const status = await reopen({
      backupDir: join(context.root, "backups"),
    }).backups.status();

    expect(status.sharesDataDir).toBe(false);
  });
});
