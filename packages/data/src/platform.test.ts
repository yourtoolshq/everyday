import { access } from "node:fs/promises";
import { join } from "node:path";
import { initTRPC } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DataPlatformBusyError, defineDataPlatform } from "./platform";
import { requireReady } from "./readiness";
import { filesTable } from "./schema";
import {
  createTestPlatform,
  platformMigration,
  writeMigrations,
} from "./test-platform";

const notesMigration = {
  tag: "0001_notes",
  sql: "CREATE TABLE notes (id text PRIMARY KEY NOT NULL);",
};

let context: Awaited<ReturnType<typeof createTestPlatform>>;

function definePlatformAgain(version?: string) {
  return defineDataPlatform({
    app: "test",
    version,
    dataDir: context.dataDir,
    db: {
      schema: { filesTable },
      migrationsFolder: context.migrationsFolder,
    },
  });
}

const fileRow = {
  id: "11111111-1111-4111-8111-111111111111",
  storageKey: "11111111-1111-4111-8111-111111111111.pdf",
  originalFilename: "Chequing March.pdf",
  mimeType: "application/pdf",
  sizeBytes: 19,
  endpoint: "statement",
};

// Reopens the data directory with `migrations` as the application's journal.
async function reopenWith(
  migrations: { tag: string; sql: string }[],
  version?: string,
) {
  context.platform.close();
  await writeMigrations(context.migrationsFolder, migrations);
  context.platform = definePlatformAgain(version);
  return context.platform;
}

beforeEach(async () => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  context = await createTestPlatform();
});

afterEach(async () => {
  await context.platform.settled();
  await context.cleanup();
  vi.restoreAllMocks();
});

describe("defineDataPlatform", () => {
  it("boots by creating the data layout and applying migrations", async () => {
    await access(join(context.dataDir, "test.db"));
    await access(context.documentsDir);

    await context.db.insert(filesTable).values(fileRow);
    expect(await context.db.select().from(filesTable)).toHaveLength(1);
  });

  it("shares one connection and boot per database file", async () => {
    const again = definePlatformAgain();

    expect(again.boot()).toBe(context.platform.boot());
    await context.db.insert(filesTable).values(fileRow);
    expect(await again.db.select().from(filesTable)).toHaveLength(1);
  });

  it("opens a fresh connection after close", async () => {
    await context.db.insert(filesTable).values(fileRow);
    context.platform.close();

    const reopened = definePlatformAgain();
    await reopened.settled();
    expect(await reopened.db.select().from(filesTable)).toHaveLength(1);
    context.platform = reopened;
  });
});

describe("platform state", () => {
  const t = initTRPC.create();

  function callGuarded(platform: ReturnType<typeof defineDataPlatform>) {
    const router = t.router({
      ping: t.procedure.use(requireReady(platform)).query(() => "pong"),
    });
    return t.createCallerFactory(router)({}).ping();
  }

  it("is ready after booting a current database", async () => {
    expect(await context.platform.status()).toEqual({
      app: "test",
      version: null,
      state: "ready",
    });
    expect(await callGuarded(context.platform)).toBe("pong");
  });

  it("upgrades in the background after boot and rejects procedures until ready", async () => {
    const platform = await reopenWith([platformMigration, notesMigration]);

    await platform.boot();

    expect(await platform.state()).toEqual({
      state: "upgrading",
      step: "backup",
      migrations: ["0001_notes"],
    });
    await expect(callGuarded(platform)).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "test is upgrading its data; try again when it is done",
    });
    await expect(
      platform.backups.restore(join(context.root, "any.ytbackup")),
    ).rejects.toThrow(DataPlatformBusyError);

    expect(await platform.settled()).toEqual({ state: "ready" });
    expect(await callGuarded(platform)).toBe("pong");
  });

  it("blocks a newer database and lists only the backups this version can restore", async () => {
    const older = await context.platform.backups.create();
    const platform = await reopenWith(
      [platformMigration, notesMigration],
      "2.0.0",
    );
    await platform.settled();
    await platform.backups.create();
    await reopenWith([platformMigration], "1.0.0");

    const status = await context.platform.status();

    expect(status).toMatchObject({
      app: "test",
      version: "1.0.0",
      state: "blocked",
      reason: "downgrade",
      message: expect.stringContaining("upgraded by test 2.0.0") as string,
    });
    // 2.0.0 took the pre-migration backup before upgrading; its later backup is left out.
    expect(status.restorableBackups).toEqual([
      expect.objectContaining({
        trigger: "pre-migration",
        appVersion: "2.0.0",
      }),
      {
        id: older.id,
        createdAt: older.manifest?.createdAt,
        appVersion: null,
        trigger: "manual",
      },
    ]);
    await expect(callGuarded(context.platform)).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: status.state === "blocked" ? status.message : "",
    });
  });

  it("becomes ready after restoring a backup it can open", async () => {
    const older = await context.platform.backups.create();
    await (await reopenWith([platformMigration, notesMigration])).settled();
    const platform = await reopenWith([platformMigration]);
    expect(await platform.state()).toMatchObject({ state: "blocked" });

    await platform.backups.restore(older.path);

    expect(await platform.state()).toEqual({ state: "ready" });
    expect(await callGuarded(platform)).toBe("pong");
  });

  it("lists no backups to restore after a failed migration", async () => {
    await context.platform.backups.create();
    const platform = await reopenWith([
      platformMigration,
      { tag: "0001_broken", sql: "INSERT INTO missing_table VALUES (1);" },
    ]);

    await platform.settled();

    expect(await platform.status()).toEqual({
      app: "test",
      version: null,
      state: "blocked",
      reason: "migration-failed",
      message:
        "Migration 0001_broken failed: SQLITE_ERROR: no such table: missing_table",
    });
  });
});
