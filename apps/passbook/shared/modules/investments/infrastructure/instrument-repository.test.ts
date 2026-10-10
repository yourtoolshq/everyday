import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isAppError } from "@yourtoolshq/server/errors";

import {
  reviewInvestmentSnapshot,
  saveInvestmentSnapshot,
} from "~/modules/investment-statements/application/investment-snapshot-service";
import { createInvestmentStatementRepository } from "~/modules/investment-statements/infrastructure/investment-statement-repository";
import { updateInstrument } from "~/modules/investments/application/instrument-service";
import { createInstrumentRepository } from "~/modules/investments/infrastructure/instrument-repository";
import * as schema from "~/server/db/schema";
import {
  accounts,
  documentEnrichments,
  documents,
  filesTable,
  households,
  institutions,
  people,
} from "~/server/db/schema";

const migrationsFolder = join(process.cwd(), "drizzle");

let directory: string;
let db: ReturnType<typeof drizzle<typeof schema>>;
let client: ReturnType<typeof createClient>;
let documentId = "";
let instrumentId = "";

async function seedReviewedInvestmentStatement() {
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
  documentId = document!.id;

  const instrumentRepository = createInstrumentRepository(db);
  const instrument = await instrumentRepository.create({
    displayName: "Sample ETF",
    kind: "etf",
    series: null,
    notes: null,
    identifiers: [{ kind: "ticker", value: "SAMP", namespace: null }],
  });
  instrumentId = instrument.id;

  const investmentRepository = createInvestmentStatementRepository(db);
  const saved = await saveInvestmentSnapshot(investmentRepository, {
    documentId,
    expectedRevision: null,
    valuationDate: "2025-01-31",
    coverageStart: "2025-01-01",
    coverageEnd: "2025-01-31",
    summaryCoverage: "complete",
    holdingsCoverage: "complete",
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
        instrumentId: instrument.id,
        lineKind: "investment",
        sourceLabel: "Sample ETF",
        sourceIdentifier: "SAMP",
        sourceSeries: null,
        valueCurrency: "CAD",
        marketValue: "1000.00",
        quantity: "10",
        unitPrice: "100",
        unitPriceCurrency: "CAD",
        bookCost: null,
        bookCostCurrency: null,
        sourcePage: null,
        sourceNote: null,
      },
    ],
  });
  await reviewInvestmentSnapshot(
    investmentRepository,
    documentId,
    saved.revision,
  );
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "passbook-instrument-repo-"));
  client = createClient({ url: `file:${join(directory, "passbook.db")}` });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  await seedReviewedInvestmentStatement();
});

afterEach(async () => {
  client.close();
  await rm(directory, { recursive: true, force: true });
});

describe("instrument update with investment invalidation", () => {
  it("rolls back invalid identity edits without touching reviewed snapshots", async () => {
    try {
      await updateInstrument(db, {
        id: instrumentId,
        displayName: "Sample ETF",
        kind: "mutual_fund",
        series: null,
        notes: null,
        identifiers: [{ kind: "ticker", value: "SAMP", namespace: null }],
      });
      throw new Error("Expected invalid input");
    } catch (error) {
      expect(isAppError(error) && error.code).toBe("invalid_input");
    }

    const [enrichment] = await db
      .select()
      .from(documentEnrichments)
      .where(eq(documentEnrichments.documentId, documentId));
    expect(enrichment?.reviewStatus).toBe("reviewed");
  });

  it("invalidates reviewed snapshots when identity mapping changes", async () => {
    await updateInstrument(db, {
      id: instrumentId,
      displayName: "Sample ETF",
      kind: "stock",
      series: null,
      notes: null,
      identifiers: [{ kind: "ticker", value: "SAMP", namespace: null }],
    });

    const [enrichment] = await db
      .select()
      .from(documentEnrichments)
      .where(eq(documentEnrichments.documentId, documentId));
    expect(enrichment?.reviewStatus).toBe("draft");
    expect(enrichment?.revision).toBe(3);
  });
});
