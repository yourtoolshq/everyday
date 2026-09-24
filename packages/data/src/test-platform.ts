import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { defineDataPlatform } from "./platform";
import { filesTable } from "./schema";

const createFilesTable = `CREATE TABLE yt_files (
  id text PRIMARY KEY NOT NULL,
  storage_key text NOT NULL UNIQUE,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  sha256 text,
  endpoint text NOT NULL,
  created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);`;

export async function writeMigrations(
  folder: string,
  migrations: { tag: string; sql: string }[],
) {
  await mkdir(join(folder, "meta"), { recursive: true });
  for (const migration of migrations) {
    await writeFile(join(folder, `${migration.tag}.sql`), migration.sql);
  }
  const entries = migrations.map((migration, idx) => ({
    idx,
    version: "6",
    when: 1_789_000_000_000 + idx,
    tag: migration.tag,
    breakpoints: true,
  }));
  await writeFile(
    join(folder, "meta", "_journal.json"),
    JSON.stringify({ version: "7", dialect: "sqlite", entries }),
  );
}

export const filesMigration = { tag: "0000_files", sql: createFilesTable };

export async function createTestPlatform() {
  const root = await mkdtemp(join(tmpdir(), "yt-data-"));
  const dataDir = join(root, "data");
  const migrationsFolder = join(root, "drizzle");
  await writeMigrations(migrationsFolder, [filesMigration]);
  const platform = defineDataPlatform({
    app: "test",
    dataDir,
    db: { schema: { filesTable }, migrationsFolder },
  });
  await platform.boot();
  return {
    db: platform.db,
    dataDir,
    documentsDir: join(dataDir, "documents"),
    migrationsFolder,
    platform,
    root,
    async cleanup() {
      platform.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

export const pdfBytes = new TextEncoder().encode("%PDF-1.7\nfictional\n");
