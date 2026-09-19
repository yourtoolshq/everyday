import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import type { DocumentType } from "~/lib/documents";
import type { EmploymentStatus } from "~/lib/employment-status";

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

export const households = sqliteTable("households", {
  id: id(),
  name: text("name").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const people = sqliteTable(
  "people",
  {
    id: id(),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("people_household_idx").on(table.householdId)],
);

export const employers = sqliteTable("employers", {
  id: id(),
  name: text("name").notNull(),
  website: text("website"),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const employments = sqliteTable(
  "employments",
  {
    id: id(),
    employerId: text("employer_id")
      .notNull()
      .references(() => employers.id, { onDelete: "restrict" }),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    jobTitle: text("job_title"),
    status: text("status").$type<EmploymentStatus>().notNull().default("current"),
    startDate: text("start_date"),
    endDate: text("end_date"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("employments_employer_idx").on(table.employerId),
    index("employments_person_idx").on(table.personId),
  ],
);

export const discussions = sqliteTable(
  "discussions",
  {
    id: id(),
    employmentId: text("employment_id")
      .notNull()
      .references(() => employments.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    discussionDate: text("discussion_date"),
    participants: text("participants"),
    body: text("body"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("discussions_employment_idx").on(table.employmentId)],
);

export const documents = sqliteTable(
  "documents",
  {
    id: id(),
    employmentId: text("employment_id")
      .notNull()
      .references(() => employments.id, { onDelete: "cascade" }),
    discussionId: text("discussion_id").references(() => discussions.id, { onDelete: "set null" }),
    type: text("type").$type<DocumentType>().notNull(),
    title: text("title").notNull(),
    documentDate: text("document_date"),
    notes: text("notes"),
    originalFilename: text("original_filename").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("documents_employment_idx").on(table.employmentId),
    index("documents_discussion_idx").on(table.discussionId),
  ],
);
