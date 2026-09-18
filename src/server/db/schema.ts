import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import type { AccountStatus } from "~/lib/account-status";
import type { AccountType } from "~/lib/account-types";
import type { DocumentType } from "~/lib/documents";
import type { StatementFrequency } from "~/lib/statement-frequency";

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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("accounts_institution_idx").on(table.institutionId)],
);

export const statementExpectations = sqliteTable(
  "statement_expectations",
  {
    accountId: text("account_id")
      .primaryKey()
      .references(() => accounts.id, { onDelete: "cascade" }),
    frequency: text("frequency").$type<StatementFrequency>().notNull().default("monthly"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
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
    originalFilename: text("original_filename").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("documents_account_idx").on(table.accountId),
    uniqueIndex("documents_account_period_unique").on(table.accountId, table.periodKey),
  ],
);
