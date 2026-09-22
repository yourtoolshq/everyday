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
  MAX_TAX_DOCUMENT_ATTACHMENT_BYTES,
  taxDocumentStatuses,
  taxDocumentStatusLabels,
  taxDocumentTypes,
  taxDocumentTypeLabels,
  type TaxDocumentStatus,
  type TaxDocumentType,
} from "~/domain/tax-document";
import { api, type RouterOutputs } from "~/trpc/react";

type TaxItem = {
  id: number;
  name: string;
  ownerKind: "household" | "person";
  personId: number | null;
  personName: string | null;
};
type TaxDocument = RouterOutputs["taxDocument"]["list"]["items"][number];
type Person = RouterOutputs["settings"]["get"]["people"][number];

export function TaxDocumentFormSheet({
  item,
  document,
  people,
  open,
  onOpenChange,
}: {
  item: TaxItem;
  document: TaxDocument | null;
  people: Person[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const [type, setType] = useState<TaxDocumentType>(document?.type ?? "t4");
  const [customTypeName, setCustomTypeName] = useState(
    document?.customTypeName ?? "",
  );
  const [issuer, setIssuer] = useState(document?.issuer ?? "");
  const [personId, setPersonId] = useState(
    String(document?.personId ?? item.personId ?? "none"),
  );
  const [status, setStatus] = useState<TaxDocumentStatus>(
    document?.status ?? "expected",
  );
  const [notes, setNotes] = useState(document?.notes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (type === "other" && !customTypeName.trim()) {
      toast.error("Enter a document type.");
      return;
    }
    if (!issuer.trim()) {
      toast.error("Enter the issuer.");
      return;
    }
    if (file && file.size > MAX_TAX_DOCUMENT_ATTACHMENT_BYTES) {
      toast.error("Attachment must be 20 MB or smaller.");
      return;
    }

    const form = new FormData();
    if (!document) form.set("taxItemId", String(item.id));
    form.set("type", type);
    form.set("customTypeName", type === "other" ? customTypeName : "");
    form.set("issuer", issuer);
    form.set(
      "personId",
      item.ownerKind === "person"
        ? String(item.personId)
        : personId === "none"
          ? ""
          : personId,
    );
    form.set("notes", notes);
    if (document) {
      form.set("status", status);
      form.set(
        "attachmentAction",
        file ? "replace" : removeAttachment ? "remove" : "keep",
      );
    }
    if (file) form.set("attachment", file);

    setPending(true);
    try {
      const response = await fetch(
        document ? `/api/tax-documents/${document.id}` : "/api/tax-documents",
        {
          method: document ? "PUT" : "POST",
          body: form,
        },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to save the Tax Document.");
      }
      await Promise.all([
        utils.taxDocument.list.invalidate(),
        utils.taxDocument.overview.invalidate(),
        utils.taxItem.get.invalidate({ id: item.id }),
      ]);
      toast.success(
        document ? "Tax Document updated." : "Tax Document added.",
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save the Tax Document.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <form className="flex min-h-full flex-col" onSubmit={save}>
          <SheetHeader>
            <SheetTitle>
              {document ? "Edit Tax Document" : "Add Tax Document"}
            </SheetTitle>
            <SheetDescription>
              {document
                ? `Update the document attached to ${item.name}.`
                : `Track an official document expected for ${item.name}.`}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="space-y-2">
              <Label>Tax Item</Label>
              <Input value={item.name} disabled />
            </div>
            <div className="space-y-2">
              <Label>Document type</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as TaxDocumentType)}
              >
                <SelectTrigger aria-label="Document type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {taxDocumentTypes.map((value) => (
                    <SelectItem key={value} value={value}>
                      {taxDocumentTypeLabels[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {type === "other" ? (
              <div className="space-y-2">
                <Label htmlFor="tax-document-custom-type">Custom type</Label>
                <Input
                  id="tax-document-custom-type"
                  maxLength={100}
                  placeholder="e.g. T4A"
                  value={customTypeName}
                  onChange={(event) => setCustomTypeName(event.target.value)}
                  required
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="tax-document-issuer">Issuer</Label>
              <Input
                id="tax-document-issuer"
                maxLength={200}
                placeholder="e.g. Employer or financial institution"
                value={issuer}
                onChange={(event) => setIssuer(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Person</Label>
              {item.ownerKind === "person" ? (
                <Input value={item.personName ?? ""} disabled />
              ) : (
                <Select value={personId} onValueChange={setPersonId}>
                  <SelectTrigger aria-label="Tax Document person">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific person</SelectItem>
                    {people.map((person) => (
                      <SelectItem key={person.id} value={String(person.id)}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {document ? (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(value) =>
                    setStatus(value as TaxDocumentStatus)
                  }
                >
                  <SelectTrigger aria-label="Tax Document status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {taxDocumentStatuses.map((value) => (
                      <SelectItem key={value} value={value}>
                        {taxDocumentStatusLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="tax-document-notes">Notes</Label>
              <Textarea
                id="tax-document-notes"
                rows={5}
                maxLength={4000}
                placeholder="Optional context about this document"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {notes.length.toLocaleString()} / 4,000
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax-document-attachment">Attachment</Label>
              {document?.attachmentFileName && !removeAttachment ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="truncate">
                    {document.attachmentFileName}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRemoveAttachment(true);
                      setFile(null);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : null}
              <Input
                id="tax-document-attachment"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setRemoveAttachment(false);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Optional PDF or image, up to 20 MB. Adding a file to an
                Expected document marks it Received.
              </p>
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
            <Button disabled={pending}>
              {pending
                ? "Saving…"
                : document
                  ? "Save changes"
                  : "Add Tax Document"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
