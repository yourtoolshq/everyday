import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createInstitution } from "~/modules/institutions/application/create-institution";
import { listInstitutions } from "~/modules/institutions/application/list-institutions";
import { createInstitutionRepository } from "~/modules/institutions/infrastructure/institution-repository";
import * as schema from "~/server/db/schema";

const migrationsFolder = join(process.cwd(), "drizzle");

let directory: string;
let db: ReturnType<typeof drizzle<typeof schema>>;
let client: ReturnType<typeof createClient>;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "passbook-institution-repo-"));
  client = createClient({ url: `file:${join(directory, "passbook.db")}` });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
});

afterEach(async () => {
  client.close();
  await rm(directory, { recursive: true, force: true });
});

describe("institution repository slice", () => {
  it("creates and lists projected institution fields", async () => {
    const repository = createInstitutionRepository(db);
    await createInstitution(repository, {
      name: "Northwind Credit Union",
      website: "https://example.com",
      notes: null,
    });

    const items = await listInstitutions(repository);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: "Northwind Credit Union",
      website: "https://example.com",
      notes: null,
    });
    expect(items[0]).toHaveProperty("id");
    expect(items[0]).not.toHaveProperty("accounts");
  });
});
