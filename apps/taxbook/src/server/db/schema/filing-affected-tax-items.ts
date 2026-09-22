import { integer, primaryKey, sqliteTable } from "drizzle-orm/sqlite-core";

import { filings } from "./filings";
import { taxItems } from "./tax-items";

export const filingAffectedTaxItems = sqliteTable(
  "filing_affected_tax_items",
  {
    filingId: integer("filing_id")
      .notNull()
      .references(() => filings.id, { onDelete: "cascade" }),
    taxItemId: integer("tax_item_id")
      .notNull()
      .references(() => taxItems.id, { onDelete: "restrict" }),
  },
  (table) => [primaryKey({ columns: [table.filingId, table.taxItemId] })],
);
