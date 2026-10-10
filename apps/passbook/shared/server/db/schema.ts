import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { filesTable, platformMetaTable } from "@yourtoolshq/data/schema";

import type { AccountEventType } from "~/lib/account-events";
import type { AccountStatus } from "~/lib/account-status";
import type { AccountType } from "~/lib/account-types";
import type { DocumentType } from "~/lib/documents";
import type { StatementFrequency } from "~/lib/statement-frequency";
import type {
  EnrichmentKind,
  EnrichmentReviewStatus,
  PositionLineKind,
  SectionCoverage,
  TotalScope,
} from "~/modules/investment-statements/domain/enums";
import type {
  IdentifierKind,
  InstrumentKind,
} from "~/modules/investments/domain/enums";
import {
  enrichmentKinds,
  enrichmentReviewStatuses,
  positionLineKinds,
  sectionCoverages,
  totalScopes,
} from "~/modules/investment-statements/domain/enums";
import {
  identifierKinds,
  instrumentKinds,
} from "~/modules/investments/domain/enums";

export { filesTable, platformMetaTable };

export {
  enrichmentKinds,
  enrichmentReviewStatuses,
  identifierKinds,
  instrumentKinds,
  positionLineKinds,
  sectionCoverages,
  totalScopes,
};
export type {
  EnrichmentKind,
  EnrichmentReviewStatus,
  IdentifierKind,
  InstrumentKind,
  PositionLineKind,
  SectionCoverage,
  TotalScope,
};

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`);

const updatedAt = () =>
  text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`);

export const households = sqliteTable("households", {
  id: id(),
  name: text("name").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const people = sqliteTable(
  "people",
  {
    id: id(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("people_household_idx").on(table.householdId)],
);

export const institutions = sqliteTable("institutions", {
  id: id(),
  name: text("name").notNull(),
  website: text("website"),
  notes: text("notes"),
  iconFileId: text("icon_file_id").references(() => filesTable.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const accounts = sqliteTable(
  "accounts",
  {
    id: id(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "restrict" }),
    displayName: text("display_name").notNull(),
    accountType: text("account_type").$type<AccountType>().notNull(),
    identifierSuffix: text("identifier_suffix"),
    status: text("status").$type<AccountStatus>().notNull().default("active"),
    openedDate: text("opened_date"),
    closedDate: text("closed_date"),
    notes: text("notes"),
    interestRate: text("interest_rate"),
    promotionalInterestRate: text("promotional_interest_rate"),
    promotionalInterestRateExpires: text("promotional_interest_rate_expires"),
    creditLimit: text("credit_limit"),
    annualFee: text("annual_fee"),
    renewalDate: text("renewal_date"),
    insurance: text("insurance"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("accounts_institution_idx").on(table.institutionId)],
);

export const accountTermsSnapshots = sqliteTable(
  "account_terms_snapshots",
  {
    id: id(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    effectiveDate: text("effective_date").notNull(),
    interestRate: text("interest_rate"),
    promotionalInterestRate: text("promotional_interest_rate"),
    promotionalInterestRateExpires: text("promotional_interest_rate_expires"),
    creditLimit: text("credit_limit"),
    annualFee: text("annual_fee"),
    renewalDate: text("renewal_date"),
    insurance: text("insurance"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("account_terms_snapshots_account_idx").on(table.accountId)],
);

export const statementExpectations = sqliteTable("statement_expectations", {
  accountId: text("account_id")
    .primaryKey()
    .references(() => accounts.id, { onDelete: "cascade" }),
  frequency: text("frequency")
    .$type<StatementFrequency>()
    .notNull()
    .default("monthly"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const statementPeriodExceptions = sqliteTable(
  "statement_period_exceptions",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    periodKey: text("period_key").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("statement_period_exceptions_unique").on(
      table.accountId,
      table.periodKey,
    ),
    index("statement_period_exceptions_account_idx").on(table.accountId),
  ],
);

export const accountOwnership = sqliteTable(
  "account_ownership",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("account_ownership_unique").on(table.accountId, table.personId),
    index("account_ownership_person_idx").on(table.personId),
  ],
);

export const accountEvents = sqliteTable(
  "account_events",
  {
    id: id(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    type: text("type").$type<AccountEventType>().notNull(),
    title: text("title").notNull(),
    notes: text("notes"),
    startDate: text("start_date").notNull(),
    resolvedDate: text("resolved_date"),
    termsSnapshotId: text("terms_snapshot_id").references(
      () => accountTermsSnapshots.id,
      {
        onDelete: "set null",
      },
    ),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("account_events_account_idx").on(table.accountId)],
);

export const INVESTMENT_STATEMENT_SCHEMA_VERSION = 1;

export const documents = sqliteTable(
  "documents",
  {
    id: id(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    type: text("type").$type<DocumentType>().notNull(),
    periodKey: text("period_key"),
    title: text("title").notNull(),
    documentDate: text("document_date"),
    notes: text("notes"),
    eventId: text("event_id").references(() => accountEvents.id, {
      onDelete: "set null",
    }),
    termsSnapshotId: text("terms_snapshot_id").references(
      () => accountTermsSnapshots.id,
      {
        onDelete: "set null",
      },
    ),
    fileId: text("file_id")
      .notNull()
      .references(() => filesTable.id),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("documents_account_idx").on(table.accountId),
    index("documents_event_idx").on(table.eventId),
    index("documents_terms_snapshot_idx").on(table.termsSnapshotId),
    uniqueIndex("documents_file_unique").on(table.fileId),
    uniqueIndex("documents_account_period_unique").on(
      table.accountId,
      table.periodKey,
    ),
  ],
);

export const documentEnrichments = sqliteTable(
  "document_enrichments",
  {
    id: id(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    kind: text("kind").$type<EnrichmentKind>().notNull(),
    schemaVersion: integer("schema_version")
      .notNull()
      .default(INVESTMENT_STATEMENT_SCHEMA_VERSION),
    entryMethod: text("entry_method").notNull().default("manual"),
    reviewStatus: text("review_status")
      .$type<EnrichmentReviewStatus>()
      .notNull()
      .default("draft"),
    revision: integer("revision").notNull().default(0),
    reviewedAt: text("reviewed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("document_enrichments_document_kind_unique").on(
      table.documentId,
      table.kind,
    ),
    index("document_enrichments_document_idx").on(table.documentId),
  ],
);

export const investmentStatementSnapshots = sqliteTable(
  "investment_statement_snapshots",
  {
    id: id(),
    enrichmentId: text("enrichment_id")
      .notNull()
      .references(() => documentEnrichments.id, { onDelete: "cascade" }),
    valuationDate: text("valuation_date").notNull(),
    coverageStart: text("coverage_start"),
    coverageEnd: text("coverage_end"),
    summaryCoverage: text("summary_coverage")
      .$type<SectionCoverage>()
      .notNull()
      .default("not_entered"),
    holdingsCoverage: text("holdings_coverage")
      .$type<SectionCoverage>()
      .notNull()
      .default("not_entered"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("investment_statement_snapshots_enrichment_unique").on(
      table.enrichmentId,
    ),
    index("investment_statement_snapshots_valuation_idx").on(
      table.valuationDate,
    ),
  ],
);

export const investmentStatementTotals = sqliteTable(
  "investment_statement_totals",
  {
    id: id(),
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => investmentStatementSnapshots.id, {
        onDelete: "cascade",
      }),
    currency: text("currency").notNull(),
    scope: text("scope").$type<TotalScope>().notNull(),
    closingValue: text("closing_value"),
    openingValue: text("opening_value"),
    cash: text("cash"),
    bookCost: text("book_cost"),
    contributions: text("contributions"),
    withdrawals: text("withdrawals"),
    transfersIn: text("transfers_in"),
    transfersOut: text("transfers_out"),
    income: text("income"),
    fees: text("fees"),
    reportedValueChange: text("reported_value_change"),
    sourcePage: integer("source_page"),
    sourceNote: text("source_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("investment_statement_totals_snapshot_currency_scope").on(
      table.snapshotId,
      table.currency,
      table.scope,
    ),
    index("investment_statement_totals_snapshot_idx").on(table.snapshotId),
  ],
);

export const investmentInstruments = sqliteTable("investment_instruments", {
  id: id(),
  kind: text("kind").$type<InstrumentKind>().notNull(),
  displayName: text("display_name").notNull(),
  series: text("series"),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const investmentInstrumentIdentifiers = sqliteTable(
  "investment_instrument_identifiers",
  {
    id: id(),
    instrumentId: text("instrument_id")
      .notNull()
      .references(() => investmentInstruments.id, { onDelete: "cascade" }),
    kind: text("kind").$type<IdentifierKind>().notNull(),
    value: text("value").notNull(),
    namespace: text("namespace"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("investment_instrument_identifiers_unique").on(
      table.kind,
      table.value,
      table.namespace,
    ),
    index("investment_instrument_identifiers_instrument_idx").on(
      table.instrumentId,
    ),
  ],
);

export const investmentStatementPositions = sqliteTable(
  "investment_statement_positions",
  {
    id: id(),
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => investmentStatementSnapshots.id, {
        onDelete: "cascade",
      }),
    instrumentId: text("instrument_id").references(
      () => investmentInstruments.id,
      { onDelete: "restrict" },
    ),
    lineKind: text("line_kind").$type<PositionLineKind>().notNull(),
    sourceLabel: text("source_label").notNull(),
    sourceIdentifier: text("source_identifier"),
    sourceSeries: text("source_series"),
    valueCurrency: text("value_currency").notNull(),
    marketValue: text("market_value"),
    quantity: text("quantity"),
    unitPrice: text("unit_price"),
    unitPriceCurrency: text("unit_price_currency"),
    bookCost: text("book_cost"),
    bookCostCurrency: text("book_cost_currency"),
    sourcePage: integer("source_page"),
    sourceNote: text("source_note"),
    sortOrder: integer("sort_order").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("investment_statement_positions_snapshot_idx").on(table.snapshotId),
    index("investment_statement_positions_instrument_idx").on(
      table.instrumentId,
    ),
  ],
);
