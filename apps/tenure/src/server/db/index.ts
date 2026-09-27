import { sql } from "drizzle-orm";

import { dataPlatform } from "~/server/data";

export const db = dataPlatform.db;

export async function checkDatabaseConnection() {
  await dataPlatform.boot();
  await db.run(sql`select 1`);
}
