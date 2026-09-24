import type { Client } from "@libsql/client";
import { createClient } from "@libsql/client";

export interface DatabaseContents {
  rowCounts: Record<string, number>;
  files: { id: string; storageKey: string }[];
  migrations: { hash: string; createdAt: number }[];
}

export async function withDatabaseFile<T>(
  path: string,
  fn: (client: Client) => Promise<T>,
) {
  const client = createClient({ url: `file:${path}` });
  try {
    return await fn(client);
  } finally {
    client.close();
  }
}

const quoteIdentifier = (name: string) => `"${name.replaceAll('"', '""')}"`;

export async function readContents(client: Client): Promise<DatabaseContents> {
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const names = tables.rows.map((row) => row.name as string);
  const rowCounts: Record<string, number> = {};
  for (const name of names) {
    const result = await client.execute(
      `SELECT count(*) AS n FROM ${quoteIdentifier(name)}`,
    );
    rowCounts[name] = Number(result.rows[0]?.n ?? 0);
  }

  const files = names.includes("yt_files")
    ? (
        await client.execute("SELECT id, storage_key FROM yt_files ORDER BY id")
      ).rows.map((row) => ({
        id: row.id as string,
        storageKey: row.storage_key as string,
      }))
    : [];
  const migrations = names.includes("__drizzle_migrations")
    ? (
        await client.execute(
          "SELECT hash, created_at FROM __drizzle_migrations ORDER BY id",
        )
      ).rows.map((row) => ({
        hash: row.hash as string,
        createdAt: Number(row.created_at),
      }))
    : [];
  return { rowCounts, files, migrations };
}

export async function findStructuralProblem(client: Client) {
  const integrity = await client.execute("PRAGMA integrity_check");
  const status = integrity.rows.map((row) => row[0] as string).join("; ");
  if (status !== "ok") return `integrity_check reported: ${status}`;
  const violations = await client.execute("PRAGMA foreign_key_check");
  if (violations.rows.length > 0) {
    const first = violations.rows[0];
    return `foreign_key_check found ${violations.rows.length} violation(s), first in ${first?.table as string}`;
  }
  return null;
}
