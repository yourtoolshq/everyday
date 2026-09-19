"use client";

import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  documentTypes,
  documentTypeLabels,
  titleFromFilename,
  type DocumentType,
} from "~/lib/documents";
import { uploadEmploymentDocument } from "~/lib/upload-employment-document";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";

type EmploymentDocumentUploadSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employmentId: string;
  defaultDiscussionId?: string | null;
};

export function EmploymentDocumentUploadSheet({
  open,
  onOpenChange,
  employmentId,
  defaultDiscussionId,
}: EmploymentDocumentUploadSheetProps) {
  const utils = api.useUtils();
  const discussions = api.discussions.listByEmployment.useQuery({ employmentId }, { enabled: open });
  const [type, setType] = useState<DocumentType>("other");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [documentDate, setDocumentDate] = useState("");
  const [notes, setNotes] = useState("");
  const [discussionId, setDiscussionId] = useState<string>("none");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType("other");
    setFile(null);
    setTitle("");
    setTitleTouched(false);
    setDocumentDate("");
    setNotes("");
    setDiscussionId(defaultDiscussionId ?? "none");
  }, [defaultDiscussionId, open]);

  useEffect(() => {
    if (!file || titleTouched) return;
    setTitle(titleFromFilename(file.name));
  }, [file, titleTouched]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      toast.error("Choose a file to upload.");
      return;
    }

    setUploading(true);
    try {
      await uploadEmploymentDocument({
        employmentId,
        file,
        type,
        title,
        documentDate: documentDate || null,
        notes,
        discussionId: discussionId === "none" ? null : discussionId,
      });
      await Promise.all([
        utils.documents.listByEmployment.invalidate({ employmentId }),
        utils.discussions.listByEmployment.invalidate({ employmentId }),
      ]);
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
              Add a contract, offer letter, exported email, or other employment record.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="employment-document-file">File</Label>
              <Input
                id="employment-document-file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,message/rfc822,.pdf,.jpg,.jpeg,.png,.webp,.heic,.eml"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                required
              />
              <p className="text-xs text-muted-foreground">
                PDF, JPEG, PNG, WebP, HEIC, or EML up to 25 MB.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Document type</Label>
              <Select value={type} onValueChange={(value) => setType(value as DocumentType)}>
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
              <Input
                id="employment-document-date"
                type="date"
                value={documentDate}
                onChange={(event) => setDocumentDate(event.target.value)}
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploading}>
              {uploading ? "Uploading…" : "Save document"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
