import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createCareOrganization } from "~/modules/care-providers/application/create-care-organization";
import { getCareProvidersOverview } from "~/modules/care-providers/application/get-care-providers-overview";
import { createCareProvidersRepository } from "~/modules/care-providers/infrastructure/care-providers-repository";
import * as schema from "~/server/db/schema";

const migrationsFolder = join(process.cwd(), "drizzle");

let directory: string;
let db: ReturnType<typeof drizzle<typeof schema>>;
let client: ReturnType<typeof createClient>;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "firstaid-care-providers-repo-"));
  client = createClient({ url: `file:${join(directory, "firstaid.db")}` });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
});

afterEach(async () => {
  client.close();
  await rm(directory, { recursive: true, force: true });
});

describe("care providers repository slice", () => {
  it("creates an organization and lists it in overview projections", async () => {
    const repository = createCareProvidersRepository(db as never);
    await createCareOrganization(repository, {
      name: "River Clinic",
      phoneNumbers: ["555-0100"],
      websiteUrl: null,
      bookingUrl: null,
    });

    const overview = await getCareProvidersOverview(repository);
    expect(overview.organizations).toHaveLength(1);
    expect(overview.organizations[0]).toMatchObject({
      name: "River Clinic",
      phoneNumbers: ["555-0100"],
      providerCount: 0,
      visitCount: 0,
    });
    expect(overview.organizations[0]).not.toHaveProperty("secret");
  });
});
