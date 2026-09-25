import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, join } from "node:path";
import type { Client } from "@libsql/client";

import type { BackupContext } from "./backup/backups";
import { withDatabaseFile } from "./backup/sqlite";
import { isMissing } from "./backup/swap";
import { storageKeyPattern } from "./files/store";

export interface FileFinding {
  fileId: string;
  storageKey: string;
  originalFilename: string;
  endpoint: string;
  referencedBy: { table: string; key: string }[];
}

export interface UnreferencedFile {
  name: string;
  sizeBytes: number;
  // The yt_files row nothing references; null for a file on disk without a row.
  file: { id: string; originalFilename: string; endpoint: string } | null;
}

export interface QuarantinedFile {
  name: string;
  sizeBytes: number;
  originalFilename: string | null;
}

export interface IntegrityReport {
  scannedAt: string;
  database: {
    // integrity_check messages; empty when the database is intact.
    problems: string[];
    foreignKeyViolations: {
      count: number;
      first: { table: string; rowid: number | null; parent: string }[];
    };
  };
  files: {
    checked: number;
    checksumsRecorded: number;
    missing: FileFinding[];
    checksumMismatches: FileFinding[];
    unreferenced: UnreferencedFile[];
    quarantined: QuarantinedFile[];
  };
}

interface FileRow {
  id: string;
  storageKey: string;
  originalFilename: string;
  endpoint: string;
  sha256: string | null;
}

interface FileReference {
  table: string;
  column: string;
  parentColumn: string;
}

const reportedViolations = 20;

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

export type Integrity = ReturnType<typeof createIntegrity>;

export function createIntegrity(context: BackupContext) {
  const orphansDir = join(context.documentsDir, ".orphans");
  const metadataPath = (name: string) => join(orphansDir, `.${name}.json`);

  async function scan(): Promise<IntegrityReport> {
    const scannedAt = new Date().toISOString();
    const client = context.client;
    const integrity = await client.execute("PRAGMA integrity_check");
    const problems = integrity.rows
      .map((row) => row[0] as string)
      .filter((message) => message !== "ok");
    const violations = await client.execute("PRAGMA foreign_key_check");

    const references = await findFileReferences(client);
    const rows = await readFileRows(client);
    const missing: FileRow[] = [];
    const checksumMismatches: FileRow[] = [];
    let checked = 0;
    let checksumsRecorded = 0;
    for (const row of rows) {
      if (!storageKeyPattern.test(row.storageKey)) {
        missing.push(row);
        continue;
      }
      let sha256: string;
      try {
        sha256 = await hashFile(join(context.documentsDir, row.storageKey));
      } catch (error) {
        if (!isMissing(error)) throw error;
        // A file removed during the scan takes its row with it.
        if (await fileRowExists(client, row.id)) missing.push(row);
        continue;
      }
      checked += 1;
      if (row.sha256 === null) {
        await client.execute({
          sql: "UPDATE yt_files SET sha256 = ? WHERE id = ? AND sha256 IS NULL",
          args: [sha256, row.id],
        });
        checksumsRecorded += 1;
      } else if (row.sha256 !== sha256) {
        checksumMismatches.push(row);
      }
    }

    const report: IntegrityReport = {
      scannedAt,
      database: {
        problems,
        foreignKeyViolations: {
          count: violations.rows.length,
          first: violations.rows.slice(0, reportedViolations).map((row) => ({
            table: row.table as string,
            rowid: row.rowid === null ? null : Number(row.rowid),
            parent: row.parent as string,
          })),
        },
      },
      files: {
        checked,
        checksumsRecorded,
        missing: await describeFindings(client, references, missing),
        checksumMismatches: await describeFindings(
          client,
          references,
          checksumMismatches,
        ),
        unreferenced: await findUnreferenced(client),
        quarantined: await listQuarantined(),
      },
    };
    console.info("integrity scan finished", {
      app: context.app,
      databaseProblems: problems.length,
      foreignKeyViolations: violations.rows.length,
      filesChecked: checked,
      checksumsRecorded,
      missingFiles: missing.length,
      checksumMismatches: checksumMismatches.length,
      unreferencedFiles: report.files.unreferenced.length,
    });
    return report;
  }

  async function findUnreferenced(client: Client) {
    const references = await findFileReferences(client);
    const unreferencedRows = await readUnreferencedRows(client, references);
    const knownKeys = new Set(
      (await readFileRows(client)).map((row) => row.storageKey),
    );
    const found: UnreferencedFile[] = [];
    for (const row of unreferencedRows) {
      if (!storageKeyPattern.test(row.storageKey)) continue;
      found.push({
        name: row.storageKey,
        sizeBytes: await sizeOf(join(context.documentsDir, row.storageKey)),
        file: {
          id: row.id,
          originalFilename: row.originalFilename,
          endpoint: row.endpoint,
        },
      });
    }
    for (const name of await listFiles(context.documentsDir)) {
      if (knownKeys.has(name)) continue;
      found.push({
        name,
        sizeBytes: await sizeOf(join(context.documentsDir, name)),
        file: null,
      });
    }
    return found;
  }

  // Moves the named files, if still unreferenced, to .orphans/ and deletes their rows.
  async function quarantine(names: string[]) {
    const quarantined: string[] = [];
    const skipped: string[] = [];
    await context.client.exclusive(() =>
      withDatabaseFile(context.databasePath, async (client) => {
        const current = new Map(
          (await findUnreferenced(client)).map((file) => [file.name, file]),
        );
        await mkdir(orphansDir, { recursive: true });
        for (const name of names) {
          const found = current.get(name);
          if (!found || (await exists(join(orphansDir, name)))) {
            skipped.push(name);
            continue;
          }
          if (found.file) {
            await client.execute({
              sql: "DELETE FROM yt_files WHERE id = ?",
              args: [found.file.id],
            });
          }
          const source = join(context.documentsDir, name);
          if (await exists(source)) {
            if (found.file) {
              await writeFile(metadataPath(name), JSON.stringify(found.file));
            }
            await rename(source, join(orphansDir, name));
          }
          quarantined.push(name);
          console.info("file quarantined", {
            app: context.app,
            name,
            fileId: found.file?.id ?? null,
            originalFilename: found.file?.originalFilename ?? null,
          });
        }
      }),
    );
    return { quarantined, skipped };
  }

  async function purge(names: string[]) {
    const purged: string[] = [];
    for (const name of names) {
      if (!isPlainName(name)) {
        throw new Error(`Invalid quarantined file name: ${name}`);
      }
      await rm(join(orphansDir, name), { force: true });
      await rm(metadataPath(name), { force: true });
      purged.push(name);
    }
    console.info("quarantined files purged", { app: context.app, purged });
    return { purged };
  }

  async function listQuarantined(): Promise<QuarantinedFile[]> {
    const quarantined: QuarantinedFile[] = [];
    for (const name of await listFiles(orphansDir)) {
      quarantined.push({
        name,
        sizeBytes: await sizeOf(join(orphansDir, name)),
        originalFilename: await readQuarantinedName(metadataPath(name)),
      });
    }
    return quarantined;
  }

  return {
    scan: () => context.serialize(scan),
    quarantine: (names: string[]) => context.serialize(() => quarantine(names)),
    purge: (names: string[]) => context.serialize(() => purge(names)),
  };
}

// Every foreign key that points at yt_files, discovered from the schema.
async function findFileReferences(client: Client): Promise<FileReference[]> {
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  const references: FileReference[] = [];
  for (const { name } of tables.rows) {
    const keys = await client.execute(
      `PRAGMA foreign_key_list(${quote(name as string)})`,
    );
    for (const key of keys.rows) {
      if (key.table !== "yt_files") continue;
      references.push({
        table: name as string,
        column: key.from as string,
        parentColumn: (key.to as string | null) ?? "id",
      });
    }
  }
  return references;
}

async function readFileRows(client: Client): Promise<FileRow[]> {
  const result = await client.execute(
    "SELECT id, storage_key, original_filename, endpoint, sha256 FROM yt_files ORDER BY id",
  );
  return result.rows.map(toFileRow);
}

async function readUnreferencedRows(
  client: Client,
  references: FileReference[],
): Promise<FileRow[]> {
  const unreferenced = references.map(
    (ref) =>
      `NOT EXISTS (SELECT 1 FROM ${quote(ref.table)} WHERE ${quote(ref.column)} = yt_files.${quote(ref.parentColumn)})`,
  );
  const result = await client.execute(
    `SELECT id, storage_key, original_filename, endpoint, sha256 FROM yt_files${
      unreferenced.length > 0 ? ` WHERE ${unreferenced.join(" AND ")}` : ""
    } ORDER BY id`,
  );
  return result.rows.map(toFileRow);
}

function toFileRow(row: Record<string, unknown>): FileRow {
  return {
    id: row.id as string,
    storageKey: row.storage_key as string,
    originalFilename: row.original_filename as string,
    endpoint: row.endpoint as string,
    sha256: row.sha256 as string | null,
  };
}

async function fileRowExists(client: Client, id: string) {
  const result = await client.execute({
    sql: "SELECT 1 FROM yt_files WHERE id = ?",
    args: [id],
  });
  return result.rows.length > 0;
}

async function describeFindings(
  client: Client,
  references: FileReference[],
  rows: FileRow[],
): Promise<FileFinding[]> {
  const findings: FileFinding[] = [];
  for (const row of rows) {
    const referencedBy: FileFinding["referencedBy"] = [];
    for (const ref of references) {
      const parentValue =
        ref.parentColumn === "storage_key" ? row.storageKey : row.id;
      const keyColumn = await primaryKeyColumn(client, ref.table);
      const result = await client.execute({
        sql: `SELECT ${keyColumn} AS key FROM ${quote(ref.table)} WHERE ${quote(ref.column)} = ?`,
        args: [parentValue],
      });
      for (const match of result.rows) {
        const key = match.key as string | number;
        referencedBy.push({ table: ref.table, key: String(key) });
      }
    }
    findings.push({
      fileId: row.id,
      storageKey: row.storageKey,
      originalFilename: row.originalFilename,
      endpoint: row.endpoint,
      referencedBy,
    });
  }
  return findings;
}

async function primaryKeyColumn(client: Client, table: string) {
  const columns = await client.execute(`PRAGMA table_info(${quote(table)})`);
  const keys = columns.rows.filter((column) => Number(column.pk) > 0);
  return keys.length === 1 ? quote(keys[0]?.name as string) : "rowid";
}

async function hashFile(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
}

// Plain files directly in `dir`; dot entries are the platform's own folders and metadata.
async function listFiles(dir: string) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

async function sizeOf(path: string) {
  try {
    return (await stat(path)).size;
  } catch (error) {
    if (isMissing(error)) return 0;
    throw error;
  }
}

async function exists(path: string) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

async function readQuarantinedName(path: string) {
  try {
    const metadata = JSON.parse(await readFile(path, "utf8")) as {
      originalFilename?: string;
    };
    return metadata.originalFilename ?? null;
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

function isPlainName(name: string) {
  return basename(name) === name && !name.startsWith(".") && name.length > 0;
}
