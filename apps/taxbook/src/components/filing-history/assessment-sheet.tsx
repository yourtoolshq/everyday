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
import { assessmentKindLabels, MAX_FILING_ATTACHMENT_BYTES } from "~/domain/filing";
import { signedDollarsToCents } from "~/domain/money";
import type { RouterOutputs } from "~/trpc/react";

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

export function AssessmentSheet({
  filing,
  open,
  onOpenChange,
  onSaved,
}: {
  filing: Filing;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const editing = filing.assessmentId !== null;
  const initialResult = resultFields(filing.assessedResultCents ?? null);
  const [assessmentDate, setAssessmentDate] = useState(filing.assessmentDate ?? "");
  const [resultDirection, setResultDirection] = useState(initialResult.direction);
  const [resultAmount, setResultAmount] = useState(initialResult.amount);
  const [refundOrPaymentDate, setRefundOrPaymentDate] = useState(
    filing.refundOrPaymentDate ?? "",
  );
  const [notes, setNotes] = useState(filing.assessmentNotes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assessmentDate) {
      toast.error("Enter the assessment date.");
      return;
    }
    if (file && file.size > MAX_FILING_ATTACHMENT_BYTES) {
      toast.error("Attachment must be 20 MB or smaller.");
      return;
    }
    if (resultDirection !== "none" && resultAmount.trim() === "") {
      toast.error("Enter an assessed refund or amount owing, or choose Unknown.");
      return;
    }
    if (
      resultDirection !== "none" &&
      signedDollarsToCents(resultAmount) === null
    ) {
      toast.error("Enter a valid amount for the assessed result.");
      return;
    }

    const assessedResultCents =
      resultDirection === "none"
        ? null
        : resultCents(resultDirection, resultAmount);

    const form = new FormData();
    if (!editing) form.set("filingId", String(filing.id));
    form.set("assessmentDate", assessmentDate);
    form.set(
      "assessedResultCents",
      assessedResultCents === null ? "" : String(assessedResultCents),
    );
    form.set("refundOrPaymentDate", refundOrPaymentDate);
    form.set("notes", notes);
    if (editing) {
      form.set(
        "attachmentAction",
        file ? "replace" : removeAttachment ? "remove" : "keep",
      );
    }
    if (file) form.set("attachment", file);

    setPending(true);
    try {
      const response = await fetch(
        editing ? `/api/assessments/${filing.assessmentId}` : "/api/assessments",
        { method: editing ? "PUT" : "POST", body: form },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to save the assessment.");
      }
      toast.success(editing ? "Assessment updated." : "Assessment added.");
      onOpenChange(false);
      await onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save the assessment.",
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
              {editing
                ? filing.kind === "adjustment"
                  ? "Edit reassessment"
                  : "Edit assessment"
                : filing.kind === "adjustment"
                  ? "Add reassessment"
                  : "Add assessment"}
            </SheetTitle>
            <SheetDescription>
              {filing.kind === "adjustment"
                ? assessmentKindLabels.notice_of_reassessment
                : assessmentKindLabels.notice_of_assessment}{" "}
              for {filing.personName}.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="assessment-date">Assessment date</Label>
              <Input
                id="assessment-date"
                type="date"
                value={assessmentDate}
                required
                onChange={(event) => setAssessmentDate(event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="assessment-result-direction">Assessed result</Label>
                <Select value={resultDirection} onValueChange={setResultDirection}>
                  <SelectTrigger id="assessment-result-direction">
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
                <Label htmlFor="assessment-result-amount">Amount</Label>
                <Input
                  id="assessment-result-amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={resultAmount}
                  disabled={resultDirection === "none"}
                  onChange={(event) => setResultAmount(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assessment-payment-date">Refund or payment date</Label>
              <Input
                id="assessment-payment-date"
                type="date"
                value={refundOrPaymentDate}
                onChange={(event) => setRefundOrPaymentDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assessment-attachment">
                {filing.kind === "adjustment" ? "NOR attachment" : "NOA attachment"}
              </Label>
              <Input
                id="assessment-attachment"
                type="file"
                accept=".pdf,image/jpeg,image/png,image/heic,image/heif"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              {filing.assessmentAttachmentFileName ? (
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={removeAttachment}
                    onChange={(event) => setRemoveAttachment(event.target.checked)}
                  />
                  Remove {filing.assessmentAttachmentFileName}
                </label>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="assessment-notes">Notes</Label>
              <Textarea
                id="assessment-notes"
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
