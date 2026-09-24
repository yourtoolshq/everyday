import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withDatabaseFile } from "./backup/sqlite";
import { defineDataPlatform } from "./platform";
import { filesTable } from "./schema";
import { platformMigration, writeMigrations } from "./test-platform";

const notesMigration = {
  tag: "0001_notes",
  sql: "CREATE TABLE notes (id text PRIMARY KEY NOT NULL, body text NOT NULL);",
};

let root: string;
let dataDir: string;
let migrationsFolder: string;
let current: ReturnType<typeof defineDataPlatform> | null = null;

async function bootWith(
  migrations: { tag: string; sql: string }[],
  version?: string,
) {
  current?.close();
  await writeMigrations(migrationsFolder, migrations);
  current = defineDataPlatform({
    app: "test",
    version,
    dataDir,
    db: { schema: { filesTable }, migrationsFolder },
  });
  await current.settled();
  return current;
}

async function blockedMessage(migrations: { tag: string; sql: string }[]) {
  const state = await (await bootWith(migrations)).state();
  return state.state === "blocked" ? state.message : null;
}

function query(sql: string) {
  return withDatabaseFile(
    join(dataDir, "test.db"),
    async (client: Client) => (await client.execute(sql)).rows,
  );
}

async function tableNames() {
  const rows = await query(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  );
  return rows.map((row) => row.name);
}

async function listBackups() {
  return (await readdir(join(dataDir, "backups"))).filter((name) =>
    name.endsWith(".ytbackup"),
  );
}

async function readMeta() {
  const rows = await query("SELECT key, value FROM yt_meta");
  return Object.fromEntries(
    rows.map((row) => [row.key as string, row.value as string]),
  );
}

beforeEach(async () => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  root = await mkdtemp(join(tmpdir(), "yt-data-migrations-"));
  dataDir = join(root, "data");
  migrationsFolder = join(root, "drizzle");
});

afterEach(async () => {
  vi.restoreAllMocks();
  current?.close();
  current = null;
  await rm(root, { recursive: true, force: true });
});

describe("boot migrations", () => {
  it("migrates an empty database without a backup and records who migrated it", async () => {
    await bootWith([platformMigration], "1.0.0");

    expect(await tableNames()).toContain("yt_files");
    await expect(readdir(join(dataDir, "backups"))).rejects.toThrow();
    expect(await readMeta()).toEqual({
      migratedAt: expect.any(String) as string,
      migratedByAppVersion: "1.0.0",
      migratedByPlatformVersion: expect.any(String) as string,
    });
  });

  it("takes a verified pre-migration backup before applying pending migrations", async () => {
    await bootWith([platformMigration], "1.0.0");
    const platform = await bootWith([platformMigration, notesMigration]);

    expect(await tableNames()).toContain("notes");
    const [backup] = await platform.backups.list();
    expect(backup).toMatchObject({
      manifest: {
        trigger: "pre-migration",
        migrations: [{ tag: "0000_platform" }],
      },
      verification: { status: "verified" },
    });
    expect(await readMeta()).not.toHaveProperty("migratedByAppVersion");
    expect(console.info).toHaveBeenCalledWith("database migrated", {
      app: "test",
      migrations: ["0001_notes"],
      preMigrationBackup: backup?.id,
    });
  });

  it("lets other work run between statements", async () => {
    const statements = Array.from(
      { length: 500 },
      (_, i) => `CREATE TABLE t${i} (id integer PRIMARY KEY);`,
    );
    let ticks = 0;
    let migrated = false;
    const tick = () => {
      ticks += 1;
      if (!migrated) setImmediate(tick);
    };
    setImmediate(tick);

    await bootWith([
      platformMigration,
      {
        tag: "0001_many",
        sql: statements.join("\n--> statement-breakpoint\n"),
      },
    ]);
    migrated = true;

    expect(ticks).toBeGreaterThanOrEqual(statements.length);
  });

  it("does nothing when the database is current", async () => {
    await bootWith([platformMigration, notesMigration]);
    await bootWith([platformMigration, notesMigration]);

    await expect(readdir(join(dataDir, "backups"))).rejects.toThrow();
  });

  it("rolls back every pending migration when one fails", async () => {
    await bootWith([platformMigration]);

    const platform = await bootWith([
      platformMigration,
      notesMigration,
      {
        tag: "0002_broken",
        sql: "ALTER TABLE notes ADD COLUMN title text;\n--> statement-breakpoint\nINSERT INTO missing_table VALUES (1);",
      },
    ]);

    expect(await platform.state()).toEqual({
      state: "blocked",
      reason: "migration-failed",
      message:
        "Migration 0002_broken failed: SQLITE_ERROR: no such table: missing_table",
    });
    expect(console.error).toHaveBeenCalledWith(
      "data platform blocked",
      expect.objectContaining({ app: "test", reason: "migration-failed" }),
    );

    expect(await tableNames()).not.toContain("notes");
    expect(await query("SELECT hash FROM __drizzle_migrations")).toHaveLength(
      1,
    );
    expect(await listBackups()).toHaveLength(1);
  });

  it("requires the migrations to create yt_meta", async () => {
    expect(await blockedMessage([notesMigration])).toContain(
      "export platformMetaTable from the app schema",
    );

    expect(await tableNames()).not.toContain("notes");
  });

  it("rejects migrations that leave foreign key violations", async () => {
    await bootWith([platformMigration]);

    expect(
      await blockedMessage([
        platformMigration,
        {
          tag: "0001_links",
          sql: "CREATE TABLE links (id text PRIMARY KEY NOT NULL, file_id text NOT NULL REFERENCES yt_files(id));\n--> statement-breakpoint\nINSERT INTO links VALUES ('link-1', 'no-such-file');",
        },
      ]),
    ).toContain("1 foreign key violation(s) in links");

    expect(await tableNames()).not.toContain("links");
  });

  it("rebuilds a parent table without cascading to its children", async () => {
    const attachments = {
      tag: "0001_attachments",
      sql: [
        "CREATE TABLE attachments (id text PRIMARY KEY NOT NULL, file_id text NOT NULL REFERENCES yt_files(id) ON DELETE CASCADE);",
        "INSERT INTO yt_files (id, storage_key, original_filename, mime_type, size_bytes, endpoint) VALUES ('file-1', '11111111-1111-4111-8111-111111111111.pdf', 'March.pdf', 'application/pdf', 10, 'statement');",
        "INSERT INTO attachments VALUES ('attachment-1', 'file-1');",
      ].join("\n--> statement-breakpoint\n"),
    };
    await bootWith([platformMigration, attachments]);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // The shape drizzle-kit generates for a SQLite table rebuild.
    await bootWith([
      platformMigration,
      attachments,
      {
        tag: "0002_rebuild_files",
        sql: [
          "PRAGMA foreign_keys=OFF;",
          "CREATE TABLE __new_yt_files (id text PRIMARY KEY NOT NULL, storage_key text NOT NULL UNIQUE, original_filename text NOT NULL, mime_type text NOT NULL, size_bytes integer NOT NULL, sha256 text, endpoint text NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL);",
          "INSERT INTO __new_yt_files SELECT * FROM yt_files;",
          "DROP TABLE yt_files;",
          "ALTER TABLE __new_yt_files RENAME TO yt_files;",
          "PRAGMA foreign_keys=ON;",
        ].join("\n--> statement-breakpoint\n"),
      },
    ]);

    expect(await query("SELECT id FROM attachments")).toHaveLength(1);
  });

  it("continues a database drizzle migrated and records the rows drizzle does", async () => {
    const databasePath = join(dataDir, "test.db");
    const drizzlePath = join(root, "drizzle.db");
    const migrateWithDrizzle = (path: string) =>
      withDatabaseFile(path, (client) =>
        migrate(drizzle(client), { migrationsFolder }),
      );
    const appliedRows = (path: string) =>
      withDatabaseFile(path, async (client) =>
        (
          await client.execute(
            "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at",
          )
        ).rows.map((row) => [row.hash, Number(row.created_at)]),
      );
    await writeMigrations(migrationsFolder, [platformMigration]);
    await mkdir(dataDir, { recursive: true });
    await migrateWithDrizzle(databasePath);

    await bootWith([platformMigration, notesMigration]);
    current?.close();
    current = null;
    await migrateWithDrizzle(drizzlePath);

    expect(await listBackups()).toHaveLength(1);
    expect(await appliedRows(databasePath)).toEqual(
      await appliedRows(drizzlePath),
    );
    await expect(migrateWithDrizzle(databasePath)).resolves.toBeUndefined();
  });
});

describe("version guard", () => {
  it("blocks a database migrated by a newer version without changing it", async () => {
    await bootWith([platformMigration, notesMigration], "2.0.0");

    const state = await (await bootWith([platformMigration], "1.0.0")).state();

    expect(state).toMatchObject({
      state: "blocked",
      reason: "downgrade",
      message: expect.stringContaining("upgraded by test 2.0.0") as string,
    });
    expect(await tableNames()).toContain("notes");
    expect((await readMeta()).migratedByAppVersion).toBe("2.0.0");
    await expect(readdir(join(dataDir, "backups"))).rejects.toThrow();
  });

  it("blocks a database whose applied migration was edited", async () => {
    await bootWith([platformMigration, notesMigration]);

    expect(
      await (
        await bootWith([
          platformMigration,
          { ...notesMigration, sql: `${notesMigration.sql}\n` },
        ])
      ).state(),
    ).toMatchObject({
      state: "blocked",
      reason: "edited-migration",
      message: expect.stringContaining("0001_notes") as string,
    });
  });
});

describe("restore", () => {
  it("brings a backup from an older version up to the current schema", async () => {
    const older = await bootWith([platformMigration]);
    const backup = await older.backups.create();
    const platform = await bootWith([platformMigration, notesMigration]);
    await withDatabaseFile(join(dataDir, "test.db"), (client) =>
      client.execute("INSERT INTO notes VALUES ('note-1', 'After upgrade')"),
    );

    await platform.backups.restore(backup.path);

    expect(await tableNames()).toContain("notes");
    expect(await query("SELECT id FROM notes")).toHaveLength(0);
    expect(await query("SELECT hash FROM __drizzle_migrations")).toHaveLength(
      2,
    );
  });
});
