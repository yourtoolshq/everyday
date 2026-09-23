"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { AccountEventType } from "~/lib/account-events";
import type { AccountTerms } from "~/lib/account-terms";
import type { RouterOutputs } from "~/trpc/react";
import { AccountTermsFormFields } from "~/components/accounts/account-terms-form-fields";
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
  accountEventTypeLabels,
  accountEventTypes,
  suggestedAccountEventTitle,
} from "~/lib/account-events";
import { emptyAccountTerms } from "~/lib/account-terms";
import { api } from "~/trpc/react";

type AccountEvent = RouterOutputs["accountEvents"]["listByAccount"][number];

function todayInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function AccountEventSheet({
  accountId,
  event,
  open,
  onOpenChange,
  redirectOnCreate = false,
  defaultType = "account_change",
}: {
  accountId: string;
  event?: AccountEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectOnCreate?: boolean;
  defaultType?: AccountEventType;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const currentTerms = api.accountTerms.getCurrent.useQuery(
    { accountId },
    { enabled: open },
  );

  const [type, setType] = useState<AccountEventType>(defaultType);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState(todayInputValue());
  const [resolvedDate, setResolvedDate] = useState("");
  const [recordTermsChange, setRecordTermsChange] = useState(false);
  const [terms, setTerms] = useState<AccountTerms>(emptyAccountTerms());
  const [termsEffectiveDate, setTermsEffectiveDate] =
    useState(todayInputValue());
  const [termsNotes, setTermsNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const isEditing = Boolean(event);

  useEffect(() => {
    if (!open) return;

    if (event) {
      setType(event.type);
      setTitle(event.title);
      setNotes(event.notes ?? "");
      setStartDate(event.startDate);
      setResolvedDate(event.resolvedDate ?? "");
      setRecordTermsChange(false);
      setTerms(emptyAccountTerms());
      setTermsEffectiveDate(todayInputValue());
      setTermsNotes("");
      return;
    }

    setType(defaultType);
    setTitle(suggestedAccountEventTitle(defaultType));
    setTitleTouched(false);
    setNotes("");
    setStartDate(todayInputValue());
    setResolvedDate("");
    setRecordTermsChange(false);
    setTerms(currentTerms.data ?? emptyAccountTerms());
    setTermsEffectiveDate(todayInputValue());
    setTermsNotes("");
  }, [currentTerms.data, defaultType, event, open]);

  useEffect(() => {
    if (!open || event || !currentTerms.data) return;
    setTerms(currentTerms.data);
  }, [currentTerms.data, event, open]);

  useEffect(() => {
    if (!open || event || titleTouched) return;
    setTitle(suggestedAccountEventTitle(type));
  }, [event, open, titleTouched, type]);

  const createEvent = api.accountEvents.create.useMutation();
  const updateEvent = api.accountEvents.update.useMutation();

  async function submit(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();

    if (recordTermsChange && !termsEffectiveDate.trim()) {
      toast.error("Choose an effective date for the terms change.");
      return;
    }

    setSaving(true);
    try {
      if (isEditing && event) {
        await updateEvent.mutateAsync({
          id: event.id,
          type,
          title,
          notes: notes.trim() || null,
          startDate,
          resolvedDate: resolvedDate.trim() || null,
        });
        toast.success("Activity updated.");
      } else {
        const created = await createEvent.mutateAsync({
          accountId,
          type,
          title,
          notes: notes.trim() || null,
          startDate,
          resolvedDate: resolvedDate.trim() || null,
          termsChange: recordTermsChange
            ? {
                recordTermsChange: true,
                effectiveDate: termsEffectiveDate,
                snapshotNotes: termsNotes.trim() || null,
                terms,
              }
            : { recordTermsChange: false },
        });

        toast.success("Activity saved. Add documents from the activity page.");

        await Promise.all([
          utils.accountEvents.invalidate(),
          utils.accountTerms.invalidate(),
        ]);
        onOpenChange(false);
        if (redirectOnCreate) {
          router.push(`/activity/${created.id}`);
        }
        return;
      }

      await Promise.all([
        utils.accountEvents.invalidate(),
        utils.accountTerms.invalidate(),
      ]);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save activity.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <form className="flex min-h-full flex-col" onSubmit={submit}>
          <SheetHeader>
            <SheetTitle>
              {isEditing ? "Edit activity" : "Add activity"}
            </SheetTitle>
            <SheetDescription>
              {isEditing
                ? "Update the activity details."
                : type === "opening"
                  ? "Record account opening details. You can add documents and email copies on the next screen."
                  : "Record correspondence, calls, or account changes. Add supporting documents on the activity page."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as AccountEventType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accountEventTypes.map((item) => (
                    <SelectItem key={item} value={item}>
                      {accountEventTypeLabels[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-title">Title</Label>
              <Input
                id="event-title"
                value={title}
                onChange={(inputEvent) => {
                  setTitleTouched(true);
                  setTitle(inputEvent.target.value);
                }}
                placeholder={
                  type === "opening"
                    ? "Account opening"
                    : "Credit limit increase request"
                }
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event-start-date">Start date</Label>
                <Input
                  id="event-start-date"
                  type="date"
                  value={startDate}
                  onChange={(inputEvent) =>
                    setStartDate(inputEvent.target.value)
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-resolved-date">Resolved date</Label>
                <Input
                  id="event-resolved-date"
                  type="date"
                  value={resolvedDate}
                  onChange={(inputEvent) =>
                    setResolvedDate(inputEvent.target.value)
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-notes">Notes</Label>
              <Textarea
                id="event-notes"
                value={notes}
                onChange={(inputEvent) => setNotes(inputEvent.target.value)}
                placeholder={
                  type === "opening"
                    ? "Opening details, branch, or other context"
                    : "Call notes, summary, or context"
                }
                rows={4}
              />
            </div>

            {!isEditing ? (
              <div className="space-y-3 rounded-lg border p-4">
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={recordTermsChange}
                    onChange={(inputEvent) =>
                      setRecordTermsChange(inputEvent.target.checked)
                    }
                  />
                  <span>
                    <span className="font-medium">Record terms change</span>
                    <span className="text-muted-foreground mt-1 block">
                      Save updated account terms and create a snapshot linked to
                      this activity.
                    </span>
                  </span>
                </label>

                {recordTermsChange ? (
                  <div className="space-y-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="event-terms-effective-date">
                        Terms effective date
                      </Label>
                      <Input
                        id="event-terms-effective-date"
                        type="date"
                        value={termsEffectiveDate}
                        onChange={(inputEvent) =>
                          setTermsEffectiveDate(inputEvent.target.value)
                        }
                        required
                      />
                    </div>
                    <AccountTermsFormFields terms={terms} onChange={setTerms} />
                    <div className="space-y-2">
                      <Label htmlFor="event-terms-notes">Snapshot notes</Label>
                      <Textarea
                        id="event-terms-notes"
                        value={termsNotes}
                        onChange={(inputEvent) =>
                          setTermsNotes(inputEvent.target.value)
                        }
                        placeholder="Optional context for the terms snapshot"
                        rows={2}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
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
              disabled={
                saving || createEvent.isPending || updateEvent.isPending
              }
            >
              {saving
                ? "Saving…"
                : isEditing
                  ? "Save changes"
                  : "Save activity"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
