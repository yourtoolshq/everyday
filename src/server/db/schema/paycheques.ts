import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { employments } from "./employments";
import { timestamps } from "./shared";

export const paycheques = sqliteTable(
  "paycheques",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employmentId: integer("employment_id")
      .notNull()
      .references(() => employments.id, { onDelete: "cascade" }),
    payDate: text("pay_date").notNull(),
    grossPayCents: integer("gross_pay_cents").notNull(),
    incomeTaxCents: integer("income_tax_cents").notNull(),
    cppCents: integer("cpp_cents").notNull(),
    cpp2Cents: integer("cpp2_cents").notNull(),
    eiCents: integer("ei_cents").notNull(),
    wiCents: integer("wi_cents").default(0).notNull(),
    ltdCents: integer("ltd_cents").default(0).notNull(),
    otherDeductionsCents: integer("other_deductions_cents").notNull(),
    netPayCents: integer("net_pay_cents").notNull(),
    ...timestamps,
  },
  (table) => [
    index("paycheques_employment_idx").on(table.employmentId),
    index("paycheques_date_idx").on(table.payDate),
    check(
      "paycheque_amounts_non_negative",
      sql`${table.grossPayCents} >= 0 and ${table.incomeTaxCents} >= 0 and ${table.cppCents} >= 0 and ${table.cpp2Cents} >= 0 and ${table.eiCents} >= 0 and ${table.wiCents} >= 0 and ${table.ltdCents} >= 0 and ${table.otherDeductionsCents} >= 0 and ${table.netPayCents} >= 0`,
    ),
  ],
);
