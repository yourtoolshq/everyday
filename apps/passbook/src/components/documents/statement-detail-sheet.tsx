"use client";

import { ExternalLink, Pencil, Trash2 } from "lucide-react";

import { useDeleteDocumentDialog } from "~/components/documents/delete-document-dialog";
import { formatFileSize } from "~/lib/documents";
import { formatDateLabel } from "~/lib/format-date";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import type { RouterOutputs } from "~/trpc/react";

type Document = RouterOutputs["documents"]["overview"][number];

type StatementDetailSheetProps = {
  document: Document;
  periodLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
};

export function StatementDetailSheet({
  document,
  periodLabel,
  open,
  onOpenChange,
  onEdit,
}: StatementDetailSheetProps) {
  const { requestDelete, dialog } = useDeleteDocumentDialog(() => onOpenChange(false));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{document.title}</DialogTitle>
            <DialogDescription>{periodLabel}</DialogDescription>
          </DialogHeader>

          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">File</dt>
              <dd className="text-right">{document.originalFilename}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Size</dt>
              <dd>{formatFileSize(document.sizeBytes)}</dd>
            </div>
            {document.documentDate ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Date</dt>
                <dd>{formatDateLabel(document.documentDate)}</dd>
              </div>
            ) : null}
            {document.notes ? (
              <div className="space-y-1">
                <dt className="text-muted-foreground">Notes</dt>
                <dd>{document.notes}</dd>
              </div>
            ) : null}
          </dl>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => requestDelete({ id: document.id, title: document.title })}
            >
              <Trash2 />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onEdit}>
                <Pencil />
                Edit
              </Button>
              <Button asChild>
                <a
                  href={`/api/documents/${document.id}/file`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink />
                  Open
                </a>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {dialog}
    </>
  );
}
