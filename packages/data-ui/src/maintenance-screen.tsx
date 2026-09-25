"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";

import type { PlatformStatus, RestorableBackup } from "@yourtoolshq/data";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@yourtoolshq/ui/alert-dialog";
import { Button } from "@yourtoolshq/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@yourtoolshq/ui/card";

import { BackupTime } from "./backup-time";

type BlockedStatus = Extract<PlatformStatus, { state: "blocked" }>;

const statusUrl = "/api/data/status";
const restoreUrl = "/api/data/trpc/backups.restore";
const pollIntervalMs = 2000;

export function MaintenanceScreen({
  initialStatus,
}: {
  initialStatus: PlatformStatus;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      void fetch(statusUrl, { cache: "no-store" })
        .then((response) => response.json() as Promise<PlatformStatus>)
        .then((next) => {
          if (next.state === "ready") window.location.reload();
          else setStatus(next);
        })
        .catch((error: unknown) => {
          // Expected while the application restarts; the next poll retries.
          console.warn("data status poll failed", {
            error: describeError(error),
          });
        });
    }, pollIntervalMs);
    return () => clearInterval(timer);
  }, []);

  async function restore(blocked: BlockedStatus, backup: RestorableBackup) {
    setRestoreError(null);
    setStatus({
      app: blocked.app,
      version: blocked.version,
      state: "restoring",
    });
    try {
      const response = await fetch(restoreUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: backup.id }),
      });
      if (response.ok) {
        window.location.reload();
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setRestoreError(
        body?.error?.message ?? `Restore failed (HTTP ${response.status})`,
      );
    } catch (error) {
      setRestoreError(`Restore failed: ${describeError(error)}`);
    }
    setStatus(blocked);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-lg">
        {status.state === "blocked" ? (
          <BlockedContent
            status={status}
            restoreError={restoreError}
            onRestore={(backup) => void restore(status, backup)}
          />
        ) : (
          <ProgressContent status={status} />
        )}
      </Card>
    </main>
  );
}

function ProgressContent({ status }: { status: PlatformStatus }) {
  let title = "Upgrading your data";
  let detail = "";
  if (status.state === "restoring") title = "Restoring a backup";
  if (status.state === "upgrading") {
    const count = status.migrations.length;
    detail =
      status.step === "backup"
        ? "Backing up your data before the update."
        : `Applying ${count} ${count === 1 ? "update" : "updates"}.`;
  }
  return (
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        {title}
      </CardTitle>
      <CardDescription>
        {detail} Your data is safe; this page reloads when it is done.
      </CardDescription>
    </CardHeader>
  );
}

const blockedTitles = {
  downgrade: "This data needs a newer version",
  "edited-migration": "This data does not match this version",
  "migration-failed": "The upgrade failed",
} as const;

function BlockedContent({
  status,
  restoreError,
  onRestore,
}: {
  status: BlockedStatus;
  restoreError: string | null;
  onRestore: (backup: RestorableBackup) => void;
}) {
  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TriangleAlert className="text-destructive size-4" aria-hidden />
          {blockedTitles[status.reason]}
        </CardTitle>
        <CardDescription>{status.message}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status.reason === "migration-failed" ? (
          <p className="text-muted-foreground">
            The upgrade was rolled back, so your data is unchanged. Run the
            previous version.
          </p>
        ) : (
          <RestorableBackups
            backups={status.restorableBackups ?? []}
            onRestore={onRestore}
          />
        )}
        {restoreError ? (
          <p role="alert" className="text-destructive">
            {restoreError}
          </p>
        ) : null}
      </CardContent>
    </>
  );
}

function RestorableBackups({
  backups,
  onRestore,
}: {
  backups: RestorableBackup[];
  onRestore: (backup: RestorableBackup) => void;
}) {
  if (backups.length === 0) {
    return (
      <p className="text-muted-foreground">
        No backup this version can open was found.
      </p>
    );
  }
  return (
    <>
      <p className="text-muted-foreground">Backups this version can open:</p>
      <ul className="divide-y rounded-lg border">
        {backups.map((backup) => (
          <li
            key={backup.id}
            className="flex items-center justify-between gap-4 px-3 py-2"
          >
            <div>
              <p className="font-medium">
                <BackupTime iso={backup.createdAt} />
              </p>
              <p className="text-muted-foreground text-xs">
                {backup.trigger}
                {backup.appVersion ? ` · made by ${backup.appVersion}` : ""}
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Restore
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restore this backup?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The current data is backed up first, then replaced by the
                    backup from <BackupTime iso={backup.createdAt} />.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onRestore(backup)}>
                    Restore
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </li>
        ))}
      </ul>
    </>
  );
}

function describeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
