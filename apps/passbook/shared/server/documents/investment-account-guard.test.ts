import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { TRPCError } from "@trpc/server";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { saveInvestmentSnapshot } from "~/modules/investment-statements/application/investment-snapshot-service";
import { createInvestmentStatementRepository } from "~/modules/investment-statements/infrastructure/investment-statement-repository";
import * as schema from "~/server/db/schema";
import {
  accounts,
  documents,
  filesTable,
  households,
  institutions,
  people,
} from "~/server/db/schema";
import { assertAccountUpdateAllowsInvestmentEnrichment } from "~/server/documents/investment-enrichment-guards";

const migrationsFolder = join(process.cwd(), "drizzle");

let directory: string;
let db: ReturnType<typeof drizzle<typeof schema>>;
let client: ReturnType<typeof createClient>;
let accountId = "";

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "passbook-account-guard-"));
  client = createClient({ url: `file:${join(directory, "passbook.db")}` });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });

  const [household] = await db
    .insert(households)
    .values({ name: "Sample household" })
    .returning();
  const [person] = await db
    .insert(people)
    .values({
      householdId: household!.id,
      displayName: "Alex Sample",
      sortOrder: 0,
    })
    .returning();
  const [institution] = await db
    .insert(institutions)
    .values({ name: "Northwind Brokerage" })
    .returning();
  const [account] = await db
    .insert(accounts)
    .values({
      institutionId: institution!.id,
      displayName: "Sample TFSA",
      accountType: "tfsa",
      status: "active",
    })
    .returning();
  accountId = account!.id;
  await db.insert(schema.accountOwnership).values({
    accountId: account!.id,
    personId: person!.id,
  });
  const [file] = await db
    .insert(filesTable)
    .values({
      id: crypto.randomUUID(),
      storageKey: "sample-statement.pdf",
      originalFilename: "sample-statement.pdf",
      mimeType: "application/pdf",
      sizeBytes: 128,
      endpoint: "documents",
    })
    .returning();
  const [document] = await db
    .insert(documents)
    .values({
      accountId: account!.id,
      type: "statement",
      periodKey: "2025-01",
      title: "January statement",
      fileId: file!.id,
      originalFilename: file!.originalFilename,
      mimeType: file!.mimeType,
      sizeBytes: file!.sizeBytes,
    })
    .returning();

  const repository = createInvestmentStatementRepository(db);
  await saveInvestmentSnapshot(repository, {
    documentId: document!.id,
    expectedRevision: null,
    valuationDate: "2025-01-31",
    coverageStart: "2025-01-01",
    coverageEnd: "2025-01-31",
    summaryCoverage: "partial",
    holdingsCoverage: "partial",
    notes: null,
    totals: [
      {
        currency: "CAD",
        scope: "account_total",
        closingValue: "1000.00",
        openingValue: null,
        cash: null,
        bookCost: null,
        contributions: null,
        withdrawals: null,
        transfersIn: null,
        transfersOut: null,
        income: null,
        fees: null,
        reportedValueChange: null,
        sourcePage: null,
        sourceNote: null,
      },
    ],
    positions: [
      {
        instrumentId: null,
        lineKind: "cash",
        sourceLabel: "Cash balance",
        sourceIdentifier: null,
        sourceSeries: null,
        valueCurrency: "CAD",
        marketValue: "1000.00",
        quantity: null,
        unitPrice: null,
        unitPriceCurrency: null,
        bookCost: null,
        bookCostCurrency: null,
        sourcePage: null,
        sourceNote: null,
      },
    ],
  });
});

afterEach(async () => {
  client.close();
  await rm(directory, { recursive: true, force: true });
});

describe("assertAccountUpdateAllowsInvestmentEnrichment", () => {
  it("blocks demoting an account type while investment enrichments exist", async () => {
    await expect(
      assertAccountUpdateAllowsInvestmentEnrichment(db, {
        accountId,
        nextAccountType: "chequing",
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});
