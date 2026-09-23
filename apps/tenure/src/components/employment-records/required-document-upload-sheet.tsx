"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { RequiredDocumentKind } from "~/lib/employment-document-suggestions";
import type { RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { documentTypeLabels } from "~/lib/documents";
import {
  canSuggestRequiredDocumentTitle,
  suggestRequiredDocumentDate,
  suggestRequiredDocumentTitle,
  suggestRequiredDocumentType,
} from "~/lib/employment-document-suggestions";
import { uploadEmploymentDocument } from "~/lib/upload-employment-document";
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
  const updateChange = api.compensationChanges.update.useMutation();
  const [file, setFile] = useState<File | null>(null);
  const [documentDate, setDocumentDate] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [uploading, setUploading] = useState(false);

  const documentType = kind ? suggestRequiredDocumentType(kind) : "other";

  const suggestedTitle = useMemo(() => {
    if (!kind || !canSuggestRequiredDocumentTitle({ file, documentDate }))
      return "";
    return suggestRequiredDocumentTitle({
      kind,
      employerName,
      personName,
      documentDate,
      compensationChange: compensationChange ?? null,
    });
  }, [compensationChange, documentDate, employerName, file, kind, personName]);

  useEffect(() => {
    if (!open) return;
    setFile(null);
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
  }, [compensationChange, kind, open]);

  useEffect(() => {
    if (!open || titleTouched || !suggestedTitle) return;
    setTitle(suggestedTitle);
  }, [open, suggestedTitle, titleTouched]);

  async function submitUpload() {
    if (!kind || !file) {
      toast.error("Choose a file to upload.");
      return;
    }

    setUploading(true);
    try {
      const uploaded = (await uploadEmploymentDocument({
        employmentId,
        file,
        type: documentType,
        title: title.trim() || suggestedTitle,
        documentDate: documentDate.trim() || null,
      })) as { id: string };

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
          documentId: uploaded.id,
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
            <Input
              id="required-document-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,message/rfc822,.pdf,.jpg,.jpeg,.png,.webp,.heic,.eml"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="required-document-date">Document date</Label>
            <Input
              id="required-document-date"
              type="date"
              value={documentDate}
              onChange={(event) => setDocumentDate(event.target.value)}
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
                canSuggestRequiredDocumentTitle({ file, documentDate })
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
            <Button type="submit" disabled={uploading || !kind}>
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
