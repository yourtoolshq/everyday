"use client";

import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  accountDocumentTypes,
  documentTypeLabels,
  suggestDocumentTitle,
  type AccountDocumentType,
} from "~/lib/documents";
import { uploadAccountDocument } from "~/lib/upload-account-document";
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

type AccountDocumentUploadSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  defaultType?: AccountDocumentType;
};

export function AccountDocumentUploadSheet({
  open,
  onOpenChange,
  accountId,
  defaultType = "other",
}: AccountDocumentUploadSheetProps) {
  const utils = api.useUtils();
  const account = api.accounts.get.useQuery({ id: accountId });
  const [type, setType] = useState<AccountDocumentType>(defaultType);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [documentDate, setDocumentDate] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(defaultType);
    setFile(null);
    setTitle("");
    setTitleTouched(false);
    setDocumentDate("");
    setNotes("");
  }, [defaultType, open]);

  useEffect(() => {
    if (!open || titleTouched || !account.data) return;
    setTitle(
      suggestDocumentTitle({
        type,
        accountDisplayName: account.data.displayName,
        documentDate,
      }),
    );
  }, [account.data, documentDate, open, titleTouched, type]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      toast.error("Choose a file to upload.");
      return;
    }

    setUploading(true);
    try {
      await uploadAccountDocument({
        accountId,
        file,
        type,
        title,
        documentDate: documentDate || null,
        notes,
      });
      await utils.documents.overview.invalidate();
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
              Add an agreement, notice, or other record to this account.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="account-document-file">File</Label>
              <Input
                id="account-document-file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,.pdf,.jpg,.jpeg,.png,.webp,.heic"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                required
              />
              <p className="text-xs text-muted-foreground">
                PDF, JPEG, PNG, WebP, or HEIC up to 25 MB.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Document type</Label>
              <Select value={type} onValueChange={(value) => setType(value as AccountDocumentType)}>
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
              <Label htmlFor="account-document-title">Title</Label>
              <Input
                id="account-document-title"
                value={title}
                onChange={(event) => {
                  setTitleTouched(true);
                  setTitle(event.target.value);
                }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-document-date">Document date</Label>
              <Input
                id="account-document-date"
                type="date"
                value={documentDate}
                onChange={(event) => setDocumentDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-document-notes">Notes</Label>
              <Textarea
                id="account-document-notes"
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
