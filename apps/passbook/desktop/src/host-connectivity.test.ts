import { afterEach, describe, expect, it, vi } from "vitest";

import { isHostHealthy } from "../electron/host-connectivity";

describe("isHostHealthy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns true when health responds ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "ok" }),
      }),
    );

    await expect(isHostHealthy("http://127.0.0.1:3847", 500)).resolves.toBe(
      true,
    );
  });

  it("returns false when health never succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));

    await expect(isHostHealthy("http://127.0.0.1:3847", 200)).resolves.toBe(
      false,
    );
  });
});
