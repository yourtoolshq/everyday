import { describe, expect, it } from "vitest";

import type { BackupSummary } from "./manifest";
import { describeBackupStatus } from "./status";

const now = new Date("2026-09-24T12:00:00.000Z");

function backup(
  createdAt: string,
  status: "verified" | "failed" | null,
): BackupSummary {
  return {
    id: `test-${createdAt}`,
    path: `/backups/test-${createdAt}.ytbackup`,
    size: 1,
    manifest: {
      formatVersion: 1,
      app: "test",
      appVersion: null,
      platformVersion: "0.0.0",
      createdAt,
      trigger: "scheduled",
      migrations: [],
      rowCounts: {},
      files: [],
      missingFiles: [],
    },
    verification: status && {
      status,
      checkedAt: createdAt,
      ...(status === "failed" ? { error: "Database is corrupt" } : {}),
    },
  };
}

function statusOf(backups: BackupSummary[], lastCreateError?: string) {
  return describeBackupStatus({
    backups,
    lastCreateError: lastCreateError ?? null,
    sharesDataDir: false,
    now,
  });
}

describe("describeBackupStatus", () => {
  it("is ok with a verified backup in the last two days", () => {
    expect(statusOf([backup("2026-09-22T12:30:00.000Z", "verified")])).toEqual({
      status: "ok",
      lastVerifiedBackupAt: "2026-09-22T12:30:00.000Z",
      lastError: null,
      sharesDataDir: false,
    });
  });

  it("is stale without a verified backup in the last two days", () => {
    expect(statusOf([])).toMatchObject({
      status: "stale",
      lastVerifiedBackupAt: null,
    });
    expect(
      statusOf([
        backup("2026-09-24T11:00:00.000Z", null),
        backup("2026-09-22T11:30:00.000Z", "verified"),
      ]),
    ).toMatchObject({
      status: "stale",
      lastVerifiedBackupAt: "2026-09-22T11:30:00.000Z",
    });
  });

  it("is failing when the newest backup failed verification", () => {
    expect(
      statusOf([
        backup("2026-09-24T02:00:00.000Z", "failed"),
        backup("2026-09-23T02:00:00.000Z", "verified"),
      ]),
    ).toMatchObject({
      status: "failing",
      lastVerifiedBackupAt: "2026-09-23T02:00:00.000Z",
      lastError: "Database is corrupt",
    });
  });

  it("is failing when the last backup attempt threw", () => {
    expect(
      statusOf(
        [backup("2026-09-24T02:00:00.000Z", "verified")],
        "ENOSPC: no space left on device",
      ),
    ).toMatchObject({
      status: "failing",
      lastError: "ENOSPC: no space left on device",
    });
  });
});
