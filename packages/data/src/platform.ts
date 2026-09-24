import { mkdirSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import type { BackupContext } from "./backup/backups";
import type { FileCoordinator } from "./files/store";
import { createBackups, recoverInterruptedRestore } from "./backup/backups";
import { PausableClient } from "./connection";
import { createFileCoordinator, createFileStore } from "./files/store";

export interface DataPlatformConfig<TSchema extends Record<string, unknown>> {
  app: string;
  version?: string;
  dataDir: string;
  backupDir?: string;
  db: { schema: TSchema; migrationsFolder: string };
}

export type DataPlatform<
  TSchema extends Record<string, unknown> = Record<string, unknown>,
> = ReturnType<typeof defineDataPlatform<TSchema>>;

interface Connection {
  client: PausableClient;
  coordinator: FileCoordinator;
  serialize: <T>(operation: () => Promise<T>) => Promise<T>;
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
    const client = new PausableClient(() =>
      createClient({ url: `file:${databasePath}` }),
    );
    let queue: Promise<unknown> = Promise.resolve();
    connection = {
      client,
      coordinator: createFileCoordinator((work) => client.guard(work)),
      serialize(operation) {
        const result = queue.then(operation, operation);
        queue = result.catch(() => undefined);
        return result;
      },
    };
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
  const backupContext: BackupContext = {
    app: config.app,
    appVersion: config.version ?? null,
    dataDir,
    databasePath,
    documentsDir,
    backupDir: resolve(config.backupDir ?? join(dataDir, "backups")),
    migrationsFolder: config.db.migrationsFolder,
    client: connection.client,
    coordinator: connection.coordinator,
    serialize: connection.serialize,
  };

  return {
    app: config.app,
    dataDir,
    db,
    files: createFileStore({
      db,
      documentsDir,
      coordinator: connection.coordinator,
    }),
    backups: createBackups(backupContext),
    boot() {
      connection.booted ??= connection.serialize(async () => {
        await recoverInterruptedRestore(backupContext);
        await mkdir(documentsDir, { recursive: true });
        await migrate(db, { migrationsFolder: config.db.migrationsFolder });
      });
      return connection.booted;
    },
    close() {
      connection.client.close();
      connections.delete(databasePath);
    },
  };
}
