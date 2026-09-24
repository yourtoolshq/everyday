import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { Client } from "@libsql/client";
import { createClient } from "@libsql/client";

import type { JournalMigration } from "./migrations";
import { readJournal } from "./migrations";

export const reviewedDestructiveMarker = "-- yt:reviewed-destructive";

export interface BaseMigration {
  tag: string;
  when: number;
  file: Buffer;
}

export interface MigrationCheckResult {
  problems: string[];
  checked: string[];
}

const execFileAsync = promisify(execFile);

export async function readBaseMigrations(
  migrationsFolder: string,
  ref: string,
): Promise<BaseMigration[]> {
  const git = async (args: string[]) =>
    (
      await execFileAsync("git", args, {
        cwd: migrationsFolder,
        encoding: "buffer",
        maxBuffer: 256 * 1024 * 1024,
      })
    ).stdout;
  try {
    await git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  } catch {
    throw new Error(`Git ref ${ref} was not found; fetch it first`);
  }
  // Paths are relative to the migrations folder, which is the working directory.
  const tracked = new Set(
    (await git(["ls-tree", "-r", "--name-only", ref, "--", "."]))
      .toString("utf8")
      .split("\n"),
  );
  if (!tracked.has("meta/_journal.json")) return [];
  const journal = JSON.parse(
    (await git(["show", `${ref}:./meta/_journal.json`])).toString("utf8"),
  ) as { entries: { tag: string; when: number }[] };
  return Promise.all(
    journal.entries.map(async (entry) => ({
      tag: entry.tag,
      when: entry.when,
      file: await git(["show", `${ref}:./${entry.tag}.sql`]),
    })),
  );
}

export async function checkMigrations(options: {
  migrationsFolder: string;
  base: BaseMigration[];
  baseName: string;
}): Promise<MigrationCheckResult> {
  const { migrationsFolder, base, baseName } = options;
  const journal = readJournal(migrationsFolder);
  const problems: string[] = [];

  const positions = new Map(journal.map((m, index) => [m.tag, index]));
  for (const [index, merged] of base.entries()) {
    const position = positions.get(merged.tag);
    if (position === undefined) {
      problems.push(
        `${merged.tag}: removed; migrations on ${baseName} stay in the journal`,
      );
    } else if (
      position !== index ||
      journal[position]?.folderMillis !== merged.when
    ) {
      problems.push(
        `${merged.tag}: moved or regenerated; migrations on ${baseName} keep their journal entry`,
      );
    } else {
      const file = await readFile(join(migrationsFolder, `${merged.tag}.sql`));
      if (!file.equals(merged.file)) {
        problems.push(
          `${merged.tag}: edited after it reached ${baseName}; add a new migration instead`,
        );
      }
    }
  }
  for (let index = 1; index < journal.length; index += 1) {
    const previous = journal[index - 1];
    const migration = journal[index];
    if (
      previous &&
      migration &&
      migration.folderMillis <= previous.folderMillis
    ) {
      problems.push(
        `${migration.tag}: its timestamp is not after ${previous.tag}; generate it again on top of ${baseName}`,
      );
    }
  }

  const merged = new Set(base.map((m) => m.tag));
  const added = journal.filter((m) => !merged.has(m.tag));
  problems.push(...(await checkDestructiveChanges(journal, merged)));
  return { problems, checked: added.map((m) => m.tag) };
}

// Applies every migration in order to an empty database and compares the schema before
// and after each new one, so a destructive change is found however its SQL is written.
async function checkDestructiveChanges(
  journal: JournalMigration[],
  merged: Set<string>,
) {
  const problems: string[] = [];
  const client = createClient({ url: ":memory:" });
  try {
    await client.execute("PRAGMA foreign_keys = OFF");
    for (const migration of journal) {
      const isNew = !merged.has(migration.tag);
      const before = isNew ? await readSchema(client) : null;
      try {
        for (const statement of migration.sql) {
          if (statement.trim() !== "") await client.execute(statement);
        }
      } catch (error) {
        problems.push(
          `${migration.tag}: fails after the migrations before it: ${error instanceof Error ? error.message : String(error)}`,
        );
        break;
      }
      if (!before) continue;
      const changes = destructiveChanges(
        before,
        await readSchema(client),
        migration.sql,
      );
      const reviewed = migration.sql.some((statement) =>
        statement.includes(reviewedDestructiveMarker),
      );
      if (changes.length > 0 && !reviewed) {
        problems.push(
          `${migration.tag}: ${changes.join(", ")}; once reviewed, add "${reviewedDestructiveMarker}" as its first line`,
        );
      }
    }
  } finally {
    client.close();
  }
  return problems;
}

type Schema = Map<string, Set<string>>;

async function readSchema(client: Client): Promise<Schema> {
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '__drizzle_migrations'",
  );
  const schema: Schema = new Map();
  for (const row of tables.rows) {
    const table = row.name as string;
    const columns = await client.execute({
      sql: "SELECT name FROM pragma_table_info(?)",
      args: [table],
    });
    schema.set(table, new Set(columns.rows.map((c) => c.name as string)));
  }
  return schema;
}

const tableRename = /\bALTER\s+TABLE\s+(\S+)\s+RENAME\s+TO\s+([^\s;]+)/i;
const columnRename =
  /\bALTER\s+TABLE\s+(\S+)\s+RENAME\s+COLUMN\s+(\S+)\s+TO\s+([^\s;]+)/i;
const rowDelete = /\bDELETE\s+FROM\s+([^\s;]+)/i;

function unquote(identifier: string) {
  return identifier.replace(/^[`"[]|[`"\]]$/g, "");
}

// Follows renames so a renamed table or column is not reported as dropped; a drizzle-kit
// table rebuild drops the original and renames the copy back, so only columns the copy
// leaves out are reported.
function destructiveChanges(
  before: Schema,
  after: Schema,
  statements: string[],
) {
  const tableNames = new Map([...before.keys()].map((t) => [t, t]));
  const columnNames = new Map(
    [...before].map(([table, columns]) => [
      table,
      new Map([...columns].map((c) => [c, c])),
    ]),
  );
  const changes: string[] = [];
  for (const statement of statements) {
    const table = tableRename.exec(statement);
    if (table?.[1] && table[2]) {
      const [from, to] = [unquote(table[1]), unquote(table[2])];
      for (const [original, current] of tableNames) {
        if (current === from) tableNames.set(original, to);
      }
    }
    const column = columnRename.exec(statement);
    if (column?.[1] && column[2] && column[3]) {
      const [tableName, from, to] = column.slice(1, 4).map(unquote);
      for (const [original, current] of tableNames) {
        if (current !== tableName) continue;
        const columns = columnNames.get(original);
        for (const [originalColumn, currentColumn] of columns ?? []) {
          if (currentColumn === from && to) columns?.set(originalColumn, to);
        }
      }
    }
    const deleted = rowDelete.exec(statement);
    if (deleted?.[1]) changes.push(`deletes rows from ${unquote(deleted[1])}`);
  }
  for (const [original, columns] of before) {
    const remaining = after.get(tableNames.get(original) ?? original);
    if (!remaining) {
      changes.push(`drops table ${original}`);
      continue;
    }
    for (const column of columns) {
      if (!remaining.has(columnNames.get(original)?.get(column) ?? column)) {
        changes.push(`drops column ${original}.${column}`);
      }
    }
  }
  return changes;
}
