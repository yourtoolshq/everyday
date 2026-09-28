import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isAppError } from "@yourtoolshq/server/errors";

import { createPaycheck } from "~/modules/paychecks/application/create-paycheck";
import { listPaychecksByEmployment } from "~/modules/paychecks/application/list-paychecks-by-employment";
import { createPaycheckRepository } from "~/modules/paychecks/infrastructure/paycheck-repository";
import * as schema from "~/server/db/schema";

const migrationsFolder = join(process.cwd(), "drizzle");

let directory: string;
let db: ReturnType<typeof drizzle<typeof schema>>;
let client: ReturnType<typeof createClient>;

const householdId = "11111111-1111-4111-8111-111111111111";
const personId = "22222222-2222-4222-8222-222222222222";
const employerId = "33333333-3333-4333-8333-333333333333";
const employmentId = "44444444-4444-4444-8444-444444444444";

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "tenure-paycheck-repo-"));
  client = createClient({ url: `file:${join(directory, "tenure.db")}` });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });

  await db.insert(schema.households).values({
    id: householdId,
    name: "River household",
  });
  await db.insert(schema.people).values({
    id: personId,
    householdId,
    displayName: "Alex Rivera",
    sortOrder: 0,
  });
  await db.insert(schema.employers).values({
    id: employerId,
    name: "Northwind Labs",
  });
  await db.insert(schema.employments).values({
    id: employmentId,
    employerId,
    personId,
    deductionSettings: JSON.stringify({
      incomeTaxEnabled: true,
      federalIncomeTaxEnabled: false,
      manitobaIncomeTaxEnabled: false,
    }),
  });
});

afterEach(async () => {
  client.close();
  await rm(directory, { recursive: true, force: true });
});

describe("paycheck repository slice", () => {
  it("lists projected paycheck fields for an employment", async () => {
    const repository = createPaycheckRepository(db as never);
    await createPaycheck(repository, {
      employmentId,
      payDate: "2024-01-15",
      periodStartDate: "2024-01-01",
      periodEndDate: "2024-01-15",
      grossPayCents: 100_000,
      incomeTaxCents: 10_000,
      federalIncomeTaxCents: 0,
      manitobaIncomeTaxCents: 0,
      cppCents: 5_000,
      cpp2Cents: 0,
      eiCents: 1_500,
      wiCents: 0,
      ltdCents: 0,
      extendedHealthCents: 0,
      travelMedicalCents: 0,
      unionDuesCents: 0,
      otherDeductionsCents: 0,
    });

    const items = await listPaychecksByEmployment(repository, employmentId);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      employmentId,
      payDate: "2024-01-15",
      grossPayCents: 100_000,
      netPayCents: 83_500,
      documentId: null,
      documentTitle: null,
    });
    expect(items[0]).not.toHaveProperty("deductionSettings");
  });

  it("rejects create when the employment is missing", async () => {
    const repository = createPaycheckRepository(db as never);
    await expect(
      createPaycheck(repository, {
        employmentId: "55555555-5555-4555-8555-555555555555",
        payDate: "2024-01-15",
        periodStartDate: "2024-01-01",
        periodEndDate: "2024-01-15",
        grossPayCents: 100_000,
        incomeTaxCents: 0,
        federalIncomeTaxCents: 0,
        manitobaIncomeTaxCents: 0,
        cppCents: 0,
        cpp2Cents: 0,
        eiCents: 0,
        wiCents: 0,
        ltdCents: 0,
        extendedHealthCents: 0,
        travelMedicalCents: 0,
        unionDuesCents: 0,
        otherDeductionsCents: 0,
      }),
    ).rejects.toSatisfy(
      (error: unknown) => isAppError(error) && error.code === "not_found",
    );
  });
});
