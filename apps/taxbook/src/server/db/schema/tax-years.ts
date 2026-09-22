import { sql } from "drizzle-orm";
import {
  check,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { taxYearStatuses } from "~/domain/filing";
import { households } from "./households";
import { timestamps } from "./shared";

export const taxYears = sqliteTable(
  "tax_years",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    householdId: integer("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    isActive: integer("is_active", { mode: "boolean" })
      .default(false)
      .notNull(),
    status: text("status", { enum: taxYearStatuses })
      .default("tracking")
      .notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("tax_year_household_year_unique").on(
      table.householdId,
      table.year,
    ),
    uniqueIndex("tax_year_one_active_unique")
      .on(table.householdId)
      .where(sql`${table.isActive} = 1`),
    check("tax_year_range", sql`${table.year} between 2000 and 2100`),
  ],
);
