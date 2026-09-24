"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { AccountEventType } from "~/lib/account-events";
import type { AccountDocumentType } from "~/lib/documents";
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
import {
  activityAttachmentDocumentType,
  defaultActivityDocumentType,
} from "~/lib/account-events";
import {
  accountDocumentTypes,
  defaultDocumentTitle,
  documentTypeLabels,
  usesSuggestedDocumentTitle,
} from "~/lib/documents";
import { uploadFile } from "~/lib/uploads";
import { api } from "~/trpc/react";

type ActivityDocumentUploadSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  eventId: string;
  activityType: AccountEventType;
  defaultDocumentDate?: string;
};

export function ActivityDocumentUploadSheet({
  open,
  onOpenChange,
  accountId,
  eventId,
  activityType,
  defaultDocumentDate = "",
}: ActivityDocumentUploadSheetProps) {
  const utils = api.useUtils();
  const createDocument = api.documents.create.useMutation();
  const account = api.accounts.get.useQuery(
    { id: accountId },
    { enabled: open },
  );
  const [type, setType] = useState<AccountDocumentType>(
    defaultActivityDocumentType(activityType),
  );
  const [typeTouched, setTypeTouched] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [documentDate, setDocumentDate] = useState(defaultDocumentDate);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(defaultActivityDocumentType(activityType));
    setTypeTouched(false);
    setFile(null);
    setTitle("");
    setTitleTouched(false);
    setDocumentDate(defaultDocumentDate);
    setNotes("");
  }, [activityType, defaultDocumentDate, open]);

  useEffect(() => {
    if (!file || typeTouched) return;
    setType(activityAttachmentDocumentType(activityType, file));
  }, [activityType, file, typeTouched]);

  useEffect(() => {
    if (
      !open ||
      titleTouched ||
      !account.data ||
      !usesSuggestedDocumentTitle(type)
    )
      return;
    setTitle(
      defaultDocumentTitle({
        type,
        accountDisplayName: account.data.displayName,
        documentDate,
        filename: file?.name,
      }),
    );
  }, [account.data, documentDate, file, open, titleTouched, type]);

  useEffect(() => {
    if (!file || titleTouched || !account.data) return;
    setTitle(
      defaultDocumentTitle({
        type,
        accountDisplayName: account.data.displayName,
        documentDate,
        filename: file.name,
      }),
    );
  }, [account.data, documentDate, file, titleTouched, type]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      toast.error("Choose a file to upload.");
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadFile("document", file);
      await createDocument.mutateAsync({
        accountId,
        eventId,
        file: uploaded.token,
        type,
        title,
        documentDate: documentDate || null,
        notes,
      });
      await Promise.all([
        utils.accountEvents.invalidate(),
        utils.documents.invalidate(),
      ]);
      toast.success("Document added to activity.");
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
            <SheetTitle>Add document</SheetTitle>
            <SheetDescription>
              Attach a file to this activity with its type, title, and date.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="activity-document-file">File</Label>
              <Input
                id="activity-document-file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,.pdf,.jpg,.jpeg,.png,.webp,.heic,.eml,message/rfc822,audio/mpeg,audio/mp4,audio/wav,audio/ogg,.mp3,.m4a,.wav,.ogg"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                required
              />
              <p className="text-muted-foreground text-xs">
                PDF, images, .eml, or common audio files up to 25 MB.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Document type</Label>
              <Select
                value={type}
                onValueChange={(value) => {
                  setTypeTouched(true);
                  setType(value as AccountDocumentType);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accountDocumentTypes.map((item) => (
                    <SelectItem key={item} value={item}>
                      {documentTypeLabels[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="activity-document-title">Title</Label>
              <Input
                id="activity-document-title"
                value={title}
                onChange={(event) => {
                  setTitleTouched(true);
                  setTitle(event.target.value);
                }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="activity-document-date">Document date</Label>
              <Input
                id="activity-document-date"
                type="date"
                value={documentDate}
                onChange={(event) => setDocumentDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="activity-document-notes">Notes</Label>
              <Textarea
                id="activity-document-notes"
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
            <Button type="submit" disabled={uploading}>
              {uploading ? "Uploading…" : "Save document"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
