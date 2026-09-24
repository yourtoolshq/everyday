import { basename, dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import type { RestoreResult } from "../backup/backups";
import type { BackupRecord, BackupSummary } from "../backup/manifest";
import { checkMigrations, readBaseMigrations } from "../migration-check";
import { defineDataPlatform } from "../platform";
import { ApplicationUnreachableError, callProcedure } from "./http";

export interface CliIo {
  env: Record<string, string | undefined>;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

const usage = `Usage: yt-data <command> [backup] --app <name> --migrations <dir> [options]

Commands:
  list               List backups, newest first
  backup             Take a backup and verify it
  verify <backup>    Verify a backup again
  restore <backup>   Restore a backup; a pre-restore backup is taken first
  migrations check   Check the migrations against --base; needs only --migrations

<backup> is a backup id or the path of a .ytbackup file.

Options:
  --app <name>         Application name, for example passbook
  --migrations <dir>   The application's drizzle migrations folder
  --data-dir <dir>     Data directory (default: $DATA_DIR)
  --backup-dir <dir>   Backup directory (default: $BACKUP_DIR, else <data-dir>/backups)
  --url <url>          Running application (default: http://127.0.0.1:$PORT, port 3000)
  --direct             Work on the data directory even if the application answers
  --base <ref>         Git ref holding the merged migrations (default: origin/main)

When the application answers at --url, commands run inside it, so they never overlap with
its own work. Otherwise they run on the data directory directly; the application must be
stopped.`;

interface Target {
  id: string;
  path: string;
}

interface Backups {
  list(): Promise<BackupSummary[]>;
  create(): Promise<BackupRecord>;
  verify(target: Target): Promise<BackupRecord>;
  restore(target: Target): Promise<RestoreResult>;
  close(): void;
}

class UsageError extends Error {}

export async function runCli(argv: string[], io: CliIo): Promise<number> {
  try {
    return await run(argv, io);
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`${error.message}\n\n${usage}`);
      return 2;
    }
    io.stderr(
      `yt-data: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }
}

async function run(argv: string[], io: CliIo) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        app: { type: "string" },
        migrations: { type: "string" },
        "data-dir": { type: "string" },
        "backup-dir": { type: "string" },
        url: { type: "string" },
        direct: { type: "boolean", default: false },
        base: { type: "string" },
        help: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (error) {
    throw new UsageError((error as Error).message);
  }
  const { values, positionals } = parsed;
  if (values.help) {
    io.stdout(usage);
    return 0;
  }

  const [command, argument, ...extra] = positionals;
  if (command === "migrations") {
    if (argument !== "check" || extra.length > 0) {
      throw new UsageError("migrations takes the subcommand check");
    }
    if (!values.migrations) throw new UsageError("--migrations is required");
    return runMigrationsCheck(
      resolve(values.migrations),
      values.base ?? "origin/main",
      io,
    );
  }
  if (!command || !["list", "backup", "verify", "restore"].includes(command)) {
    throw new UsageError(
      command ? `Unknown command: ${command}` : "No command given",
    );
  }
  const takesBackup = command === "verify" || command === "restore";
  if (extra.length > 0 || (!takesBackup && argument)) {
    throw new UsageError(
      takesBackup
        ? `${command} takes one backup`
        : `${command} takes no arguments`,
    );
  }
  const app = values.app;
  const migrations = values.migrations;
  const dataDir = values["data-dir"] ?? io.env.DATA_DIR;
  if (!app || !migrations || !dataDir) {
    throw new UsageError(
      "--app, --migrations, and --data-dir (or DATA_DIR) are required",
    );
  }
  const backupDir = resolve(
    values["backup-dir"] ?? io.env.BACKUP_DIR ?? join(dataDir, "backups"),
  );
  const target = takesBackup ? parseTarget(command, argument, backupDir) : null;
  const url = values.url ?? `http://127.0.0.1:${io.env.PORT ?? "3000"}`;

  const viaApplication = values.direct ? null : await connectHttp(url, app, io);
  if (viaApplication && target && dirname(target.path) !== backupDir) {
    throw new Error(
      `The application only restores and verifies backups in ${backupDir}; copy ${target.path} there first`,
    );
  }
  if (!viaApplication && !values.direct) {
    io.stderr(
      `No application answers at ${url}; working on ${resolve(dataDir)} directly. The application must be stopped.`,
    );
  }
  const backups =
    viaApplication ??
    (await openDirect({
      app,
      version: io.env.APP_VERSION === "" ? undefined : io.env.APP_VERSION,
      dataDir,
      backupDir,
      migrationsFolder: resolve(migrations),
      io,
    }));

  try {
    if (!target) {
      return command === "list"
        ? await listBackups(backups, io)
        : reportVerification("Created backup", await backups.create(), io);
    }
    if (command === "verify") {
      return reportVerification("Backup", await backups.verify(target), io);
    }
    const result = await backups.restore(target);
    io.stdout(
      `Restored backup ${target.id}, created ${result.manifest.createdAt}. The data it replaced is in backup ${result.preRestoreBackup}.`,
    );
    return 0;
  } finally {
    backups.close();
  }
}

async function runMigrationsCheck(
  migrationsFolder: string,
  base: string,
  io: CliIo,
) {
  const result = await checkMigrations({
    migrationsFolder,
    base: await readBaseMigrations(migrationsFolder, base),
    baseName: base,
  });
  for (const problem of result.problems) io.stdout(problem);
  if (result.problems.length > 0) return 1;
  io.stdout(
    `Migrations are append-only relative to ${base}; new: ${result.checked.join(", ") || "none"}`,
  );
  return 0;
}

function parseTarget(
  command: string,
  argument: string | undefined,
  backupDir: string,
): Target {
  if (!argument) throw new UsageError(`${command} takes one backup`);
  if (!argument.includes("/") && !argument.endsWith(".ytbackup")) {
    return { id: argument, path: join(backupDir, `${argument}.ytbackup`) };
  }
  const path = resolve(argument);
  return { id: basename(path, ".ytbackup"), path };
}

async function listBackups(backups: Backups, io: CliIo) {
  for (const backup of await backups.list()) {
    io.stdout(
      [
        backup.id,
        backup.manifest?.trigger ?? "-",
        formatSize(backup.size),
        backup.verification?.status ?? "unverified",
      ].join("\t"),
    );
  }
  return 0;
}

function reportVerification(prefix: string, record: BackupRecord, io: CliIo) {
  if (record.verification.status === "verified") {
    io.stdout(`${prefix} ${record.id}: verified`);
    return 0;
  }
  io.stdout(
    `${prefix} ${record.id}: failed verification: ${record.verification.error ?? "unknown error"}`,
  );
  return 1;
}

async function connectHttp(
  url: string,
  app: string,
  io: CliIo,
): Promise<Backups | null> {
  let listed: { app: string; backups: BackupSummary[] };
  try {
    listed = await callProcedure(url, "backups.list");
  } catch (error) {
    if (error instanceof ApplicationUnreachableError) return null;
    throw error;
  }
  if (listed.app !== app) {
    throw new Error(`${url} is ${listed.app}, not ${app}`);
  }
  io.stderr(`Using the application at ${url}`);
  return {
    list: async () =>
      (await callProcedure<typeof listed>(url, "backups.list")).backups,
    create: () => callProcedure(url, "backups.create", {}),
    verify: (target) => callProcedure(url, "backups.verify", { id: target.id }),
    restore: (target) =>
      callProcedure(url, "backups.restore", { id: target.id }),
    close: () => undefined,
  };
}

async function openDirect(config: {
  app: string;
  version: string | undefined;
  dataDir: string;
  backupDir: string;
  migrationsFolder: string;
  io: CliIo;
}): Promise<Backups> {
  const platform = defineDataPlatform({
    app: config.app,
    version: config.version,
    dataDir: config.dataDir,
    backupDir: config.backupDir,
    db: { schema: {}, migrationsFolder: config.migrationsFolder },
  });
  // Opening the data the way the application does at start also finishes or rolls
  // back an interrupted restore and brings the data directory up to the schema.
  let state;
  try {
    state = await platform.settled();
  } catch (error) {
    platform.close();
    throw error;
  }
  // Restoring is the remedy for a blocked database, so the commands stay available.
  if (state.state === "blocked") config.io.stderr(`yt-data: ${state.message}`);
  return {
    list: () => platform.backups.list(),
    create: () => platform.backups.create(),
    verify: (target) => platform.backups.verify(target.path),
    restore: (target) => platform.backups.restore(target.path),
    close: () => platform.close(),
  };
}

function formatSize(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}
