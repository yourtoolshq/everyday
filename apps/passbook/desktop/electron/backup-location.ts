import { existsSync, mkdirSync, renameSync } from "node:fs";
import path from "node:path";

export function moveLegacyDesktopBackups(dataDir: string, backupDir: string) {
  const legacyBackupDir = path.join(dataDir, "backups");
  if (legacyBackupDir === backupDir || !existsSync(legacyBackupDir)) return;

  // Never merge into an existing destination. A user may already have made a
  // backup with the newer layout, and both sets should remain untouched.
  if (existsSync(backupDir)) return;

  mkdirSync(path.dirname(backupDir), { recursive: true });
  renameSync(legacyBackupDir, backupDir);
}
