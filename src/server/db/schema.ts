import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import type { CompensationCurrency, CompensationType } from "~/lib/compensation";
import type { DocumentType } from "~/lib/documents";
import type { EmploymentStatus } from "~/lib/employment-status";
import type { PayFrequency } from "~/lib/pay-frequency";

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

export const employers = sqliteTable("employers", {
  id: id(),
  name: text("name").notNull(),
  website: text("website"),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const employments = sqliteTable(
  "employments",
  {
    id: id(),
    employerId: text("employer_id")
      .notNull()
      .references(() => employers.id, { onDelete: "restrict" }),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    jobTitle: text("job_title"),
    status: text("status").$type<EmploymentStatus>().notNull().default("current"),
    startDate: text("start_date"),
    endDate: text("end_date"),
    notes: text("notes"),
    payFrequency: text("pay_frequency").$type<PayFrequency>().notNull().default("irregular"),
    biweeklyAnchorDate: text("biweekly_anchor_date"),
    deductionSettings: text("deduction_settings").notNull().default("{}"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("employments_employer_idx").on(table.employerId),
    index("employments_person_idx").on(table.personId),
  ],
);

export const discussions = sqliteTable(
  "discussions",
  {
    id: id(),
    employmentId: text("employment_id")
      .notNull()
      .references(() => employments.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    discussionDate: text("discussion_date"),
    participants: text("participants"),
    body: text("body"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("discussions_employment_idx").on(table.employmentId)],
);

export const documents = sqliteTable(
  "documents",
  {
    id: id(),
    employmentId: text("employment_id")
      .notNull()
      .references(() => employments.id, { onDelete: "cascade" }),
    discussionId: text("discussion_id").references(() => discussions.id, { onDelete: "set null" }),
    type: text("type").$type<DocumentType>().notNull(),
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
    index("documents_employment_idx").on(table.employmentId),
    index("documents_discussion_idx").on(table.discussionId),
  ],
);

export const paychecks = sqliteTable(
  "paychecks",
  {
    id: id(),
    employmentId: text("employment_id")
      .notNull()
      .references(() => employments.id, { onDelete: "cascade" }),
    payDate: text("pay_date").notNull(),
    periodStartDate: text("period_start_date").notNull(),
    periodEndDate: text("period_end_date").notNull(),
    grossPayCents: integer("gross_pay_cents").notNull(),
    incomeTaxCents: integer("income_tax_cents").notNull(),
    federalIncomeTaxCents: integer("federal_income_tax_cents").notNull().default(0),
    manitobaIncomeTaxCents: integer("manitoba_income_tax_cents").notNull().default(0),
    cppCents: integer("cpp_cents").notNull(),
    cpp2Cents: integer("cpp2_cents").notNull(),
    eiCents: integer("ei_cents").notNull(),
    wiCents: integer("wi_cents").notNull().default(0),
    ltdCents: integer("ltd_cents").notNull().default(0),
    extendedHealthCents: integer("extended_health_cents").notNull().default(0),
    travelMedicalCents: integer("travel_medical_cents").notNull().default(0),
    unionDuesCents: integer("union_dues_cents").notNull().default(0),
    otherDeductionsCents: integer("other_deductions_cents").notNull(),
    netPayCents: integer("net_pay_cents").notNull(),
    documentId: text("document_id").references(() => documents.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("paychecks_employment_idx").on(table.employmentId),
    index("paychecks_document_idx").on(table.documentId),
  ],
);

export const compensationChanges = sqliteTable(
  "compensation_changes",
  {
    id: id(),
    employmentId: text("employment_id")
      .notNull()
      .references(() => employments.id, { onDelete: "cascade" }),
    type: text("type").$type<CompensationType>().notNull(),
    currency: text("currency").$type<CompensationCurrency>().notNull().default("CAD"),
    effectiveDate: text("effective_date").notNull(),
    amountCents: integer("amount_cents"),
    commissionBasisPoints: integer("commission_basis_points"),
    notes: text("notes"),
    documentId: text("document_id").references(() => documents.id, { onDelete: "set null" }),
    discussionId: text("discussion_id").references(() => discussions.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("compensation_changes_employment_idx").on(table.employmentId),
    index("compensation_changes_document_idx").on(table.documentId),
    index("compensation_changes_discussion_idx").on(table.discussionId),
  ],
);

export const payPeriodExceptions = sqliteTable(
  "pay_period_exceptions",
  {
    employmentId: text("employment_id")
      .notNull()
      .references(() => employments.id, { onDelete: "cascade" }),
    periodKey: text("period_key").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.employmentId, table.periodKey] }),
    index("pay_period_exceptions_employment_idx").on(table.employmentId),
  ],
);

export const employmentRecordExceptions = sqliteTable(
  "employment_record_exceptions",
  {
    employmentId: text("employment_id")
      .notNull()
      .references(() => employments.id, { onDelete: "cascade" }),
    requirementKey: text("requirement_key").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.employmentId, table.requirementKey] }),
    index("employment_record_exceptions_employment_idx").on(table.employmentId),
  ],
);
