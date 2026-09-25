import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  BackupStatus,
  BackupSummary,
  BackupTrigger,
  IntegrityReport,
  StorageUsage,
} from "@yourtoolshq/data";

import { BackupStatusNotice } from "./backup-status-banner";
import { DataSettingsView } from "./data-settings-page";

const megabyte = 1024 * 1024;
const gigabyte = 1024 * megabyte;

const usage: StorageUsage = {
  database: { bytes: 42 * megabyte },
  files: {
    count: 318,
    bytes: 612 * megabyte,
    byGroup: {
      pdf: { count: 300, bytes: 540 * megabyte },
      image: { count: 17, bytes: 61 * megabyte },
      eml: { count: 0, bytes: 0 },
      audio: { count: 0, bytes: 0 },
      other: { count: 1, bytes: 11 * megabyte },
    },
  },
  backups: { count: 2, bytes: 596 * megabyte },
  volumes: {
    data: { freeBytes: 118 * gigabyte, totalBytes: 500 * gigabyte },
    backups: { freeBytes: 1.5 * 1024 * gigabyte, totalBytes: 2048 * gigabyte },
  },
};

function backup(
  createdAt: string,
  trigger: BackupTrigger,
  verification: BackupSummary["verification"],
): BackupSummary {
  const id = `passbook-${createdAt.slice(0, 19).replaceAll(":", "-")}Z`;
  return {
    id,
    path: `/backups/${id}.ytbackup`,
    size: 298 * megabyte,
    manifest: {
      formatVersion: 1,
      app: "passbook",
      appVersion: "0.88.0",
      platformVersion: "0.1.0",
      createdAt,
      trigger,
      migrations: [],
      rowCounts: {},
      files: [],
      missingFiles: [],
    },
    verification,
  };
}

const verified = (checkedAt: string) => ({
  status: "verified" as const,
  checkedAt,
});

const policy = {
  schedule: "daily@02:00" as const,
  retention: { daily: 7, weekly: 4, monthly: 12 },
};

function render(
  settings: Partial<Parameters<typeof DataSettingsView>[0]["settings"]>,
) {
  return renderToStaticMarkup(
    <DataSettingsView
      settings={{
        usage,
        schedule: { ...policy, nextRunAt: "2026-09-25T02:00:00.000Z" },
        backups: [],
        integrity: null,
        ...settings,
      }}
      onChanged={() => Promise.resolve()}
    />,
  );
}

describe("DataSettingsView", () => {
  it("shows storage by kind and the space left on each volume", () => {
    const html = render({});
    expect(html).toContain("<dt>Database</dt>");
    expect(html).toContain("42.0 MB");
    expect(html).toContain("Files (318)");
    expect(html).toContain("PDF 540.0 MB · Images 61.0 MB · Other 11.0 MB");
    expect(html).not.toContain("Email");
    expect(html).toContain("Backups (2)");
    expect(html).toContain("118.0 GB free of 500.0 GB");
    expect(html).toContain("1.5 TB free of 2.0 TB");
    expect(html).toContain("width:76%");
  });

  it("shows the schedule, retention, and last and next scheduled runs", () => {
    const html = render({
      backups: [
        backup("2026-09-24T18:41:00.000Z", "manual", null),
        backup(
          "2026-09-24T02:00:00.000Z",
          "scheduled",
          verified("2026-09-24T02:01:00.000Z"),
        ),
      ],
    });
    expect(html).toContain("Every day at 02:00, server time.");
    expect(html).toContain("7 daily · 4 weekly · 12 monthly");
    expect(html).toMatch(
      /<dt>Last<\/dt><dd[^>]*><time dateTime="2026-09-24T02:00:00.000Z">Sep 24, 2026, 2:00 AM UTC<\/time>.*Verified/,
    );
    expect(html).toContain("Sep 25, 2026, 2:00 AM UTC");
  });

  it("says when automatic backups are off", () => {
    const html = render({ schedule: null });
    expect(html).toContain("Automatic backups are off for this app.");
    expect(html).not.toContain("<dt>Next</dt>");
  });

  it("lists backups with their trigger, size, and verification", () => {
    const html = render({
      backups: [
        backup("2026-09-24T02:00:00.000Z", "scheduled", {
          status: "failed",
          checkedAt: "2026-09-24T02:01:00.000Z",
          error: "Database is corrupt",
        }),
        backup(
          "2026-09-23T18:41:00.000Z",
          "pre-migration",
          verified("2026-09-23T18:42:00.000Z"),
        ),
        backup("2026-09-23T02:00:00.000Z", "manual", null),
      ],
    });
    expect(html).toContain("Scheduled · 298.0 MB");
    expect(html).toContain("Before an upgrade · 298.0 MB");
    expect(html).toContain('title="Database is corrupt"');
    expect(html).toContain("Failed verification");
    expect(html).toContain("Not verified");
    expect(html).toContain(
      'href="/api/data/backups/passbook-2026-09-23T18-41-00Z" download=""',
    );
    expect(html.match(/<button[^>]*>Restore<\/button>/g)).toHaveLength(3);
    expect(
      html.match(/<button[^>]*disabled=""[^>]*>Restore<\/button>/g),
    ).toHaveLength(1);
  });

  it("says when there are no backups", () => {
    expect(render({})).toContain("No backups yet.");
  });
});

function integrity(files: Partial<IntegrityReport["files"]> = {}) {
  return {
    scannedAt: "2026-09-24T18:45:00.000Z",
    database: { problems: [], foreignKeyViolations: { count: 0, first: [] } },
    files: {
      checked: 318,
      checksumsRecorded: 0,
      missing: [],
      checksumMismatches: [],
      unreferenced: [],
      quarantined: [],
      ...files,
    },
  } satisfies IntegrityReport;
}

describe("Integrity card", () => {
  it("offers a scan when none has run", () => {
    const html = render({});
    expect(html).toContain("No scan since the app started.");
    expect(html).toMatch(/<button[^>]*>Scan now<\/button>/);
  });

  it("shows a clean scan", () => {
    const html = render({ integrity: integrity() });
    expect(html).toContain(
      'Last scanned <time dateTime="2026-09-24T18:45:00.000Z">',
    );
    expect(html).toContain("Database structure is intact");
    expect(html).toContain("Every relationship is intact");
    expect(html).toContain("318 files read");
    expect(html).toContain("Every stored file is in use");
    expect(html).not.toContain("Move to quarantine");
    expect(html).not.toContain("in quarantine");
  });

  it("lists database problems and broken relationships", () => {
    const html = render({
      integrity: {
        ...integrity(),
        database: {
          problems: ["row 7 missing from index statements_account_idx"],
          foreignKeyViolations: {
            count: 3,
            first: [
              { table: "statements", rowid: 4, parent: "accounts" },
              { table: "account_tags", rowid: null, parent: "tags" },
            ],
          },
        },
      },
    });
    expect(html).toContain("Database has 1 problem");
    expect(html).toContain("row 7 missing from index statements_account_idx");
    expect(html).toContain("3 broken relationships");
    expect(html).toContain(
      "Row 4 in statements points to a missing row in accounts",
    );
    expect(html).toContain(
      "A row in account_tags points to a missing row in tags",
    );
    expect(html).toContain("and 1 more");
  });

  it("lists missing and changed files with the records that use them", () => {
    const finding = (id: string, originalFilename: string) => ({
      fileId: id,
      storageKey: `${id}.pdf`,
      originalFilename,
      endpoint: "statement",
      referencedBy: [{ table: "statements", key: `statement-${id}` }],
    });
    const html = render({
      integrity: integrity({
        checksumsRecorded: 2,
        missing: [finding("f1", "Chequing Mar 2025.pdf")],
        checksumMismatches: [finding("f2", "Savings Apr 2025.pdf")],
      }),
    });
    expect(html).toContain("318 files read, 2 checksums recorded");
    expect(html).toContain("1 file missing on disk");
    expect(html).toContain("Chequing Mar 2025.pdf");
    expect(html).toContain("statement · statements statement-f1");
    expect(html).toContain("1 file changed since upload");
    expect(html).toContain("Savings Apr 2025.pdf");
    expect(html).toContain("copy the file out of a backup archive");
  });

  it("offers to quarantine unreferenced files and delete quarantined ones", () => {
    const html = render({
      integrity: integrity({
        unreferenced: [
          {
            name: "f3.pdf",
            sizeBytes: 2 * megabyte,
            file: {
              id: "f3",
              originalFilename: "Old statement.pdf",
              endpoint: "statement",
            },
          },
          { name: "stray.pdf", sizeBytes: megabyte, file: null },
        ],
        quarantined: [
          { name: "f4.pdf", sizeBytes: megabyte, originalFilename: null },
        ],
      }),
    });
    expect(html).toContain("2 files not used by any record");
    expect(html).toContain("Old statement.pdf");
    expect(html).toContain("statement · 2.0 MB");
    expect(html).toContain("No file record · 1.0 MB");
    expect(html).toMatch(/<button[^>]*>Move to quarantine<\/button>/);
    expect(html).toContain("1 file in quarantine");
    expect(html).toContain("f4.pdf");
    expect(html).toMatch(/<button[^>]*>Delete quarantined files<\/button>/);
  });
});

function notice(status: Partial<BackupStatus>) {
  return renderToStaticMarkup(
    <BackupStatusNotice
      status={{
        status: "ok",
        lastVerifiedBackupAt: "2026-09-24T02:00:00.000Z",
        lastError: null,
        sharesDataDir: false,
        ...status,
      }}
    />,
  );
}

describe("BackupStatusNotice", () => {
  it("renders nothing while backups are healthy and on their own volume", () => {
    expect(notice({})).toBe("");
  });

  it("warns when backups share the data directory", () => {
    expect(notice({ sharesDataDir: true })).toContain(
      "Set BACKUP_DIR to a separate volume.",
    );
  });

  it("warns when no backup has been verified recently", () => {
    expect(notice({ status: "stale" })).toContain(
      "No backup has been verified since <time",
    );
    expect(notice({ status: "stale", lastVerifiedBackupAt: null })).toContain(
      "No verified backup exists yet.",
    );
  });

  it("shows why the last backup failed", () => {
    const html = notice({
      status: "failing",
      lastError: "ENOSPC: no space left on device",
    });
    expect(html).toContain(
      "The last backup failed: ENOSPC: no space left on device",
    );
    expect(html).toContain('href="/settings/data"');
  });
});
