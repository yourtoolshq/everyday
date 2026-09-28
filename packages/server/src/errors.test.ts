import { describe, expect, it, vi } from "vitest";

import { AppError, isAppError, notFound } from "./errors";
import { createLogger, logEvent } from "./log";

describe("AppError", () => {
  it("carries a transport-neutral code and message", () => {
    const error = notFound("Paycheck not found.");
    expect(error).toBeInstanceOf(AppError);
    expect(isAppError(error)).toBe(true);
    expect(error.code).toBe("not_found");
    expect(error.message).toBe("Paycheck not found.");
  });
});

describe("logEvent", () => {
  it("writes one JSON line without undefined context keys", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    logEvent({
      level: "info",
      app: "tenure",
      operation: "paycheck.create",
      outcome: "success",
      durationMs: 12,
      message: "created",
      employmentId: undefined,
    });
    expect(info).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(info.mock.calls[0]?.[0])) as Record<
      string,
      unknown
    >;
    expect(line).toMatchObject({
      level: "info",
      app: "tenure",
      operation: "paycheck.create",
      outcome: "success",
      durationMs: 12,
      message: "created",
    });
    expect(line).not.toHaveProperty("employmentId");
    expect(typeof line.ts).toBe("string");
    info.mockRestore();
  });

  it("createLogger binds the app identity", () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    createLogger("data").error("backup.create", {
      outcome: "failure",
      message: "verification failed",
    });
    const line = JSON.parse(String(error.mock.calls[0]?.[0])) as Record<
      string,
      unknown
    >;
    expect(line.app).toBe("data");
    expect(line.operation).toBe("backup.create");
    error.mockRestore();
  });
});
