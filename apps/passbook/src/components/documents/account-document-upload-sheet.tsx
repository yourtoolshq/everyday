"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
  accountDocumentTypes,
  defaultDocumentTitle,
  documentTypeLabels,
  usesSuggestedDocumentTitle,
} from "~/lib/documents";
import { FileDropzone, useUpload } from "~/lib/uploads";
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
  const createDocument = api.documents.create.useMutation();
  const fileUpload = useUpload("document");
  const file = fileUpload.source;
  const resetUpload = fileUpload.reset;
  const account = api.accounts.get.useQuery({ id: accountId });
  const uploadableTypes = useMemo(
    () =>
      account.data?.accountType === "chequing"
        ? accountDocumentTypes
        : accountDocumentTypes.filter((item) => item !== "void_cheque"),
    [account.data?.accountType],
  );
  const [type, setType] = useState<AccountDocumentType>(defaultType);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [documentDate, setDocumentDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(defaultType);
    resetUpload();
    setTitle("");
    setTitleTouched(false);
    setDocumentDate("");
    setNotes("");
  }, [defaultType, open, resetUpload]);

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
    const uploaded = fileUpload.file;
    if (!uploaded) {
      toast.error("Choose a file to upload.");
      return;
    }

    setSaving(true);
    try {
      await createDocument.mutateAsync({
        accountId,
        file: uploaded.token,
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
      setSaving(false);
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
              <FileDropzone
                id="account-document-file"
                upload={fileUpload}
                accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,.pdf,.jpg,.jpeg,.png,.webp,.heic"
              />
              <p className="text-muted-foreground text-xs">
                PDF, JPEG, PNG, WebP, or HEIC up to 25 MB.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Document type</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as AccountDocumentType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {uploadableTypes.map((item) => (
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
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || fileUpload.status === "uploading"}
            >
              {saving ? "Saving…" : "Save document"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
