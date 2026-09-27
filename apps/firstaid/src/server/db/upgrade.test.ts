import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Client } from "@libsql/client";
import { createClient } from "@libsql/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { DataPlatform } from "@yourtoolshq/data";

const fixture = join(import.meta.dirname, "fixtures", "previous-release");

const tables = [
  "people",
  "care_plans",
  "care_items",
  "care_organizations",
  "providers",
  "insurance_plans",
  "benefits",
  "visits",
  "claims",
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
  dataDir = await mkdtemp(join(tmpdir(), "firstaid-upgrade-"));
  await cp(join(fixture, "documents"), join(dataDir, "documents"), {
    recursive: true,
  });
  const fixtureClient = createClient({
    url: `file:${join(dataDir, "firstaid.db")}`,
  });
  await fixtureClient.executeMultiple(
    await readFile(join(fixture, "firstaid.sql"), "utf8"),
  );
  countsBefore = await rowCounts(fixtureClient);
  fixtureClient.close();

  vi.stubEnv("DATA_DIR", dataDir);
  ({ dataPlatform: platform } = await import("~/server/data"));
  expect(await platform.settled()).toEqual({ state: "ready" });
  caller = await createCaller();
  client = createClient({ url: `file:${join(dataDir, "firstaid.db")}` });
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

  it("serves visit documents from where the previous release stored them", async () => {
    const documents = await caller.documents.overview();
    expect(documents.map((document) => document.title).sort()).toEqual([
      "Lab image",
      "Visit receipt",
    ]);

    for (const document of documents) {
      const stored = await platform.files.read(document.fileId);
      expect(stored?.file.originalFilename).toBe(document.originalFilename);
      expect(stored?.file.storageKey).toMatch(
        /^(aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\.pdf|bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb\.jpg)$/,
      );
      expect(stored?.bytes).toEqual(
        await readFile(
          join(fixture, "documents", stored?.file.storageKey ?? ""),
        ),
      );
    }
  });

  it("deletes a document and its file", async () => {
    const documents = await caller.documents.overview();
    const receipt = documents.find((document) => document.type === "receipt");
    if (!receipt) throw new Error("The fixture has no receipt");

    await caller.documents.delete({ id: receipt.id });

    expect(await platform.files.read(receipt.fileId)).toBeNull();
    expect(await caller.documents.overview()).toHaveLength(1);
  });
});
