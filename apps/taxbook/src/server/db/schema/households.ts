import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { timestamps } from "./shared";

export const households = sqliteTable("households", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  tenureBaseUrl: text("tenure_base_url").notNull().default("https://tenure.tools.local"),
  tenureLastSyncAt: text("tenure_last_sync_at"),
  tenureLastSyncError: text("tenure_last_sync_error"),
  tenurePersonMappings: text("tenure_person_mappings", { mode: "json" })
    .$type<Record<string, number>>()
    .notNull()
    .default({}),
  ...timestamps,
});
