import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { housingModes } from "~/domain/tax-estimate";
import { people } from "./people";
import { timestamps } from "./shared";
import { taxYears } from "./tax-years";

export const taxEstimateSettings = sqliteTable("tax_estimate_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taxYearId: integer("tax_year_id").notNull().references(() => taxYears.id, { onDelete: "cascade" }),
  manitobaCreditsClaimantPersonId: integer("manitoba_credits_claimant_person_id").notNull().references(() => people.id, { onDelete: "restrict" }),
  housingMode: text("housing_mode", { enum: housingModes }).notNull().default("none"),
  homeOwnershipStartDate: text("home_ownership_start_date"),
  eligibleSchoolTaxCents: integer("eligible_school_tax_cents"),
  homeownerAdvanceReceivedCents: integer("homeowner_advance_received_cents"),
  ...timestamps,
}, (table) => [
  uniqueIndex("tax_estimate_settings_year_unique").on(table.taxYearId),
  index("tax_estimate_settings_claimant_idx").on(table.manitobaCreditsClaimantPersonId),
  check("tax_estimate_school_tax_non_negative", sql`${table.eligibleSchoolTaxCents} is null or ${table.eligibleSchoolTaxCents} >= 0`),
  check("tax_estimate_advance_non_negative", sql`${table.homeownerAdvanceReceivedCents} is null or ${table.homeownerAdvanceReceivedCents} >= 0`),
]);

export const taxEstimatePersonInputs = sqliteTable("tax_estimate_person_inputs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taxYearId: integer("tax_year_id").notNull().references(() => taxYears.id, { onDelete: "cascade" }),
  personId: integer("person_id").notNull().references(() => people.id, { onDelete: "restrict" }),
  fullTimeStudyMonths: integer("full_time_study_months").notNull().default(0),
  partTimeStudyMonths: integer("part_time_study_months").notNull().default(0),
  ...timestamps,
}, (table) => [
  uniqueIndex("tax_estimate_person_year_unique").on(table.taxYearId, table.personId),
  index("tax_estimate_person_idx").on(table.personId),
  check("tax_estimate_study_months", sql`${table.fullTimeStudyMonths} >= 0 and ${table.partTimeStudyMonths} >= 0 and ${table.fullTimeStudyMonths} + ${table.partTimeStudyMonths} <= 12`),
]);
