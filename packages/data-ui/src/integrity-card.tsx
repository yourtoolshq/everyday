"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";

import type { FileFinding, IntegrityReport } from "@yourtoolshq/data";
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

import { dataClient, describeError } from "./client";
import { formatBytes } from "./format";
import { LocalTime } from "./local-time";

type Action = "scan" | "quarantine" | "purge";

interface Outcome {
  tone: "success" | "error";
  text: string;
}

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

export function IntegrityCard({
  report,
  onChanged,
}: {
  report: IntegrityReport | null;
  onChanged: () => Promise<void>;
}) {
  const [pending, setPending] = useState<Action | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function run(action: Action, work: () => Promise<string>) {
    setPending(action);
    setOutcome(null);
    let result: Outcome;
    try {
      result = { tone: "success", text: await work() };
    } catch (error) {
      result = { tone: "error", text: describeError(error) };
    }
    await onChanged();
    setOutcome(result);
    setPending(null);
  }

  const scan = () =>
    run("scan", async () => {
      await dataClient.integrity.scan.mutate();
      return "Scan finished.";
    });
  const quarantine = (names: string[]) =>
    run("quarantine", async () => {
      const { quarantined, skipped } =
        await dataClient.integrity.quarantine.mutate({ names });
      await dataClient.integrity.scan.mutate();
      const moved = `Moved ${plural(quarantined.length, "file")} to quarantine.`;
      return skipped.length === 0
        ? moved
        : `${moved} Skipped ${plural(skipped.length, "file")} that are referenced again or already quarantined.`;
    });
  const purge = (names: string[]) =>
    run("purge", async () => {
      const { purged } = await dataClient.integrity.purge.mutate({ names });
      await dataClient.integrity.scan.mutate();
      return `Deleted ${plural(purged.length, "quarantined file")}.`;
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrity</CardTitle>
        <CardDescription>
          {report ? (
            <>
              Last scanned <LocalTime iso={report.scannedAt} />.
            </>
          ) : (
            "No scan since the app started."
          )}
        </CardDescription>
        <CardAction>
          <Button
            size="sm"
            disabled={pending !== null}
            onClick={() => void scan()}
          >
            {pending === "scan" ? (
              <LoaderCircle className="animate-spin" aria-hidden />
            ) : null}
            Scan now
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
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
        {report ? (
          <IntegrityFindings
            report={report}
            pending={pending}
            onQuarantine={(names) => void quarantine(names)}
            onPurge={(names) => void purge(names)}
          />
        ) : (
          <p className="text-muted-foreground">
            A scan checks the database for corruption and broken relationships,
            and re-reads every stored file.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function IntegrityFindings({
  report,
  pending,
  onQuarantine,
  onPurge,
}: {
  report: IntegrityReport;
  pending: Action | null;
  onQuarantine: (names: string[]) => void;
  onPurge: (names: string[]) => void;
}) {
  const { database, files } = report;
  const violations = database.foreignKeyViolations;
  const unreferencedNames = files.unreferenced.map((file) => file.name);
  const quarantinedNames = files.quarantined.map((file) => file.name);
  return (
    <ul className="space-y-4">
      <Check
        tone={database.problems.length === 0 ? "ok" : "problem"}
        title={
          database.problems.length === 0
            ? "Database structure is intact"
            : `Database has ${plural(database.problems.length, "problem")}`
        }
      >
        {database.problems.length > 0 ? (
          <>
            <Details items={database.problems} />
            <p>Restore the newest verified backup.</p>
          </>
        ) : null}
      </Check>
      <Check
        tone={violations.count === 0 ? "ok" : "problem"}
        title={
          violations.count === 0
            ? "Every relationship is intact"
            : plural(violations.count, "broken relationship")
        }
      >
        {violations.count > 0 ? (
          <Details
            items={violations.first.map((violation) =>
              violation.rowid === null
                ? `A row in ${violation.table} points to a missing row in ${violation.parent}`
                : `Row ${violation.rowid} in ${violation.table} points to a missing row in ${violation.parent}`,
            )}
            more={violations.count - violations.first.length}
          />
        ) : null}
      </Check>
      <Check
        tone={
          files.missing.length + files.checksumMismatches.length === 0
            ? "ok"
            : "problem"
        }
        title={`${plural(files.checked, "file")} read${
          files.checksumsRecorded > 0
            ? `, ${plural(files.checksumsRecorded, "checksum")} recorded`
            : ""
        }`}
      >
        {files.missing.length > 0 ? (
          <FindingList
            title={`${plural(files.missing.length, "file")} missing on disk`}
            findings={files.missing}
          />
        ) : null}
        {files.checksumMismatches.length > 0 ? (
          <FindingList
            title={`${plural(files.checksumMismatches.length, "file")} changed since upload`}
            findings={files.checksumMismatches}
          />
        ) : null}
        {files.missing.length + files.checksumMismatches.length > 0 ? (
          <p>
            Restore the newest verified backup, or copy the file out of a backup
            archive and scan again.
          </p>
        ) : null}
      </Check>
      <Check
        tone={files.unreferenced.length === 0 ? "ok" : "warning"}
        title={
          files.unreferenced.length === 0
            ? "Every stored file is in use"
            : `${plural(files.unreferenced.length, "file")} not used by any record`
        }
      >
        {files.unreferenced.length > 0 ? (
          <>
            <FileList
              files={files.unreferenced.map((file) => ({
                name: file.name,
                label: file.file?.originalFilename ?? file.name,
                detail: file.file
                  ? `${file.file.endpoint} · ${formatBytes(file.sizeBytes)}`
                  : `No file record · ${formatBytes(file.sizeBytes)}`,
              }))}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={pending !== null}
              onClick={() => onQuarantine(unreferencedNames)}
            >
              {pending === "quarantine" ? (
                <LoaderCircle className="animate-spin" aria-hidden />
              ) : null}
              Move to quarantine
            </Button>
          </>
        ) : null}
      </Check>
      {files.quarantined.length > 0 ? (
        <Check
          tone="warning"
          title={`${plural(files.quarantined.length, "file")} in quarantine`}
        >
          <FileList
            files={files.quarantined.map((file) => ({
              name: file.name,
              label: file.originalFilename ?? file.name,
              detail: formatBytes(file.sizeBytes),
            }))}
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={pending !== null}>
                {pending === "purge" ? (
                  <LoaderCircle className="animate-spin" aria-hidden />
                ) : null}
                Delete quarantined files
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete quarantined files?</AlertDialogTitle>
                <AlertDialogDescription>
                  {plural(files.quarantined.length, "file")} will be deleted
                  permanently. Backups made before they were quarantined still
                  hold a copy.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onPurge(quarantinedNames)}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Check>
      ) : null}
    </ul>
  );
}

const checkIcons = {
  ok: <CircleCheck className="text-muted-foreground" aria-hidden />,
  warning: <TriangleAlert className="text-amber-600" aria-hidden />,
  problem: <CircleAlert className="text-destructive" aria-hidden />,
};

function Check({
  tone,
  title,
  children,
}: {
  tone: keyof typeof checkIcons;
  title: string;
  children?: ReactNode;
}) {
  return (
    <li className="flex gap-3 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0">
      {checkIcons[tone]}
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-medium">{title}</p>
        {children}
      </div>
    </li>
  );
}

function Details({ items, more = 0 }: { items: string[]; more?: number }) {
  return (
    <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-xs">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
      {more > 0 ? <li>and {more} more</li> : null}
    </ul>
  );
}

function FindingList({
  title,
  findings,
}: {
  title: string;
  findings: FileFinding[];
}) {
  return (
    <div className="space-y-2">
      <p className="text-destructive">{title}</p>
      <FileList
        files={findings.map((finding) => ({
          name: finding.storageKey,
          label: finding.originalFilename,
          detail: [
            finding.endpoint,
            ...finding.referencedBy.map((ref) => `${ref.table} ${ref.key}`),
          ].join(" · "),
        }))}
      />
    </div>
  );
}

function FileList({
  files,
}: {
  files: { name: string; label: string; detail: string }[];
}) {
  return (
    <ul className="divide-y rounded-lg border">
      {files.map((file) => (
        <li key={file.name} className="px-3 py-2">
          <p className="truncate">{file.label}</p>
          <p className="text-muted-foreground text-xs break-all">
            {file.detail}
          </p>
        </li>
      ))}
    </ul>
  );
}
