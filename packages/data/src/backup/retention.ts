import type { BackupManifest, BackupSummary } from "./manifest";

export interface RetentionPolicy {
  daily: number;
  weekly: number;
  monthly: number;
}

const preMigrationHoldMs = 30 * 24 * 60 * 60 * 1000;

type VerifiedBackup = BackupSummary & { manifest: BackupManifest };

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function weekKey(date: Date) {
  const daysSinceMonday = (date.getDay() + 6) % 7;
  return dayKey(
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() - daysSinceMonday,
    ),
  );
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

// Periods are calendar days, weeks starting Monday, and months in local time. Each
// policy count keeps the newest backup of that many of the most recent periods that
// have a backup.
export function selectExpiredBackups(
  backups: BackupSummary[],
  policy: RetentionPolicy,
  now: Date,
): BackupSummary[] {
  const verified = backups
    .filter(
      (backup): backup is VerifiedBackup =>
        backup.verification?.status === "verified" && backup.manifest !== null,
    )
    .sort((a, b) => b.manifest.createdAt.localeCompare(a.manifest.createdAt));

  const kept = new Set(verified.slice(0, 1).map((backup) => backup.id));
  const periods: [number, (date: Date) => string][] = [
    [policy.daily, dayKey],
    [policy.weekly, weekKey],
    [policy.monthly, monthKey],
  ];
  for (const [count, periodOf] of periods) {
    const seen = new Set<string>();
    for (const backup of verified) {
      if (seen.size >= count) break;
      const period = periodOf(new Date(backup.manifest.createdAt));
      if (seen.has(period)) continue;
      seen.add(period);
      kept.add(backup.id);
    }
  }

  return verified.filter(
    (backup) =>
      !kept.has(backup.id) &&
      !(
        backup.manifest.trigger === "pre-migration" &&
        now.getTime() - Date.parse(backup.manifest.createdAt) <
          preMigrationHoldMs
      ),
  );
}
