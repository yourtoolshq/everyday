"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { AccountTerms } from "~/lib/account-terms";
import type { RouterOutputs } from "~/trpc/react";
import { AccountTermsFormFields } from "~/components/accounts/account-terms-form-fields";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Textarea } from "~/components/ui/textarea";
import { emptyAccountTerms } from "~/lib/account-terms";
import { api } from "~/trpc/react";

type Snapshot = RouterOutputs["accountTerms"]["listSnapshots"][number];

export function AccountTermsSnapshotSheet({
  accountId,
  snapshot,
  open,
  onOpenChange,
}: {
  accountId: string;
  snapshot: Snapshot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const [terms, setTerms] = useState<AccountTerms>(emptyAccountTerms());
  const [effectiveDate, setEffectiveDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (snapshot) {
      setTerms(snapshot.terms);
      setEffectiveDate(snapshot.effectiveDate);
      setNotes(snapshot.notes ?? "");
      return;
    }
    setTerms(emptyAccountTerms());
    setEffectiveDate("");
    setNotes("");
  }, [open, snapshot]);

  const addSnapshot = api.accountTerms.addSnapshot.useMutation({
    onSuccess: async () => {
      await utils.accountTerms.invalidate();
      toast.success("Historical snapshot added.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const updateSnapshot = api.accountTerms.updateSnapshot.useMutation({
    onSuccess: async () => {
      await utils.accountTerms.invalidate();
      toast.success("Snapshot updated.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!effectiveDate) {
      toast.error("Choose an effective date.");
      return;
    }

    if (snapshot) {
      updateSnapshot.mutate({
        id: snapshot.id,
        effectiveDate,
        notes: notes.trim() || null,
        terms,
      });
      return;
    }

    addSnapshot.mutate({
      accountId,
      effectiveDate,
      notes: notes.trim() || null,
      ...terms,
    });
  }

  const pending = addSnapshot.isPending || updateSnapshot.isPending;
  const isLinked = Boolean(snapshot?.linkedActivity);

  if (snapshot && isLinked) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Snapshot linked to activity</SheetTitle>
            <SheetDescription>
              This snapshot was recorded from &quot;
              {snapshot.linkedActivity?.title}&quot;. Edit the terms change from
              that activity instead.
            </SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <form className="flex min-h-full flex-col" onSubmit={submit}>
          <SheetHeader>
            <SheetTitle>
              {snapshot ? "Edit snapshot" : "Add historical snapshot"}
            </SheetTitle>
            <SheetDescription>
              {snapshot
                ? "Correct a past snapshot without changing the account’s current terms."
                : "Record how terms looked on a past date. Current terms stay unchanged."}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="snapshot-effective-date">Effective date</Label>
                <Input
                  id="snapshot-effective-date"
                  type="date"
                  value={effectiveDate}
                  onChange={(event) => setEffectiveDate(event.target.value)}
                  required
                />
              </div>
            </div>
            <AccountTermsFormFields terms={terms} onChange={setTerms} />
            <div className="space-y-2">
              <Label htmlFor="snapshot-notes">Notes</Label>
              <Textarea
                id="snapshot-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional context for this snapshot"
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
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : snapshot
                  ? "Save snapshot"
                  : "Add snapshot"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
