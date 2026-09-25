"use client";

import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";

import type {
  BackupSummary,
  BackupTrigger,
  Verification,
} from "@yourtoolshq/data";
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
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@yourtoolshq/ui/card";

import { BackupTime } from "./backup-time";
import { dataClient, describeError, notifyBackupsChanged } from "./client";
import { formatBytes } from "./format";
import { VerificationBadge } from "./verification-badge";

const triggerLabels: Record<BackupTrigger, string> = {
  scheduled: "Scheduled",
  manual: "Manual",
  "pre-migration": "Before an upgrade",
  "pre-restore": "Before a restore",
};

interface Outcome {
  tone: "success" | "error";
  text: string;
}

function describeVerification(verification: Verification, subject: string) {
  return verification.status === "verified"
    ? { tone: "success" as const, text: `${subject} and verified.` }
    : {
        tone: "error" as const,
        text: `${subject} but failed verification: ${verification.error ?? "unknown error"}`,
      };
}

export function BackupsCard({
  backups,
  onChanged,
}: {
  backups: BackupSummary[];
  onChanged: () => Promise<void>;
}) {
  // The action in progress: "create", or "verify:<id>" / "restore:<id>".
  const [pending, setPending] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function run(action: string, work: () => Promise<Outcome>) {
    setPending(action);
    setOutcome(null);
    let result: Outcome;
    try {
      result = await work();
    } catch (error) {
      result = { tone: "error", text: describeError(error) };
    }
    notifyBackupsChanged();
    await onChanged();
    setOutcome(result);
    setPending(null);
  }

  async function restore(backup: BackupSummary) {
    setPending(`restore:${backup.id}`);
    setOutcome(null);
    try {
      await dataClient.backups.restore.mutate({ id: backup.id });
      window.location.reload();
    } catch (error) {
      setOutcome({ tone: "error", text: describeError(error) });
      setPending(null);
    }
  }

  const createBackup = () =>
    run("create", async () =>
      describeVerification(
        (await dataClient.backups.create.mutate()).verification,
        "Backup created",
      ),
    );
  const verifyBackup = (backup: BackupSummary) =>
    run(`verify:${backup.id}`, async () =>
      describeVerification(
        (await dataClient.backups.verify.mutate({ id: backup.id }))
          .verification,
        "Backup checked",
      ),
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backups</CardTitle>
        <CardDescription>
          Each backup holds the database and every file it references.
        </CardDescription>
        <CardAction>
          <Button
            size="sm"
            disabled={pending !== null}
            onClick={() => void createBackup()}
          >
            {pending === "create" ? (
              <LoaderCircle className="animate-spin" aria-hidden />
            ) : null}
            Back up now
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {outcome ? (
          <p
            role={outcome.tone === "error" ? "alert" : "status"}
            className={
              outcome.tone === "error" ? "text-destructive" : "text-foreground"
            }
          >
            {outcome.text}
          </p>
        ) : null}
        {backups.length === 0 ? (
          <p className="text-muted-foreground">No backups yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {backups.map((backup) => (
              <BackupRow
                key={backup.id}
                backup={backup}
                pending={pending}
                onVerify={() => void verifyBackup(backup)}
                onRestore={() => void restore(backup)}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function BackupRow({
  backup,
  pending,
  onVerify,
  onRestore,
}: {
  backup: BackupSummary;
  pending: string | null;
  onVerify: () => void;
  onRestore: () => void;
}) {
  const { manifest } = backup;
  const createdAt = manifest ? <BackupTime iso={manifest.createdAt} /> : null;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{createdAt ?? backup.id}</p>
        <p className="text-muted-foreground text-xs">
          {manifest ? triggerLabels[manifest.trigger] : "Unreadable archive"} ·{" "}
          {formatBytes(backup.size)}
        </p>
      </div>
      <VerificationBadge verification={backup.verification} />
      <div className="flex gap-1">
        <Button asChild variant="ghost" size="sm">
          <a
            href={`/api/data/backups/${encodeURIComponent(backup.id)}`}
            download
          >
            <Download aria-hidden />
            Download
          </a>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending !== null}
          onClick={onVerify}
        >
          {pending === `verify:${backup.id}` ? (
            <LoaderCircle className="animate-spin" aria-hidden />
          ) : null}
          Verify
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={
                pending !== null || backup.verification?.status === "failed"
              }
            >
              {pending === `restore:${backup.id}` ? (
                <LoaderCircle className="animate-spin" aria-hidden />
              ) : null}
              Restore
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restore this backup?</AlertDialogTitle>
              <AlertDialogDescription>
                The current data is backed up first, then replaced by the backup
                from {createdAt ?? backup.id}. The app is unavailable until the
                restore finishes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onRestore}>Restore</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}
