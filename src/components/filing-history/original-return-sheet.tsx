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
  filingStatuses,
  filingStatusLabels,
  MAX_FILING_ATTACHMENT_BYTES,
  returnCopyStatuses,
  returnCopyStatusLabels,
  type FilingStatus,
  type ReturnCopyStatus,
} from "~/domain/filing";
import { signedDollarsToCents } from "~/domain/money";
import { api, type RouterOutputs } from "~/trpc/react";

type Person = RouterOutputs["settings"]["get"]["people"][number];
type Filing = RouterOutputs["filing"]["timeline"]["filings"][number];

function resultCents(direction: string, amount: string) {
  const cents = signedDollarsToCents(amount);
  if (cents === null) return null;
  if (direction === "owing") return -Math.abs(cents);
  return Math.abs(cents);
}

function resultFields(cents: number | null) {
  if (cents === null) return { direction: "none", amount: "" };
  if (cents < 0) return { direction: "owing", amount: (Math.abs(cents) / 100).toFixed(2) };
  return { direction: "refund", amount: (cents / 100).toFixed(2) };
}

export function OriginalReturnSheet({
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
  const initialResult = resultFields(filing?.expectedResultCents ?? null);
  const [personId, setPersonId] = useState(
    String(filing?.personId ?? defaultPersonId ?? people[0]?.id ?? ""),
  );
  const [submissionDate, setSubmissionDate] = useState(filing?.submissionDate ?? "");
  const [resultDirection, setResultDirection] = useState(initialResult.direction);
  const [resultAmount, setResultAmount] = useState(initialResult.amount);
  const [returnCopyStatus, setReturnCopyStatus] = useState<ReturnCopyStatus>(
    filing?.returnCopyStatus ?? "unavailable",
  );
  const [status, setStatus] = useState<FilingStatus>(filing?.status ?? "preparing");
  const [notes, setNotes] = useState(filing?.notes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [markUnavailable, setMarkUnavailable] = useState(false);
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!filing && !personId) {
      toast.error("Choose a household member.");
      return;
    }
    if (file && file.size > MAX_FILING_ATTACHMENT_BYTES) {
      toast.error("Attachment must be 20 MB or smaller.");
      return;
    }
    if (resultDirection !== "none" && resultAmount.trim() === "") {
      toast.error("Enter an expected refund or amount owing, or choose Unknown.");
      return;
    }
    if (
      resultDirection !== "none" &&
      signedDollarsToCents(resultAmount) === null
    ) {
      toast.error("Enter a valid amount for the expected result.");
      return;
    }
    if (
      (status === "submitted" || status === "assessed") &&
      !file &&
      returnCopyStatus === "not_added_yet"
    ) {
      toast.error(
        "Attach the submitted T1 or mark it unavailable before marking the return submitted.",
      );
      return;
    }

    const expectedResultCents =
      resultDirection === "none"
        ? null
        : resultCents(resultDirection, resultAmount);

    const form = new FormData();
    if (!filing) {
      form.set("taxYearId", String(taxYearId));
      form.set("personId", personId);
    }
    form.set("submissionDate", submissionDate);
    form.set(
      "expectedResultCents",
      expectedResultCents === null ? "" : String(expectedResultCents),
    );
    form.set("returnCopyStatus", file ? "attached" : returnCopyStatus);
    form.set("notes", notes);
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
        filing ? `/api/filings/${filing.id}` : "/api/filings",
        { method: filing ? "PUT" : "POST", body: form },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to save the original return.");
      }
      toast.success(filing ? "Original return updated." : "Original return added.");
      onOpenChange(false);
      await onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save the original return.",
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
            <SheetTitle>{filing ? "Edit original return" : "Add original return"}</SheetTitle>
            <SheetDescription>
              Record what was filed. The submitted T1 can be attached, marked unavailable, or added later.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-6 px-4 py-6">
            {!filing ? (
              <div className="space-y-2">
                <Label htmlFor="filing-person">Person</Label>
                <Select value={personId} onValueChange={setPersonId}>
                  <SelectTrigger id="filing-person">
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
              <Label htmlFor="filing-date">Filing date</Label>
              <Input
                id="filing-date"
                type="date"
                value={submissionDate}
                onChange={(event) => setSubmissionDate(event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="filing-result-direction">Expected result</Label>
                <Select value={resultDirection} onValueChange={setResultDirection}>
                  <SelectTrigger id="filing-result-direction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unknown</SelectItem>
                    <SelectItem value="refund">Refund</SelectItem>
                    <SelectItem value="owing">Amount owing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filing-result-amount">Amount</Label>
                <Input
                  id="filing-result-amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={resultAmount}
                  disabled={resultDirection === "none"}
                  onChange={(event) => setResultAmount(event.target.value)}
                />
              </div>
            </div>
            {!file && !filing?.attachmentFileName ? (
              <div className="space-y-2">
                <Label htmlFor="filing-copy-status">Submitted T1</Label>
                <Select
                  value={returnCopyStatus}
                  onValueChange={(value) => setReturnCopyStatus(value as ReturnCopyStatus)}
                >
                  <SelectTrigger id="filing-copy-status">
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
                <Label htmlFor="filing-status">Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as FilingStatus)}>
                  <SelectTrigger id="filing-status">
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
              <Label htmlFor="filing-attachment">T1 attachment</Label>
              <Input
                id="filing-attachment"
                type="file"
                accept=".pdf,image/jpeg,image/png,image/heic,image/heif"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              {filing?.attachmentFileName ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{filing.attachmentFileName}</span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={markUnavailable}
                      onChange={(event) => setMarkUnavailable(event.target.checked)}
                    />
                    Mark unavailable
                  </label>
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="filing-notes">Notes</Label>
              <Textarea
                id="filing-notes"
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
