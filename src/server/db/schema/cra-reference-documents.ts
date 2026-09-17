import { sql } from "drizzle-orm";
import {
  blob,
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { craReferenceCategories } from "~/domain/cra-reference";
import { people } from "./people";
import { timestamps } from "./shared";
import { taxYears } from "./tax-years";

export const craReferenceDocuments = sqliteTable(
  "cra_reference_documents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taxYearId: integer("tax_year_id")
      .notNull()
      .references(() => taxYears.id, { onDelete: "cascade" }),
    category: text("category", { enum: craReferenceCategories }).notNull(),
    title: text("title").notNull(),
    personId: integer("person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    documentDate: text("document_date"),
    reportingPeriodLabel: text("reporting_period_label"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("cra_reference_documents_year_idx").on(table.taxYearId),
    index("cra_reference_documents_person_idx").on(table.personId),
  ],
);

export const craReferenceDocumentAttachments = sqliteTable(
  "cra_reference_document_attachments",
  {
    craReferenceDocumentId: integer("cra_reference_document_id")
      .primaryKey()
      .references(() => craReferenceDocuments.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    data: blob("data", { mode: "buffer" }).notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "cra_reference_document_attachment_size_valid",
      sql`${table.sizeBytes} > 0 and ${table.sizeBytes} <= 20971520`,
    ),
  ],
);
