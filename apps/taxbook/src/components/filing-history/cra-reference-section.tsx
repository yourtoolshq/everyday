"use client";

import { useState } from "react";
import {
  IconDownload,
  IconExternalLink,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";

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
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { craReferenceCategoryLabels } from "~/domain/cra-reference";
import { api } from "~/trpc/react";
import { CraReferenceSheet } from "./cra-reference-sheet";

type Person = RouterOutputs["settings"]["get"]["people"][number];
type CraReferenceDocument =
  RouterOutputs["craReference"]["list"]["items"][number];

export function CraReferenceSection({
  taxYearId,
  people,
}: {
  taxYearId: number;
  people: Person[];
}) {
  const documents = api.craReference.list.useQuery({ taxYearId });
  const utils = api.useUtils();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CraReferenceDocument | null>(null);
  const [deleting, setDeleting] = useState<CraReferenceDocument | null>(null);
  const [deletingPending, setDeletingPending] = useState(false);

  async function refresh() {
    await utils.craReference.list.invalidate({ taxYearId });
  }

  async function removeDocument() {
    if (!deleting) return;
    setDeletingPending(true);
    try {
      const response = await fetch(
        `/api/cra-reference-documents/${deleting.id}`,
        {
          method: "DELETE",
        },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          result.error ?? "Unable to delete the CRA reference document.",
        );
      }
      setDeleting(null);
      await refresh();
      toast.success("CRA reference document deleted.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to delete the CRA reference document.",
      );
    } finally {
      setDeletingPending(false);
    }
  }

  const items = documents.data?.items ?? [];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">CRA reference documents</h3>
          <p className="text-muted-foreground text-sm">
            GST/HST returns, Canada Carbon Rebate notices, and other CRA
            material for this year.
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          Add document <IconPlus />
        </Button>
      </div>

      {documents.isLoading ? (
        <p className="text-muted-foreground text-sm">
          Loading CRA reference documents…
        </p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-sm">
          No CRA reference documents recorded for this year yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Reporting period</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((document) => (
                <TableRow key={document.id}>
                  <TableCell>
                    {craReferenceCategoryLabels[document.category]}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium">{document.title}</p>
                      {document.documentDate ? (
                        <p className="text-muted-foreground text-xs">
                          {document.documentDate}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{document.personName ?? "—"}</TableCell>
                  <TableCell>{document.reportingPeriodLabel ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {document.attachmentFileName ? (
                        <>
                          <Button asChild size="sm" variant="outline">
                            <a
                              href={`/api/cra-reference-documents/${document.id}/attachment`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View <IconExternalLink />
                            </a>
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <a
                              href={`/api/cra-reference-documents/${document.id}/attachment?download=1`}
                            >
                              Download <IconDownload />
                            </a>
                          </Button>
                        </>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(document)}
                      >
                        Edit <IconPencil />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeleting(document)}
                      >
                        Delete <IconTrash />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CraReferenceSheet
        key={editing ? `edit-${editing.id}` : adding ? "add" : "closed"}
        taxYearId={taxYearId}
        people={people}
        document={editing}
        open={adding || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(false);
            setEditing(null);
          }
        }}
        onSaved={refresh}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete CRA reference document?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {deleting?.title} from the retained CRA material for
              this tax year.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingPending}
              onClick={removeDocument}
            >
              {deletingPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
