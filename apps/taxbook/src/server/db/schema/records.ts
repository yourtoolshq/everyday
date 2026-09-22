import { sql } from "drizzle-orm";
import {
  blob,
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { people } from "./people";
import { timestamps } from "./shared";
import { taxItems } from "./tax-items";

export const records = sqliteTable(
  "records",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taxItemId: integer("tax_item_id")
      .notNull()
      .references(() => taxItems.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    personId: integer("person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("records_tax_item_idx").on(table.taxItemId),
    index("records_person_idx").on(table.personId),
    index("records_date_idx").on(table.date),
    check("record_amount_positive", sql`${table.amountCents} > 0`),
  ],
);

export const recordAttachments = sqliteTable(
  "record_attachments",
  {
    recordId: integer("record_id")
      .primaryKey()
      .references(() => records.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    data: blob("data", { mode: "buffer" }).notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "record_attachment_size_valid",
      sql`${table.sizeBytes} > 0 and ${table.sizeBytes} <= 20971520`,
    ),
  ],
);
