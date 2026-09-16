import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import type {
  CareCadence,
  CareCategory,
  CareSource,
  TimingKind,
} from "~/lib/care-planning";
import type { dateMeanings, intervalUnits, seasons } from "~/lib/care-planning";
import type { VisitStatus } from "~/lib/visits";
import type { DocumentType } from "~/lib/documents";

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
  targetVisitCount: integer("target_visit_count").notNull().default(1),
  notPursuingAt: text("not_pursuing_at"),
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

export const careOrganizations = sqliteTable("care_organizations", {
  id: id(),
  name: text("name").notNull(),
  phoneNumbers: text("phone_numbers", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  websiteUrl: text("website_url"),
  bookingUrl: text("booking_url"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const providers = sqliteTable("providers", {
  id: id(),
  name: text("name").notNull(),
  careOrganizationId: text("care_organization_id").references(
    () => careOrganizations.id,
    { onDelete: "restrict" },
  ),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const visits = sqliteTable("visits", {
  id: id(),
  personId: text("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "restrict" }),
  careItemId: text("care_item_id").references(() => careItems.id, {
    onDelete: "set null",
  }),
  providerId: text("provider_id").references(() => providers.id, {
    onDelete: "restrict",
  }),
  careOrganizationId: text("care_organization_id").references(
    () => careOrganizations.id,
    { onDelete: "restrict" },
  ),
  title: text("title").notNull(),
  startsAt: text("starts_at").notNull(),
  status: text("status").$type<VisitStatus>().notNull(),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const documents = sqliteTable("documents", {
  id: id(),
  visitId: text("visit_id")
    .notNull()
    .references(() => visits.id, { onDelete: "cascade" }),
  type: text("type").$type<DocumentType>().notNull(),
  title: text("title").notNull(),
  originalFilename: text("original_filename").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
