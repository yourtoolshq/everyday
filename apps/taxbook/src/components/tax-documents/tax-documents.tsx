"use client";

import { useState } from "react";
import Link from "next/link";
import {
  IconCircleCheck,
  IconClock,
  IconDownload,
  IconExternalLink,
  IconFileDescription,
  IconPencil,
} from "@tabler/icons-react";
import { toast } from "sonner";

import type { TaxDocumentStatus } from "~/domain/tax-document";
import type { RouterOutputs } from "~/trpc/react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import {
  buildTaxDocumentReadiness,
  taxDocumentDisplayType,
  taxDocumentStatuses,
  taxDocumentStatusLabels,
} from "~/domain/tax-document";
import { api } from "~/trpc/react";
import { TaxDocumentFormSheet } from "./tax-document-form-sheet";

type TaxDocument = RouterOutputs["taxDocument"]["list"]["items"][number];

const groups: Array<{
  status: TaxDocumentStatus;
  title: string;
  description: string;
}> = [
  {
    status: "expected",
    title: "Waiting",
    description: "Official documents that have not arrived yet.",
  },
  {
    status: "received",
    title: "Needs review",
    description: "Documents received but not yet checked.",
  },
  {
    status: "ready",
    title: "Ready",
    description: "Checked and ready to use for filing.",
  },
  {
    status: "used",
    title: "Used",
    description: "Documents already used in the filing workflow.",
  },
];

function documentFormData(document: TaxDocument, status: TaxDocumentStatus) {
  const form = new FormData();
  form.set("type", document.type);
  form.set("customTypeName", document.customTypeName ?? "");
  form.set("issuer", document.issuer);
  form.set("personId", document.personId ? String(document.personId) : "");
  form.set("notes", document.notes ?? "");
  form.set("status", status);
  form.set("attachmentAction", "keep");
  return form;
}

export function TaxDocuments() {
  const utils = api.useUtils();
  const documents = api.taxDocument.list.useQuery();
  const settings = api.settings.get.useQuery();
  const [editing, setEditing] = useState<TaxDocument | null>(null);
  const [deleting, setDeleting] = useState<TaxDocument | null>(null);
  const [pendingStatusId, setPendingStatusId] = useState<number | null>(null);
  const [deletingPending, setDeletingPending] = useState(false);

  async function refresh() {
    await Promise.all([
      utils.taxDocument.list.invalidate(),
      utils.taxDocument.overview.invalidate(),
    ]);
  }

  async function changeStatus(
    document: TaxDocument,
    status: TaxDocumentStatus,
  ) {
    setPendingStatusId(document.id);
    try {
      const response = await fetch(`/api/tax-documents/${document.id}`, {
        method: "PUT",
        body: documentFormData(document, status),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Unable to update the Tax Document.");
      await refresh();
      toast.success(`Tax Document marked ${taxDocumentStatusLabels[status]}.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update the Tax Document.",
      );
    } finally {
      setPendingStatusId(null);
    }
  }

  async function removeDocument() {
    if (!deleting) return;
    setDeletingPending(true);
    try {
      const response = await fetch(`/api/tax-documents/${deleting.id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Unable to delete the Tax Document.");
      setDeleting(null);
      await refresh();
      toast.success("Tax Document deleted.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to delete the Tax Document.",
      );
    } finally {
      setDeletingPending(false);
    }
  }

  if (documents.isLoading || settings.isLoading) {
    return (
      <div className="space-y-5 p-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const error = documents.error ?? settings.error;
  if (error || !documents.data || !settings.data) {
    return (
      <div className="text-destructive p-6 text-sm">
        Unable to load Tax Documents. {error?.message}
      </div>
    );
  }

  const readiness = buildTaxDocumentReadiness(documents.data.items);
  const readinessMessage =
    readiness.total === 0
      ? "No tax documents tracked"
      : readiness.isReady
        ? "All tracked documents are ready"
        : `${readiness.counts.expected} waiting · ${readiness.counts.received} need review`;

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-primary text-sm font-medium">
            {documents.data.year.year} tax year
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            Tax Documents
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            See what is still expected and what is ready for filing.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/items">Manage Tax Items</Link>
        </Button>
      </div>

      <Card
        className={
          readiness.isReady
            ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/40"
            : undefined
        }
      >
        <CardContent className="flex flex-wrap items-center gap-3">
          <span className="bg-background flex size-10 items-center justify-center rounded-full">
            {readiness.isReady ? (
              <IconCircleCheck className="size-5 text-emerald-600" />
            ) : (
              <IconClock className="text-primary size-5" />
            )}
          </span>
          <div>
            <p className="font-medium">{readinessMessage}</p>
            <p className="text-muted-foreground text-sm">
              {readiness.total.toLocaleString()} tracked{" "}
              {readiness.total === 1 ? "document" : "documents"} for this year
            </p>
          </div>
        </CardContent>
      </Card>

      {documents.data.items.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-64 flex-col items-center justify-center text-center">
            <IconFileDescription className="text-muted-foreground mb-3 size-9" />
            <p className="font-medium">No Tax Documents tracked</p>
            <p className="text-muted-foreground mt-1 max-w-md text-sm">
              Open a Tax Item to add the first official document you expect for
              this tax year.
            </p>
            <Button className="mt-4" asChild>
              <Link href="/items">Open Tax Items</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          {groups.map((group) => {
            const items = documents.data.items.filter(
              (document) => document.status === group.status,
            );
            return (
              <Card key={group.status}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">{group.title}</CardTitle>
                    <Badge variant="secondary">{items.length}</Badge>
                  </div>
                  <CardDescription>{group.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
                      No documents in this group.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {items.map((document) => (
                        <div
                          key={document.id}
                          className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-48 flex-1">
                            <p className="font-medium">
                              {taxDocumentDisplayType(document)}
                            </p>
                            <p className="text-muted-foreground text-sm">
                              {document.issuer} ·{" "}
                              <Link
                                className="hover:text-primary hover:underline"
                                href={`/items/${document.taxItemId}`}
                              >
                                {document.taxItemName}
                              </Link>
                              {document.personName
                                ? ` · ${document.personName}`
                                : ""}
                            </p>
                          </div>
                          {document.attachmentFileName ? (
                            <div className="flex items-center gap-1">
                              <Button asChild variant="ghost" size="icon">
                                <a
                                  aria-label={`Open ${document.attachmentFileName}`}
                                  href={`/api/tax-documents/${document.id}/attachment`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <IconExternalLink />
                                </a>
                              </Button>
                              <Button asChild variant="ghost" size="icon">
                                <a
                                  aria-label={`Download ${document.attachmentFileName}`}
                                  href={`/api/tax-documents/${document.id}/attachment?download=1`}
                                >
                                  <IconDownload />
                                </a>
                              </Button>
                            </div>
                          ) : null}
                          <Select
                            value={document.status}
                            disabled={pendingStatusId === document.id}
                            onValueChange={(value) =>
                              void changeStatus(
                                document,
                                value as TaxDocumentStatus,
                              )
                            }
                          >
                            <SelectTrigger
                              className="w-40"
                              aria-label={`Status for ${taxDocumentDisplayType(document)} from ${document.issuer}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {taxDocumentStatuses.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {taxDocumentStatusLabels[status]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${taxDocumentDisplayType(document)} from ${document.issuer}`}
                            onClick={() => setEditing(document)}
                          >
                            <IconPencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => setDeleting(document)}
                          >
                            Delete
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editing ? (
        <TaxDocumentFormSheet
          key={editing.id}
          item={{
            id: editing.taxItemId,
            name: editing.taxItemName,
            ownerKind: editing.taxItemOwnerKind,
            personId:
              editing.taxItemOwnerKind === "person" ? editing.personId : null,
            personName:
              editing.taxItemOwnerKind === "person" ? editing.personName : null,
          }}
          document={editing}
          people={settings.data.people}
          open
          onOpenChange={(open) => !open && setEditing(null)}
        />
      ) : null}

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Tax Document?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting ? taxDocumentDisplayType(deleting) : ""}” from{" "}
              {deleting?.issuer} and its attachment will be permanently removed.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              disabled={deletingPending}
              onClick={() => void removeDocument()}
            >
              {deletingPending ? "Deleting…" : "Delete Tax Document"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
