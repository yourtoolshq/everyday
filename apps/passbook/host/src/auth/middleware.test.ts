import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { authorizeRequest } from "./middleware";
import { createAuthStore } from "./store";

describe("authorizeRequest", () => {
  let dataDir: string;

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
    delete process.env.PASSBOOK_REQUIRE_AUTH;
  });

  it("allows loopback access without a token", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "passbook-auth-"));
    const store = createAuthStore(dataDir);
    const result = await authorizeRequest(store, {
      remoteAddress: "127.0.0.1",
      request: new Request("http://127.0.0.1:3847/api/trpc/setup.state"),
    });
    expect(result.error).toBeUndefined();
    expect(result.context.isLoopback).toBe(true);
  });

  it("denies remote access without a token", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "passbook-auth-"));
    const store = createAuthStore(dataDir);
    const result = await authorizeRequest(store, {
      remoteAddress: "192.168.1.50",
      request: new Request("http://192.168.1.50:3847/api/trpc/setup.state"),
    });
    expect(result.error?.status).toBe(401);
  });

  it("allows remote access with a paired token", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "passbook-auth-"));
    const store = createAuthStore(dataDir);
    const pairing = await store.createPairingCode();
    const paired = await store.pairDevice({
      code: pairing.code,
      label: "Phone",
    });

    const result = await authorizeRequest(store, {
      remoteAddress: "192.168.1.50",
      request: new Request("http://192.168.1.50:3847/api/trpc/setup.state", {
        headers: { authorization: `Bearer ${paired.token}` },
      }),
    });
    expect(result.error).toBeUndefined();
    expect(result.context.tokenId).toBe(paired.id);
  });
});
