import { mkdtemp, rm } from "node:fs/promises";
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
        "properties",
        "property_events",
        "yt_files",
        "yt_meta",
      ]),
    );
  });
});
