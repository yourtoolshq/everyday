import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { rm } from "node:fs/promises";
import path from "node:path";

const databasePath = path.resolve(".data/e2e.db");
await Promise.all([
  rm(databasePath, { force: true }),
  rm(`${databasePath}-shm`, { force: true }),
  rm(`${databasePath}-wal`, { force: true }),
]);
const client = createClient({ url: `file:${databasePath}` });
const db = drizzle(client);
await migrate(db, { migrationsFolder: "./drizzle" });
client.close();
