"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { toast } from "sonner";

import type { RouterOutputs } from "~/trpc/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
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
import { centsToDollars, dollarsToCents, formatCad } from "~/domain/money";
import { MAX_ATTACHMENT_BYTES } from "~/domain/record";
import { api } from "~/trpc/react";

type TaxItem = RouterOutputs["taxItem"]["get"]["item"];
type RecordItem = RouterOutputs["record"]["list"]["items"][number];
type Person = RouterOutputs["settings"]["get"]["people"][number];

export function RecordFormSheet({
  item,
  record,
  people,
  open,
  onOpenChange,
}: {
  item: TaxItem;
  record: RecordItem | null;
  people: Person[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const [date, setDate] = useState(record?.date ?? "");
  const [description, setDescription] = useState(record?.description ?? "");
  const [amount, setAmount] = useState(
    centsToDollars(record?.amountCents ?? null),
  );
  const [personId, setPersonId] = useState(
    String(record?.personId ?? item.personId ?? "none"),
  );
  const [notes, setNotes] = useState(record?.notes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const replacesManualAmount =
    record === null &&
    item.valueSource === "manual" &&
    item.actualAmountCents !== null;

  async function save(confirmReplaceActual: boolean) {
    const amountCents = dollarsToCents(amount);
    if (amountCents === null || amountCents <= 0) {
      toast.error("Amount must be greater than zero.");
      return;
    }
    if (file && file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("Attachment must be 20 MB or smaller.");
      return;
    }
    const form = new FormData();
    if (!record) form.set("taxItemId", String(item.id));
    form.set("date", date);
    form.set("description", description);
    form.set("amountCents", String(amountCents));
    form.set(
      "personId",
      item.ownerKind === "person"
        ? String(item.personId)
        : personId === "none"
          ? ""
          : personId,
    );
    form.set("notes", notes);
    if (!record) form.set("confirmReplaceActual", String(confirmReplaceActual));
    if (file) form.set("attachment", file);
    if (record) {
      form.set(
        "attachmentAction",
        file ? "replace" : removeAttachment ? "remove" : "keep",
      );
    }

    setPending(true);
    try {
      const response = await fetch(
        record ? `/api/records/${record.id}` : "/api/records",
        {
          method: record ? "PUT" : "POST",
          body: form,
        },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Unable to save the Record.");
      await Promise.all([
        utils.record.list.invalidate({ taxItemId: item.id }),
        utils.taxItem.get.invalidate({ id: item.id }),
        utils.taxItem.list.invalidate(),
        utils.taxItem.overview.invalidate(),
        utils.taxEstimate.get.invalidate(),
      ]);
      toast.success(record ? "Record updated." : "Record added.");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save the Record.",
      );
    } finally {
      setPending(false);
      setConfirmOpen(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (replacesManualAmount) setConfirmOpen(true);
    else void save(false);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <form className="flex min-h-full flex-col" onSubmit={submit}>
            <SheetHeader>
              <SheetTitle>{record ? "Edit Record" : "Add Record"}</SheetTitle>
              <SheetDescription>
                The amount will count toward this Tax Item’s actual total.
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-6 px-4 py-6">
              <div className="space-y-2">
                <Label htmlFor="record-date">Date</Label>
                <Input
                  id="record-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  required
                />
                <p className="text-muted-foreground text-xs">
                  The date may fall outside the selected calendar year.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="record-description">Description</Label>
                <Input
                  id="record-description"
                  maxLength={200}
                  placeholder="e.g. Dental appointment"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="record-amount">Amount counted</Label>
                <div className="relative">
                  <span className="text-muted-foreground absolute top-2.5 left-3 text-sm">
                    $
                  </span>
                  <Input
                    id="record-amount"
                    className="pl-7 tabular-nums"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    required
                  />
                </div>
                <p className="text-muted-foreground text-xs">
                  Enter the amount that should be included in the Tax Item
                  total.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Person</Label>
                {item.ownerKind === "person" ? (
                  <Input value={item.personName ?? ""} disabled />
                ) : (
                  <Select value={personId} onValueChange={setPersonId}>
                    <SelectTrigger aria-label="Record person">
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
              <div className="space-y-2">
                <Label htmlFor="record-notes">Notes</Label>
                <Textarea
                  id="record-notes"
                  rows={5}
                  maxLength={4000}
                  placeholder="Optional reimbursement or eligibility context"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  {notes.length.toLocaleString()} / 4,000
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="record-attachment">Attachment</Label>
                {record?.attachmentFileName && !removeAttachment ? (
                  <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="truncate">
                      {record.attachmentFileName}
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
                  id="record-attachment"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setRemoveAttachment(false);
                  }}
                />
                <p className="text-muted-foreground text-xs">
                  Optional PDF or image, up to 20 MB. Choosing a file replaces
                  the current attachment.
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
                {pending ? "Saving…" : record ? "Save changes" : "Add Record"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Use Records for the actual amount?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The current actual amount of {formatCad(item.actualAmountCents)}{" "}
              will be replaced. From then on, this Tax Item’s actual amount will
              equal the sum of its Records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => void save(true)}
            >
              {pending ? "Saving…" : "Replace and add Record"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
