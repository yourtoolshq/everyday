import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { defineDataPlatform } from "@yourtoolshq/data";

import * as schema from "~/server/db/schema";
import { filesTable, records } from "~/server/db/schema";
import { exportLegacyAttachments } from "~/server/legacy-files";

const migrationsFolder = fileURLToPath(
  new URL("../../../drizzle", import.meta.url),
);
const fixturePath = fileURLToPath(
  new URL("./fixtures/previous-release/taxbook.sql", import.meta.url),
);

describe("previous release upgrade", () => {
  let dataDir: string | undefined;

  afterEach(() => {
    platform?.close();
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
    platform = undefined;
    dataDir = undefined;
  });

  let platform:
    ReturnType<typeof defineDataPlatform<typeof schema>> | undefined;

  it("backs up and migrates prior records and BLOB attachments to platform files", async () => {
    dataDir = mkdtempSync(path.join(tmpdir(), "taxbook-upgrade-"));
    const databasePath = path.join(dataDir, "taxbook.db");
    const fixtureClient = createClient({ url: `file:${databasePath}` });
    await fixtureClient.executeMultiple(readFileSync(fixturePath, "utf8"));
    fixtureClient.close();

    await exportLegacyAttachments(dataDir);
    platform = defineDataPlatform({
      app: "taxbook",
      version: "fixture-upgrade",
      dataDir,
      db: { schema, migrationsFolder },
    });
    await platform.boot();
    expect((await platform.settled()).state).toBe("ready");

    const backupList = await platform.backups.list();
    expect(backupList).toHaveLength(1);
    expect(backupList[0]).toMatchObject({
      manifest: { trigger: "pre-migration" },
      verification: { status: "verified" },
    });
    expect(
      await platform.db.select({ id: records.id }).from(records),
    ).toHaveLength(1);
    const [file] = await platform.db.select().from(filesTable);
    expect(file).toMatchObject({
      id: "record-1",
      storageKey: "00000000-0000-4000-8000-000100000001.pdf",
      originalFilename: "fictional-receipt.pdf",
      mimeType: "application/pdf",
      endpoint: "document",
    });
    const stored = await platform.files.read(file!.id);
    expect(stored?.bytes.toString()).toContain("%PDF-1.4");

    const checkClient = createClient({ url: `file:${databasePath}` });
    const integrity = await checkClient.execute("PRAGMA integrity_check");
    const foreignKeys = await checkClient.execute("PRAGMA foreign_key_check");
    checkClient.close();
    expect(integrity.rows.map((row) => row.integrity_check)).toEqual(["ok"]);
    expect(foreignKeys.rows).toHaveLength(0);

    await platform.files.withFiles(platform.db, async (tx, files) => {
      await tx.delete(records).where(eq(records.id, 1));
      await files.remove(file!.id);
    });
    expect(await platform.files.read(file!.id)).toBeNull();
    expect(await platform.db.select().from(records)).toHaveLength(0);
  });
});
