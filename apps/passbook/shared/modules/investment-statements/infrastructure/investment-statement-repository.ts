import { and, asc, eq, inArray, sql } from "drizzle-orm";

import {
  conflict,
  failedPrecondition,
  invalidInput,
  notFound,
  unexpected,
} from "@yourtoolshq/server/errors";

import type { AccountType } from "~/lib/account-types";
import type {
  SaveSnapshotCommand,
  SnapshotDto,
} from "~/modules/investment-statements/domain/snapshot-dto";
import type { db as passbookDb } from "~/server/db";
import { isInvestmentEligibleAccountType } from "~/modules/investment-statements/domain/account-eligibility";
import {
  accounts,
  documentEnrichments,
  documents,
  INVESTMENT_STATEMENT_SCHEMA_VERSION,
  investmentStatementPositions,
  investmentStatementSnapshots,
  investmentStatementTotals,
} from "~/server/db/schema";

export type PassbookDatabase = Pick<
  typeof passbookDb,
  "select" | "insert" | "update" | "delete" | "transaction"
>;

const now = () => new Date().toISOString();

type DbExecutor = Pick<
  PassbookDatabase,
  "select" | "insert" | "update" | "delete"
>;

type InvestmentDocumentContext = {
  type: string;
  accountType: AccountType;
};

function assertInvestmentEligibleDocumentContext(
  context: InvestmentDocumentContext,
  invalidInputMessage = "Only statement documents support investment details.",
) {
  if (context.type !== "statement") {
    throw invalidInput(invalidInputMessage);
  }
  if (!isInvestmentEligibleAccountType(context.accountType)) {
    throw invalidInput(
      "Investment details are only available for investment, TFSA, RRSP, and FHSA accounts.",
    );
  }
}

async function invalidateReviewForDocumentOnExecutor(
  db: DbExecutor,
  documentId: string,
) {
  await db
    .update(documentEnrichments)
    .set({
      reviewStatus: "draft",
      reviewedAt: null,
      revision: sql`${documentEnrichments.revision} + 1`,
      updatedAt: now(),
    })
    .where(
      and(
        eq(documentEnrichments.documentId, documentId),
        eq(documentEnrichments.kind, "investment_statement"),
        eq(documentEnrichments.reviewStatus, "reviewed"),
      ),
    );
}

async function loadSnapshotParts(
  db: DbExecutor,
  enrichmentId: string,
  snapshotRowId: string,
) {
  const totals = await db
    .select()
    .from(investmentStatementTotals)
    .where(eq(investmentStatementTotals.snapshotId, snapshotRowId));
  const positions = await db
    .select()
    .from(investmentStatementPositions)
    .where(eq(investmentStatementPositions.snapshotId, snapshotRowId))
    .orderBy(asc(investmentStatementPositions.sortOrder));
  return { totals, positions };
}

function mapSnapshotDto(
  enrichment: typeof documentEnrichments.$inferSelect,
  snapshot: typeof investmentStatementSnapshots.$inferSelect,
  document: {
    id: string;
    accountId: string;
    title: string;
    periodKey: string | null;
  },
  totals: (typeof investmentStatementTotals.$inferSelect)[],
  positions: (typeof investmentStatementPositions.$inferSelect)[],
): SnapshotDto {
  return {
    id: enrichment.id,
    documentId: document.id,
    accountId: document.accountId,
    documentTitle: document.title,
    periodKey: document.periodKey,
    revision: enrichment.revision,
    schemaVersion: enrichment.schemaVersion,
    reviewStatus: enrichment.reviewStatus,
    reviewedAt: enrichment.reviewedAt,
    valuationDate: snapshot.valuationDate,
    coverageStart: snapshot.coverageStart,
    coverageEnd: snapshot.coverageEnd,
    summaryCoverage: snapshot.summaryCoverage,
    holdingsCoverage: snapshot.holdingsCoverage,
    notes: snapshot.notes,
    totals: totals.map((row) => ({
      id: row.id,
      currency: row.currency,
      scope: row.scope,
      closingValue: row.closingValue,
      openingValue: row.openingValue,
      cash: row.cash,
      bookCost: row.bookCost,
      contributions: row.contributions,
      withdrawals: row.withdrawals,
      transfersIn: row.transfersIn,
      transfersOut: row.transfersOut,
      income: row.income,
      fees: row.fees,
      reportedValueChange: row.reportedValueChange,
      sourcePage: row.sourcePage,
      sourceNote: row.sourceNote,
    })),
    positions: positions.map((row) => ({
      id: row.id,
      instrumentId: row.instrumentId,
      lineKind: row.lineKind,
      sourceLabel: row.sourceLabel,
      sourceIdentifier: row.sourceIdentifier,
      sourceSeries: row.sourceSeries,
      valueCurrency: row.valueCurrency,
      marketValue: row.marketValue,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      unitPriceCurrency: row.unitPriceCurrency,
      bookCost: row.bookCost,
      bookCostCurrency: row.bookCostCurrency,
      sourcePage: row.sourcePage,
      sourceNote: row.sourceNote,
    })),
  };
}

export function createInvestmentStatementRepository(db: PassbookDatabase) {
  return {
    async findDocumentContext(documentId: string) {
      const [row] = await db
        .select({
          documentId: documents.id,
          accountId: documents.accountId,
          accountType: accounts.accountType,
          type: documents.type,
          title: documents.title,
          periodKey: documents.periodKey,
          documentDate: documents.documentDate,
          fileId: documents.fileId,
          mimeType: documents.mimeType,
          originalFilename: documents.originalFilename,
          accountName: accounts.displayName,
        })
        .from(documents)
        .innerJoin(accounts, eq(documents.accountId, accounts.id))
        .where(eq(documents.id, documentId));
      return row ?? null;
    },

    async loadSnapshotByDocumentId(
      documentId: string,
    ): Promise<SnapshotDto | null> {
      const [enrichment] = await db
        .select()
        .from(documentEnrichments)
        .where(
          and(
            eq(documentEnrichments.documentId, documentId),
            eq(documentEnrichments.kind, "investment_statement"),
          ),
        );
      if (!enrichment) return null;

      const [snapshot] = await db
        .select()
        .from(investmentStatementSnapshots)
        .where(eq(investmentStatementSnapshots.enrichmentId, enrichment.id));
      if (!snapshot) {
        throw unexpected("Investment snapshot payload is missing.");
      }

      const [document] = await db
        .select({
          id: documents.id,
          accountId: documents.accountId,
          title: documents.title,
          periodKey: documents.periodKey,
        })
        .from(documents)
        .where(eq(documents.id, documentId));
      if (!document) return null;

      const { totals, positions } = await loadSnapshotParts(
        db,
        enrichment.id,
        snapshot.id,
      );
      return mapSnapshotDto(enrichment, snapshot, document, totals, positions);
    },

    async listSnapshotsByAccountId(accountId: string): Promise<
      (SnapshotDto & {
        valuationDate: string;
        documentId: string;
        documentTitle: string;
        periodKey: string | null;
      })[]
    > {
      const rows = await db
        .select({
          enrichment: documentEnrichments,
          snapshot: investmentStatementSnapshots,
          documentId: documents.id,
          documentTitle: documents.title,
          periodKey: documents.periodKey,
          accountId: documents.accountId,
        })
        .from(documentEnrichments)
        .innerJoin(documents, eq(documentEnrichments.documentId, documents.id))
        .innerJoin(
          investmentStatementSnapshots,
          eq(investmentStatementSnapshots.enrichmentId, documentEnrichments.id),
        )
        .where(
          and(
            eq(documents.accountId, accountId),
            eq(documentEnrichments.kind, "investment_statement"),
          ),
        );

      const snapshotIds = rows.map((row) => row.snapshot.id);
      if (snapshotIds.length === 0) return [];

      const totals = await db
        .select()
        .from(investmentStatementTotals)
        .where(inArray(investmentStatementTotals.snapshotId, snapshotIds));
      const positions = await db
        .select()
        .from(investmentStatementPositions)
        .where(inArray(investmentStatementPositions.snapshotId, snapshotIds))
        .orderBy(asc(investmentStatementPositions.sortOrder));

      const totalsBySnapshot = new Map<string, typeof totals>();
      for (const row of totals) {
        const list = totalsBySnapshot.get(row.snapshotId) ?? [];
        list.push(row);
        totalsBySnapshot.set(row.snapshotId, list);
      }
      const positionsBySnapshot = new Map<string, typeof positions>();
      for (const row of positions) {
        const list = positionsBySnapshot.get(row.snapshotId) ?? [];
        list.push(row);
        positionsBySnapshot.set(row.snapshotId, list);
      }

      const mapped = rows.map((row) =>
        mapSnapshotDto(
          row.enrichment,
          row.snapshot,
          {
            id: row.documentId,
            accountId: row.accountId,
            title: row.documentTitle,
            periodKey: row.periodKey,
          },
          totalsBySnapshot.get(row.snapshot.id) ?? [],
          positionsBySnapshot.get(row.snapshot.id) ?? [],
        ),
      );

      return mapped.sort((left, right) => {
        if (left.valuationDate !== right.valuationDate) {
          return left.valuationDate.localeCompare(right.valuationDate);
        }
        return left.documentTitle.localeCompare(right.documentTitle);
      });
    },

    async saveSnapshot(command: SaveSnapshotCommand): Promise<SnapshotDto> {
      return db.transaction(async (tx) => {
        const context = await createInvestmentStatementRepository(
          tx as PassbookDatabase,
        ).findDocumentContext(command.documentId);
        if (!context) throw notFound("Document not found.");
        assertInvestmentEligibleDocumentContext(context);

        const [existing] = await tx
          .select()
          .from(documentEnrichments)
          .where(
            and(
              eq(documentEnrichments.documentId, command.documentId),
              eq(documentEnrichments.kind, "investment_statement"),
            ),
          );

        if (!existing) {
          if (command.expectedRevision !== null) {
            throw conflict(
              "This statement no longer matches the expected revision.",
            );
          }
          const [enrichment] = await tx
            .insert(documentEnrichments)
            .values({
              documentId: command.documentId,
              kind: "investment_statement",
              schemaVersion: INVESTMENT_STATEMENT_SCHEMA_VERSION,
              entryMethod: "manual",
              reviewStatus: "draft",
              revision: 1,
              reviewedAt: null,
            })
            .returning();
          if (!enrichment) throw unexpected("Enrichment creation failed.");

          const [snapshot] = await tx
            .insert(investmentStatementSnapshots)
            .values({
              enrichmentId: enrichment.id,
              valuationDate: command.valuationDate,
              coverageStart: command.coverageStart,
              coverageEnd: command.coverageEnd,
              summaryCoverage: command.summaryCoverage,
              holdingsCoverage: command.holdingsCoverage,
              notes: command.notes,
            })
            .returning();
          if (!snapshot) throw unexpected("Snapshot creation failed.");

          await insertChildren(tx, snapshot.id, command);
          const loaded = await createInvestmentStatementRepository(
            tx as PassbookDatabase,
          ).loadSnapshotByDocumentId(command.documentId);
          if (!loaded) throw unexpected("Saved snapshot could not be loaded.");
          return loaded;
        }

        if (command.expectedRevision === null) {
          throw conflict("This statement already has investment details.");
        }
        if (existing.revision !== command.expectedRevision) {
          throw conflict(
            "This statement was updated elsewhere. Reload and try again.",
          );
        }

        const [snapshot] = await tx
          .select()
          .from(investmentStatementSnapshots)
          .where(eq(investmentStatementSnapshots.enrichmentId, existing.id));
        if (!snapshot)
          throw unexpected("Investment snapshot payload is missing.");

        await tx
          .update(documentEnrichments)
          .set({
            reviewStatus: "draft",
            reviewedAt: null,
            revision: existing.revision + 1,
            updatedAt: now(),
          })
          .where(eq(documentEnrichments.id, existing.id));

        await tx
          .update(investmentStatementSnapshots)
          .set({
            valuationDate: command.valuationDate,
            coverageStart: command.coverageStart,
            coverageEnd: command.coverageEnd,
            summaryCoverage: command.summaryCoverage,
            holdingsCoverage: command.holdingsCoverage,
            notes: command.notes,
            updatedAt: now(),
          })
          .where(eq(investmentStatementSnapshots.id, snapshot.id));

        await tx
          .delete(investmentStatementTotals)
          .where(eq(investmentStatementTotals.snapshotId, snapshot.id));
        await tx
          .delete(investmentStatementPositions)
          .where(eq(investmentStatementPositions.snapshotId, snapshot.id));

        await insertChildren(tx, snapshot.id, command);

        const loaded = await createInvestmentStatementRepository(
          tx as PassbookDatabase,
        ).loadSnapshotByDocumentId(command.documentId);
        if (!loaded) throw unexpected("Saved snapshot could not be loaded.");
        return loaded;
      });
    },

    async reviewSnapshot(
      documentId: string,
      expectedRevision: number,
    ): Promise<SnapshotDto> {
      return db.transaction(async (tx) => {
        const context = await createInvestmentStatementRepository(
          tx as PassbookDatabase,
        ).findDocumentContext(documentId);
        if (!context) throw notFound("Document not found.");
        if (context.type !== "statement") {
          throw failedPrecondition(
            "Only statement documents support investment details.",
          );
        }
        if (!isInvestmentEligibleAccountType(context.accountType)) {
          throw failedPrecondition(
            "Investment details are only available for investment, TFSA, RRSP, and FHSA accounts.",
          );
        }

        const [existing] = await tx
          .select()
          .from(documentEnrichments)
          .where(
            and(
              eq(documentEnrichments.documentId, documentId),
              eq(documentEnrichments.kind, "investment_statement"),
            ),
          );
        if (!existing) throw notFound("Investment details not found.");
        if (existing.revision !== expectedRevision) {
          throw conflict(
            "This statement was updated elsewhere. Reload and try again.",
          );
        }

        const reviewedAt = now();
        await tx
          .update(documentEnrichments)
          .set({
            reviewStatus: "reviewed",
            reviewedAt,
            revision: existing.revision + 1,
            updatedAt: reviewedAt,
          })
          .where(eq(documentEnrichments.id, existing.id));

        const loaded = await createInvestmentStatementRepository(
          tx as PassbookDatabase,
        ).loadSnapshotByDocumentId(documentId);
        if (!loaded) throw unexpected("Reviewed snapshot could not be loaded.");
        return loaded;
      });
    },

    async removeSnapshot(
      documentId: string,
      expectedRevision: number,
    ): Promise<{ documentId: string }> {
      return db.transaction(async (tx) => {
        const context = await createInvestmentStatementRepository(
          tx as PassbookDatabase,
        ).findDocumentContext(documentId);
        if (!context) throw notFound("Document not found.");
        if (context.type !== "statement") {
          throw failedPrecondition(
            "Only statement documents support investment details.",
          );
        }
        if (!isInvestmentEligibleAccountType(context.accountType)) {
          throw failedPrecondition(
            "Investment details are only available for investment, TFSA, RRSP, and FHSA accounts.",
          );
        }

        const [existing] = await tx
          .select()
          .from(documentEnrichments)
          .where(
            and(
              eq(documentEnrichments.documentId, documentId),
              eq(documentEnrichments.kind, "investment_statement"),
            ),
          );
        if (!existing) throw notFound("Investment details not found.");
        if (existing.revision !== expectedRevision) {
          throw conflict(
            "This statement was updated elsewhere. Reload and try again.",
          );
        }

        await tx
          .delete(documentEnrichments)
          .where(eq(documentEnrichments.id, existing.id));
        return { documentId };
      });
    },

    async invalidateReviewForDocument(documentId: string) {
      await invalidateReviewForDocumentOnExecutor(db, documentId);
    },

    async accountHasInvestmentEnrichment(accountId: string): Promise<boolean> {
      const rows = await db
        .select({ id: documentEnrichments.id })
        .from(documentEnrichments)
        .innerJoin(documents, eq(documentEnrichments.documentId, documents.id))
        .where(
          and(
            eq(documents.accountId, accountId),
            eq(documentEnrichments.kind, "investment_statement"),
          ),
        )
        .limit(1);
      return rows.length > 0;
    },

    async documentHasInvestmentEnrichment(
      documentId: string,
    ): Promise<boolean> {
      const [row] = await db
        .select({ id: documentEnrichments.id })
        .from(documentEnrichments)
        .where(
          and(
            eq(documentEnrichments.documentId, documentId),
            eq(documentEnrichments.kind, "investment_statement"),
          ),
        );
      return Boolean(row);
    },

    async countEnrichmentsForAccount(accountId: string): Promise<number> {
      const rows = await db
        .select({ id: documentEnrichments.id })
        .from(documentEnrichments)
        .innerJoin(documents, eq(documentEnrichments.documentId, documents.id))
        .where(
          and(
            eq(documents.accountId, accountId),
            eq(documentEnrichments.kind, "investment_statement"),
          ),
        );
      return rows.length;
    },

    async invalidateReviewedSnapshotsForInstruments(instrumentIds: string[]) {
      if (instrumentIds.length === 0) return;
      const positionRows = await db
        .select({ documentId: documents.id })
        .from(investmentStatementPositions)
        .innerJoin(
          investmentStatementSnapshots,
          eq(
            investmentStatementPositions.snapshotId,
            investmentStatementSnapshots.id,
          ),
        )
        .innerJoin(
          documentEnrichments,
          eq(investmentStatementSnapshots.enrichmentId, documentEnrichments.id),
        )
        .innerJoin(documents, eq(documentEnrichments.documentId, documents.id))
        .where(
          and(
            inArray(investmentStatementPositions.instrumentId, instrumentIds),
            eq(documentEnrichments.reviewStatus, "reviewed"),
          ),
        );

      const documentIds = [
        ...new Set(positionRows.map((row) => row.documentId)),
      ];
      for (const documentId of documentIds) {
        await invalidateReviewForDocumentOnExecutor(db, documentId);
      }
    },
  };
}

async function insertChildren(
  tx: DbExecutor,
  snapshotId: string,
  command: SaveSnapshotCommand,
) {
  if (command.totals.length > 0) {
    await tx.insert(investmentStatementTotals).values(
      command.totals.map((row) => ({
        snapshotId,
        currency: row.currency,
        scope: row.scope,
        closingValue: row.closingValue,
        openingValue: row.openingValue,
        cash: row.cash,
        bookCost: row.bookCost,
        contributions: row.contributions,
        withdrawals: row.withdrawals,
        transfersIn: row.transfersIn,
        transfersOut: row.transfersOut,
        income: row.income,
        fees: row.fees,
        reportedValueChange: row.reportedValueChange,
        sourcePage: row.sourcePage,
        sourceNote: row.sourceNote,
      })),
    );
  }

  if (command.positions.length > 0) {
    await tx.insert(investmentStatementPositions).values(
      command.positions.map((row, index) => ({
        snapshotId,
        instrumentId: row.instrumentId,
        lineKind: row.lineKind,
        sourceLabel: row.sourceLabel,
        sourceIdentifier: row.sourceIdentifier,
        sourceSeries: row.sourceSeries,
        valueCurrency: row.valueCurrency,
        marketValue: row.marketValue,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        unitPriceCurrency: row.unitPriceCurrency,
        bookCost: row.bookCost,
        bookCostCurrency: row.bookCostCurrency,
        sourcePage: row.sourcePage,
        sourceNote: row.sourceNote,
        sortOrder: index,
      })),
    );
  }
}

export type InvestmentStatementRepository = ReturnType<
  typeof createInvestmentStatementRepository
>;
