import { stat, statfs } from "node:fs/promises";
import { dirname } from "node:path";

import type { BackupContext } from "./backup/backups";
import type { BackupSummary } from "./backup/manifest";
import type { FileTypeGroup } from "./files/detect";
import { isMissing } from "./backup/swap";
import { fileTypeGroups, groupOfMimeType } from "./files/detect";

interface Amount {
  count: number;
  bytes: number;
}

export interface VolumeSpace {
  freeBytes: number;
  totalBytes: number;
}

export interface StorageUsage {
  database: { bytes: number };
  files: Amount & { byGroup: Record<FileTypeGroup | "other", Amount> };
  backups: Amount;
  volumes: { data: VolumeSpace; backups: VolumeSpace };
}

export async function readUsage(
  context: BackupContext,
  backups: BackupSummary[],
): Promise<StorageUsage> {
  const byGroup = Object.fromEntries(
    [...fileTypeGroups, "other" as const].map((group) => [
      group,
      { count: 0, bytes: 0 },
    ]),
  ) as StorageUsage["files"]["byGroup"];
  const rows = await context.client.execute(
    "SELECT mime_type, COUNT(*) AS count, COALESCE(SUM(size_bytes), 0) AS bytes FROM yt_files GROUP BY mime_type",
  );
  for (const row of rows.rows) {
    const amount = byGroup[groupOfMimeType(row.mime_type as string)];
    amount.count += Number(row.count);
    amount.bytes += Number(row.bytes);
  }
  const groups = Object.values(byGroup);

  return {
    database: {
      bytes:
        (await sizeOf(context.databasePath)) +
        (await sizeOf(`${context.databasePath}-wal`)),
    },
    files: {
      count: groups.reduce((total, group) => total + group.count, 0),
      bytes: groups.reduce((total, group) => total + group.bytes, 0),
      byGroup,
    },
    backups: {
      count: backups.length,
      bytes: backups.reduce((total, backup) => total + backup.size, 0),
    },
    volumes: {
      data: await spaceOf(context.dataDir),
      backups: await spaceOf(context.backupDir),
    },
  };
}

async function sizeOf(path: string) {
  try {
    return (await stat(path)).size;
  } catch (error) {
    if (isMissing(error)) return 0;
    throw error;
  }
}

// The backup directory is created by the first backup, so a missing directory reports
// the volume it will be created on.
async function spaceOf(path: string): Promise<VolumeSpace> {
  try {
    const stats = await statfs(path);
    return {
      freeBytes: stats.bavail * stats.bsize,
      totalBytes: stats.blocks * stats.bsize,
    };
  } catch (error) {
    if (!isMissing(error) || dirname(path) === path) throw error;
    return spaceOf(dirname(path));
  }
}
