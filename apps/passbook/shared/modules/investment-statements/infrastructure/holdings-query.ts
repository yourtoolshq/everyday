import { asc, eq, inArray, isNotNull, lte, or } from "drizzle-orm";

import type { db as passbookDb } from "~/server/db";
import {
  accounts,
  documentEnrichments,
  documents,
  investmentInstruments,
  investmentStatementPositions,
  investmentStatementSnapshots,
} from "~/server/db/schema";

export type PassbookDatabase = Pick<typeof passbookDb, "select">;

export async function listGlobalHoldingsObservations(db: PassbookDatabase) {
  const rows = await db
    .select({
      instrumentId: investmentStatementPositions.instrumentId,
      accountId: documents.accountId,
      accountName: accounts.displayName,
      documentId: documents.id,
      documentTitle: documents.title,
      valuationDate: investmentStatementSnapshots.valuationDate,
      reviewStatus: documentEnrichments.reviewStatus,
      holdingsCoverage: investmentStatementSnapshots.holdingsCoverage,
      quantity: investmentStatementPositions.quantity,
      marketValue: investmentStatementPositions.marketValue,
      valueCurrency: investmentStatementPositions.valueCurrency,
      lineKind: investmentStatementPositions.lineKind,
    })
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
    .innerJoin(accounts, eq(documents.accountId, accounts.id))
    .where(isNotNull(investmentStatementPositions.instrumentId))
    .orderBy(
      asc(accounts.displayName),
      asc(investmentStatementSnapshots.valuationDate),
    );

  const instruments = await db
    .select()
    .from(investmentInstruments)
    .orderBy(asc(investmentInstruments.displayName));

  return {
    instruments,
    positions: rows
      .filter((row) => row.instrumentId && row.lineKind === "investment")
      .map((row) => ({
        instrumentId: row.instrumentId!,
        accountId: row.accountId,
        accountName: row.accountName,
        documentId: row.documentId,
        documentTitle: row.documentTitle,
        valuationDate: row.valuationDate,
        reviewStatus: row.reviewStatus,
        holdingsCoverage: row.holdingsCoverage,
        quantity: row.quantity,
        marketValue: row.marketValue,
        valueCurrency: row.valueCurrency,
      })),
  };
}

/** Read the snapshot universe, including cash and statements without this holding. */
export async function listExposureStatements(
  db: PassbookDatabase,
  instrumentId: string,
  asOf: string,
) {
  const headers = await db
    .select({
      id: investmentStatementSnapshots.id,
      accountId: documents.accountId,
      accountName: accounts.displayName,
      documentId: documents.id,
      documentTitle: documents.title,
      valuationDate: investmentStatementSnapshots.valuationDate,
      reviewStatus: documentEnrichments.reviewStatus,
      holdingsCoverage: investmentStatementSnapshots.holdingsCoverage,
    })
    .from(investmentStatementSnapshots)
    .innerJoin(
      documentEnrichments,
      eq(investmentStatementSnapshots.enrichmentId, documentEnrichments.id),
    )
    .innerJoin(documents, eq(documentEnrichments.documentId, documents.id))
    .innerJoin(accounts, eq(documents.accountId, accounts.id))
    .where(lte(investmentStatementSnapshots.valuationDate, asOf));
  const latest = new Map<string, (typeof headers)[number]>();
  for (const header of [...headers].sort(
    (a, b) =>
      a.valuationDate.localeCompare(b.valuationDate) ||
      a.documentId.localeCompare(b.documentId),
  )) {
    if (header.reviewStatus === "reviewed")
      latest.set(header.accountId, header);
  }
  const latestIds = [...latest.values()].map((header) => header.id);
  const positions = await db
    .select()
    .from(investmentStatementPositions)
    .where(
      or(
        eq(investmentStatementPositions.instrumentId, instrumentId),
        latestIds.length
          ? inArray(investmentStatementPositions.snapshotId, latestIds)
          : undefined,
      ),
    )
    .orderBy(asc(investmentStatementPositions.sortOrder));
  const bySnapshot = new Map<string, typeof positions>();
  for (const row of positions) {
    const list = bySnapshot.get(row.snapshotId) ?? [];
    list.push(row);
    bySnapshot.set(row.snapshotId, list);
  }
  return headers.map((header) => ({
    ...header,
    positions: bySnapshot.get(header.id) ?? [],
  }));
}
