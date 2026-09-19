"use client";

import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  documentTypes,
  documentTypeLabels,
  type DocumentType,
} from "~/lib/documents";
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
import { api, type RouterOutputs } from "~/trpc/react";

type Document = RouterOutputs["documents"]["listByEmployment"][number];

type DocumentEditSheetProps = {
  document: Document;
  employmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DocumentEditSheet({
  document,
  employmentId,
  open,
  onOpenChange,
}: DocumentEditSheetProps) {
  const utils = api.useUtils();
  const discussions = api.discussions.listByEmployment.useQuery({ employmentId }, { enabled: open });
  const [type, setType] = useState<DocumentType>(document.type);
  const [title, setTitle] = useState(document.title);
  const [documentDate, setDocumentDate] = useState(document.documentDate ?? "");
  const [notes, setNotes] = useState(document.notes ?? "");
  const [discussionId, setDiscussionId] = useState<string>(document.discussionId ?? "none");

  useEffect(() => {
    if (!open) return;
    setType(document.type);
    setTitle(document.title);
    setDocumentDate(document.documentDate ?? "");
    setNotes(document.notes ?? "");
    setDiscussionId(document.discussionId ?? "none");
  }, [document, open]);

  const updateDocument = api.documents.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.documents.listByEmployment.invalidate({ employmentId }),
        utils.discussions.listByEmployment.invalidate({ employmentId }),
      ]);
      toast.success("Document updated.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateDocument.mutate({
      id: document.id,
      type,
      title,
      documentDate: documentDate || null,
      notes: notes || null,
      discussionId: discussionId === "none" ? null : discussionId,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <form className="flex min-h-full flex-col" onSubmit={submit}>
          <SheetHeader>
            <SheetTitle>Edit document</SheetTitle>
            <SheetDescription>
              Update the title, type, date, linked discussion, or notes for this record.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-4 py-6">
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
              <Label htmlFor="edit-document-title">Title</Label>
              <Input
                id="edit-document-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-document-date">Document date</Label>
              <Input
                id="edit-document-date"
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
              <Label htmlFor="edit-document-notes">Notes</Label>
              <Textarea
                id="edit-document-notes"
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
            <Button type="submit" disabled={updateDocument.isPending}>
              {updateDocument.isPending ? "Saving…" : "Save changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
