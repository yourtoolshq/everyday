import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BaseMigration } from "./migration-check";
import { runCli } from "./cli/run";
import { checkMigrations, reviewedDestructiveMarker } from "./migration-check";
import { platformMigration, writeMigrations } from "./test-platform";

const notes = {
  tag: "0001_notes",
  sql: "CREATE TABLE `notes` (`id` text PRIMARY KEY NOT NULL, `title` text NOT NULL, `body` text);",
};

let root: string;
let migrationsFolder: string;

async function readMerged(): Promise<BaseMigration[]> {
  const journal = JSON.parse(
    await readFile(join(migrationsFolder, "meta", "_journal.json"), "utf8"),
  ) as { entries: { tag: string; when: number }[] };
  return Promise.all(
    journal.entries.map(async (entry) => ({
      tag: entry.tag,
      when: entry.when,
      file: await readFile(join(migrationsFolder, `${entry.tag}.sql`)),
    })),
  );
}

// Writes `merged` as the base, then `migrations` as the working tree, and checks them.
async function check(
  merged: { tag: string; sql: string }[],
  migrations: { tag: string; sql: string }[],
) {
  await writeMigrations(migrationsFolder, merged);
  const base = await readMerged();
  await writeMigrations(migrationsFolder, migrations);
  return checkMigrations({ migrationsFolder, base, baseName: "origin/main" });
}

const addNew = (sql: string) =>
  check(
    [platformMigration, notes],
    [platformMigration, notes, { tag: "0002_change", sql }],
  );

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "yt-data-migration-check-"));
  migrationsFolder = join(root, "drizzle");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("journal", () => {
  it("accepts appended migrations", async () => {
    expect(
      await addNew(
        "ALTER TABLE `notes` ADD `pinned` integer DEFAULT 0 NOT NULL;",
      ),
    ).toEqual({ problems: [], checked: ["0002_change"] });
  });

  it("rejects an edited merged migration", async () => {
    const result = await check(
      [platformMigration, notes],
      [platformMigration, { ...notes, sql: `${notes.sql}\n` }],
    );

    expect(result.problems).toEqual([
      "0001_notes: edited after it reached origin/main; add a new migration instead",
    ]);
  });

  it("rejects a removed merged migration", async () => {
    const result = await check([platformMigration, notes], [platformMigration]);

    expect(result.problems).toEqual([
      "0001_notes: removed; migrations on origin/main stay in the journal",
    ]);
  });

  it("rejects reordered merged migrations", async () => {
    const tags = {
      tag: "0002_tags",
      sql: "CREATE TABLE `tags` (`id` text PRIMARY KEY);",
    };
    const result = await check(
      [platformMigration, notes, tags],
      [platformMigration, tags, notes],
    );

    expect(result.problems).toEqual([
      "0001_notes: moved or regenerated; migrations on origin/main keep their journal entry",
      "0002_tags: moved or regenerated; migrations on origin/main keep their journal entry",
    ]);
  });

  it("rejects a new migration that is not newer than the one before it", async () => {
    await writeMigrations(migrationsFolder, [platformMigration, notes]);
    const base = await readMerged();
    await writeMigrations(migrationsFolder, [
      platformMigration,
      notes,
      { tag: "0002_tags", sql: "CREATE TABLE `tags` (`id` text PRIMARY KEY);" },
    ]);
    const journalPath = join(migrationsFolder, "meta", "_journal.json");
    const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
      entries: { when: number }[];
    };
    const [first, , added] = journal.entries;
    if (first && added) added.when = first.when;
    await writeFile(journalPath, JSON.stringify(journal));

    const result = await checkMigrations({
      migrationsFolder,
      base,
      baseName: "origin/main",
    });

    expect(result.problems).toEqual([
      "0002_tags: its timestamp is not after 0001_notes; generate it again on top of origin/main",
    ]);
  });
});

describe("destructive changes", () => {
  const needsMarker = (change: string) => [
    `0002_change: ${change}; once reviewed, add "${reviewedDestructiveMarker}" as its first line`,
  ];

  it("flags a dropped table, a dropped column, and deleted rows", async () => {
    expect((await addNew("DROP TABLE `notes`;")).problems).toEqual(
      needsMarker("drops table notes"),
    );
    expect(
      (await addNew("ALTER TABLE `notes` DROP COLUMN `body`;")).problems,
    ).toEqual(needsMarker("drops column notes.body"));
    expect(
      (await addNew("DELETE FROM `notes` WHERE `body` IS NULL;")).problems,
    ).toEqual(needsMarker("deletes rows from notes"));
  });

  it("accepts a destructive migration marked as reviewed", async () => {
    expect(
      (await addNew(`${reviewedDestructiveMarker}\nDROP TABLE \`notes\`;`))
        .problems,
    ).toEqual([]);
  });

  it("accepts renames and a drizzle-kit rebuild that keeps every column", async () => {
    expect(
      (
        await addNew(
          [
            "ALTER TABLE `notes` RENAME COLUMN `body` TO `text`;",
            "ALTER TABLE `notes` RENAME TO `memos`;",
          ].join("\n--> statement-breakpoint\n"),
        )
      ).problems,
    ).toEqual([]);
    expect(
      (await addNew(rebuildNotes(["id", "title", "body"]))).problems,
    ).toEqual([]);
  });

  it("flags a rebuild that leaves a column out", async () => {
    expect((await addNew(rebuildNotes(["id", "title"]))).problems).toEqual(
      needsMarker("drops column notes.body"),
    );
  });

  it("checks only migrations that are not merged", async () => {
    const dropNotes = { tag: "0002_drop_notes", sql: "DROP TABLE `notes`;" };
    const result = await check(
      [platformMigration, notes, dropNotes],
      [platformMigration, notes, dropNotes],
    );

    expect(result).toEqual({ problems: [], checked: [] });
  });

  it("reports a migration that does not apply", async () => {
    expect(
      (await addNew("ALTER TABLE `missing` ADD `x` text;")).problems,
    ).toEqual([
      "0002_change: fails after the migrations before it: SQLITE_ERROR: no such table: missing",
    ]);
  });
});

// The statements drizzle-kit generates to change a column SQLite cannot alter in place.
function rebuildNotes(columns: string[]) {
  const definitions: Record<string, string> = {
    id: "`id` text PRIMARY KEY NOT NULL",
    title: "`title` text",
    body: "`body` text",
  };
  const list = columns.map((c) => `"${c}"`).join(", ");
  return [
    "PRAGMA foreign_keys=OFF;",
    `CREATE TABLE \`__new_notes\` (${columns.map((c) => definitions[c]).join(", ")});`,
    `INSERT INTO \`__new_notes\`(${list}) SELECT ${list} FROM \`notes\`;`,
    "DROP TABLE `notes`;",
    "ALTER TABLE `__new_notes` RENAME TO `notes`;",
    "PRAGMA foreign_keys=ON;",
  ].join("\n--> statement-breakpoint\n");
}

describe("yt-data migrations check", () => {
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, stdio: "pipe" });
  let output: string[];

  function cli(...args: string[]) {
    output = [];
    return runCli(
      ["migrations", "check", "--migrations", migrationsFolder, ...args],
      {
        env: {},
        stdout: (line) => output.push(line),
        stderr: (line) => output.push(line),
      },
    );
  }

  beforeEach(() => {
    git("init", "--quiet", "--initial-branch", "main");
    git("config", "user.email", "ci@example.com");
    git("config", "user.name", "CI");
  });

  it("compares the working tree with a git ref", async () => {
    await writeMigrations(migrationsFolder, [platformMigration]);
    git("add", ".");
    git("commit", "--quiet", "-m", "platform");
    await writeMigrations(migrationsFolder, [platformMigration, notes]);

    expect(await cli("--base", "main")).toBe(0);
    expect(output).toEqual([
      "Migrations are append-only relative to main; new: 0001_notes",
    ]);

    await writeFile(
      join(migrationsFolder, "0000_platform.sql"),
      `${platformMigration.sql}\n`,
    );
    expect(await cli("--base", "main")).toBe(1);
    expect(output).toEqual([
      "0000_platform: edited after it reached main; add a new migration instead",
    ]);
  });

  it("treats every migration as new when the ref has none", async () => {
    await writeFile(join(root, "README.md"), "fictional");
    git("add", ".");
    git("commit", "--quiet", "-m", "start");
    await writeMigrations(migrationsFolder, [platformMigration, notes]);

    expect(await cli("--base", "main")).toBe(0);
    expect(output).toEqual([
      "Migrations are append-only relative to main; new: 0000_platform, 0001_notes",
    ]);
  });

  it("rejects other subcommands", async () => {
    await writeMigrations(migrationsFolder, [platformMigration]);
    output = [];

    expect(
      await runCli(["migrations", "apply", "--migrations", migrationsFolder], {
        env: {},
        stdout: (line) => output.push(line),
        stderr: (line) => output.push(line),
      }),
    ).toBe(2);
    expect(output[0]).toMatch(/^migrations takes the subcommand check/);
  });

  it("asks for a ref that is missing to be fetched", async () => {
    await writeMigrations(migrationsFolder, [platformMigration]);

    expect(await cli()).toBe(1);
    expect(output).toEqual([
      "yt-data: Git ref origin/main was not found; fetch it first",
    ]);
  });
});
