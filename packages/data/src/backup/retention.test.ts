import { describe, expect, it } from "vitest";

import type { BackupSummary, BackupTrigger } from "./manifest";
import { selectExpiredBackups } from "./retention";

function backup(
  createdAt: Date,
  options: {
    trigger?: BackupTrigger;
    status?: "verified" | "failed" | null;
  } = {},
): BackupSummary {
  const iso = createdAt.toISOString();
  const status = options.status === undefined ? "verified" : options.status;
  return {
    id: `test-${iso}`,
    path: `/backups/test-${iso}.ytbackup`,
    size: 1024,
    manifest: {
      formatVersion: 1,
      app: "test",
      appVersion: null,
      platformVersion: "0.0.0",
      createdAt: iso,
      trigger: options.trigger ?? "scheduled",
      migrations: [],
      rowCounts: {},
      files: [],
      missingFiles: [],
    },
    verification: status && { status, checkedAt: iso },
  };
}

const day = (month: number, date: number, hour = 2) =>
  new Date(2026, month - 1, date, hour);
const now = day(9, 24, 3);

function keptDates(backups: BackupSummary[], expired: BackupSummary[]) {
  const expiredIds = new Set(expired.map((b) => b.id));
  return backups
    .filter((b) => !expiredIds.has(b.id))
    .map((b) => {
      const date = new Date(b.manifest?.createdAt ?? "");
      return `${date.getMonth() + 1}-${date.getDate()}`;
    });
}

describe("selectExpiredBackups", () => {
  it("keeps the newest backup of each recent day, week, and month", () => {
    const daily = Array.from({ length: 120 }, (_, i) => backup(day(9, 24 - i)));

    const expired = selectExpiredBackups(
      daily,
      { daily: 7, weekly: 4, monthly: 12 },
      now,
    );

    expect(keptDates(daily, expired)).toEqual([
      "9-24",
      "9-23",
      "9-22",
      "9-21",
      "9-20",
      "9-19",
      "9-18",
      "9-13",
      "9-6",
      "8-31",
      "7-31",
      "6-30",
      "5-31",
    ]);
  });

  it("keeps only the newest backup of a day", () => {
    const backups = [
      backup(day(9, 24, 14), { trigger: "manual" }),
      backup(day(9, 24, 2)),
      backup(day(9, 23, 2)),
    ];

    const expired = selectExpiredBackups(
      backups,
      { daily: 2, weekly: 0, monthly: 0 },
      now,
    );

    expect(expired).toEqual([backups[1]]);
  });

  it("never expires unverified backups and always keeps the newest verified one", () => {
    const backups = [
      backup(day(9, 24), { status: "failed" }),
      backup(day(9, 23), { status: null }),
      backup(day(9, 22)),
      backup(day(9, 21)),
    ];

    const expired = selectExpiredBackups(
      backups,
      { daily: 0, weekly: 0, monthly: 0 },
      now,
    );

    expect(expired).toEqual([backups[3]]);
  });

  it("holds pre-migration backups for 30 days", () => {
    const backups = [
      backup(day(9, 24)),
      backup(day(9, 1), { trigger: "pre-migration" }),
      backup(day(8, 20), { trigger: "pre-migration" }),
    ];

    const expired = selectExpiredBackups(
      backups,
      { daily: 1, weekly: 0, monthly: 0 },
      now,
    );

    expect(expired).toEqual([backups[2]]);
  });
});
