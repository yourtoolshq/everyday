import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";
import type { Client } from "@libsql/client";
import { readMigrationFiles } from "drizzle-orm/migrator";

import packageJson from "../package.json";
import { withDatabaseFile } from "./backup/sqlite";

export interface JournalMigration {
  tag: string;
  hash: string;
  folderMillis: number;
  sql: string[];
}

export type MigrationPlan =
  | { status: "current" }
  | { status: "pending"; applied: number; pending: JournalMigration[] }
  | { status: "downgrade"; unknown: number }
  | { status: "edited-migration"; tag: string };

export type BlockedReason =
  "downgrade" | "edited-migration" | "migration-failed";

export class DataPlatformBlockedError extends Error {
  override name = "DataPlatformBlockedError";
  readonly reason: Exclude<BlockedReason, "migration-failed">;

  constructor(
    reason: Exclude<BlockedReason, "migration-failed">,
    message: string,
  ) {
    super(message);
    this.reason = reason;
  }
}

export class MigrationFailedError extends Error {
  override name = "MigrationFailedError";
}

export function readJournal(migrationsFolder: string): JournalMigration[] {
  const journal = JSON.parse(
    readFileSync(join(migrationsFolder, "meta", "_journal.json"), "utf8"),
  ) as { entries: { tag: string }[] };
  return readMigrationFiles({ migrationsFolder }).map((migration, index) => ({
    tag: journal.entries[index]?.tag ?? `#${index}`,
    hash: migration.hash,
    folderMillis: migration.folderMillis,
    sql: migration.sql,
  }));
}

async function hasTable(client: Client, name: string) {
  const result = await client.execute({
    sql: "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [name],
  });
  return result.rows.length > 0;
}

interface AppliedMigration {
  hash: string;
  createdAt: number;
}

async function readAppliedMigrations(
  client: Client,
): Promise<AppliedMigration[]> {
  if (!(await hasTable(client, "__drizzle_migrations"))) return [];
  const rows = await client.execute(
    "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at",
  );
  return rows.rows.map((row) => ({
    hash: row.hash as string,
    createdAt: Number(row.created_at),
  }));
}

// Applied rows are matched to journal entries by `created_at`, which holds the entry's
// timestamp; comparing their hashes detects a database from a newer version and an
// edited migration.
function planMigrations(
  journal: JournalMigration[],
  applied: AppliedMigration[],
): MigrationPlan {
  const byTimestamp = new Map(journal.map((m) => [m.folderMillis, m]));
  const appliedTimestamps = new Set<number>();
  let unknown = 0;
  for (const row of applied) {
    const expected = byTimestamp.get(row.createdAt);
    if (!expected) {
      unknown += 1;
    } else if (expected.hash !== row.hash) {
      return { status: "edited-migration", tag: expected.tag };
    } else {
      appliedTimestamps.add(row.createdAt);
    }
  }
  if (unknown > 0) return { status: "downgrade", unknown };
  const pending = journal.filter((m) => !appliedTimestamps.has(m.folderMillis));
  return pending.length > 0
    ? { status: "pending", applied: appliedTimestamps.size, pending }
    : { status: "current" };
}

async function readMeta(client: Client) {
  if (!(await hasTable(client, "yt_meta"))) return {};
  const rows = await client.execute("SELECT key, value FROM yt_meta");
  return Object.fromEntries(
    rows.rows.map((row) => [row.key as string, row.value as string]),
  );
}

export async function readMigrationPlan(options: {
  app: string;
  databasePath: string;
  migrationsFolder: string;
}) {
  const journal = readJournal(options.migrationsFolder);
  return withDatabaseFile(options.databasePath, async (client) => {
    const plan = planMigrations(journal, await readAppliedMigrations(client));
    if (plan.status === "downgrade" || plan.status === "edited-migration") {
      throw blockedError(options.app, plan, await readMeta(client));
    }
    return plan;
  });
}

function blockedError(
  app: string,
  plan: Extract<MigrationPlan, { status: "downgrade" | "edited-migration" }>,
  meta: Record<string, string>,
) {
  if (plan.status === "edited-migration") {
    return new DataPlatformBlockedError(
      "edited-migration",
      `Migration ${plan.tag} differs from the one applied to this database. Restore the applied version of the migration file; nothing has been changed.`,
    );
  }
  const migratedBy = meta.migratedByAppVersion
    ? `${app} ${meta.migratedByAppVersion}`
    : `a newer version of ${app}`;
  return new DataPlatformBlockedError(
    "downgrade",
    `This database was upgraded by ${migratedBy} and has ${plan.unknown} migration(s) this version does not know. Run that version or newer, or restore a backup this version can open; nothing has been changed.`,
  );
}

// Runs the pending migrations and the foreign key check in one transaction on its own
// connection, so a failure leaves the database exactly as it was. Foreign keys are off
// for the connection because drizzle-kit's table rebuilds drop parent tables, which
// would otherwise cascade to their children; the PRAGMA inside those migrations is a
// no-op within a transaction.
export async function applyMigrations(
  databasePath: string,
  pending: JournalMigration[],
  appVersion: string | null,
) {
  const meta = {
    migratedAt: new Date().toISOString(),
    migratedByAppVersion: appVersion,
    migratedByPlatformVersion: packageJson.version,
  };
  await withDatabaseFile(databasePath, async (client) => {
    await client.execute("PRAGMA foreign_keys = OFF");
    await client.execute("BEGIN IMMEDIATE");
    // Closing the connection without COMMIT rolls the transaction back.
    await client.execute(
      "CREATE TABLE IF NOT EXISTS __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)",
    );
    for (const migration of pending) {
      for (const statement of migration.sql) {
        if (statement.trim() === "") continue;
        try {
          await client.execute(statement);
        } catch (error) {
          throw new MigrationFailedError(
            `Migration ${migration.tag} failed: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error },
          );
        }
        // Local libsql runs each statement synchronously; yielding lets the server
        // answer status and maintenance requests between statements.
        await yieldToEventLoop();
      }
      await client.execute({
        sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
        args: [migration.hash, migration.folderMillis],
      });
    }
    const violations = await client.execute("PRAGMA foreign_key_check");
    if (violations.rows.length > 0) {
      const tables = [
        ...new Set(violations.rows.map((row) => row.table as string)),
      ];
      throw new MigrationFailedError(
        `Migrations ${pending.map((m) => m.tag).join(", ")} leave ${violations.rows.length} foreign key violation(s) in ${tables.join(", ")}`,
      );
    }
    if (!(await hasTable(client, "yt_meta"))) {
      throw new MigrationFailedError(
        "The migrations do not create the yt_meta table; export platformMetaTable from the app schema and generate a migration",
      );
    }
    for (const [key, value] of Object.entries(meta)) {
      await client.execute(
        value === null
          ? { sql: "DELETE FROM yt_meta WHERE key = ?", args: [key] }
          : {
              sql: "INSERT INTO yt_meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
              args: [key, value],
            },
      );
    }
    await client.execute("COMMIT");
  });
}
