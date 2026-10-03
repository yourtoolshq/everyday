import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createAuthStore } from "./store";

describe("AuthStore", () => {
  let dataDir: string;

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it("pairs a device and verifies its token", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "passbook-auth-"));
    const store = createAuthStore(dataDir);
    const pairing = await store.createPairingCode();
    const paired = await store.pairDevice({
      code: pairing.code,
      label: "Test phone",
    });

    expect(await store.verifyToken(paired.token)).toBe(paired.id);
    expect(await store.verifyToken("invalid")).toBeNull();
  });

  it("revokes a token", async () => {
    dataDir = await mkdtemp(join(tmpdir(), "passbook-auth-"));
    const store = createAuthStore(dataDir);
    const pairing = await store.createPairingCode();
    const paired = await store.pairDevice({
      code: pairing.code,
      label: "Test phone",
    });

    await store.revokeToken(paired.id);
    expect(await store.verifyToken(paired.token)).toBeNull();
  });
});
