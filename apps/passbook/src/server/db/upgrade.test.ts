import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Client } from "@libsql/client";
import { createClient } from "@libsql/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { DataPlatform } from "@yourtoolshq/data";

// A fictional database and its documents as the previous release leaves them.
const fixture = join(import.meta.dirname, "fixtures", "previous-release");

const tables = [
  "households",
  "people",
  "institutions",
  "accounts",
  "account_ownership",
  "statement_expectations",
  "statement_period_exceptions",
  "account_terms_snapshots",
  "account_events",
  "documents",
];

async function rowCounts(client: Pick<Client, "execute">) {
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const result = await client.execute(`SELECT count(*) AS n FROM ${table}`);
    counts[table] = Number(result.rows[0]?.n);
  }
  return counts;
}

let dataDir: string;
let countsBefore: Record<string, number>;
let platform: DataPlatform;
let caller: Awaited<ReturnType<typeof createCaller>>;
let client: Client;

async function createCaller() {
  const { createCaller } = await import("~/server/api/root");
  const { createTRPCContext } = await import("~/server/api/trpc");
  return createCaller(createTRPCContext({ headers: new Headers() }));
}

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "passbook-upgrade-"));
  await cp(join(fixture, "documents"), join(dataDir, "documents"), {
    recursive: true,
  });
  const fixtureClient = createClient({
    url: `file:${join(dataDir, "passbook.db")}`,
  });
  await fixtureClient.executeMultiple(
    await readFile(join(fixture, "passbook.sql"), "utf8"),
  );
  countsBefore = await rowCounts(fixtureClient);
  fixtureClient.close();

  vi.stubEnv("DATA_DIR", dataDir);
  ({ dataPlatform: platform } = await import("~/server/data"));
  await platform.boot();
  caller = await createCaller();
  client = createClient({ url: `file:${join(dataDir, "passbook.db")}` });
});

afterAll(async () => {
  client.close();
  platform.close();
  vi.unstubAllEnvs();
  await rm(dataDir, { recursive: true, force: true });
});

describe("upgrading the previous release's database", () => {
  it("takes a verified pre-migration backup first", async () => {
    const backups = await platform.backups.list();

    expect(backups).toHaveLength(1);
    expect(backups[0]?.manifest?.trigger).toBe("pre-migration");
    expect(backups[0]?.verification?.status).toBe("verified");
  });

  it("keeps every row and leaves the database consistent", async () => {
    expect(await rowCounts(client)).toEqual(countsBefore);
    expect((await client.execute("PRAGMA integrity_check")).rows).toEqual([
      expect.objectContaining({ integrity_check: "ok" }),
    ]);
    expect((await client.execute("PRAGMA foreign_key_check")).rows).toEqual([]);
  });

  it("serves the household, accounts, and statements", async () => {
    expect(await caller.overview.summary()).toEqual({
      householdName: "Rivera household",
      memberCount: 2,
      institutionCount: 2,
      accountCount: 3,
    });
    expect(
      (await caller.accounts.list()).map((a) => a.displayName).sort(),
    ).toEqual(["Everyday Chequing", "High Interest Savings", "Rewards Visa"]);
    expect(await caller.documents.statementDocumentsByAccount()).toEqual({
      "5abe6b7c-2f8d-4eaf-9b4c-6d7e8f9a0b06": {
        "2025-01": "a0f3b0c1-7ed2-4df4-8a9b-1c2d3e4f5a11",
        "2025-03": "b104c1d2-8fe3-4e05-9bac-2d3e4f5a6b12",
      },
    });
  });

  it("serves every document's file from where the previous release stored it", async () => {
    const documents = await caller.documents.overview();
    expect(documents).toHaveLength(4);

    for (const document of documents) {
      const stored = await platform.files.read(document.fileId);
      expect(stored?.file.originalFilename).toBe(document.originalFilename);
      expect(stored?.bytes).toEqual(
        await readFile(
          join(fixture, "documents", stored?.file.storageKey ?? ""),
        ),
      );
    }
  });

  it("deletes a document and its file", async () => {
    const [document] = await caller.documents.overview({
      excludeStatements: true,
      excludeVoidCheques: true,
    });
    if (!document) throw new Error("The fixture has no correspondence");

    await caller.documents.delete({ id: document.id });

    expect(await platform.files.read(document.fileId)).toBeNull();
    expect(await caller.documents.overview()).toHaveLength(3);
  });
});
