import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const filesTable = sqliteTable("yt_files", {
  id: text("id").primaryKey(),
  storageKey: text("storage_key").notNull().unique(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  // Null for files stored before checksums were recorded; the integrity scan fills it in.
  sha256: text("sha256"),
  endpoint: text("endpoint").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export type StoredFile = typeof filesTable.$inferSelect;

export const platformMetaTable = sqliteTable("yt_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
