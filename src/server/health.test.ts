import { describe, expect, it, vi } from "vitest";

import { createHealthResponse } from "~/server/health";

describe("createHealthResponse", () => {
  it("returns ok when the database is reachable", async () => {
    const response = await createHealthResponse(
      vi.fn().mockResolvedValue(undefined),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("returns a service error when the database is unavailable", async () => {
    const response = await createHealthResponse(
      vi.fn().mockRejectedValue(new Error("database unavailable")),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: "error" });
  });
});
