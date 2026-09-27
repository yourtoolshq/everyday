"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@yourtoolshq/ui/button";
import { DateField } from "@yourtoolshq/ui/date-field";
import { Input } from "@yourtoolshq/ui/input";
import { Label } from "@yourtoolshq/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@yourtoolshq/ui/sheet";

import type { RequiredDocumentKind } from "~/lib/employment-document-suggestions";
import type { RouterOutputs } from "~/trpc/react";
import { documentAccept, documentTypeLabels } from "~/lib/documents";
import {
  canSuggestRequiredDocumentTitle,
  suggestRequiredDocumentDate,
  suggestRequiredDocumentTitle,
  suggestRequiredDocumentType,
} from "~/lib/employment-document-suggestions";
import { FileDropzone, useUpload } from "~/lib/uploads";
import { api } from "~/trpc/react";

type CompensationChange =
  RouterOutputs["compensationChanges"]["listByEmployment"][number];

type RequiredDocumentUploadSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employmentId: string;
  employerName: string;
  personName: string;
  kind: RequiredDocumentKind | null;
  compensationChange?: CompensationChange | null;
};

function sheetTitle(kind: RequiredDocumentKind | null) {
  if (kind === "offer_letter") return "Upload offer letter";
  if (kind === "compensation_change") return "Upload supporting document";
  return "Upload document";
}

function sheetDescription(kind: RequiredDocumentKind | null) {
  if (kind === "offer_letter") {
    return "Choose a file and enter the document date. The title is suggested once both are set.";
  }
  if (kind === "compensation_change") {
    return "Choose a file and confirm the date. The title is suggested once both are set and the document is linked automatically.";
  }
  return "Upload an employment record.";
}

export function RequiredDocumentUploadSheet({
  open,
  onOpenChange,
  employmentId,
  employerName,
  personName,
  kind,
  compensationChange,
}: RequiredDocumentUploadSheetProps) {
  const utils = api.useUtils();
  const createDocument = api.documents.create.useMutation();
  const updateChange = api.compensationChanges.update.useMutation();
  const fileUpload = useUpload("document");
  const resetUpload = fileUpload.reset;
  const [documentDate, setDocumentDate] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [uploading, setUploading] = useState(false);

  const documentType = kind ? suggestRequiredDocumentType(kind) : "other";

  const suggestedTitle = useMemo(() => {
    if (
      !kind ||
      !canSuggestRequiredDocumentTitle({
        hasFile: fileUpload.source !== null,
        documentDate,
      })
    )
      return "";
    return suggestRequiredDocumentTitle({
      kind,
      employerName,
      personName,
      documentDate,
      compensationChange: compensationChange ?? null,
    });
  }, [
    compensationChange,
    documentDate,
    employerName,
    fileUpload.source,
    kind,
    personName,
  ]);

  useEffect(() => {
    if (!open) return;
    resetUpload();
    setTitle("");
    setTitleTouched(false);
    setDocumentDate(
      kind
        ? suggestRequiredDocumentDate({
            kind,
            compensationChange: compensationChange ?? null,
          })
        : "",
    );
  }, [compensationChange, kind, open, resetUpload]);

  useEffect(() => {
    if (!open || titleTouched || !suggestedTitle) return;
    setTitle(suggestedTitle);
  }, [open, suggestedTitle, titleTouched]);

  async function submitUpload() {
    const uploaded = fileUpload.file;
    if (!kind || !uploaded) {
      toast.error("Choose a file to upload.");
      return;
    }

    setUploading(true);
    try {
      const created = await createDocument.mutateAsync({
        employmentId,
        file: uploaded.token,
        type: documentType,
        title: title.trim() || suggestedTitle,
        documentDate: documentDate.trim() || null,
      });

      if (kind === "compensation_change" && compensationChange) {
        await updateChange.mutateAsync({
          id: compensationChange.id,
          type: compensationChange.type,
          currency: compensationChange.currency,
          effectiveDate: compensationChange.effectiveDate,
          amountCents: compensationChange.amountCents,
          commissionBasisPoints: compensationChange.commissionBasisPoints,
          notes: compensationChange.notes,
          discussionId: compensationChange.discussionId,
          documentId: created.id,
        });
      }

      await Promise.all([
        utils.documents.listByEmployment.invalidate({ employmentId }),
        utils.employmentRecords.completenessByEmployment.invalidate({
          employmentId,
        }),
        utils.employmentRecords.listForReview.invalidate(),
        utils.compensationChanges.listByEmployment.invalidate({ employmentId }),
        utils.compensationChanges.getCurrentByEmployment.invalidate({
          employmentId,
        }),
        utils.employments.list.invalidate(),
      ]);

      toast.success(
        kind === "compensation_change"
          ? "Supporting document uploaded and linked."
          : `${documentTypeLabels[documentType]} uploaded.`,
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{sheetTitle(kind)}</SheetTitle>
          <SheetDescription>{sheetDescription(kind)}</SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-1 flex-col gap-4 px-4 pb-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitUpload();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="required-document-file">File</Label>
            <FileDropzone
              id="required-document-file"
              upload={fileUpload}
              accept={documentAccept}
            />
            <p className="text-muted-foreground text-xs">
              PDF, JPEG, PNG, WebP, HEIC, or EML up to 25 MB.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="required-document-date">Document date</Label>
            <DateField
              id="required-document-date"
              value={documentDate}
              onChange={(value) => setDocumentDate(value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="required-document-title">Title</Label>
            <Input
              id="required-document-title"
              value={title}
              onChange={(event) => {
                setTitleTouched(true);
                setTitle(event.target.value);
              }}
              placeholder={
                canSuggestRequiredDocumentTitle({
                  hasFile: fileUpload.source !== null,
                  documentDate,
                })
                  ? undefined
                  : "Choose a file and date to suggest a title"
              }
              required
            />
            <p className="text-muted-foreground text-xs">
              Suggested from the date, employer, and record type once a file and
              date are set. You can edit it before uploading.
            </p>
          </div>

          {kind ? (
            <p className="text-muted-foreground text-sm">
              Will save as {documentTypeLabels[documentType]}
            </p>
          ) : null}

          <SheetFooter className="px-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={uploading || !kind || fileUpload.status === "uploading"}
            >
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
