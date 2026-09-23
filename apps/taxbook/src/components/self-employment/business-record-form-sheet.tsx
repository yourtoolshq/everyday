"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { toast } from "sonner";

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
import { centsToDollars, dollarsToCents } from "~/domain/money";
import { MAX_ATTACHMENT_BYTES } from "~/domain/record";
import {
  businessExpenseCategories,
  businessExpenseCategoryDetails,
} from "~/domain/self-employment";
import { api } from "~/trpc/react";

type RecordItem = RouterOutputs["business"]["records"]["items"][number];
export function BusinessRecordFormSheet({
  activityId,
  record,
  initialKind,
  open,
  onOpenChange,
}: {
  activityId: number;
  record: RecordItem | null;
  initialKind: "revenue" | "expense";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const [kind, setKind] = useState(record?.kind ?? initialKind);
  const [category, setCategory] = useState(record?.expenseCategory ?? "other");
  const [date, setDate] = useState(record?.date ?? "");
  const [description, setDescription] = useState(record?.description ?? "");
  const [amount, setAmount] = useState(
    centsToDollars(record?.amountCents ?? null),
  );
  const [notes, setNotes] = useState(record?.notes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const amountCents = dollarsToCents(amount);
    if (amountCents === null || amountCents <= 0)
      return toast.error("Amount must be greater than zero.");
    if (file && file.size > MAX_ATTACHMENT_BYTES)
      return toast.error("Attachment must be 20 MB or smaller.");
    const form = new FormData();
    form.set("businessActivityId", String(activityId));
    form.set("kind", kind);
    form.set("expenseCategory", kind === "expense" ? category : "");
    form.set("date", date);
    form.set("description", description);
    form.set("amountCents", String(amountCents));
    form.set("notes", notes);
    if (file) form.set("attachment", file);
    if (record)
      form.set(
        "attachmentAction",
        file ? "replace" : removeAttachment ? "remove" : "keep",
      );
    setPending(true);
    try {
      const response = await fetch(
        record ? `/api/business-records/${record.id}` : "/api/business-records",
        { method: record ? "PUT" : "POST", body: form },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Unable to save the Record.");
      await Promise.all([
        utils.business.records.invalidate({ businessActivityId: activityId }),
        utils.business.list.invalidate(),
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
    }
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <form className="flex min-h-full flex-col" onSubmit={submit}>
          <SheetHeader>
            <SheetTitle>
              {record ? "Edit" : "Add"} self-employment Record
            </SheetTitle>
            <SheetDescription>
              Enter the amount that should count toward this business’s tax
              result.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-5 px-4 py-6">
            <div className="space-y-2">
              <Label>Kind</Label>
              <Select
                value={kind}
                onValueChange={(value) => setKind(value as typeof kind)}
              >
                <SelectTrigger aria-label="Record kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="expense">Eligible expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {kind === "expense" ? (
              <div className="space-y-2">
                <Label>T2125 category</Label>
                <Select
                  value={category}
                  onValueChange={(value) =>
                    setCategory(value as typeof category)
                  }
                >
                  <SelectTrigger aria-label="T2125 category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {businessExpenseCategories.map((value) => (
                      <SelectItem key={value} value={value}>
                        {businessExpenseCategoryDetails[value].line} ·{" "}
                        {businessExpenseCategoryDetails[value].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  CCA, vehicles, payroll, inventory, and business-use-of-home
                  calculations are not supported.
                </p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="business-date">Date</Label>
              <Input
                id="business-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-description">Description</Label>
              <Input
                id="business-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-amount">
                {kind === "expense" ? "Deductible amount" : "Revenue amount"}
              </Label>
              <Input
                id="business-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-notes">Notes</Label>
              <Textarea
                id="business-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-attachment">Attachment</Label>
              {record?.attachmentFileName && !removeAttachment ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="truncate">{record.attachmentFileName}</span>
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
                id="business-attachment"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setRemoveAttachment(false);
                }}
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
            <Button disabled={pending}>
              {pending ? "Saving…" : "Save Record"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
