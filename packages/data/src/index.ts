export { DataPlatformBusyError, defineDataPlatform } from "./platform";
export type {
  DataPlatform,
  DataPlatformConfig,
  PlatformState,
  PlatformStatus,
  RestorableBackup,
} from "./platform";
export { requireReady } from "./readiness";
export { BackupVerificationError } from "./backup/backups";
export { DataPlatformBlockedError, MigrationFailedError } from "./migrations";
export type { RestoreResult } from "./backup/backups";
export type { RetentionPolicy } from "./backup/retention";
export type { BackupPolicy } from "./backup/schedule";
export type {
  BackupManifest,
  BackupRecord,
  BackupSummary,
  BackupTrigger,
  Verification,
} from "./backup/manifest";
export type {
  FileFinding,
  IntegrityReport,
  QuarantinedFile,
  UnreferencedFile,
} from "./integrity";
export type { DataRouter } from "./router";
