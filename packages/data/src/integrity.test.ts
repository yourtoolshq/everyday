import { access, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withDatabaseFile } from "./backup/sqlite";
import { DataPlatformBusyError, defineDataPlatform } from "./platform";
import { createDataRouter } from "./router";
import { filesTable } from "./schema";
import {
  createTestPlatform,
  pdfBytes,
  platformMigration,
  writeMigrations,
} from "./test-platform";

const statementsMigration = {
  tag: "0001_statements",
  sql: "CREATE TABLE statements (id text PRIMARY KEY NOT NULL, file_id text NOT NULL REFERENCES yt_files(id));",
};

let context: Awaited<ReturnType<typeof createTestPlatform>>;
const platform = () => context.platform;

function reopenWith(migrations: { tag: string; sql: string }[]) {
  context.platform.close();
  return writeMigrations(context.migrationsFolder, migrations).then(() => {
    context.platform = defineDataPlatform({
      app: "test",
      dataDir: context.dataDir,
      db: {
        schema: { filesTable },
        migrationsFolder: context.migrationsFolder,
      },
    });
    return context.platform;
  });
}

async function stageAndClaim(name: string, statementId?: string) {
  const staged = await platform().files.stage({
    endpoint: "statement",
    originalFilename: name,
    bytes: pdfBytes,
    type: { group: "pdf", mimeType: "application/pdf", extension: "pdf" },
  });
  return platform().files.withFiles(platform().db, async (tx, files) => {
    const file = await files.claim(staged.token);
    if (statementId) {
      await tx.run(
        sql`INSERT INTO statements (id, file_id) VALUES (${statementId}, ${file.id})`,
      );
    }
    return file;
  });
}

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

beforeEach(async () => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  context = await createTestPlatform();
  await (await reopenWith([platformMigration, statementsMigration])).settled();
});

afterEach(async () => {
  await context.cleanup();
  vi.restoreAllMocks();
});

describe("integrity.scan", () => {
  it("reports intact data", async () => {
    await stageAndClaim("Chequing March.pdf", "statement-1");

    const report = await platform().integrity.scan();

    expect(report).toMatchObject({
      database: {
        problems: [],
        foreignKeyViolations: { count: 0, first: [] },
      },
      files: {
        checked: 1,
        checksumsRecorded: 0,
        missing: [],
        checksumMismatches: [],
        unreferenced: [],
        quarantined: [],
      },
    });
    expect(platform().integrity.lastReport()).toEqual(report);
  });

  it("records checksums for files stored without one", async () => {
    const file = await stageAndClaim("Chequing March.pdf", "statement-1");
    await platform().db.run(sql`UPDATE yt_files SET sha256 = NULL`);

    const report = await platform().integrity.scan();

    expect(report.files.checksumsRecorded).toBe(1);
    const [row] = await platform().db.select().from(filesTable);
    expect(row?.sha256).toBe(file.sha256);
  });

  it("reports missing and changed files with the records that reference them", async () => {
    const missing = await stageAndClaim("Chequing March.pdf", "statement-1");
    const changed = await stageAndClaim("Visa March.pdf", "statement-2");
    await rm(join(context.documentsDir, missing.storageKey));
    await writeFile(join(context.documentsDir, changed.storageKey), "altered");

    const { files } = await platform().integrity.scan();

    expect(files.checked).toBe(1);
    expect(files.missing).toEqual([
      {
        fileId: missing.id,
        storageKey: missing.storageKey,
        originalFilename: "Chequing March.pdf",
        endpoint: "statement",
        referencedBy: [{ table: "statements", key: "statement-1" }],
      },
    ]);
    expect(files.checksumMismatches).toEqual([
      expect.objectContaining({
        fileId: changed.id,
        referencedBy: [{ table: "statements", key: "statement-2" }],
      }),
    ]);
  });

  it("reports rows nothing references and files without a row", async () => {
    const unreferenced = await stageAndClaim("Old statement.pdf");
    await writeFile(join(context.documentsDir, "stray.pdf"), "stray");
    await mkdir(join(context.documentsDir, ".staging"), { recursive: true });
    await writeFile(join(context.documentsDir, ".staging", "upload"), "x");

    const { files } = await platform().integrity.scan();

    expect(files.unreferenced).toEqual([
      {
        name: unreferenced.storageKey,
        sizeBytes: pdfBytes.byteLength,
        file: {
          id: unreferenced.id,
          originalFilename: "Old statement.pdf",
          endpoint: "statement",
        },
      },
      { name: "stray.pdf", sizeBytes: 5, file: null },
    ]);
  });

  it("reports foreign key violations", async () => {
    await withDatabaseFile(join(context.dataDir, "test.db"), async (client) => {
      await client.execute("PRAGMA foreign_keys = OFF");
      await client.execute(
        "INSERT INTO statements (id, file_id) VALUES ('statement-1', 'no-such-file')",
      );
    });

    const { database } = await platform().integrity.scan();

    expect(database.foreignKeyViolations).toEqual({
      count: 1,
      first: [{ table: "statements", rowid: 1, parent: "yt_files" }],
    });
  });
});

describe("integrity.quarantine", () => {
  it("moves unreferenced files to .orphans and deletes their rows", async () => {
    const unreferenced = await stageAndClaim("Old statement.pdf");
    const referenced = await stageAndClaim("Chequing March.pdf", "statement-1");
    await writeFile(join(context.documentsDir, "stray.pdf"), "stray");

    const result = await platform().integrity.quarantine([
      unreferenced.storageKey,
      "stray.pdf",
      referenced.storageKey,
    ]);

    expect(result).toEqual({
      quarantined: [unreferenced.storageKey, "stray.pdf"],
      skipped: [referenced.storageKey],
    });
    expect(
      (await platform().db.select().from(filesTable)).map((row) => row.id),
    ).toEqual([referenced.id]);
    expect(
      await exists(join(context.documentsDir, referenced.storageKey)),
    ).toBe(true);
    const { files } = await platform().integrity.scan();
    expect(files.unreferenced).toEqual([]);
    expect(files.quarantined).toEqual([
      {
        name: unreferenced.storageKey,
        sizeBytes: pdfBytes.byteLength,
        originalFilename: "Old statement.pdf",
      },
      { name: "stray.pdf", sizeBytes: 5, originalFilename: null },
    ]);
  });

  it("waits for a claim in progress instead of taking its file", async () => {
    const staged = await platform().files.stage({
      endpoint: "statement",
      originalFilename: "Chequing March.pdf",
      bytes: pdfBytes,
      type: { group: "pdf", mimeType: "application/pdf", extension: "pdf" },
    });
    let finishClaim!: () => void;
    const claimHeld = new Promise<void>((resolve) => (finishClaim = resolve));
    const claiming = platform().files.withFiles(
      platform().db,
      async (tx, files) => {
        const file = await files.claim(staged.token);
        await tx.run(
          sql`INSERT INTO statements (id, file_id) VALUES ('statement-1', ${file.id})`,
        );
        await claimHeld;
        return file;
      },
    );
    const name = await vi.waitFor(async () => {
      const claimed = (await readdir(context.documentsDir)).find((entry) =>
        entry.endsWith(".pdf"),
      );
      if (!claimed) throw new Error("The claimed file is not written yet");
      return claimed;
    });

    const quarantining = platform().integrity.quarantine([name]);
    await sleep(100);
    finishClaim();
    const file = await claiming;

    expect(await quarantining).toEqual({
      quarantined: [],
      skipped: [file.storageKey],
    });
    expect(await exists(join(context.documentsDir, file.storageKey))).toBe(
      true,
    );
  });

  it("keeps a file already quarantined under the same name", async () => {
    await mkdir(join(context.documentsDir, ".orphans"), { recursive: true });
    await writeFile(join(context.documentsDir, ".orphans", "stray.pdf"), "old");
    await writeFile(join(context.documentsDir, "stray.pdf"), "new");

    const result = await platform().integrity.quarantine(["stray.pdf"]);

    expect(result).toEqual({ quarantined: [], skipped: ["stray.pdf"] });
    expect(await exists(join(context.documentsDir, "stray.pdf"))).toBe(true);
  });
});

describe("integrity.purge", () => {
  it("deletes quarantined files", async () => {
    await stageAndClaim("Old statement.pdf");
    const { files } = await platform().integrity.scan();
    const names = files.unreferenced.map((file) => file.name);
    await platform().integrity.quarantine(names);

    expect(await platform().integrity.purge(names)).toEqual({ purged: names });
    expect(await readdir(join(context.documentsDir, ".orphans"))).toEqual([]);
  });

  it("rejects names outside the quarantine folder", async () => {
    const caller = createDataRouter(platform()).createCaller({});

    await expect(
      caller.integrity.purge({ names: ["../test.db"] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(platform().integrity.purge(["../test.db"])).rejects.toThrow(
      "Invalid quarantined file name",
    );
    expect(await exists(join(context.dataDir, "test.db"))).toBe(true);
  });
});

describe("integrity while the data is not ready", () => {
  it("refuses to scan, quarantine, or purge", async () => {
    const blocked = await reopenWith([platformMigration]);
    expect(await blocked.state()).toMatchObject({ state: "blocked" });

    await expect(blocked.integrity.scan()).rejects.toThrow(
      DataPlatformBusyError,
    );
    await expect(blocked.integrity.quarantine([])).rejects.toThrow(
      DataPlatformBusyError,
    );
    await expect(
      createDataRouter(blocked).createCaller({}).integrity.purge({ names: [] }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
