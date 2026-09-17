import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import {
  employmentStatuses,
  payFrequencies,
} from "~/domain/employment";
import { people } from "./people";
import { timestamps } from "./shared";
import { taxItems } from "./tax-items";
import { taxYears } from "./tax-years";

export const employments = sqliteTable(
  "employments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taxYearId: integer("tax_year_id")
      .notNull()
      .references(() => taxYears.id, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    taxItemId: integer("tax_item_id")
      .notNull()
      .references(() => taxItems.id, { onDelete: "cascade" }),
    employerName: text("employer_name").notNull(),
    payFrequency: text("pay_frequency", { enum: payFrequencies }).notNull(),
    status: text("status", { enum: employmentStatuses }).notNull(),
    endDate: text("end_date"),
    typicalGrossOverrideCents: integer("typical_gross_override_cents"),
    incomeTaxEnabled: integer("income_tax_enabled", { mode: "boolean" })
      .default(true)
      .notNull(),
    cppEnabled: integer("cpp_enabled", { mode: "boolean" }).default(true).notNull(),
    cpp2Enabled: integer("cpp2_enabled", { mode: "boolean" }).default(true).notNull(),
    eiEnabled: integer("ei_enabled", { mode: "boolean" }).default(true).notNull(),
    wiEnabled: integer("wi_enabled", { mode: "boolean" }).default(false).notNull(),
    ltdEnabled: integer("ltd_enabled", { mode: "boolean" }).default(false).notNull(),
    extendedHealthEnabled: integer("extended_health_enabled", { mode: "boolean" })
      .default(false)
      .notNull(),
    travelMedicalEnabled: integer("travel_medical_enabled", { mode: "boolean" })
      .default(false)
      .notNull(),
    unionDuesEnabled: integer("union_dues_enabled", { mode: "boolean" })
      .default(false)
      .notNull(),
    phspReportedOnT4: integer("phsp_reported_on_t4", { mode: "boolean" })
      .default(false)
      .notNull(),
    unionDuesReportedOnT4: integer("union_dues_reported_on_t4", { mode: "boolean" })
      .default(false)
      .notNull(),
    phspTaxItemId: integer("phsp_tax_item_id").references(() => taxItems.id, {
      onDelete: "set null",
    }),
    unionDuesTaxItemId: integer("union_dues_tax_item_id").references(() => taxItems.id, {
      onDelete: "set null",
    }),
    otherDeductionsEnabled: integer("other_deductions_enabled", { mode: "boolean" })
      .default(true)
      .notNull(),
    ...timestamps,
  },
  (table) => [
    index("employments_year_idx").on(table.taxYearId),
    index("employments_person_idx").on(table.personId),
    uniqueIndex("employments_tax_item_unique").on(table.taxItemId),
    uniqueIndex("employments_phsp_tax_item_unique").on(table.phspTaxItemId),
    uniqueIndex("employments_union_dues_tax_item_unique").on(table.unionDuesTaxItemId),
    check(
      "employment_status_end_date_consistent",
      sql`(${table.status} = 'active' and ${table.endDate} is null) or (${table.status} = 'ended' and ${table.endDate} is not null)`,
    ),
    check(
      "employment_typical_gross_non_negative",
      sql`${table.typicalGrossOverrideCents} is null or ${table.typicalGrossOverrideCents} >= 0`,
    ),
  ],
);
