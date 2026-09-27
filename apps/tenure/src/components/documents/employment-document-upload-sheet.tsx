"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@yourtoolshq/ui/button";
import { DateField } from "@yourtoolshq/ui/date-field";
import { Input } from "@yourtoolshq/ui/input";
import { Label } from "@yourtoolshq/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@yourtoolshq/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@yourtoolshq/ui/sheet";
import { Textarea } from "@yourtoolshq/ui/textarea";

import type { DocumentType } from "~/lib/documents";
import {
  documentAccept,
  documentTypeLabels,
  documentTypes,
  titleFromFilename,
} from "~/lib/documents";
import { FileDropzone, useUpload } from "~/lib/uploads";
import { api } from "~/trpc/react";

type EmploymentDocumentUploadSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employmentId: string;
  defaultDiscussionId?: string | null;
  defaultType?: DocumentType;
  onUploaded?: () => void | Promise<void>;
};

export function EmploymentDocumentUploadSheet({
  open,
  onOpenChange,
  employmentId,
  defaultDiscussionId,
  defaultType,
  onUploaded,
}: EmploymentDocumentUploadSheetProps) {
  const utils = api.useUtils();
  const createDocument = api.documents.create.useMutation();
  const fileUpload = useUpload("document");
  const resetUpload = fileUpload.reset;
  const discussions = api.discussions.listByEmployment.useQuery(
    { employmentId },
    { enabled: open },
  );
  const [type, setType] = useState<DocumentType>("other");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [documentDate, setDocumentDate] = useState("");
  const [notes, setNotes] = useState("");
  const [discussionId, setDiscussionId] = useState<string>("none");
  const [uploading, setUploading] = useState(false);
  const pickedFile = fileUpload.source;

  useEffect(() => {
    if (!open) return;
    setType(defaultType ?? "other");
    resetUpload();
    setTitle("");
    setTitleTouched(false);
    setDocumentDate("");
    setNotes("");
    setDiscussionId(defaultDiscussionId ?? "none");
  }, [defaultDiscussionId, defaultType, open, resetUpload]);

  useEffect(() => {
    if (!pickedFile || titleTouched) return;
    setTitle(titleFromFilename(pickedFile.name));
  }, [pickedFile, titleTouched]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const uploaded = fileUpload.file;
    if (!uploaded) {
      toast.error("Choose a file to upload.");
      return;
    }

    setUploading(true);
    try {
      await createDocument.mutateAsync({
        employmentId,
        file: uploaded.token,
        type,
        title,
        documentDate: documentDate || null,
        notes,
        discussionId: discussionId === "none" ? null : discussionId,
      });
      await Promise.all([
        utils.documents.listByEmployment.invalidate({ employmentId }),
        utils.discussions.listByEmployment.invalidate({ employmentId }),
        utils.employmentRecords.completenessByEmployment.invalidate({
          employmentId,
        }),
        utils.employmentRecords.listForReview.invalidate(),
      ]);
      await onUploaded?.();
      toast.success("Document uploaded.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <form className="flex min-h-full flex-col" onSubmit={submit}>
          <SheetHeader>
            <SheetTitle>Upload document</SheetTitle>
            <SheetDescription>
              Add a contract, offer letter, exported email, or other employment
              record.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="employment-document-file">File</Label>
              <FileDropzone
                id="employment-document-file"
                upload={fileUpload}
                accept={documentAccept}
              />
              <p className="text-muted-foreground text-xs">
                PDF, JPEG, PNG, WebP, HEIC, or EML up to 25 MB.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Document type</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as DocumentType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((item) => (
                    <SelectItem key={item} value={item}>
                      {documentTypeLabels[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employment-document-title">Title</Label>
              <Input
                id="employment-document-title"
                value={title}
                onChange={(event) => {
                  setTitleTouched(true);
                  setTitle(event.target.value);
                }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employment-document-date">Document date</Label>
              <DateField
                id="employment-document-date"
                value={documentDate}
                onChange={(value) => setDocumentDate(value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Related discussion</Label>
              <Select value={discussionId} onValueChange={setDiscussionId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {discussions.data?.map((discussion) => (
                    <SelectItem key={discussion.id} value={discussion.id}>
                      {discussion.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employment-document-notes">Notes</Label>
              <Textarea
                id="employment-document-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
              />
            </div>
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={uploading || fileUpload.status === "uploading"}
            >
              {uploading ? "Uploading…" : "Save document"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
