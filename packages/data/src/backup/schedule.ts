import type { Backups } from "./backups";
import type { RetentionPolicy } from "./retention";

export interface BackupPolicy {
  schedule: `daily@${string}`;
  retention: RetentionPolicy;
}

export interface BackupScheduleSummary extends BackupPolicy {
  // Null until the platform is ready and the scheduler has started.
  nextRunAt: string | null;
}

interface TimeOfDay {
  hour: number;
  minute: number;
}

export const backupIntervalMs = 24 * 60 * 60 * 1000;
const catchUpDelayMs = 2 * 60 * 1000;
// Comparing the wall clock every minute keeps the schedule after the host sleeps or its
// clock changes, which a single long timer would not.
const checkEveryMs = 60 * 1000;

export function parseSchedule(schedule: string): TimeOfDay {
  const match = /^daily@([01]\d|2[0-3]):([0-5]\d)$/.exec(schedule);
  if (!match) {
    throw new Error(
      `Backup schedule ${schedule} is not in the form daily@HH:MM`,
    );
  }
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function nextRunAfter(time: TimeOfDay, after: Date) {
  const next = new Date(after);
  next.setHours(time.hour, time.minute, 0, 0);
  if (next <= after) {
    next.setDate(next.getDate() + 1);
    next.setHours(time.hour, time.minute, 0, 0);
  }
  return next;
}

export async function startBackupSchedule(options: {
  app: string;
  policy: BackupPolicy;
  backups: Backups;
}) {
  const { app, policy, backups } = options;
  const time = parseSchedule(policy.schedule);
  const newest = (await backups.list()).find(
    (backup) => backup.verification?.status === "verified" && backup.manifest,
  );
  const newestAt = newest?.manifest ? Date.parse(newest.manifest.createdAt) : 0;
  let nextRunAt =
    Date.now() - newestAt < backupIntervalMs
      ? nextRunAfter(time, new Date())
      : new Date(Date.now() + catchUpDelayMs);
  console.info("backup schedule started", {
    app,
    schedule: policy.schedule,
    lastVerifiedBackupAt: newest?.manifest?.createdAt ?? null,
    nextRunAt: nextRunAt.toISOString(),
  });

  async function runScheduledBackup() {
    try {
      const backup = await backups.create({ trigger: "scheduled" });
      if (backup.verification.status !== "verified") {
        console.error("scheduled backup failed verification", {
          app,
          backupId: backup.id,
          error: backup.verification.error,
        });
      }
      await backups.prune(policy.retention);
    } catch (error) {
      console.error("scheduled backup failed", {
        app,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  let running = false;
  const timer = setInterval(() => {
    if (running || Date.now() < nextRunAt.getTime()) return;
    running = true;
    void runScheduledBackup().finally(() => {
      running = false;
      nextRunAt = nextRunAfter(time, new Date());
    });
  }, checkEveryMs);
  timer.unref();
  return {
    stop: () => clearInterval(timer),
    nextRunAt: () => nextRunAt,
  };
}

export type BackupScheduler = Awaited<ReturnType<typeof startBackupSchedule>>;
