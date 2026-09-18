"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { accountStatusLabels, accountStatuses, type AccountStatus } from "~/lib/account-status";
import { accountTypeLabels, accountTypes, type AccountType } from "~/lib/account-types";
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

type Account = RouterOutputs["accounts"]["list"][number];

type AccountFormState = {
  institutionId: string;
  displayName: string;
  accountType: AccountType;
  identifierSuffix: string;
  status: AccountStatus;
  openedDate: string;
  closedDate: string;
  notes: string;
  ownerIds: string[];
};

function emptyFormState(): AccountFormState {
  return {
    institutionId: "",
    displayName: "",
    accountType: accountTypes[0],
    identifierSuffix: "",
    status: accountStatuses[0],
    openedDate: "",
    closedDate: "",
    notes: "",
    ownerIds: [],
  };
}

function accountToFormState(account: Account): AccountFormState {
  return {
    institutionId: account.institutionId,
    displayName: account.displayName,
    accountType: account.accountType,
    identifierSuffix: account.identifierSuffix ?? "",
    status: account.status,
    openedDate: account.openedDate ?? "",
    closedDate: account.closedDate ?? "",
    notes: account.notes ?? "",
    ownerIds: account.owners.map((owner) => owner.id),
  };
}

function validateAccountForm(form: AccountFormState): string | null {
  if (!form.institutionId || !form.displayName.trim() || form.ownerIds.length === 0) {
    return "Choose an institution, account name, and at least one owner.";
  }
  if (form.status === "closed" && !form.closedDate) {
    return "Closed accounts need a closed date.";
  }
  return null;
}

function toAccountPayload(form: AccountFormState) {
  return {
    institutionId: form.institutionId,
    displayName: form.displayName.trim(),
    accountType: form.accountType,
    identifierSuffix: form.identifierSuffix.trim() || null,
    status: form.status,
    openedDate: form.openedDate || null,
    closedDate: form.status === "closed" ? form.closedDate || null : null,
    notes: form.notes.trim() || null,
    ownerIds: form.ownerIds,
  };
}

export function AccountFormSheet({
  account,
  open,
  onOpenChange,
}: {
  account: Account | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const utils = api.useUtils();
  const institutions = api.institutions.list.useQuery();
  const members = api.people.list.useQuery();
  const [form, setForm] = useState<AccountFormState>(
    account ? accountToFormState(account) : emptyFormState(),
  );

  const finish = async (message: string) => {
    await utils.accounts.invalidate();
    toast.success(message);
    onOpenChange(false);
  };

  const createAccount = api.accounts.create.useMutation({
    onSuccess: () => finish("Account added."),
    onError: (error) => toast.error(error.message),
  });
  const updateAccount = api.accounts.update.useMutation({
    onSuccess: () => finish("Account updated."),
    onError: (error) => toast.error(error.message),
  });

  function toggleOwner(personId: string) {
    setForm((current) => ({
      ...current,
      ownerIds: current.ownerIds.includes(personId)
        ? current.ownerIds.filter((id) => id !== personId)
        : [...current.ownerIds, personId],
    }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateAccountForm(form);
    if (error) {
      toast.error(error);
      return;
    }
    const payload = toAccountPayload(form);
    if (account) {
      updateAccount.mutate({ id: account.id, ...payload });
    } else {
      createAccount.mutate(payload);
    }
  }

  const pending = createAccount.isPending || updateAccount.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <form className="flex min-h-full flex-col" onSubmit={submit}>
          <SheetHeader>
            <SheetTitle>{account ? "Edit account" : "Add account"}</SheetTitle>
            <SheetDescription>
              Track a financial relationship held with an institution.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-6 px-4 py-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Institution</Label>
                <Select
                  value={form.institutionId}
                  onValueChange={(value) => setForm({ ...form, institutionId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose institution" />
                  </SelectTrigger>
                  <SelectContent>
                    {institutions.data?.map((institution) => (
                      <SelectItem key={institution.id} value={institution.id}>
                        {institution.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="account-name">Display name</Label>
                <Input
                  id="account-name"
                  value={form.displayName}
                  onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Account type</Label>
                <Select
                  value={form.accountType}
                  onValueChange={(value) =>
                    setForm({ ...form, accountType: value as AccountType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accountTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {accountTypeLabels[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="identifier-suffix">Identifier suffix</Label>
                <Input
                  id="identifier-suffix"
                  value={form.identifierSuffix}
                  onChange={(event) => setForm({ ...form, identifierSuffix: event.target.value })}
                  placeholder="Last 4 digits"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => {
                    const status = value as AccountStatus;
                    setForm({
                      ...form,
                      status,
                      closedDate: status === "active" ? "" : form.closedDate,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accountStatuses.map((item) => (
                      <SelectItem key={item} value={item}>
                        {accountStatusLabels[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="opened-date">Opened date</Label>
                <Input
                  id="opened-date"
                  type="date"
                  value={form.openedDate}
                  onChange={(event) => setForm({ ...form, openedDate: event.target.value })}
                />
              </div>
              {form.status === "closed" ? (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="closed-date">Closed date</Label>
                  <Input
                    id="closed-date"
                    type="date"
                    value={form.closedDate}
                    onChange={(event) => setForm({ ...form, closedDate: event.target.value })}
                    required
                  />
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Owners</Label>
              <div className="flex flex-wrap gap-2">
                {members.data?.map((member) => {
                  const selected = form.ownerIds.includes(member.id);
                  return (
                    <Button
                      key={member.id}
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      onClick={() => toggleOwner(member.id)}
                    >
                      {member.displayName}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-notes">Notes</Label>
              <Textarea
                id="account-notes"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                rows={4}
              />
            </div>
          </div>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : account ? "Save changes" : "Add account"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
