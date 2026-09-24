import { mkdirSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { Client } from "@libsql/client";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import { createFileStore } from "./files/store";

export interface DataPlatformConfig<TSchema extends Record<string, unknown>> {
  app: string;
  dataDir: string;
  db: { schema: TSchema; migrationsFolder: string };
}

export type DataPlatform<
  TSchema extends Record<string, unknown> = Record<string, unknown>,
> = ReturnType<typeof defineDataPlatform<TSchema>>;

interface Connection {
  client: Client;
  booted?: Promise<void>;
}

// Next.js evaluates instrumentation and route bundles as separate module graphs, and dev
// reloads modules on every change; both must share one connection per database file.
const connectionsKey = Symbol.for("@yourtoolshq/data/connections");
const globalRegistry = globalThis as {
  [connectionsKey]?: Map<string, Connection>;
};
const connections = (globalRegistry[connectionsKey] ??= new Map<
  string,
  Connection
>());

function openConnection(databasePath: string) {
  let connection = connections.get(databasePath);
  if (!connection) {
    mkdirSync(dirname(databasePath), { recursive: true });
    connection = { client: createClient({ url: `file:${databasePath}` }) };
    connections.set(databasePath, connection);
  }
  return connection;
}

export function defineDataPlatform<TSchema extends Record<string, unknown>>(
  config: DataPlatformConfig<TSchema>,
) {
  const dataDir = resolve(config.dataDir);
  const documentsDir = join(dataDir, "documents");
  const databasePath = join(dataDir, `${config.app}.db`);
  const connection = openConnection(databasePath);
  const db = drizzle(connection.client, { schema: config.db.schema });

  return {
    app: config.app,
    dataDir,
    db,
    files: createFileStore({ db, documentsDir }),
    boot() {
      connection.booted ??= (async () => {
        await mkdir(documentsDir, { recursive: true });
        await migrate(db, { migrationsFolder: config.db.migrationsFolder });
      })();
      return connection.booted;
    },
    close() {
      connection.client.close();
      connections.delete(databasePath);
    },
  };
}
