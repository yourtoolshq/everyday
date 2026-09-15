import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { env } from "~/env";

const globalForDb = globalThis as unknown as {
  client: Client | undefined;
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

export const db = drizzle(client);

export async function checkDatabaseConnection() {
  await client.execute("select 1");
}
