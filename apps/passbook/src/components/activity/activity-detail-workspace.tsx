"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { FilePreview } from "@yourtoolshq/data-ui";

import type { AccountEventType } from "~/lib/account-events";
import type { DocumentType } from "~/lib/documents";
import { AccountEventSheet } from "~/components/accounts/account-event-sheet";
import { AccountTermsSnapshotDetailSheet } from "~/components/accounts/account-terms-snapshot-detail-sheet";
import { ActivityDocumentUploadSheet } from "~/components/activity/activity-document-upload-sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { accountEventTypeLabels } from "~/lib/account-events";
import {
  accountTermsFieldLabels,
  listAccountTermsEntries,
} from "~/lib/account-terms";
import { documentTypeLabels, formatFileSize } from "~/lib/documents";
import { formatDateLabel } from "~/lib/format-date";
import { formatTermValue } from "~/lib/format-term-value";
import { api } from "~/trpc/react";

export function ActivityDetailWorkspace({ eventId }: { eventId: string }) {
  const router = useRouter();
  const utils = api.useUtils();
  const event = api.accountEvents.get.useQuery({ id: eventId });
  const snapshots = api.accountTerms.listSnapshots.useQuery(
    { accountId: event.data?.accountId ?? "" },
    { enabled: Boolean(event.data?.termsSnapshotId) },
  );

  const [editOpen, setEditOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [snapshotDetailOpen, setSnapshotDetailOpen] = useState(false);

  const deleteEvent = api.accountEvents.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.accountEvents.invalidate(),
        utils.documents.invalidate(),
      ]);
      toast.success("Activity deleted.");
      router.push("/activity");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteDocument = api.documents.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.accountEvents.invalidate(),
        utils.documents.invalidate(),
      ]);
      toast.success("Document removed.");
    },
    onError: (error) => toast.error(error.message),
  });

  if (event.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (event.error || !event.data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/activity">
            <ArrowLeft />
            Activity
          </Link>
        </Button>
        <p className="text-destructive text-sm">
          {event.error?.message ?? "Activity not found."}
        </p>
      </div>
    );
  }

  const linkedSnapshot = (snapshots.data ?? []).find(
    (snapshot) => snapshot.id === event.data.termsSnapshotId,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/activity">
            <ArrowLeft />
            Activity
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-primary text-sm font-medium">
              {event.data.institutionName}
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">
              {event.data.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {accountEventTypeLabels[event.data.type as AccountEventType]}
              </Badge>
              {event.data.resolvedDate ? (
                <Badge variant="outline">Resolved</Badge>
              ) : null}
            </div>
          </div>
          <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <span>
              <span className="text-foreground">Account</span>{" "}
              <Link
                href={`/accounts/${event.data.accountId}`}
                className="text-primary hover:underline"
              >
                {event.data.accountName}
              </Link>
            </span>
            <span>
              <span className="text-foreground">Started</span>{" "}
              {formatDateLabel(event.data.startDate) ?? event.data.startDate}
            </span>
            {event.data.resolvedDate ? (
              <span>
                <span className="text-foreground">Resolved</span>{" "}
                {formatDateLabel(event.data.resolvedDate) ??
                  event.data.resolvedDate}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil />
            Edit
          </Button>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 />
            Delete
          </Button>
        </div>
      </div>

      <Card className="shadow-none">
        <CardContent className="space-y-6 p-4">
          {event.data.notes ? (
            <div className="space-y-2">
              <h3 className="font-medium">Notes</h3>
              <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                {event.data.notes}
              </p>
            </div>
          ) : null}

          {linkedSnapshot ? (
            <>
              {event.data.notes ? <Separator /> : null}
              <div className="space-y-3">
                <div className="space-y-1">
                  <h3 className="font-medium">Linked terms change</h3>
                  <p className="text-muted-foreground text-sm">
                    Recorded when this activity was created. Edit the terms from
                    a new activity rather than changing this snapshot
                    separately.
                  </p>
                </div>
                <p className="text-muted-foreground text-sm">
                  Effective{" "}
                  {formatDateLabel(linkedSnapshot.effectiveDate) ??
                    linkedSnapshot.effectiveDate}
                </p>
                {linkedSnapshot.notes ? (
                  <p className="text-muted-foreground text-sm">
                    {linkedSnapshot.notes}
                  </p>
                ) : null}
                <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {listAccountTermsEntries(linkedSnapshot.terms).map(
                    (entry) => (
                      <span key={entry.field}>
                        {accountTermsFieldLabels[entry.field]}:{" "}
                        <span className="text-foreground">
                          {formatTermValue(entry.field, entry.value)}
                        </span>
                      </span>
                    ),
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSnapshotDetailOpen(true)}
                >
                  View in terms history
                </Button>
              </div>
            </>
          ) : null}

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium">Documents</h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setUploadOpen(true)}
              >
                <Plus />
                Add document
              </Button>
            </div>
            {event.data.documents.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No documents yet. Add agreements, notices, or saved email
                copies.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {event.data.documents.map((document) => (
                  <li
                    key={document.id}
                    className="flex items-start justify-between gap-3 p-3 text-sm"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{document.title}</p>
                        <Badge variant="secondary">
                          {documentTypeLabels[document.type as DocumentType]}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {formatDateLabel(document.documentDate) ?? "No date"}
                        {" · "}
                        {document.originalFilename}
                        {" · "}
                        {formatFileSize(document.sizeBytes)}
                      </p>
                      {document.notes ? (
                        <p className="text-muted-foreground text-xs">
                          {document.notes}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon-sm" asChild>
                        <FilePreview
                          file={{
                            id: document.fileId,
                            mimeType: document.mimeType,
                          }}
                          aria-label={`Open ${document.title}`}
                        >
                          <ExternalLink />
                        </FilePreview>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${document.title}`}
                        onClick={() =>
                          deleteDocument.mutate({ id: document.id })
                        }
                        disabled={deleteDocument.isPending}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {uploadOpen ? (
        <ActivityDocumentUploadSheet
          accountId={event.data.accountId}
          eventId={event.data.id}
          activityType={event.data.type as AccountEventType}
          defaultDocumentDate={event.data.startDate}
          open={uploadOpen}
          onOpenChange={(nextOpen) => {
            setUploadOpen(nextOpen);
            if (!nextOpen) void utils.accountEvents.invalidate();
          }}
        />
      ) : null}

      {editOpen ? (
        <AccountEventSheet
          key={event.data.id}
          accountId={event.data.accountId}
          event={event.data}
          open={editOpen}
          onOpenChange={(nextOpen) => {
            setEditOpen(nextOpen);
            if (!nextOpen) void utils.accountEvents.invalidate();
          }}
        />
      ) : null}

      {snapshotDetailOpen && linkedSnapshot ? (
        <AccountTermsSnapshotDetailSheet
          accountId={event.data.accountId}
          snapshot={linkedSnapshot}
          open={snapshotDetailOpen}
          onOpenChange={setSnapshotDetailOpen}
        />
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete activity?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{event.data.title}&quot; and its attachments will be removed
              permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteEvent.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteEvent.isPending}
              onClick={(clickEvent) => {
                clickEvent.preventDefault();
                deleteEvent.mutate({ id: event.data.id });
              }}
            >
              {deleteEvent.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
