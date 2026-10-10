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
import { invalidateInvestmentReviewAfterDocumentMetadataChange } from "~/server/documents/investment-enrichment-guards";
import { holdingExposure } from "../domain/holding-exposure";
import { listExposureStatements } from "./holdings-query";

const migrationsFolder = join(process.cwd(), "drizzle");

let directory: string;
let db: ReturnType<typeof drizzle<typeof schema>>;
let client: ReturnType<typeof createClient>;
let documentId = "";

async function seedStatementDocument() {
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
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "passbook-investment-repo-"));
  client = createClient({ url: `file:${join(directory, "passbook.db")}` });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  await seedStatementDocument();
});

afterEach(async () => {
  client.close();
  await rm(directory, { recursive: true, force: true });
});

const baseSave = () => ({
  documentId,
  expectedRevision: null as number | null,
  valuationDate: "2025-01-31",
  coverageStart: "2025-01-01",
  coverageEnd: "2025-01-31",
  summaryCoverage: "partial" as const,
  holdingsCoverage: "partial" as const,
  notes: null,
  totals: [
    {
      currency: "CAD",
      scope: "account_total" as const,
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
      lineKind: "cash" as const,
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

describe("investment statement repository", () => {
  it("exposure query includes the latest statement even when the holding disappears", async () => {
    const repository = createInvestmentStatementRepository(db);
    const instrument = await createInstrumentRepository(db).create({
      displayName: "Fictional Equity",
      kind: "etf",
      series: null,
      notes: null,
      identifiers: [{ kind: "ticker", value: "FEQ", namespace: "DEMO" }],
    });
    const first = await saveInvestmentSnapshot(repository, {
      ...baseSave(),
      holdingsCoverage: "complete",
      positions: [
        { ...baseSave().positions[0]!, marketValue: "100" },
        {
          ...baseSave().positions[0]!,
          lineKind: "investment",
          instrumentId: instrument.id,
          sourceLabel: "Fictional Equity",
          marketValue: "900",
        },
      ],
    });
    await reviewInvestmentSnapshot(repository, documentId, first.revision);
    const original = (
      await db.select().from(documents).where(eq(documents.id, documentId))
    )[0]!;
    const laterId = crypto.randomUUID();
    const laterFileId = crypto.randomUUID();
    const originalFile = (
      await db
        .select()
        .from(filesTable)
        .where(eq(filesTable.id, original.fileId))
    )[0]!;
    await db.insert(filesTable).values({
      ...originalFile,
      id: laterFileId,
      storageKey: "later-statement.pdf",
    });
    await db.insert(documents).values({
      ...original,
      id: laterId,
      fileId: laterFileId,
      periodKey: "2025-02",
      title: "February statement",
    });
    const later = await saveInvestmentSnapshot(repository, {
      ...baseSave(),
      documentId: laterId,
      valuationDate: "2025-02-28",
      holdingsCoverage: "complete",
    });
    await reviewInvestmentSnapshot(repository, laterId, later.revision);
    const january = await listExposureStatements(
      db,
      instrument.id,
      "2025-01-31",
    );
    expect(
      holdingExposure(january, instrument.id, "CAD", "2025-01-31").share,
    ).toBe("90.00");
    const february = await listExposureStatements(
      db,
      instrument.id,
      "2025-02-28",
    );
    const exposure = holdingExposure(
      february,
      instrument.id,
      "CAD",
      "2025-02-28",
    );
    expect(exposure.value).toBe("0");
    expect(exposure.total).toBe("1000");
    expect(exposure.accounts[0]?.documentId).toBe(laterId);
    expect(
      february.find((statement) => statement.documentId === documentId)
        ?.positions,
    ).toHaveLength(1);
  });

  it("rejects stale revisions and invalid review payloads", async () => {
    const repository = createInvestmentStatementRepository(db);
    const saved = await saveInvestmentSnapshot(repository, baseSave());
    expect(saved.revision).toBe(1);

    try {
      await saveInvestmentSnapshot(repository, {
        ...baseSave(),
        expectedRevision: 0,
        notes: "stale",
      });
      throw new Error("Expected conflict");
    } catch (error) {
      expect(isAppError(error) && error.code).toBe("conflict");
    }

    await saveInvestmentSnapshot(repository, {
      ...baseSave(),
      expectedRevision: saved.revision,
      positions: [
        ...baseSave().positions,
        {
          instrumentId: null,
          lineKind: "investment" as const,
          sourceLabel: "Unresolved ETF",
          sourceIdentifier: "ABC",
          sourceSeries: null,
          valueCurrency: "CAD",
          marketValue: "10",
          quantity: "1",
          unitPrice: "10",
          unitPriceCurrency: "CAD",
          bookCost: null,
          bookCostCurrency: null,
          sourcePage: null,
          sourceNote: null,
        },
      ],
    });
    const pending = await repository.loadSnapshotByDocumentId(documentId);
    if (!pending) throw new Error("Expected saved snapshot");

    try {
      await reviewInvestmentSnapshot(repository, documentId, pending.revision);
      throw new Error("Expected invalid review");
    } catch (error) {
      expect(isAppError(error) && error.code).toBe("invalid_input");
    }
  });

  it("removes enrichment without deleting the statement document", async () => {
    const repository = createInvestmentStatementRepository(db);
    const saved = await saveInvestmentSnapshot(repository, baseSave());
    await repository.removeSnapshot(documentId, saved.revision);

    const remaining = await db
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.id, documentId));
    expect(remaining).toHaveLength(1);
    expect(await repository.loadSnapshotByDocumentId(documentId)).toBeNull();
  });

  it("cascades enrichment deletion when the parent document is deleted", async () => {
    const repository = createInvestmentStatementRepository(db);
    await saveInvestmentSnapshot(repository, baseSave());
    await db.delete(documents).where(eq(documents.id, documentId));

    const enrichments = await db.select().from(schema.documentEnrichments);
    expect(enrichments).toHaveLength(0);
  });

  it("increments revision atomically when invalidating a reviewed snapshot", async () => {
    const repository = createInvestmentStatementRepository(db);
    const saved = await saveInvestmentSnapshot(repository, baseSave());
    const reviewed = await reviewInvestmentSnapshot(
      repository,
      documentId,
      saved.revision,
    );

    await repository.invalidateReviewForDocument(documentId);

    const [enrichment] = await db
      .select()
      .from(documentEnrichments)
      .where(eq(documentEnrichments.documentId, documentId));
    expect(enrichment?.reviewStatus).toBe("draft");
    expect(enrichment?.revision).toBe(reviewed.revision + 1);
  });

  it("rejects saves when the account type is not investment-eligible", async () => {
    const repository = createInvestmentStatementRepository(db);
    const [document] = await db
      .select({ accountId: documents.accountId })
      .from(documents)
      .where(eq(documents.id, documentId));
    await db
      .update(accounts)
      .set({ accountType: "chequing" })
      .where(eq(accounts.id, document!.accountId));

    try {
      await saveInvestmentSnapshot(repository, baseSave());
      throw new Error("Expected invalid input");
    } catch (error) {
      expect(isAppError(error) && error.code).toBe("invalid_input");
    }
  });

  it("invalidates review only after successful metadata change hooks", async () => {
    const repository = createInvestmentStatementRepository(db);
    const saved = await saveInvestmentSnapshot(repository, baseSave());
    await reviewInvestmentSnapshot(repository, documentId, saved.revision);

    await invalidateInvestmentReviewAfterDocumentMetadataChange(db, {
      documentId,
      previousPeriodKey: "2025-01",
      nextPeriodKey: "2025-01",
      previousDocumentDate: null,
      nextStoredDocumentDate: null,
    });

    let [enrichment] = await db
      .select()
      .from(documentEnrichments)
      .where(eq(documentEnrichments.documentId, documentId));
    expect(enrichment?.reviewStatus).toBe("reviewed");

    await invalidateInvestmentReviewAfterDocumentMetadataChange(db, {
      documentId,
      previousPeriodKey: "2025-01",
      nextPeriodKey: "2025-02",
      previousDocumentDate: null,
      nextStoredDocumentDate: null,
    });

    [enrichment] = await db
      .select()
      .from(documentEnrichments)
      .where(eq(documentEnrichments.documentId, documentId));
    expect(enrichment?.reviewStatus).toBe("draft");
  });
});
