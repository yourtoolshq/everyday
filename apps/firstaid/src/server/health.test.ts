import { beforeAll, describe, expect, it, vi } from "vitest";

import { dataPlatform } from "~/server/data";
import { createHealthResponse } from "~/server/health";

describe("createHealthResponse", () => {
  beforeAll(async () => {
    expect(await dataPlatform.settled()).toEqual({ state: "ready" });
  });

  it("returns ok and backup status when the database is reachable", async () => {
    const response = await createHealthResponse(
      vi.fn().mockResolvedValue(undefined),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      state: "ready",
      backup: { status: expect.any(String) },
    });
  });

  it("returns a service error when the ready database check fails", async () => {
    const response = await createHealthResponse(
      vi.fn().mockRejectedValue(new Error("database unavailable")),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      state: "ready",
    });
  });

  it("returns maintenance while the platform is not ready", async () => {
    vi.spyOn(dataPlatform, "state").mockResolvedValueOnce({
      state: "upgrading",
      step: "migrate",
      migrations: ["0005_platform_files"],
    });

    const response = await createHealthResponse();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "maintenance",
      state: "upgrading",
    });
  });
});
