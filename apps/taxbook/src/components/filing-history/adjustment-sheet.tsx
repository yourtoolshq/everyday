"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { toast } from "sonner";

import type { FilingStatus, ReturnCopyStatus } from "~/domain/filing";
import type { RouterOutputs } from "~/trpc/react";
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
  filingStatuses,
  filingStatusLabels,
  MAX_FILING_ATTACHMENT_BYTES,
  returnCopyStatuses,
  returnCopyStatusLabels,
} from "~/domain/filing";
import { signedDollarsToCents } from "~/domain/money";
import { api } from "~/trpc/react";

type Person = RouterOutputs["settings"]["get"]["people"][number];
type Filing = RouterOutputs["filing"]["timeline"]["filings"][number];
type TaxItem = RouterOutputs["taxItem"]["list"]["items"][number];

function changeCents(direction: string, amount: string) {
  const cents = signedDollarsToCents(amount);
  if (cents === null) return null;
  if (direction === "decrease_refund") return -Math.abs(cents);
  return Math.abs(cents);
}

function changeFields(cents: number | null) {
  if (cents === null) return { direction: "none", amount: "" };
  if (cents < 0) {
    return {
      direction: "decrease_refund",
      amount: (Math.abs(cents) / 100).toFixed(2),
    };
  }
  return { direction: "increase_refund", amount: (cents / 100).toFixed(2) };
}

export function AdjustmentSheet({
  taxYearId,
  people,
  filing,
  defaultPersonId,
  open,
  onOpenChange,
  onSaved,
}: {
  taxYearId: number;
  people: Person[];
  filing: Filing | null;
  defaultPersonId?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const taxItems = api.taxItem.list.useQuery(undefined, { enabled: open });
  const initialChange = changeFields(filing?.expectedChangeCents ?? null);
  const [personId, setPersonId] = useState(
    String(filing?.personId ?? defaultPersonId ?? people[0]?.id ?? ""),
  );
  const [reason, setReason] = useState(filing?.reason ?? "");
  const [submissionDate, setSubmissionDate] = useState(
    filing?.submissionDate ?? "",
  );
  const [changeDirection, setChangeDirection] = useState(
    initialChange.direction,
  );
  const [changeAmount, setChangeAmount] = useState(initialChange.amount);
  const [returnCopyStatus, setReturnCopyStatus] = useState<ReturnCopyStatus>(
    filing?.returnCopyStatus ?? "unavailable",
  );
  const [status, setStatus] = useState<FilingStatus>(
    filing?.status ?? "preparing",
  );
  const [notes, setNotes] = useState(filing?.notes ?? "");
  const [selectedTaxItemIds, setSelectedTaxItemIds] = useState<number[]>(
    filing?.affectedTaxItems.map((item) => item.id) ?? [],
  );
  const [file, setFile] = useState<File | null>(null);
  const [markUnavailable, setMarkUnavailable] = useState(false);
  const [pending, setPending] = useState(false);

  function toggleTaxItem(taxItemId: number, checked: boolean) {
    setSelectedTaxItemIds((current) =>
      checked
        ? [...current, taxItemId]
        : current.filter((id) => id !== taxItemId),
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!filing && !personId) {
      toast.error("Choose a household member.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Enter a reason for the adjustment.");
      return;
    }
    if (file && file.size > MAX_FILING_ATTACHMENT_BYTES) {
      toast.error("Attachment must be 20 MB or smaller.");
      return;
    }
    if (changeDirection !== "none" && changeAmount.trim() === "") {
      toast.error("Enter the expected change, or choose Unknown.");
      return;
    }
    if (
      changeDirection !== "none" &&
      signedDollarsToCents(changeAmount) === null
    ) {
      toast.error("Enter a valid amount for the expected change.");
      return;
    }
    if (
      (status === "submitted" || status === "assessed") &&
      !file &&
      returnCopyStatus === "not_added_yet"
    ) {
      toast.error(
        "Attach the submitted adjustment or mark it unavailable before marking it submitted.",
      );
      return;
    }

    const expectedChangeCents =
      changeDirection === "none"
        ? null
        : changeCents(changeDirection, changeAmount);

    const form = new FormData();
    if (!filing) {
      form.set("taxYearId", String(taxYearId));
      form.set("personId", personId);
    }
    form.set("reason", reason);
    form.set("submissionDate", submissionDate);
    form.set(
      "expectedChangeCents",
      expectedChangeCents === null ? "" : String(expectedChangeCents),
    );
    form.set("returnCopyStatus", file ? "attached" : returnCopyStatus);
    form.set("notes", notes);
    for (const taxItemId of selectedTaxItemIds) {
      form.append("affectedTaxItemIds", String(taxItemId));
    }
    if (filing) {
      form.set("status", status);
      form.set(
        "attachmentAction",
        file ? "replace" : markUnavailable ? "unavailable" : "keep",
      );
    }
    if (file) form.set("attachment", file);

    setPending(true);
    try {
      const response = await fetch(
        filing ? `/api/adjustments/${filing.id}` : "/api/adjustments",
        { method: filing ? "PUT" : "POST", body: form },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to save the adjustment.");
      }
      toast.success(filing ? "Adjustment updated." : "Adjustment added.");
      onOpenChange(false);
      await onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save the adjustment.",
      );
    } finally {
      setPending(false);
    }
  }

  const selectedPersonId = filing?.personId ?? Number(personId);
  const availableItems = (taxItems.data?.items ?? []).filter(
    (item) =>
      item.ownerKind === "household" || item.personId === selectedPersonId,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <form className="flex min-h-full flex-col" onSubmit={save}>
          <SheetHeader>
            <SheetTitle>
              {filing ? "Edit adjustment" : "Add adjustment"}
            </SheetTitle>
            <SheetDescription>
              Record a correction to a previously filed return and the expected
              change to the tax result.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-6 px-4 py-6">
            {!filing ? (
              <div className="space-y-2">
                <Label htmlFor="adjustment-person">Person</Label>
                <Select value={personId} onValueChange={setPersonId}>
                  <SelectTrigger id="adjustment-person">
                    <SelectValue placeholder="Choose a person" />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((person) => (
                      <SelectItem key={person.id} value={String(person.id)}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="adjustment-reason">Reason</Label>
              <Textarea
                id="adjustment-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjustment-date">Submission date</Label>
              <Input
                id="adjustment-date"
                type="date"
                value={submissionDate}
                onChange={(event) => setSubmissionDate(event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="adjustment-change-direction">
                  Expected change
                </Label>
                <Select
                  value={changeDirection}
                  onValueChange={setChangeDirection}
                >
                  <SelectTrigger id="adjustment-change-direction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unknown</SelectItem>
                    <SelectItem value="increase_refund">
                      Increase refund
                    </SelectItem>
                    <SelectItem value="decrease_refund">
                      Reduce refund / increase owing
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjustment-change-amount">Amount</Label>
                <Input
                  id="adjustment-change-amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={changeAmount}
                  disabled={changeDirection === "none"}
                  onChange={(event) => setChangeAmount(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label>Affected tax items</Label>
              {availableItems.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No tax items in this year yet. You can still describe the
                  change in the reason field.
                </p>
              ) : (
                <div className="space-y-2 rounded-lg border p-3">
                  {availableItems.map((item: TaxItem) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTaxItemIds.includes(item.id)}
                        onChange={(event) =>
                          toggleTaxItem(item.id, event.target.checked)
                        }
                      />
                      <span>{item.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {!file && !filing?.attachmentFileName ? (
              <div className="space-y-2">
                <Label htmlFor="adjustment-copy-status">
                  Submitted adjustment
                </Label>
                <Select
                  value={returnCopyStatus}
                  onValueChange={(value) =>
                    setReturnCopyStatus(value as ReturnCopyStatus)
                  }
                >
                  <SelectTrigger id="adjustment-copy-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {returnCopyStatuses.map((value) => (
                      <SelectItem key={value} value={value}>
                        {returnCopyStatusLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {filing ? (
              <div className="space-y-2">
                <Label htmlFor="adjustment-status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(value) => setStatus(value as FilingStatus)}
                >
                  <SelectTrigger id="adjustment-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filingStatuses.map((value) => (
                      <SelectItem key={value} value={value}>
                        {filingStatusLabels[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="adjustment-attachment">
                Adjustment attachment
              </Label>
              <Input
                id="adjustment-attachment"
                type="file"
                accept=".pdf,image/jpeg,image/png,image/heic,image/heif"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              {filing?.attachmentFileName ? (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <span>{filing.attachmentFileName}</span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={markUnavailable}
                      onChange={(event) =>
                        setMarkUnavailable(event.target.checked)
                      }
                    />
                    Mark unavailable
                  </label>
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjustment-notes">Notes</Label>
              <Textarea
                id="adjustment-notes"
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
            <Button disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
