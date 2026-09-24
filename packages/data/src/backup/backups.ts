import { createWriteStream, readFileSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, join } from "node:path";
import { Writable } from "node:stream";
import type { Readable } from "node:stream";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";

import type { PausableClient } from "../connection";
import type { FileCoordinator } from "../files/store";
import type { Digest } from "./archive";
import type {
  BackupManifest,
  BackupRecord,
  BackupSummary,
  BackupTrigger,
  Verification,
} from "./manifest";
import type { DataLayout } from "./swap";
import packageJson from "../../package.json";
import { storageKeyPattern } from "../files/store";
import { digestInto, readArchive, writeArchive } from "./archive";
import { manifestSchema, sidecarSchema } from "./manifest";
import {
  findStructuralProblem,
  readContents,
  withDatabaseFile,
} from "./sqlite";
import {
  clearRestore,
  isMissing,
  readMarker,
  restorePaths,
  rollbackSwap,
  swapIn,
  writeMarker,
} from "./swap";

export interface BackupContext extends DataLayout {
  app: string;
  appVersion: string | null;
  backupDir: string;
  migrationsFolder: string;
  client: PausableClient;
  coordinator: FileCoordinator;
  serialize: <T>(operation: () => Promise<T>) => Promise<T>;
}

export interface RestoreResult {
  manifest: BackupManifest;
  preRestoreBackup: string;
}

const maxManifestBytes = 64 * 1024 * 1024;

export const backupIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export class BackupVerificationError extends Error {
  override name = "BackupVerificationError";
}

export type Backups = ReturnType<typeof createBackups>;

export function createBackups(context: BackupContext) {
  const workDir = join(context.backupDir, ".work");

  function readAppMigrations() {
    const journal = JSON.parse(
      readFileSync(
        join(context.migrationsFolder, "meta", "_journal.json"),
        "utf8",
      ),
    ) as { entries: { tag: string }[] };
    return readMigrationFiles({
      migrationsFolder: context.migrationsFolder,
    }).map((migration, index) => ({
      tag: journal.entries[index]?.tag ?? null,
      hash: migration.hash,
    }));
  }

  async function createBackup(trigger: BackupTrigger): Promise<BackupRecord> {
    const createdAt = new Date().toISOString();
    const id = `${context.app}-${createdAt.replaceAll(":", "-")}`;
    const archivePath = join(context.backupDir, `${id}.ytbackup`);
    const partialPath = `${archivePath}.partial`;
    const snapshotPath = join(workDir, `${id}.sqlite`);
    await mkdir(workDir, { recursive: true });

    const releaseDeletes = context.coordinator.holdDeletes();
    try {
      await context.client.execute({
        sql: "VACUUM INTO ?",
        args: [snapshotPath],
      });
      const contents = await withDatabaseFile(snapshotPath, readContents);
      const known = new Map(readAppMigrations().map((m) => [m.hash, m.tag]));
      const files: BackupManifest["files"] = [];
      const missingFiles: BackupManifest["missingFiles"] = [];

      await writeArchive(partialPath, async (archive) => {
        await archive.addFile("db.sqlite", snapshotPath);
        for (const file of contents.files) {
          if (!storageKeyPattern.test(file.storageKey)) {
            throw new Error(
              `File ${file.id} has an invalid storage key: ${file.storageKey}`,
            );
          }
          const path = `documents/${file.storageKey}`;
          try {
            const digest = await archive.addFile(
              path,
              join(context.documentsDir, file.storageKey),
            );
            files.push({ id: file.id, path, ...digest });
          } catch (error) {
            if (!isMissing(error)) throw error;
            console.warn("backup skipped a file missing on disk", {
              backupId: id,
              fileId: file.id,
              storageKey: file.storageKey,
            });
            missingFiles.push(file);
          }
        }
        const manifest: BackupManifest = {
          formatVersion: 1,
          app: context.app,
          appVersion: context.appVersion,
          platformVersion: packageJson.version,
          createdAt,
          trigger,
          migrations: contents.migrations.map(({ hash }) => ({
            tag: known.get(hash) ?? null,
            hash,
          })),
          rowCounts: contents.rowCounts,
          files,
          missingFiles,
        };
        await archive.addJson("manifest.json", manifest);
      });
      await rename(partialPath, archivePath);
    } catch (error) {
      await rm(partialPath, { force: true });
      throw error;
    } finally {
      await releaseDeletes();
      await rm(snapshotPath, { force: true });
    }

    const record = await verifyBackup(archivePath);
    console.info("backup created", {
      backupId: id,
      trigger,
      status: record.verification.status,
    });
    return record;
  }

  // Streams the archive once: extracts db.sqlite (and the documents, when asked) into
  // `extractDir`, hashes every entry, then checks it all against the manifest.
  async function inspectArchive(
    archivePath: string,
    extractDir: string,
    options: { extractDocuments: boolean },
  ): Promise<BackupManifest> {
    const digests = new Map<string, Digest>();
    let rawManifest: Buffer | undefined;
    if (options.extractDocuments) {
      await mkdir(join(extractDir, "documents"), { recursive: true });
    }

    await readArchive(archivePath, async (entry) => {
      if (entry.type !== "file") {
        throw new BackupVerificationError(
          `Archive entry ${entry.name} is a ${entry.type}, not a file`,
        );
      }
      if (
        digests.has(entry.name) ||
        (rawManifest && entry.name === "manifest.json")
      ) {
        throw new BackupVerificationError(
          `Archive entry ${entry.name} appears more than once`,
        );
      }
      if (entry.name === "manifest.json") {
        rawManifest = await readLimited(entry.stream, maxManifestBytes);
        return;
      }
      if (entry.name === "db.sqlite") {
        digests.set(
          entry.name,
          await digestInto(
            entry.stream,
            createWriteStream(join(extractDir, "db.sqlite"), { flags: "wx" }),
          ),
        );
        return;
      }
      const storageKey = entry.name.slice("documents/".length);
      if (
        !entry.name.startsWith("documents/") ||
        !storageKeyPattern.test(storageKey)
      ) {
        throw new BackupVerificationError(
          `Archive entry ${entry.name} is not part of a backup`,
        );
      }
      digests.set(
        entry.name,
        await digestInto(
          entry.stream,
          options.extractDocuments
            ? createWriteStream(join(extractDir, "documents", storageKey), {
                flags: "wx",
              })
            : undefined,
        ),
      );
    }).catch((error: unknown) => {
      // tar-stream reports a malformed archive as a plain Error without an errno code.
      if (error instanceof BackupVerificationError || hasErrnoCode(error)) {
        throw error;
      }
      throw new BackupVerificationError(
        `Archive is not a readable backup: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    });

    if (!rawManifest) {
      throw new BackupVerificationError("Archive has no manifest.json");
    }
    if (!digests.has("db.sqlite")) {
      throw new BackupVerificationError("Archive has no db.sqlite");
    }
    const parsed = manifestSchema.safeParse(parseJson(rawManifest));
    if (!parsed.success) {
      throw new BackupVerificationError(
        `Archive manifest is not valid: ${parsed.error.message}`,
      );
    }
    const manifest = parsed.data;
    if (manifest.app !== context.app) {
      throw new BackupVerificationError(
        `Archive is a ${manifest.app} backup, not ${context.app}`,
      );
    }

    const unlisted = new Set(
      [...digests.keys()].filter((n) => n !== "db.sqlite"),
    );
    for (const file of manifest.files) {
      const digest = digests.get(file.path);
      if (digest?.size !== file.size || digest.sha256 !== file.sha256) {
        throw new BackupVerificationError(
          `File ${file.id} (${file.path}) does not match the manifest`,
        );
      }
      unlisted.delete(file.path);
    }
    if (unlisted.size > 0) {
      throw new BackupVerificationError(
        `Archive has files the manifest does not list: ${[...unlisted].join(", ")}`,
      );
    }

    await withDatabaseFile(join(extractDir, "db.sqlite"), async (client) => {
      const problem = await findStructuralProblem(client);
      if (problem) throw new BackupVerificationError(`Database ${problem}`);
      const contents = await readContents(client);
      assertRowCounts(manifest.rowCounts, contents.rowCounts);
      assertFilesMatch(manifest, contents.files);
    });
    return manifest;
  }

  async function verifyBackup(archivePath: string): Promise<BackupRecord> {
    await mkdir(workDir, { recursive: true });
    const extractDir = await mkdtemp(join(workDir, "verify-"));
    let manifest: BackupManifest | null = null;
    let verification: Verification;
    try {
      manifest = await inspectArchive(archivePath, extractDir, {
        extractDocuments: false,
      });
      verification = {
        status: "verified",
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("backup failed verification", {
        archive: archivePath,
        error: message,
      });
      verification = {
        status: "failed",
        checkedAt: new Date().toISOString(),
        error: message,
      };
    } finally {
      await rm(extractDir, { recursive: true, force: true });
    }
    await writeFile(
      `${archivePath}.json`,
      `${JSON.stringify({ manifest, verification }, null, 2)}\n`,
    );
    return {
      id: basename(archivePath, ".ytbackup"),
      path: archivePath,
      manifest,
      verification,
    };
  }

  async function restoreBackup(archivePath: string): Promise<RestoreResult> {
    const paths = restorePaths(context);
    if (await readMarker(context)) {
      throw new Error(
        "An interrupted restore is still pending; restart the app to recover it",
      );
    }
    await clearRestore(context);
    await mkdir(paths.incomingDir, { recursive: true });

    let manifest: BackupManifest;
    let preRestore: BackupRecord;
    try {
      manifest = await inspectArchive(archivePath, paths.incomingDir, {
        extractDocuments: true,
      });
      const known = new Set(readAppMigrations().map((m) => m.hash));
      const unknown = manifest.migrations.filter((m) => !known.has(m.hash));
      if (unknown.length > 0) {
        throw new BackupVerificationError(
          `Backup was made by a newer version of ${context.app}; it has migrations this version does not know: ${unknown.map((m) => m.tag ?? m.hash).join(", ")}`,
        );
      }
      preRestore = await createBackup("pre-restore");
      if (preRestore.verification.status !== "verified") {
        throw new Error(
          `Pre-restore backup ${preRestore.id} failed verification: ${preRestore.verification.error}`,
        );
      }
    } catch (error) {
      await clearRestore(context);
      throw error;
    }

    const marker = { archive: archivePath, preRestoreBackup: preRestore.id };
    await context.client.exclusive(async ({ close, open }) => {
      await writeMarker(context, { stage: "swapping", ...marker });
      close();
      try {
        await swapIn(context);
        const client = open();
        const problem = await findStructuralProblem(client);
        if (problem) throw new Error(`Restored database ${problem}`);
        await migrate(drizzle(client), {
          migrationsFolder: context.migrationsFolder,
        });
        await writeMarker(context, { stage: "swapped", ...marker });
      } catch (error) {
        close();
        try {
          await rollbackSwap(context);
        } catch (rollbackError) {
          // The marker stays, so the next boot retries the rollback.
          console.error("failed to roll back a restore", {
            ...marker,
            error: rollbackError,
          });
          throw error;
        }
        await clearRestore(context);
        throw error;
      }
      await clearRestore(context);
    });

    console.info("backup restored", {
      ...marker,
      backupCreatedAt: manifest.createdAt,
    });
    return { manifest, preRestoreBackup: preRestore.id };
  }

  async function summarize(id: string): Promise<BackupSummary | null> {
    const path = join(context.backupDir, `${id}.ytbackup`);
    let size: number;
    try {
      size = (await stat(path)).size;
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
    const sidecar = await readSidecar(`${path}.json`);
    return {
      id,
      path,
      size,
      manifest: sidecar?.manifest ?? null,
      verification: sidecar?.verification ?? null,
    };
  }

  async function listBackups() {
    let names: string[];
    try {
      names = await readdir(context.backupDir);
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
    const ids = names
      .filter((name) => name.endsWith(".ytbackup") && !name.startsWith("."))
      .map((name) => basename(name, ".ytbackup"))
      .sort()
      .reverse();
    const summaries = await Promise.all(ids.map(summarize));
    return summaries.filter((summary) => summary !== null);
  }

  return {
    list: listBackups,
    find(id: string) {
      return backupIdPattern.test(id) ? summarize(id) : Promise.resolve(null);
    },
    create(options: { trigger?: BackupTrigger } = {}) {
      return context.serialize(() => createBackup(options.trigger ?? "manual"));
    },
    verify(archivePath: string) {
      return context.serialize(() => verifyBackup(archivePath));
    },
    restore(archivePath: string) {
      return context.serialize(() => restoreBackup(archivePath));
    },
  };
}

// Runs before migrations at boot, while nothing else uses the database.
export async function recoverInterruptedRestore(context: BackupContext) {
  const marker = await readMarker(context);
  if (!marker) {
    await rm(restorePaths(context).restoreDir, {
      recursive: true,
      force: true,
    });
    return;
  }
  await context.client.exclusive(async ({ close }) => {
    close();
    if (marker.stage === "swapped") {
      console.warn("finishing an interrupted restore", marker);
    } else {
      console.warn("rolling back an interrupted restore", marker);
      await rollbackSwap(context);
    }
    await clearRestore(context);
  });
}

function assertRowCounts(
  expected: Record<string, number>,
  actual: Record<string, number>,
) {
  const tables = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const table of tables) {
    if (expected[table] !== actual[table]) {
      throw new BackupVerificationError(
        `Table ${table} has ${actual[table] ?? "no"} rows; the manifest records ${expected[table] ?? "none"}`,
      );
    }
  }
}

function assertFilesMatch(
  manifest: BackupManifest,
  rows: { id: string; storageKey: string }[],
) {
  const recorded = new Map([
    ...manifest.files.map((f) => [f.id, f.path] as const),
    ...manifest.missingFiles.map(
      (f) => [f.id, `documents/${f.storageKey}`] as const,
    ),
  ]);
  for (const row of rows) {
    if (recorded.get(row.id) !== `documents/${row.storageKey}`) {
      throw new BackupVerificationError(
        `File ${row.id} in the database is not recorded in the manifest`,
      );
    }
    recorded.delete(row.id);
  }
  if (recorded.size > 0) {
    throw new BackupVerificationError(
      `Manifest records files the database does not have: ${[...recorded.keys()].join(", ")}`,
    );
  }
}

async function readLimited(stream: Readable, limit: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  await digestInto(
    stream,
    new Writable({
      write(chunk: Buffer, _encoding, callback) {
        size += chunk.byteLength;
        if (size > limit) {
          callback(
            new BackupVerificationError("Archive manifest is too large"),
          );
          return;
        }
        chunks.push(chunk);
        callback();
      },
    }),
  );
  return Buffer.concat(chunks);
}

function hasErrnoCode(error: unknown) {
  return typeof (error as NodeJS.ErrnoException | null)?.code === "string";
}

async function readSidecar(path: string) {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
  try {
    return sidecarSchema.parse(JSON.parse(raw));
  } catch (error) {
    console.warn("backup sidecar is not readable", { path, error });
    return null;
  }
}

function parseJson(bytes: Buffer): unknown {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new BackupVerificationError("Archive manifest is not valid JSON", {
      cause: error,
    });
  }
}
