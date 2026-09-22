"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  accountDocumentTypes,
  documentTypeLabels,
  type AccountDocumentType,
} from "~/lib/documents";
import { deriveAllUploadablePeriods } from "~/lib/expected-periods";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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

type Document = RouterOutputs["documents"]["overview"][number];
type Account = RouterOutputs["accounts"]["list"][number];

type DocumentEditSheetProps = {
  document: Document;
  account?: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DocumentEditSheet({
  document,
  account,
  open,
  onOpenChange,
}: DocumentEditSheetProps) {
  const utils = api.useUtils();
  const isStatement = document.type === "statement";
  const [type, setType] = useState<AccountDocumentType>(
    document.type === "statement" ? "other" : document.type,
  );
  const [title, setTitle] = useState(document.title);
  const [periodKey, setPeriodKey] = useState(document.periodKey ?? "");
  const [documentDate, setDocumentDate] = useState(document.documentDate ?? "");
  const [notes, setNotes] = useState(document.notes ?? "");

  const uploadablePeriods = useMemo(() => {
    if (!isStatement || !account) return [];
    return deriveAllUploadablePeriods(
      {
        openedDate: account.openedDate,
        closedDate: account.closedDate,
        status: account.status,
      },
      account.statementFrequency,
    );
  }, [account, isStatement]);

  const periodsByYear = useMemo(() => {
    const grouped = new Map<number, typeof uploadablePeriods>();
    for (const period of uploadablePeriods) {
      const current = grouped.get(period.year) ?? [];
      current.push(period);
      grouped.set(period.year, current);
    }
    return [...grouped.entries()].sort(([left], [right]) => right - left);
  }, [uploadablePeriods]);

  useEffect(() => {
    if (!open) return;
    setType(document.type === "statement" ? "other" : document.type);
    setTitle(document.title);
    setPeriodKey(document.periodKey ?? "");
    setDocumentDate(document.documentDate ?? "");
    setNotes(document.notes ?? "");
  }, [document, open]);

  const updateDocument = api.documents.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.documents.overview.invalidate(),
        utils.documents.statementDocumentsByAccount.invalidate(),
      ]);
      toast.success("Document updated.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isStatement) {
      if (!periodKey) {
        toast.error("Choose a statement period.");
        return;
      }
      updateDocument.mutate({
        id: document.id,
        type: "statement",
        title,
        periodKey,
        documentDate: documentDate || null,
        notes: notes || null,
      });
      return;
    }

    updateDocument.mutate({
      id: document.id,
      type,
      title,
      documentDate: documentDate || null,
      notes: notes || null,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <form className="flex min-h-full flex-col" onSubmit={submit}>
          <SheetHeader>
            <SheetTitle>{isStatement ? "Edit statement" : "Edit document"}</SheetTitle>
            <SheetDescription>
              {isStatement
                ? "Update the title, period, date, or notes for this statement."
                : "Update the title, type, date, or notes for this record."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-4 py-6">
            {!isStatement ? (
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
                    {accountDocumentTypes.map((item) => (
                      <SelectItem key={item} value={item}>
                        {documentTypeLabels[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {isStatement ? (
              <div className="space-y-2">
                <Label>Statement period</Label>
                <Select value={periodKey} onValueChange={setPeriodKey}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose period" />
                  </SelectTrigger>
                  <SelectContent>
                    {periodsByYear.map(([year, periods]) => (
                      <SelectGroup key={year}>
                        <SelectLabel>{year}</SelectLabel>
                        {periods.map((period) => (
                          <SelectItem key={period.key} value={period.key}>
                            {period.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

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
