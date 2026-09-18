"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { AccountTermsFormFields } from "~/components/accounts/account-terms-form-fields";
import {
  accountEventTypeLabels,
  accountEventTypes,
  type AccountEventType,
} from "~/lib/account-events";
import { emptyAccountTerms, type AccountTerms } from "~/lib/account-terms";
import { titleFromFilename } from "~/lib/documents";
import { uploadEventAttachment } from "~/lib/upload-event-attachment";
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

type AccountEvent = RouterOutputs["accountEvents"]["listByAccount"][number];

function todayInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

type PendingFile = {
  file: File;
  title: string;
};

export function AccountEventSheet({
  accountId,
  event,
  open,
  onOpenChange,
  redirectOnCreate = false,
}: {
  accountId: string;
  event?: AccountEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectOnCreate?: boolean;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const currentTerms = api.accountTerms.getCurrent.useQuery({ accountId }, { enabled: open });

  const [type, setType] = useState<AccountEventType>("account_change");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState(todayInputValue());
  const [resolvedDate, setResolvedDate] = useState("");
  const [recordTermsChange, setRecordTermsChange] = useState(false);
  const [terms, setTerms] = useState<AccountTerms>(emptyAccountTerms());
  const [termsEffectiveDate, setTermsEffectiveDate] = useState(todayInputValue());
  const [termsNotes, setTermsNotes] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
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
      setPendingFiles([]);
      return;
    }

    setType("account_change");
    setTitle("");
    setNotes("");
    setStartDate(todayInputValue());
    setResolvedDate("");
    setRecordTermsChange(false);
    setTerms(currentTerms.data ?? emptyAccountTerms());
    setTermsEffectiveDate(todayInputValue());
    setTermsNotes("");
    setPendingFiles([]);
  }, [currentTerms.data, event, open]);

  useEffect(() => {
    if (!open || event || !currentTerms.data) return;
    setTerms(currentTerms.data);
  }, [currentTerms.data, event, open]);

  const createEvent = api.accountEvents.create.useMutation();
  const updateEvent = api.accountEvents.update.useMutation();

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList?.length) return;
    const next = [...pendingFiles];
    for (const file of Array.from(fileList)) {
      next.push({ file, title: titleFromFilename(file.name) });
    }
    setPendingFiles(next);
  }

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

        for (const pending of pendingFiles) {
          await uploadEventAttachment({
            accountId,
            eventId: created.id,
            termsSnapshotId: created.termsSnapshotId,
            file: pending.file,
            title: pending.title,
          });
        }

        toast.success(
          pendingFiles.length > 0 ? "Activity saved with attachments." : "Activity saved.",
        );

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
      toast.error(error instanceof Error ? error.message : "Unable to save activity.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <form className="flex min-h-full flex-col" onSubmit={submit}>
          <SheetHeader>
            <SheetTitle>{isEditing ? "Edit activity" : "Add activity"}</SheetTitle>
            <SheetDescription>
              Record correspondence, calls, or account changes with supporting files.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(value) => setType(value as AccountEventType)}>
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
                onChange={(inputEvent) => setTitle(inputEvent.target.value)}
                placeholder="Credit limit increase request"
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
                  onChange={(inputEvent) => setStartDate(inputEvent.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-resolved-date">Resolved date</Label>
                <Input
                  id="event-resolved-date"
                  type="date"
                  value={resolvedDate}
                  onChange={(inputEvent) => setResolvedDate(inputEvent.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-notes">Notes</Label>
              <Textarea
                id="event-notes"
                value={notes}
                onChange={(inputEvent) => setNotes(inputEvent.target.value)}
                placeholder="Call notes, summary, or context"
                rows={4}
              />
            </div>

            {!isEditing ? (
              <>
                <div className="space-y-3 rounded-lg border p-4">
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={recordTermsChange}
                      onChange={(inputEvent) => setRecordTermsChange(inputEvent.target.checked)}
                    />
                    <span>
                      <span className="font-medium">Record terms change</span>
                      <span className="mt-1 block text-muted-foreground">
                        Save updated account terms and create a snapshot linked to this activity.
                      </span>
                    </span>
                  </label>

                  {recordTermsChange ? (
                    <div className="space-y-4 border-t pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="event-terms-effective-date">Terms effective date</Label>
                        <Input
                          id="event-terms-effective-date"
                          type="date"
                          value={termsEffectiveDate}
                          onChange={(inputEvent) => setTermsEffectiveDate(inputEvent.target.value)}
                          required
                        />
                      </div>
                      <AccountTermsFormFields terms={terms} onChange={setTerms} />
                      <div className="space-y-2">
                        <Label htmlFor="event-terms-notes">Snapshot notes</Label>
                        <Textarea
                          id="event-terms-notes"
                          value={termsNotes}
                          onChange={(inputEvent) => setTermsNotes(inputEvent.target.value)}
                          placeholder="Optional context for the terms snapshot"
                          rows={2}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event-attachments">Attachments</Label>
                  <Input
                    id="event-attachments"
                    type="file"
                    multiple
                    accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,.pdf,.jpg,.jpeg,.png,.webp,.heic,.eml,message/rfc822,audio/mpeg,audio/mp4,audio/wav,audio/ogg,.mp3,.m4a,.wav,.ogg"
                    onChange={(inputEvent) => handleFilesSelected(inputEvent.target.files)}
                  />
                  <p className="text-xs text-muted-foreground">
                    PDF, images, .eml, or common audio files up to 25 MB each.
                  </p>
                  {pendingFiles.length > 0 ? (
                    <ul className="space-y-2 text-sm">
                      {pendingFiles.map((pending, index) => (
                        <li key={`${pending.file.name}-${index}`} className="flex gap-2">
                          <Input
                            value={pending.title}
                            onChange={(inputEvent) => {
                              const next = [...pendingFiles];
                              next[index] = { ...pending, title: inputEvent.target.value };
                              setPendingFiles(next);
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setPendingFiles(pendingFiles.filter((_, i) => i !== index))}
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || createEvent.isPending || updateEvent.isPending}>
              {saving ? "Saving…" : isEditing ? "Save changes" : "Save activity"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
