"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import { type AccountTerms } from "~/lib/account-terms";
import { api } from "~/trpc/react";

function todayInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function AccountTermsSheet({
  accountId,
  open,
  onOpenChange,
  initialTerms,
}: {
  accountId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTerms: AccountTerms;
}) {
  const utils = api.useUtils();
  const [terms, setTerms] = useState<AccountTerms>(initialTerms);
  const [effectiveDate, setEffectiveDate] = useState(todayInputValue());
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTerms(initialTerms);
    setEffectiveDate(todayInputValue());
    setNotes("");
  }, [initialTerms, open]);

  const saveTerms = api.accountTerms.saveTerms.useMutation({
    onSuccess: async (result) => {
      await utils.accountTerms.invalidate();
      toast.success(
        result.changed ? "Terms updated." : "No term changes to save.",
      );
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveTerms.mutate({
      accountId,
      effectiveDate,
      notes: notes.trim() || null,
      ...terms,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <form className="flex min-h-full flex-col" onSubmit={submit}>
          <SheetHeader>
            <SheetTitle>Edit terms</SheetTitle>
            <SheetDescription>
              Update the current relationship terms for this account. A snapshot
              is saved when something changes.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="terms-effective-date">Effective date</Label>
                <Input
                  id="terms-effective-date"
                  type="date"
                  value={effectiveDate}
                  onChange={(event) => setEffectiveDate(event.target.value)}
                  required
                />
              </div>
            </div>
            <AccountTermsFormFields terms={terms} onChange={setTerms} />
            <div className="space-y-2">
              <Label htmlFor="terms-notes">Snapshot notes</Label>
              <Textarea
                id="terms-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional context for this change"
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
            <Button type="submit" disabled={saveTerms.isPending}>
              {saveTerms.isPending ? "Saving…" : "Save terms"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
