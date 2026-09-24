import { createClient } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PausableClient } from "./connection";

let client: PausableClient;

beforeEach(async () => {
  client = new PausableClient(() => createClient({ url: ":memory:" }));
  await client.execute("CREATE TABLE t (n integer)");
});

afterEach(() => {
  client.close();
});

describe("PausableClient", () => {
  it("holds new work until exclusive access ends", async () => {
    const order: string[] = [];
    let finish!: () => void;
    const exclusive = client.exclusive(async () => {
      order.push("exclusive started");
      await new Promise<void>((resolve) => (finish = resolve));
      order.push("exclusive finished");
    });
    await Promise.resolve();

    const query = client
      .execute("SELECT 1")
      .then(() => order.push("query ran"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    finish();
    await Promise.all([exclusive, query]);

    expect(order).toEqual([
      "exclusive started",
      "exclusive finished",
      "query ran",
    ]);
  });

  it("waits for guarded work, including its queries, before exclusive access", async () => {
    const order: string[] = [];
    let continueWork!: () => void;
    const guarded = client.guard(async () => {
      await new Promise<void>((resolve) => (continueWork = resolve));
      await client.execute("INSERT INTO t VALUES (1)");
      order.push("guarded finished");
    });
    const exclusive = client.exclusive(() => {
      order.push("exclusive ran");
      return Promise.resolve();
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    continueWork();
    await Promise.all([guarded, exclusive]);

    expect(order).toEqual(["guarded finished", "exclusive ran"]);
  });

  it("waits for an open transaction before exclusive access", async () => {
    const order: string[] = [];
    const tx = await client.transaction("write");
    const exclusive = client.exclusive(() => {
      order.push("exclusive ran");
      return Promise.resolve();
    });
    await tx.execute("INSERT INTO t VALUES (1)");
    order.push("transaction committing");
    await tx.commit();
    await exclusive;

    expect(order).toEqual(["transaction committing", "exclusive ran"]);
  });

  it("times out when work does not finish", async () => {
    const tx = await client.transaction("write");

    await expect(
      client.exclusive(() => Promise.resolve(), { drainTimeoutMs: 10 }),
    ).rejects.toThrow("Timed out after 10 ms");
    await tx.rollback();
    await expect(client.execute("SELECT 1")).resolves.toBeDefined();
  });

  it("reopens the connection when exclusive access leaves it closed", async () => {
    await client.exclusive(({ close }) => {
      close();
      return Promise.resolve();
    });
    await expect(client.execute("SELECT 1")).resolves.toBeDefined();
  });
});
