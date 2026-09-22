import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { households } from "./households";
import { timestamps } from "./shared";

export const people = sqliteTable(
  "people",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    householdId: integer("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull(),
    ...timestamps,
  },
  (table) => [index("people_household_idx").on(table.householdId)],
);
