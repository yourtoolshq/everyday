import { sql } from "drizzle-orm";
import {
  blob,
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import {
  businessExpenseCategories,
  businessRecordKinds,
} from "~/domain/self-employment";
import { people } from "./people";
import { timestamps } from "./shared";
import { taxItems } from "./tax-items";
import { taxYears } from "./tax-years";

export const businessActivities = sqliteTable(
  "business_activities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taxYearId: integer("tax_year_id")
      .notNull()
      .references(() => taxYears.id, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    taxItemId: integer("tax_item_id")
      .notNull()
      .references(() => taxItems.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ...timestamps,
  },
  (table) => [
    index("business_activities_year_idx").on(table.taxYearId),
    index("business_activities_person_idx").on(table.personId),
    uniqueIndex("business_activities_tax_item_unique").on(table.taxItemId),
  ],
);

export const businessRecords = sqliteTable(
  "business_records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    businessActivityId: integer("business_activity_id")
      .notNull()
      .references(() => businessActivities.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: businessRecordKinds }).notNull(),
    expenseCategory: text("expense_category", {
      enum: businessExpenseCategories,
    }),
    date: text("date").notNull(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("business_records_activity_idx").on(table.businessActivityId),
    index("business_records_date_idx").on(table.date),
    check("business_record_amount_positive", sql`${table.amountCents} > 0`),
    check(
      "business_record_category_consistent",
      sql`(${table.kind} = 'revenue' and ${table.expenseCategory} is null) or (${table.kind} = 'expense' and ${table.expenseCategory} is not null)`,
    ),
  ],
);

export const businessRecordAttachments = sqliteTable(
  "business_record_attachments",
  {
    businessRecordId: integer("business_record_id")
      .primaryKey()
      .references(() => businessRecords.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    data: blob("data", { mode: "buffer" }).notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "business_record_attachment_size_valid",
      sql`${table.sizeBytes} > 0 and ${table.sizeBytes} <= 20971520`,
    ),
  ],
);
