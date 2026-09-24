import { z } from "zod";

export const backupTriggers = [
  "scheduled",
  "manual",
  "pre-migration",
  "pre-restore",
] as const;
export type BackupTrigger = (typeof backupTriggers)[number];

export const manifestSchema = z.object({
  formatVersion: z.literal(1),
  app: z.string().min(1),
  appVersion: z.string().nullable(),
  platformVersion: z.string(),
  createdAt: z.string().datetime(),
  trigger: z.enum(backupTriggers),
  migrations: z.array(
    z.object({ tag: z.string().nullable(), hash: z.string().min(1) }),
  ),
  rowCounts: z.record(z.number().int().nonnegative()),
  files: z.array(
    z.object({
      id: z.string().min(1),
      path: z.string().min(1),
      size: z.number().int().nonnegative(),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  ),
  missingFiles: z.array(
    z.object({ id: z.string().min(1), storageKey: z.string().min(1) }),
  ),
});
export type BackupManifest = z.infer<typeof manifestSchema>;

const verificationSchema = z.object({
  status: z.enum(["verified", "failed"]),
  checkedAt: z.string().datetime(),
  error: z.string().optional(),
});
export type Verification = z.infer<typeof verificationSchema>;

export const sidecarSchema = z.object({
  manifest: manifestSchema.nullable(),
  verification: verificationSchema,
});

export interface BackupRecord {
  id: string;
  path: string;
  manifest: BackupManifest | null;
  verification: Verification;
}

// An archive found in the backup directory; `verification` is null when it has no
// readable sidecar.
export interface BackupSummary {
  id: string;
  path: string;
  size: number;
  manifest: BackupManifest | null;
  verification: Verification | null;
}
