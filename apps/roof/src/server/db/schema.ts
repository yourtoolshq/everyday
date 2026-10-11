import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { filesTable, platformMetaTable } from "@yourtoolshq/data/schema";

import type { DocumentType } from "~/lib/documents";
import type { EventCategory } from "~/lib/events";
import type { PropertyRelationship, PropertyStage } from "~/lib/properties";

export { filesTable, platformMetaTable };

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

export const properties = sqliteTable(
  "properties",
  {
    id: id(),
    name: text("name").notNull(),
    // Legacy columns remain for a lossless migration; application reads use relationship/stage.
    kind: text("kind").notNull(),
    relationship: text("relationship")
      .$type<PropertyRelationship>()
      .notNull()
      .default("purchase"),
    stage: text("stage")
      .$type<PropertyStage>()
      .notNull()
      .default("under_construction"),
    possessionDate: text("possession_date"),
    photoFileId: text("photo_file_id").references(() => filesTable.id),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    region: text("region"),
    postalCode: text("postal_code"),
    moveInDate: text("move_in_date"),
    moveOutDate: text("move_out_date"),
    leaseStartDate: text("lease_start_date"),
    leaseEndDate: text("lease_end_date"),
    leaseNotes: text("lease_notes"),
    landlordName: text("landlord_name"),
    landlordEmail: text("landlord_email"),
    landlordPhone: text("landlord_phone"),
    renterInsuranceProvider: text("renter_insurance_provider"),
    renterInsurancePolicyNumber: text("renter_insurance_policy_number"),
    renterInsuranceExpiresOn: text("renter_insurance_expires_on"),
    targetPossessionDate: text("target_possession_date"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("properties_kind_idx").on(table.kind)],
);

export const propertyEvents = sqliteTable(
  "property_events",
  {
    id: id(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    eventDate: text("event_date").notNull(),
    eventTime: text("event_time"),
    status: text("status")
      .$type<"planned" | "completed" | "cancelled">()
      .notNull()
      .default("completed"),
    category: text("category").$type<EventCategory>().notNull(),
    title: text("title").notNull(),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("property_events_property_id_idx").on(table.propertyId),
    index("property_events_event_date_idx").on(table.eventDate),
  ],
);

export const documents = sqliteTable(
  "documents",
  {
    id: id(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    insuranceId: text("insurance_id").references(() => insuranceRecords.id, {
      onDelete: "set null",
    }),
    eventId: text("event_id").references(() => propertyEvents.id, {
      onDelete: "set null",
    }),
    type: text("type").$type<DocumentType>().notNull(),
    title: text("title").notNull(),
    documentDate: text("document_date"),
    notes: text("notes"),
    fileId: text("file_id")
      .notNull()
      .references(() => filesTable.id),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("documents_file_unique").on(table.fileId),
    index("documents_property_id_idx").on(table.propertyId),
    index("documents_event_id_idx").on(table.eventId),
  ],
);

export const insuranceRecords = sqliteTable(
  "insurance_records",
  {
    id: id(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    type: text("type").$type<"tenant" | "home">().notNull(),
    provider: text("provider"),
    policyNumber: text("policy_number"),
    startsOn: text("starts_on"),
    endsOn: text("ends_on"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("insurance_property_idx").on(table.propertyId)],
);
