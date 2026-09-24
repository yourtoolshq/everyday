export { defineDataPlatform } from "./platform";
export type { DataPlatform, DataPlatformConfig } from "./platform";
export { BackupVerificationError } from "./backup/backups";
export type { RestoreResult } from "./backup/backups";
export type {
  BackupManifest,
  BackupRecord,
  BackupSummary,
  BackupTrigger,
  Verification,
} from "./backup/manifest";
export type { DataRouter } from "./router";
