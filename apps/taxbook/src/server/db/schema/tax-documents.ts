import { sql } from "drizzle-orm";
import { blob, check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { taxDocumentStatuses, taxDocumentTypes } from "~/domain/tax-document";
import { people } from "./people";
import { timestamps } from "./shared";
import { taxItems } from "./tax-items";

export const taxDocuments = sqliteTable(
  "tax_documents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taxItemId: integer("tax_item_id")
      .notNull()
      .references(() => taxItems.id, { onDelete: "cascade" }),
    type: text("type", { enum: taxDocumentTypes }).notNull(),
    customTypeName: text("custom_type_name"),
    issuer: text("issuer").notNull(),
    personId: integer("person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    status: text("status", { enum: taxDocumentStatuses })
      .default("expected")
      .notNull(),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("tax_documents_tax_item_idx").on(table.taxItemId),
    index("tax_documents_person_idx").on(table.personId),
    index("tax_documents_status_idx").on(table.status),
    check(
      "tax_document_custom_type_consistent",
      sql`(${table.type} = 'other' and ${table.customTypeName} is not null and length(trim(${table.customTypeName})) > 0) or (${table.type} <> 'other' and ${table.customTypeName} is null)`,
    ),
  ],
);

export const taxDocumentAttachments = sqliteTable(
  "tax_document_attachments",
  {
    taxDocumentId: integer("tax_document_id")
      .primaryKey()
      .references(() => taxDocuments.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    data: blob("data", { mode: "buffer" }).notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "tax_document_attachment_size_valid",
      sql`${table.sizeBytes} > 0 and ${table.sizeBytes} <= 20971520`,
    ),
  ],
);
