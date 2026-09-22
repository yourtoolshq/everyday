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

import { assessmentKinds } from "~/domain/filing";
import { timestamps } from "./shared";
import { filings } from "./filings";

export const assessments = sqliteTable(
  "assessments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    filingId: integer("filing_id")
      .notNull()
      .references(() => filings.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: assessmentKinds }).notNull(),
    assessmentDate: text("assessment_date").notNull(),
    assessedResultCents: integer("assessed_result_cents"),
    refundOrPaymentDate: text("refund_or_payment_date"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("assessments_filing_unique").on(table.filingId),
    index("assessments_date_idx").on(table.assessmentDate),
  ],
);

export const assessmentAttachments = sqliteTable(
  "assessment_attachments",
  {
    assessmentId: integer("assessment_id")
      .primaryKey()
      .references(() => assessments.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    data: blob("data", { mode: "buffer" }).notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "assessment_attachment_size_valid",
      sql`${table.sizeBytes} > 0 and ${table.sizeBytes} <= 20971520`,
    ),
  ],
);
