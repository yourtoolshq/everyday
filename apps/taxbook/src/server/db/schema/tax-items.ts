import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import {
  itemStatuses,
  itemTypes,
  ownerKinds,
  valueSources,
  taxTreatments,
} from "~/domain/tax-item";
import { people } from "./people";
import { timestamps } from "./shared";
import { taxYears } from "./tax-years";

export const taxItems = sqliteTable(
  "tax_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taxYearId: integer("tax_year_id")
      .notNull()
      .references(() => taxYears.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    taxLineReference: text("tax_line_reference"),
    type: text("type", { enum: itemTypes }).notNull(),
    ownerKind: text("owner_kind", { enum: ownerKinds }).notNull(),
    personId: integer("person_id").references(() => people.id, {
      onDelete: "restrict",
    }),
    expectedAmountCents: integer("expected_amount_cents"),
    actualAmountCents: integer("actual_amount_cents"),
    status: text("status", { enum: itemStatuses }).notNull(),
    valueSource: text("value_source", { enum: valueSources })
      .default("manual")
      .notNull(),
    taxTreatment: text("tax_treatment", { enum: taxTreatments }),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("tax_items_year_idx").on(table.taxYearId),
    index("tax_items_person_idx").on(table.personId),
    check(
      "tax_item_owner_consistent",
      sql`(${table.ownerKind} = 'household' and ${table.personId} is null) or (${table.ownerKind} = 'person' and ${table.personId} is not null)`,
    ),
    check(
      "tax_item_expected_non_negative",
      sql`${table.expectedAmountCents} is null or ${table.expectedAmountCents} >= 0`,
    ),
    check(
      "tax_item_actual_non_negative",
      sql`${table.actualAmountCents} is null or ${table.actualAmountCents} >= 0 or ${table.valueSource} = 'self_employment'`,
    ),
  ],
);
