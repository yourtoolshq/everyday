import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import type {
  CareCadence,
  CareCategory,
  CareSource,
  CareStatus,
  TimingKind,
} from "~/lib/care-planning";
import type { dateMeanings, intervalUnits, seasons } from "~/lib/care-planning";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`);

const updatedAt = () =>
  text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`);

export const people = sqliteTable("people", {
  id: id(),
  displayName: text("display_name").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const carePlans = sqliteTable(
  "care_plans",
  {
    id: id(),
    year: integer("year").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("care_plans_year_unique").on(table.year)],
);

export const careItems = sqliteTable("care_items", {
  id: id(),
  planId: text("plan_id")
    .notNull()
    .references(() => carePlans.id, { onDelete: "cascade" }),
  personId: text("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  category: text("category").$type<CareCategory>().notNull(),
  status: text("status").$type<CareStatus>().notNull(),
  cadence: text("cadence").$type<CareCadence>().notNull(),
  intervalCount: integer("interval_count"),
  intervalUnit: text("interval_unit").$type<(typeof intervalUnits)[number]>(),
  timingKind: text("timing_kind").$type<TimingKind>().notNull(),
  targetDate: text("target_date"),
  dateMeaning: text("date_meaning").$type<(typeof dateMeanings)[number]>(),
  targetMonth: integer("target_month"),
  targetSeason: text("target_season").$type<(typeof seasons)[number]>(),
  source: text("source").$type<CareSource>().notNull(),
  sourceDetail: text("source_detail"),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
