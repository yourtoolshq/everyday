import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const migrationsFolder = join(process.cwd(), "drizzle");

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "roof-migrations-"));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("roof migrations", () => {
  it("migrates legacy relationships and insurance without losing events, files, or dates", async () => {
    const legacy = join(directory, "legacy");
    await mkdir(join(legacy, "meta"), { recursive: true });
    const journal = JSON.parse(
      await readFile(join(migrationsFolder, "meta/_journal.json"), "utf8"),
    ) as { entries: { tag: string }[] };
    journal.entries = journal.entries.slice(0, 2);
    await writeFile(
      join(legacy, "meta/_journal.json"),
      JSON.stringify(journal),
    );
    for (const entry of journal.entries)
      await cp(
        join(migrationsFolder, `${entry.tag}.sql`),
        join(legacy, `${entry.tag}.sql`),
      );
    const client = createClient({
      url: `file:${join(directory, "upgrade.db")}`,
    });
    try {
      await migrate(drizzle(client), { migrationsFolder: legacy });
      for (const kind of [
        "current_rental",
        "past_rental",
        "under_construction",
        "owned",
      ]) {
        await client.execute({
          sql: "INSERT INTO properties (id, name, kind, target_possession_date, renter_insurance_provider, renter_insurance_policy_number, renter_insurance_expires_on) VALUES (?, 'Fictional place', ?, '2027-06-01', 'Example insurer', 'DEMO-100', '2027-09-30')",
          args: [kind, kind],
        });
      }
      await client.execute(
        "INSERT INTO property_events (id, property_id, event_date, category, title) VALUES ('event', 'under_construction', '2027-01-12', 'visit', 'Fictional visit')",
      );
      await client.execute(
        "INSERT INTO yt_files (id, storage_key, original_filename, mime_type, size_bytes, endpoint) VALUES ('file', 'example.png', 'example.png', 'image/png', 10, 'document')",
      );
      await client.execute(
        "INSERT INTO documents (id, property_id, event_id, type, title, file_id, original_filename, mime_type, size_bytes) VALUES ('doc', 'under_construction', 'event', 'photo', 'Fictional photo', 'file', 'example.png', 'image/png', 10)",
      );
      await migrate(drizzle(client), { migrationsFolder });
      const properties = await client.execute(
        "SELECT id, relationship, stage, target_possession_date FROM properties ORDER BY id",
      );
      expect(
        properties.rows.map((row) => [
          row.id,
          row.relationship,
          row.stage,
          row.target_possession_date,
        ]),
      ).toEqual([
        ["current_rental", "rental", "current", "2027-06-01"],
        ["owned", "purchase", "owned", "2027-06-01"],
        ["past_rental", "rental", "past", "2027-06-01"],
        ["under_construction", "purchase", "under_construction", "2027-06-01"],
      ]);
      const policies = await client.execute(
        "SELECT provider, policy_number, starts_on, ends_on FROM insurance_records",
      );
      expect(policies.rows).toHaveLength(4);
      expect(policies.rows[0]).toMatchObject({
        provider: "Example insurer",
        policy_number: "DEMO-100",
        starts_on: null,
        ends_on: "2027-09-30",
      });
      expect(
        (
          await client.execute(
            "SELECT event_id, file_id, insurance_id FROM documents",
          )
        ).rows[0],
      ).toMatchObject({
        event_id: "event",
        file_id: "file",
        insurance_id: null,
      });
      expect(
        (await client.execute("PRAGMA foreign_key_check")).rows,
      ).toHaveLength(0);
    } finally {
      client.close();
    }
  });
  it("applies the initial schema on a fresh database", async () => {
    const client = createClient({
      url: `file:${join(directory, "roof.db")}`,
    });
    await migrate(drizzle(client), { migrationsFolder });
    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    client.close();
    expect(tables.rows.map((row) => row.name)).toEqual(
      expect.arrayContaining([
        "documents",
        "insurance_records",
        "properties",
        "property_events",
        "yt_files",
        "yt_meta",
      ]),
    );
  });
});
