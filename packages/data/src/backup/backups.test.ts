import {
  access,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defineDataPlatform } from "../platform";
import { filesTable } from "../schema";
import {
  createTestPlatform,
  filesMigration,
  pdfBytes,
  writeMigrations,
} from "../test-platform";

let context: Awaited<ReturnType<typeof createTestPlatform>>;
const platform = () => context.platform;
const backupDir = () => join(context.dataDir, "backups");

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

async function addFile(name = "Chequing March.pdf") {
  const staged = await platform().files.stage({
    endpoint: "statement",
    originalFilename: name,
    bytes: pdfBytes,
    type: { group: "pdf", mimeType: "application/pdf", extension: "pdf" },
  });
  return platform().files.withFiles(context.db, (_tx, files) =>
    files.claim(staged.token),
  );
}

function removeFile(fileId: string) {
  return platform().files.withFiles(context.db, (_tx, files) =>
    files.remove(fileId),
  );
}

function definePlatformAgain() {
  return defineDataPlatform({
    app: "test",
    dataDir: context.dataDir,
    db: {
      schema: { filesTable },
      migrationsFolder: context.migrationsFolder,
    },
  });
}

async function listArchives() {
  return (await readdir(backupDir())).filter((name) =>
    name.endsWith(".ytbackup"),
  );
}

async function flipByteAfter(path: string, marker: string) {
  const bytes = await readFile(path);
  const index = bytes.indexOf(marker);
  expect(index).toBeGreaterThan(0);
  bytes[index + marker.length] = (bytes[index + marker.length] ?? 0) ^ 0xff;
  await writeFile(path, bytes);
}

beforeEach(async () => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  context = await createTestPlatform();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await context.cleanup();
});

describe("backups.create", () => {
  it("archives the database and files and verifies the archive", async () => {
    const file = await addFile();

    const backup = await platform().backups.create();

    expect(backup.verification.status).toBe("verified");
    expect(backup.id).toMatch(
      /^test-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z$/,
    );
    expect(backup.manifest).toMatchObject({
      formatVersion: 1,
      app: "test",
      appVersion: null,
      trigger: "manual",
      migrations: [{ tag: "0000_files", hash: expect.any(String) as string }],
      rowCounts: { __drizzle_migrations: 1, yt_files: 1 },
      files: [
        {
          id: file.id,
          path: `documents/${file.storageKey}`,
          size: pdfBytes.byteLength,
          sha256: file.sha256,
        },
      ],
      missingFiles: [],
    });
    const sidecar = JSON.parse(
      await readFile(`${backup.path}.json`, "utf8"),
    ) as unknown;
    expect(sidecar).toEqual({
      manifest: backup.manifest,
      verification: backup.verification,
    });
    expect(await readdir(backupDir())).toEqual([
      ".work",
      `${backup.id}.ytbackup`,
      `${backup.id}.ytbackup.json`,
    ]);
    expect(await readdir(join(backupDir(), ".work"))).toEqual([]);
  });

  it("records files missing on disk and still verifies", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const file = await addFile();
    await rm(join(context.documentsDir, file.storageKey));

    const backup = await platform().backups.create();

    expect(backup.verification.status).toBe("verified");
    expect(backup.manifest?.files).toEqual([]);
    expect(backup.manifest?.missingFiles).toEqual([
      { id: file.id, storageKey: file.storageKey },
    ]);
    expect(warn).toHaveBeenCalledWith(
      "backup skipped a file missing on disk",
      expect.objectContaining({ fileId: file.id }),
    );
  });
});

describe("backups.verify", () => {
  it("fails an archive whose file bytes changed", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const file = await addFile();
    const backup = await platform().backups.create();
    await flipByteAfter(backup.path, "%PDF-1.7\n");

    const result = await platform().backups.verify(backup.path);

    expect(result.verification).toMatchObject({
      status: "failed",
      error: `File ${file.id} (documents/${file.storageKey}) does not match the manifest`,
    });
    const sidecar = JSON.parse(
      await readFile(`${backup.path}.json`, "utf8"),
    ) as { verification: { status: string } };
    expect(sidecar.verification.status).toBe("failed");
  });

  it("fails a file that is not a backup archive", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await mkdir(backupDir(), { recursive: true });
    const path = join(backupDir(), "not-a-backup.ytbackup");
    await writeFile(path, "not a tarball, just some fictional text".repeat(20));

    const result = await platform().backups.verify(path);

    expect(result.verification.status).toBe("failed");
    expect(result.manifest).toBeNull();
  });
});

describe("backups.list", () => {
  it("returns no backups before the backup directory exists", async () => {
    expect(await platform().backups.list()).toEqual([]);
  });

  it("lists archives newest first with their verification", async () => {
    const older = await platform().backups.create();
    await sleep(2);
    const newer = await platform().backups.create();
    await writeFile(join(backupDir(), "stray.ytbackup.partial"), "partial");

    const backups = await platform().backups.list();

    expect(backups.map((b) => b.id)).toEqual([newer.id, older.id]);
    expect(backups[0]).toEqual({
      ...newer,
      size: expect.any(Number) as number,
    });
  });

  it("lists an archive without a sidecar as unverified", async () => {
    const backup = await platform().backups.create();
    await rm(`${backup.path}.json`);

    expect(await platform().backups.list()).toEqual([
      expect.objectContaining({
        id: backup.id,
        manifest: null,
        verification: null,
      }),
    ]);
  });
});

describe("backups.find", () => {
  it("finds a backup by id", async () => {
    const backup = await platform().backups.create();

    expect(await platform().backups.find(backup.id)).toMatchObject({
      id: backup.id,
      path: backup.path,
    });
    expect(await platform().backups.find("test-missing")).toBeNull();
  });

  it("rejects ids that leave the backup directory", async () => {
    await platform().backups.create();

    for (const id of ["../test", ".work", "a/b", ""]) {
      expect(await platform().backups.find(id)).toBeNull();
    }
  });
});

describe("backups.restore", () => {
  it("restores the database and files in place", async () => {
    const kept = await addFile("Kept.pdf");
    const backup = await platform().backups.create();
    const added = await addFile("Added later.pdf");
    await removeFile(kept.id);

    const result = await platform().backups.restore(backup.path);

    expect(result.manifest.createdAt).toBe(backup.manifest?.createdAt);
    expect(await platform().files.get(added.id)).toBeNull();
    expect(await exists(join(context.documentsDir, added.storageKey))).toBe(
      false,
    );
    expect(await platform().files.get(kept.id)).toEqual(kept);
    expect((await platform().files.read(kept.id))?.bytes).toEqual(
      Buffer.from(pdfBytes),
    );
    expect(await listArchives()).toContain(
      `${result.preRestoreBackup}.ytbackup`,
    );
    expect(await exists(join(context.dataDir, ".restore"))).toBe(false);
    expect(await exists(join(context.dataDir, "restore.inprogress"))).toBe(
      false,
    );
  });

  it("serves queries issued during a restore", async () => {
    const kept = await addFile();
    const backup = await platform().backups.create();
    await addFile("Added later.pdf");

    let restored = false;
    const restore = platform()
      .backups.restore(backup.path)
      .finally(() => (restored = true));
    const queries: Promise<unknown>[] = [];
    while (!restored) {
      queries.push(context.db.select().from(filesTable));
      await sleep(1);
    }
    await restore;

    await expect(Promise.all(queries)).resolves.toBeDefined();
    expect(await context.db.select().from(filesTable)).toEqual([kept]);
  });

  it("rejects a tampered archive without touching the data", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await addFile();
    const backup = await platform().backups.create();
    const added = await addFile("Added later.pdf");
    await flipByteAfter(backup.path, "%PDF-1.7\n");

    await expect(platform().backups.restore(backup.path)).rejects.toThrow(
      "does not match the manifest",
    );
    expect(await platform().files.get(added.id)).toEqual(added);
    expect(await listArchives()).toHaveLength(1);
    expect(await exists(join(context.dataDir, ".restore"))).toBe(false);
  });

  it("rejects a backup from a version with unknown migrations", async () => {
    const root = await mkdtemp(join(tmpdir(), "yt-data-newer-"));
    const migrationsFolder = join(root, "drizzle");
    await writeMigrations(migrationsFolder, [
      filesMigration,
      { tag: "0001_notes", sql: "CREATE TABLE notes (id text PRIMARY KEY);" },
    ]);
    const newer = defineDataPlatform({
      app: "test",
      dataDir: join(root, "data"),
      db: { schema: { filesTable }, migrationsFolder },
    });
    try {
      await newer.boot();
      const backup = await newer.backups.create();

      await expect(platform().backups.restore(backup.path)).rejects.toThrow(
        "it has migrations this version does not know: 0001_notes",
      );
    } finally {
      newer.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("boot", () => {
  async function interruptSwap(stage: "swapping" | "swapped") {
    const kept = await addFile();
    platform().close();
    const previousDir = join(context.dataDir, ".restore", "previous");
    await mkdir(previousDir, { recursive: true });
    await rename(
      join(context.dataDir, "test.db"),
      join(previousDir, "test.db"),
    );
    await rename(context.documentsDir, join(previousDir, "documents"));
    await writeFile(join(context.dataDir, "test.db"), "half-restored");
    await mkdir(context.documentsDir);
    await writeFile(
      join(context.dataDir, "restore.inprogress"),
      JSON.stringify({ stage, archive: "a.ytbackup", preRestoreBackup: "b" }),
    );
    context.platform = definePlatformAgain();
    return kept;
  }

  it("rolls back a restore interrupted during the swap", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const kept = await interruptSwap("swapping");

    await platform().boot();

    expect(await platform().files.read(kept.id)).not.toBeNull();
    expect(await exists(join(context.dataDir, ".restore"))).toBe(false);
    expect(await exists(join(context.dataDir, "restore.inprogress"))).toBe(
      false,
    );
    expect(warn).toHaveBeenCalledWith(
      "rolling back an interrupted restore",
      expect.objectContaining({ stage: "swapping" }),
    );
  });

  it("keeps the restored data when the swap had finished", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await interruptSwap("swapped");
    await rm(join(context.dataDir, "test.db"));

    await platform().boot();

    expect(await platform().db.select().from(filesTable)).toEqual([]);
    expect(await exists(join(context.dataDir, ".restore"))).toBe(false);
  });
});
