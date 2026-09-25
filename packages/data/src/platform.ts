import { mkdirSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import type { BackupContext } from "./backup/backups";
import type { BackupPolicy } from "./backup/schedule";
import type { FileCoordinator } from "./files/store";
import type { IntegrityReport } from "./integrity";
import type { BlockedReason, JournalMigration } from "./migrations";
import { createBackups, recoverInterruptedRestore } from "./backup/backups";
import { parseSchedule, startBackupSchedule } from "./backup/schedule";
import { PausableClient } from "./connection";
import {
  createFileCoordinator,
  createFileStore,
  removeExpiredUploads,
} from "./files/store";
import { createIntegrity } from "./integrity";
import {
  applyMigrations,
  DataPlatformBlockedError,
  readJournal,
  readMigrationPlan,
} from "./migrations";
import { describeUnavailable } from "./readiness";

export interface DataPlatformConfig<TSchema extends Record<string, unknown>> {
  app: string;
  version?: string;
  dataDir: string;
  backupDir?: string;
  db: { schema: TSchema; migrationsFolder: string };
  backups?: BackupPolicy;
}

export type DataPlatform<
  TSchema extends Record<string, unknown> = Record<string, unknown>,
> = ReturnType<typeof defineDataPlatform<TSchema>>;

export type PlatformState =
  | { state: "ready" }
  | { state: "upgrading"; step: "backup" | "migrate"; migrations: string[] }
  | { state: "restoring" }
  | { state: "blocked"; reason: BlockedReason; message: string };

export interface RestorableBackup {
  id: string;
  createdAt: string;
  appVersion: string | null;
  trigger: string;
}

export type PlatformStatus = PlatformState & {
  app: string;
  version: string | null;
  // Verified backups this version can restore; listed while the platform is blocked.
  restorableBackups?: RestorableBackup[];
};

export class DataPlatformBusyError extends Error {
  override name = "DataPlatformBusyError";
}

interface Connection {
  client: PausableClient;
  coordinator: FileCoordinator;
  serialize: <T>(operation: () => Promise<T>) => Promise<T>;
  state: PlatformState;
  booted?: Promise<void>;
  upgrade?: Promise<void>;
  stopSchedule?: () => void;
  lastIntegrityReport?: IntegrityReport;
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
      state: { state: "upgrading", step: "migrate", migrations: [] },
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
  if (config.backups) parseSchedule(config.backups.schedule);
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

  const archives = createBackups(backupContext);
  const checks = createIntegrity(backupContext);
  // The scheduler and the upgrade use the same object the platform exposes.
  const backups = { ...archives, restore };
  const planOptions = {
    app: config.app,
    databasePath,
    migrationsFolder: config.db.migrationsFolder,
  };

  async function enterReady() {
    connection.state = { state: "ready" };
    await removeExpiredUploads(documentsDir);
    if (config.backups && !connection.stopSchedule) {
      connection.stopSchedule = await startBackupSchedule({
        app: config.app,
        policy: config.backups,
        backups,
      });
    }
  }

  function block(reason: BlockedReason, message: string) {
    connection.state = { state: "blocked", reason, message };
    console.error("data platform blocked", {
      app: config.app,
      reason,
      message,
    });
  }

  async function migrate(pending: JournalMigration[], applied: number) {
    const migrations = pending.map((m) => m.tag);
    let preMigrationBackup: string | null = null;
    if (applied > 0) {
      connection.state = { state: "upgrading", step: "backup", migrations };
      const backup = await backups.create({ trigger: "pre-migration" });
      if (backup.verification.status !== "verified") {
        throw new Error(
          `Pre-migration backup ${backup.id} failed verification, so no migrations were applied: ${backup.verification.error}`,
        );
      }
      preMigrationBackup = backup.id;
    }
    connection.state = { state: "upgrading", step: "migrate", migrations };
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

  async function upgrade(pending: JournalMigration[], applied: number) {
    try {
      await migrate(pending, applied);
    } catch (error) {
      block(
        "migration-failed",
        error instanceof Error ? error.message : String(error),
      );
      return;
    }
    try {
      await enterReady();
    } catch (error) {
      console.error("backup schedule failed to start", {
        app: config.app,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Recovery and the version guard are awaited; pending migrations run in the
  // background while the state is `upgrading`, so the gates can answer requests.
  async function boot() {
    await connection.serialize(async () => {
      await recoverInterruptedRestore(backupContext);
      await mkdir(documentsDir, { recursive: true });
    });
    let plan;
    try {
      plan = await readMigrationPlan(planOptions);
    } catch (error) {
      if (!(error instanceof DataPlatformBlockedError)) throw error;
      block(error.reason, error.message);
      return;
    }
    if (plan.status === "current") {
      await enterReady();
      return;
    }
    connection.state = {
      state: "upgrading",
      step: plan.applied > 0 ? "backup" : "migrate",
      migrations: plan.pending.map((m) => m.tag),
    };
    connection.upgrade = upgrade(plan.pending, plan.applied);
  }

  function startBoot() {
    connection.booted ??= boot();
    return connection.booted;
  }

  async function restore(archivePath: string) {
    const previous = connection.state;
    if (previous.state === "upgrading" || previous.state === "restoring") {
      throw new DataPlatformBusyError(
        `${config.app} is ${previous.state === "upgrading" ? "upgrading its data" : "already restoring a backup"}; try again when it is done`,
      );
    }
    connection.state = { state: "restoring" };
    let result;
    try {
      result = await archives.restore(archivePath);
    } catch (error) {
      connection.state = previous;
      throw error;
    }
    connection.lastIntegrityReport = undefined;
    await enterReady();
    return result;
  }

  // The scan records checksums and quarantine deletes rows, so neither runs on data
  // that is upgrading, restoring, or blocked.
  async function whenReady<T>(operation: () => Promise<T>) {
    await startBoot();
    const unavailable = describeUnavailable(config.app, connection.state);
    if (unavailable) throw new DataPlatformBusyError(unavailable);
    return operation();
  }

  const integrity = {
    scan: () =>
      whenReady(async () => {
        const report = await checks.scan();
        connection.lastIntegrityReport = report;
        return report;
      }),
    lastReport: () => connection.lastIntegrityReport ?? null,
    quarantine: (names: string[]) => whenReady(() => checks.quarantine(names)),
    purge: (names: string[]) => whenReady(() => checks.purge(names)),
  };

  async function listRestorableBackups(): Promise<RestorableBackup[]> {
    const known = new Set(
      readJournal(config.db.migrationsFolder).map((m) => m.hash),
    );
    return (await backups.list()).flatMap(({ id, manifest, verification }) =>
      manifest &&
      verification?.status === "verified" &&
      manifest.migrations.every((m) => known.has(m.hash))
        ? [
            {
              id,
              createdAt: manifest.createdAt,
              appVersion: manifest.appVersion,
              trigger: manifest.trigger,
            },
          ]
        : [],
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
    integrity,
    boot: startBoot,
    async state(): Promise<PlatformState> {
      await startBoot();
      return connection.state;
    },
    async status(): Promise<PlatformStatus> {
      await startBoot();
      const state = connection.state;
      const status = { app: config.app, version: backupContext.appVersion };
      // Restoring cannot fix a failed migration: the restored data is upgraded with the same migrations.
      if (state.state === "blocked" && state.reason !== "migration-failed") {
        return {
          ...status,
          ...state,
          restorableBackups: await listRestorableBackups(),
        };
      }
      return { ...status, ...state };
    },
    // Resolves once boot has finished, including any migrations it started.
    async settled(): Promise<PlatformState> {
      await startBoot();
      await connection.upgrade;
      return connection.state;
    },
    close() {
      connection.stopSchedule?.();
      connection.client.close();
      connections.delete(databasePath);
    },
  };
}
