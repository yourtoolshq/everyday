"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

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
  craReferenceCategories,
  craReferenceCategoryLabels,
  MAX_CRA_REFERENCE_ATTACHMENT_BYTES,
  type CraReferenceCategory,
} from "~/domain/cra-reference";
import { api, type RouterOutputs } from "~/trpc/react";

type Person = RouterOutputs["settings"]["get"]["people"][number];
type CraReferenceDocument =
  RouterOutputs["craReference"]["list"]["items"][number];

export function CraReferenceSheet({
  taxYearId,
  people,
  document,
  open,
  onOpenChange,
  onSaved,
}: {
  taxYearId: number;
  people: Person[];
  document: CraReferenceDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [category, setCategory] = useState<CraReferenceCategory>(
    document?.category ?? "gst_hst_return",
  );
  const [title, setTitle] = useState(document?.title ?? "");
  const [personId, setPersonId] = useState(
    String(document?.personId ?? "none"),
  );
  const [documentDate, setDocumentDate] = useState(document?.documentDate ?? "");
  const [reportingPeriodLabel, setReportingPeriodLabel] = useState(
    document?.reportingPeriodLabel ?? "",
  );
  const [notes, setNotes] = useState(document?.notes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      toast.error("Enter a title.");
      return;
    }
    if (file && file.size > MAX_CRA_REFERENCE_ATTACHMENT_BYTES) {
      toast.error("Attachment must be 20 MB or smaller.");
      return;
    }

    const form = new FormData();
    if (!document) form.set("taxYearId", String(taxYearId));
    form.set("category", category);
    form.set("title", title.trim());
    form.set("personId", personId === "none" ? "" : personId);
    form.set("documentDate", documentDate);
    form.set("reportingPeriodLabel", reportingPeriodLabel);
    form.set("notes", notes);
    if (document) {
      form.set(
        "attachmentAction",
        file ? "replace" : removeAttachment ? "remove" : "keep",
      );
    }
    if (file) form.set("attachment", file);

    setPending(true);
    try {
      const response = await fetch(
        document
          ? `/api/cra-reference-documents/${document.id}`
          : "/api/cra-reference-documents",
        { method: document ? "PUT" : "POST", body: form },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to save the CRA reference document.");
      }
      toast.success(document ? "CRA reference document updated." : "CRA reference document added.");
      onOpenChange(false);
      await onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save the CRA reference document.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <form className="flex min-h-full flex-col" onSubmit={save}>
          <SheetHeader>
            <SheetTitle>
              {document ? "Edit CRA reference document" : "Add CRA reference document"}
            </SheetTitle>
            <SheetDescription>
              Retain GST/HST returns, Canada Carbon Rebate notices, and other CRA material for this tax year.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="cra-category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as CraReferenceCategory)}
              >
                <SelectTrigger id="cra-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {craReferenceCategories.map((value) => (
                    <SelectItem key={value} value={value}>
                      {craReferenceCategoryLabels[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cra-title">Title</Label>
              <Input
                id="cra-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cra-person">Person</Label>
              <Select value={personId} onValueChange={setPersonId}>
                <SelectTrigger id="cra-person">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Household / unspecified</SelectItem>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={String(person.id)}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cra-document-date">Document date</Label>
              <Input
                id="cra-document-date"
                type="date"
                value={documentDate}
                onChange={(event) => setDocumentDate(event.target.value)}
              />
            </div>
            {category === "gst_hst_return" ? (
              <div className="space-y-2">
                <Label htmlFor="cra-reporting-period">Reporting period</Label>
                <Input
                  id="cra-reporting-period"
                  placeholder="e.g. Jan 1 – Mar 31, 2023"
                  value={reportingPeriodLabel}
                  onChange={(event) => setReportingPeriodLabel(event.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="cra-attachment">Attachment</Label>
              <Input
                id="cra-attachment"
                type="file"
                accept=".pdf,image/jpeg,image/png,image/heic,image/heif"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              {document?.attachmentFileName ? (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={removeAttachment}
                    onChange={(event) => setRemoveAttachment(event.target.checked)}
                  />
                  Remove {document.attachmentFileName}
                </label>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cra-notes">Notes</Label>
              <Textarea
                id="cra-notes"
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
            <Button disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
