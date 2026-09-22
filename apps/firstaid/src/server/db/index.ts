import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Client } from "@libsql/client";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import { env } from "~/env";
import * as schema from "~/server/db/schema";

const globalForDb = globalThis as unknown as {
  client: Client | undefined;
  databaseReady: Promise<void> | undefined;
};

function ensureLocalDatabaseDirectory(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) return;

  const databasePath = databaseUrl.slice("file:".length);
  if (!databasePath || databasePath === ":memory:") return;

  mkdirSync(dirname(databasePath), { recursive: true });
}

ensureLocalDatabaseDirectory(env.DATABASE_URL);

export const client =
  globalForDb.client ?? createClient({ url: env.DATABASE_URL });

if (env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client, { schema });

export const databaseReady =
  process.env.NEXT_PHASE === "phase-production-build"
    ? Promise.resolve()
    : (globalForDb.databaseReady ??
      migrate(db, {
        migrationsFolder: join(process.cwd(), "drizzle"),
      }));

if (env.NODE_ENV !== "production") globalForDb.databaseReady = databaseReady;

export async function checkDatabaseConnection() {
  await databaseReady;
  await client.execute("select 1");
}
