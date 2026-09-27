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
  directory = await mkdtemp(join(tmpdir(), "tenure-migrations-"));
  client = createClient({ url: `file:${join(directory, "tenure.db")}` });
});

afterEach(async () => {
  client.close();
  await rm(directory, { recursive: true, force: true });
});

describe("files migrations", () => {
  it("links existing documents to yt_files rows in place", async () => {
    await migrateThrough("0004_sturdy_jack_flag");
    await client.batch([
      `INSERT INTO households (id, name) VALUES ('house-1', 'Chen household')`,
      `INSERT INTO people (id, household_id, display_name, sort_order) VALUES ('person-1', 'house-1', 'Alex Chen', 0)`,
      `INSERT INTO employers (id, name) VALUES ('employer-1', 'Northwind Labs')`,
      `INSERT INTO employments (id, employer_id, person_id) VALUES ('job-1', 'employer-1', 'person-1')`,
      `INSERT INTO documents (id, employment_id, type, title, original_filename, storage_key, mime_type, size_bytes, created_at)
       VALUES ('55555555-5555-4555-8555-555555555555', 'job-1', 'contract', 'Employment agreement',
               'agreement.pdf', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf', 'application/pdf', 1200, '2024-01-15 12:00:00')`,
      `INSERT INTO documents (id, employment_id, type, title, original_filename, storage_key, mime_type, size_bytes)
       VALUES ('66666666-6666-4666-8666-666666666666', 'job-1', 'pay_stub', 'Pay stub',
               'stub.pdf', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf', 'application/pdf', 800)`,
      `INSERT INTO documents (id, employment_id, type, title, original_filename, storage_key, mime_type, size_bytes)
       VALUES ('77777777-7777-4777-8777-777777777777', 'job-1', 'salary_letter', 'Salary letter',
               'salary.eml', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc.eml', 'message/rfc822', 400)`,
    ]);

    await migrate(drizzle(client), { migrationsFolder });

    const documents = await client.execute(
      "SELECT id, file_id FROM documents ORDER BY id",
    );
    expect(documents.rows).toEqual([
      expect.objectContaining({
        id: "55555555-5555-4555-8555-555555555555",
        file_id: "55555555-5555-4555-8555-555555555555",
      }),
      expect.objectContaining({
        id: "66666666-6666-4666-8666-666666666666",
        file_id: "66666666-6666-4666-8666-666666666666",
      }),
      expect.objectContaining({
        id: "77777777-7777-4777-8777-777777777777",
        file_id: "77777777-7777-4777-8777-777777777777",
      }),
    ]);

    const columns = await client.execute("PRAGMA table_info(documents)");
    expect(columns.rows.map((row) => row.name)).not.toContain("storage_key");

    const files = await client.execute(
      "SELECT id, storage_key, original_filename, mime_type, size_bytes, sha256, endpoint, created_at FROM yt_files ORDER BY id",
    );
    expect(files.rows[0]).toMatchObject({
      id: "55555555-5555-4555-8555-555555555555",
      storage_key: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf",
      original_filename: "agreement.pdf",
      mime_type: "application/pdf",
      size_bytes: 1200,
      sha256: null,
      endpoint: "document",
      created_at: "2024-01-15 12:00:00",
    });
    expect(files.rows).toHaveLength(3);

    const violations = await client.execute("PRAGMA foreign_key_check");
    expect(violations.rows).toEqual([]);
  });
});
