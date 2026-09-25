"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";

import type { BackupStatus } from "@yourtoolshq/data";

import { BackupTime } from "./backup-time";
import { dataClient, describeError, onBackupsChanged } from "./client";

const refreshIntervalMs = 60 * 1000;

export function BackupStatusBanner() {
  const [status, setStatus] = useState<BackupStatus | null>(null);

  useEffect(() => {
    function refresh() {
      dataClient.backups.status.query().then(setStatus, (error: unknown) => {
        console.warn("backup status check failed", {
          error: describeError(error),
        });
      });
    }
    refresh();
    const timer = setInterval(refresh, refreshIntervalMs);
    const unsubscribe = onBackupsChanged(refresh);
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, []);

  return status ? <BackupStatusNotice status={status} /> : null;
}

export function BackupStatusNotice({ status }: { status: BackupStatus }) {
  const problems: ReactNode[] = [];
  if (status.status === "failing") {
    problems.push(`The last backup failed: ${status.lastError}`);
  }
  if (status.status === "stale") {
    problems.push(
      status.lastVerifiedBackupAt ? (
        <>
          No backup has been verified since{" "}
          <BackupTime iso={status.lastVerifiedBackupAt} />.
        </>
      ) : (
        "No verified backup exists yet."
      ),
    );
  }
  if (status.sharesDataDir) {
    problems.push(
      "Backups are stored in the data directory, so losing that disk loses them too. Set BACKUP_DIR to a separate volume.",
    );
  }
  if (problems.length === 0) return null;

  return (
    <div
      role="status"
      className={`flex items-start gap-3 border-b px-4 py-2.5 text-sm md:px-6 ${
        status.status === "failing"
          ? "bg-destructive/10 text-destructive"
          : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
      }`}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex-1 space-y-0.5">
        {problems.map((problem, index) => (
          <p key={index}>{problem}</p>
        ))}
      </div>
      <a
        href="/settings/data"
        className="shrink-0 font-medium underline underline-offset-4"
      >
        Data settings
      </a>
    </div>
  );
}
