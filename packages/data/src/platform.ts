import { mkdirSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import type { BackupContext } from "./backup/backups";
import type { FileCoordinator } from "./files/store";
import { createBackups, recoverInterruptedRestore } from "./backup/backups";
import { PausableClient } from "./connection";
import { createFileCoordinator, createFileStore } from "./files/store";
import { applyMigrations, readMigrationPlan } from "./migrations";

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

  const backups = createBackups(backupContext);
  const planOptions = {
    app: config.app,
    databasePath,
    migrationsFolder: config.db.migrationsFolder,
  };

  async function boot() {
    await connection.serialize(async () => {
      await recoverInterruptedRestore(backupContext);
      await mkdir(documentsDir, { recursive: true });
    });
    const plan = await readMigrationPlan(planOptions);
    if (plan.status === "current") return;

    let preMigrationBackup: string | null = null;
    if (plan.applied > 0) {
      const backup = await backups.create({ trigger: "pre-migration" });
      if (backup.verification.status !== "verified") {
        throw new Error(
          `Pre-migration backup ${backup.id} failed verification, so no migrations were applied: ${backup.verification.error}`,
        );
      }
      preMigrationBackup = backup.id;
    }
    await connection.serialize(() =>
      connection.client.exclusive(async () => {
        const current = await readMigrationPlan(planOptions);
        if (current.status === "current") return;
        await applyMigrations(
          databasePath,
          current.pending,
          backupContext.appVersion,
        );
        console.info("database migrated", {
          app: config.app,
          migrations: current.pending.map((m) => m.tag),
          preMigrationBackup,
        });
      }),
    );
  }

  return {
    app: config.app,
    dataDir,
    db,
    files: createFileStore({
      db,
      documentsDir,
      coordinator: connection.coordinator,
    }),
    backups,
    boot() {
      connection.booted ??= boot();
      return connection.booted;
    },
    close() {
      connection.client.close();
      connections.delete(databasePath);
    },
  };
}
