"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import {
  statementFrequencies,
  statementFrequencyLabels,
  type StatementFrequency,
} from "~/lib/statement-frequency";
import { Button } from "~/components/ui/button";
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
import { api, type RouterOutputs } from "~/trpc/react";

type Account = RouterOutputs["accounts"]["list"][number];

export function AccountSettingsSheet({
  account,
  open,
  onOpenChange,
}: {
  account: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const [frequency, setFrequency] = useState<StatementFrequency>(account.statementFrequency);

  const updateSchedule = api.accounts.updateStatementSchedule.useMutation({
    onSuccess: async () => {
      await utils.accounts.invalidate();
      toast.success("Statement schedule updated.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateSchedule.mutate({
      accountId: account.id,
      frequency,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <form className="flex min-h-full flex-col" onSubmit={submit}>
          <SheetHeader>
            <SheetTitle>Account settings</SheetTitle>
            <SheetDescription>
              Configure how often {account.displayName} should produce statements.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="space-y-2">
              <Label>Statement frequency</Label>
              <Select
                value={frequency}
                onValueChange={(value) => setFrequency(value as StatementFrequency)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statementFrequencies.map((item) => (
                    <SelectItem key={item} value={item}>
                      {statementFrequencyLabels[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Passbook uses this schedule with the account opened and closed dates to determine
                which statement periods should exist.
              </p>
            </div>
          </div>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateSchedule.isPending}>
              {updateSchedule.isPending ? "Saving…" : "Save settings"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
