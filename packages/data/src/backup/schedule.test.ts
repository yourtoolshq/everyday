import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BackupPolicy } from "./schedule";
import { defineDataPlatform } from "../platform";
import { filesTable } from "../schema";
import { platformMigration, writeMigrations } from "../test-platform";
import { nextRunAfter } from "./schedule";

const minutes = (count: number) => count * 60 * 1000;
const policy: BackupPolicy = {
  schedule: "daily@02:00",
  retention: { daily: 7, weekly: 4, monthly: 12 },
};

let root: string;
let current: ReturnType<typeof defineDataPlatform> | null = null;

function openPlatform(backups?: BackupPolicy) {
  current?.close();
  current = defineDataPlatform({
    app: "test",
    dataDir: join(root, "data"),
    db: { schema: { filesTable }, migrationsFolder: join(root, "drizzle") },
    backups,
  });
  return current;
}

async function startScheduled(backups = policy) {
  const platform = openPlatform(backups);
  await platform.boot();
  return platform;
}

async function backUpAt(dates: Date[]) {
  const platform = openPlatform();
  await platform.boot();
  for (const date of dates) {
    vi.setSystemTime(date);
    await platform.backups.create();
  }
}

async function triggers(platform: ReturnType<typeof defineDataPlatform>) {
  return (await platform.backups.list()).map((b) => b.manifest?.trigger);
}

function waitForScheduledBackup() {
  return vi.waitFor(
    () => {
      expect(console.info).toHaveBeenCalledWith(
        "backup created",
        expect.objectContaining({ trigger: "scheduled" }),
      );
    },
    { timeout: 5000 },
  );
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(new Date(2026, 8, 24, 10, 0));
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  root = await mkdtemp(join(tmpdir(), "yt-data-schedule-"));
  await writeMigrations(join(root, "drizzle"), [platformMigration]);
});

afterEach(async () => {
  current?.close();
  current = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

describe("backup schedule", () => {
  it("catches up a few minutes after start when no backup is recent", async () => {
    const platform = await startScheduled();

    await vi.advanceTimersByTimeAsync(minutes(1));
    expect(await platform.backups.list()).toEqual([]);
    await vi.advanceTimersByTimeAsync(minutes(1));
    await waitForScheduledBackup();

    expect(await platform.backups.list()).toEqual([
      expect.objectContaining({
        verification: expect.objectContaining({
          status: "verified",
        }) as unknown,
      }),
    ]);
  });

  it("waits for the scheduled time when a backup is recent", async () => {
    await backUpAt([new Date(2026, 8, 24, 9, 0)]);
    vi.setSystemTime(new Date(2026, 8, 24, 10, 0));
    const platform = await startScheduled();

    await vi.advanceTimersByTimeAsync(minutes(15 * 60 + 59));
    expect(await triggers(platform)).toEqual(["manual"]);
    await vi.advanceTimersByTimeAsync(minutes(1));
    await waitForScheduledBackup();

    expect(await triggers(platform)).toEqual(["scheduled", "manual"]);
  });

  it("prunes by the retention policy after a scheduled backup", async () => {
    await backUpAt([
      new Date(2026, 8, 20, 2, 0),
      new Date(2026, 8, 21, 2, 0),
      new Date(2026, 8, 22, 2, 0),
    ]);
    vi.setSystemTime(new Date(2026, 8, 24, 10, 0));
    const platform = await startScheduled({
      ...policy,
      retention: { daily: 2, weekly: 0, monthly: 0 },
    });

    await vi.advanceTimersByTimeAsync(minutes(2));
    await vi.waitFor(
      () => {
        expect(console.info).toHaveBeenCalledWith(
          "backups pruned",
          expect.objectContaining({ app: "test" }),
        );
      },
      { timeout: 5000 },
    );

    const kept = await platform.backups.list();
    expect(kept.map((b) => b.manifest?.createdAt)).toEqual([
      expect.stringMatching(/^2026-09-24T/),
      new Date(2026, 8, 22, 2, 0).toISOString(),
    ]);
  });

  it("logs a failed backup and tries again at the next scheduled time", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const platform = await startScheduled();
    vi.spyOn(platform.backups, "create").mockRejectedValueOnce(
      new Error("No space left on device"),
    );

    await vi.advanceTimersByTimeAsync(minutes(2));
    expect(error).toHaveBeenCalledWith("scheduled backup failed", {
      app: "test",
      error: "No space left on device",
    });
    await vi.advanceTimersByTimeAsync(minutes(16 * 60));
    await waitForScheduledBackup();

    expect(await triggers(platform)).toEqual(["scheduled"]);
  });

  it("stops when the platform closes", async () => {
    const platform = await startScheduled();
    const create = vi.spyOn(platform.backups, "create");

    platform.close();
    current = null;
    await vi.advanceTimersByTimeAsync(minutes(24 * 60));

    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a schedule it cannot parse", () => {
    expect(() => openPlatform({ ...policy, schedule: "daily@2am" })).toThrow(
      "Backup schedule daily@2am is not in the form daily@HH:MM",
    );
  });
});

describe("nextRunAfter", () => {
  const time = { hour: 2, minute: 0 };

  it("runs later the same day before the scheduled time", () => {
    expect(nextRunAfter(time, new Date(2026, 8, 24, 1, 59))).toEqual(
      new Date(2026, 8, 24, 2, 0),
    );
  });

  it("runs the next day at or after the scheduled time", () => {
    expect(nextRunAfter(time, new Date(2026, 8, 24, 2, 0))).toEqual(
      new Date(2026, 8, 25, 2, 0),
    );
    expect(nextRunAfter(time, new Date(2026, 8, 30, 23, 0))).toEqual(
      new Date(2026, 9, 1, 2, 0),
    );
  });
});
