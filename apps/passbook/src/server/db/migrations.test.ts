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
  directory = await mkdtemp(join(tmpdir(), "passbook-migrations-"));
  client = createClient({ url: `file:${join(directory, "passbook.db")}` });
});

afterEach(async () => {
  client.close();
  await rm(directory, { recursive: true, force: true });
});

describe("files migrations", () => {
  it("links existing documents to yt_files rows in place", async () => {
    await migrateThrough("0006_curved_nekra");
    await client.batch([
      `INSERT INTO institutions (id, name) VALUES ('inst-1', 'Northwind Bank')`,
      `INSERT INTO accounts (id, institution_id, display_name, account_type)
       VALUES ('acct-1', 'inst-1', 'Everyday Chequing', 'chequing')`,
      `INSERT INTO documents (id, account_id, type, period_key, title, original_filename, storage_key, mime_type, size_bytes, created_at)
       VALUES ('11111111-1111-4111-8111-111111111111', 'acct-1', 'statement', '2025-03', 'March statement',
               'march.pdf', '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf', 'application/pdf', 1200, '2025-04-02 10:00:00')`,
      `INSERT INTO documents (id, account_id, type, title, original_filename, storage_key, mime_type, size_bytes)
       VALUES ('22222222-2222-4222-8222-222222222222', 'acct-1', 'void_cheque', 'Void cheque',
               'cheque.png', '22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png', 'image/png', 800)`,
    ]);

    await migrate(drizzle(client), { migrationsFolder });

    const documents = await client.execute(
      "SELECT id, file_id, period_key FROM documents ORDER BY id",
    );
    expect(documents.rows).toEqual([
      expect.objectContaining({
        id: "11111111-1111-4111-8111-111111111111",
        file_id: "11111111-1111-4111-8111-111111111111",
        period_key: "2025-03",
      }),
      expect.objectContaining({
        id: "22222222-2222-4222-8222-222222222222",
        file_id: "22222222-2222-4222-8222-222222222222",
      }),
    ]);

    const files = await client.execute(
      "SELECT id, storage_key, original_filename, mime_type, size_bytes, sha256, endpoint, created_at FROM yt_files ORDER BY id",
    );
    expect(files.rows[0]).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      storage_key: "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf",
      original_filename: "march.pdf",
      mime_type: "application/pdf",
      size_bytes: 1200,
      sha256: null,
      endpoint: "document",
      created_at: "2025-04-02 10:00:00",
    });
    expect(files.rows).toHaveLength(2);

    const violations = await client.execute("PRAGMA foreign_key_check");
    expect(violations.rows).toEqual([]);
  });
});
