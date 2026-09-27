import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Client } from "@libsql/client";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const migrationsFolder = join(process.cwd(), "drizzle");

let directory: string;
let client: Client;

async function migrateThrough(tag: string) {
  const folder = join(directory, "drizzle");
  await cp(migrationsFolder, folder, { recursive: true });
  const journalPath = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
    entries: { tag: string }[];
  };
  const end = journal.entries.findIndex((entry) => entry.tag === tag) + 1;
  journal.entries = journal.entries.slice(0, end);
  await writeFile(journalPath, JSON.stringify(journal));
  await migrate(drizzle(client), { migrationsFolder: folder });
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "firstaid-migrations-"));
  client = createClient({ url: `file:${join(directory, "firstaid.db")}` });
});

afterEach(async () => {
  client.close();
  await rm(directory, { recursive: true, force: true });
});

describe("files migrations", () => {
  it("links existing documents to yt_files rows in place", async () => {
    await migrateThrough("0004_brainy_jean_grey");
    await client.batch([
      `INSERT INTO people (id, display_name) VALUES ('11111111-1111-4111-8111-111111111111', 'Jordan Hale')`,
      `INSERT INTO visits (id, person_id, title, starts_at, status) VALUES ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Annual checkup', '2026-03-12T15:00:00.000Z', 'completed')`,
      `INSERT INTO documents (id, visit_id, type, title, original_filename, storage_key, mime_type, size_bytes, created_at)
       VALUES ('33333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'receipt', 'Visit receipt',
               'receipt.pdf', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf', 'application/pdf', 24, '2026-03-12 15:00:00')`,
      `INSERT INTO documents (id, visit_id, type, title, original_filename, storage_key, mime_type, size_bytes)
       VALUES ('44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222', 'report', 'Lab image',
               'result.jpg', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg', 'image/jpeg', 4)`,
    ]);

    await migrate(drizzle(client), { migrationsFolder });

    const documents = await client.execute(
      "SELECT id, file_id FROM documents ORDER BY id",
    );
    expect(documents.rows).toEqual([
      expect.objectContaining({
        id: "33333333-3333-4333-8333-333333333333",
        file_id: "33333333-3333-4333-8333-333333333333",
      }),
      expect.objectContaining({
        id: "44444444-4444-4444-8444-444444444444",
        file_id: "44444444-4444-4444-8444-444444444444",
      }),
    ]);

    const columns = await client.execute("PRAGMA table_info(documents)");
    expect(columns.rows.map((row) => row.name)).not.toContain("storage_key");

    const files = await client.execute(
      "SELECT id, storage_key, original_filename, mime_type, size_bytes, sha256, endpoint, created_at FROM yt_files ORDER BY id",
    );
    expect(files.rows[0]).toMatchObject({
      id: "33333333-3333-4333-8333-333333333333",
      storage_key: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf",
      original_filename: "receipt.pdf",
      mime_type: "application/pdf",
      size_bytes: 24,
      sha256: null,
      endpoint: "document",
      created_at: "2026-03-12 15:00:00",
    });
    expect(files.rows).toHaveLength(2);

    const violations = await client.execute("PRAGMA foreign_key_check");
    expect(violations.rows).toEqual([]);
  });
});
