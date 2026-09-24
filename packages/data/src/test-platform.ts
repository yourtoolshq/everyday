import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { defineDataPlatform } from "./platform";

export async function createTestPlatform() {
  const dataDir = await mkdtemp(join(tmpdir(), "yt-data-"));
  const client = createClient({ url: `file:${join(dataDir, "test.db")}` });
  await client.execute(`
    CREATE TABLE yt_files (
      id text PRIMARY KEY NOT NULL,
      storage_key text NOT NULL UNIQUE,
      original_filename text NOT NULL,
      mime_type text NOT NULL,
      size_bytes integer NOT NULL,
      sha256 text,
      endpoint text NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
  const db = drizzle(client);
  const platform = defineDataPlatform({ app: "test", dataDir, db });
  return {
    db,
    dataDir,
    documentsDir: join(dataDir, "documents"),
    platform,
    async cleanup() {
      client.close();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}

export const pdfBytes = new TextEncoder().encode("%PDF-1.7\nfictional\n");
