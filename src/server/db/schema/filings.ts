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
  filingKinds,
  filingStatuses,
  returnCopyStatuses,
} from "~/domain/filing";
import { people } from "./people";
import { timestamps } from "./shared";
import { taxYears } from "./tax-years";

export const filings = sqliteTable(
  "filings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taxYearId: integer("tax_year_id")
      .notNull()
      .references(() => taxYears.id, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    kind: text("kind", { enum: filingKinds }).notNull(),
    status: text("status", { enum: filingStatuses })
      .default("preparing")
      .notNull(),
    submissionDate: text("submission_date"),
    expectedResultCents: integer("expected_result_cents"),
    returnCopyStatus: text("return_copy_status", { enum: returnCopyStatuses })
      .default("not_added_yet")
      .notNull(),
    reason: text("reason"),
    expectedChangeCents: integer("expected_change_cents"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("filings_original_return_unique")
      .on(table.taxYearId, table.personId)
      .where(sql`${table.kind} = 'original_return'`),
    index("filings_year_person_idx").on(
      table.taxYearId,
      table.personId,
      table.submissionDate,
    ),
    check(
      "filing_reason_consistent",
      sql`(${table.kind} = 'adjustment' and ${table.reason} is not null and length(trim(${table.reason})) > 0) or (${table.kind} = 'original_return' and ${table.reason} is null and ${table.expectedChangeCents} is null)`,
    ),
  ],
);

export const filingAttachments = sqliteTable(
  "filing_attachments",
  {
    filingId: integer("filing_id")
      .primaryKey()
      .references(() => filings.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    data: blob("data", { mode: "buffer" }).notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "filing_attachment_size_valid",
      sql`${table.sizeBytes} > 0 and ${table.sizeBytes} <= 20971520`,
    ),
  ],
);
