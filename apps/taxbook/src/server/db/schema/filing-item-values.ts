import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { filings } from "./filings";
import { timestamps } from "./shared";
import { taxItems } from "./tax-items";

export const filingItemValues = sqliteTable(
  "filing_item_values",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    filingId: integer("filing_id")
      .notNull()
      .references(() => filings.id, { onDelete: "cascade" }),
    taxItemId: integer("tax_item_id").references(() => taxItems.id, {
      onDelete: "set null",
    }),
    itemName: text("item_name").notNull(),
    ownerLabel: text("owner_label").notNull(),
    taxLineReference: text("tax_line_reference"),
    amountCents: integer("amount_cents").notNull(),
    differenceNote: text("difference_note"),
    ...timestamps,
  },
  (table) => [index("filing_item_values_filing_idx").on(table.filingId)],
);
