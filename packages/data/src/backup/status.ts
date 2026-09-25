import type { BackupSummary } from "./manifest";
import { backupIntervalMs } from "./schedule";

export interface BackupStatus {
  status: "ok" | "stale" | "failing";
  lastVerifiedBackupAt: string | null;
  // Why the newest backup failed; null unless the status is failing.
  lastError: string | null;
  // Backups inside the data directory are lost with it.
  sharesDataDir: boolean;
}

const staleAfterMs = 2 * backupIntervalMs;

export function describeBackupStatus(input: {
  // Newest first, as `backups.list()` returns them.
  backups: BackupSummary[];
  // Set when the newest backup attempt threw before writing an archive.
  lastCreateError: string | null;
  sharesDataDir: boolean;
  now: Date;
}): BackupStatus {
  const newestVerified = input.backups.find(
    (backup) => backup.verification?.status === "verified" && backup.manifest,
  );
  const lastVerifiedBackupAt = newestVerified?.manifest?.createdAt ?? null;
  const newestVerification = input.backups[0]?.verification;
  const lastError =
    input.lastCreateError ??
    (newestVerification?.status === "failed"
      ? (newestVerification.error ?? "Backup failed verification")
      : null);
  let status: BackupStatus["status"] = "ok";
  if (lastError !== null) {
    status = "failing";
  } else if (
    lastVerifiedBackupAt === null ||
    input.now.getTime() - Date.parse(lastVerifiedBackupAt) > staleAfterMs
  ) {
    status = "stale";
  }
  return {
    status,
    lastVerifiedBackupAt,
    lastError,
    sharesDataDir: input.sharesDataDir,
  };
}
