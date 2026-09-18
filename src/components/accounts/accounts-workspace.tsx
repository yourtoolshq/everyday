"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { accountStatusLabels, accountStatuses } from "~/lib/account-status";
import { accountTypeLabels, accountTypes } from "~/lib/account-types";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { api } from "~/trpc/react";

export function AccountsWorkspace() {
  const utils = api.useUtils();
  const accounts = api.accounts.list.useQuery();
  const institutions = api.institutions.list.useQuery();
  const members = api.people.list.useQuery();
  const createAccount = api.accounts.create.useMutation({
    onSuccess: async () => {
      resetForm();
      await utils.accounts.list.invalidate();
      toast.success("Account added.");
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteAccount = api.accounts.delete.useMutation({
    onSuccess: async () => {
      await utils.accounts.list.invalidate();
      toast.success("Account removed.");
    },
    onError: (error) => toast.error(error.message),
  });

  const [institutionId, setInstitutionId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accountType, setAccountType] = useState(accountTypes[0]);
  const [identifierSuffix, setIdentifierSuffix] = useState("");
  const [status, setStatus] = useState(accountStatuses[0]);
  const [openedDate, setOpenedDate] = useState("");
  const [closedDate, setClosedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [ownerIds, setOwnerIds] = useState<string[]>([]);

  function resetForm() {
    setInstitutionId("");
    setDisplayName("");
    setAccountType(accountTypes[0]);
    setIdentifierSuffix("");
    setStatus(accountStatuses[0]);
    setOpenedDate("");
    setClosedDate("");
    setNotes("");
    setOwnerIds([]);
  }

  function toggleOwner(personId: string) {
    setOwnerIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId],
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-none">
        <CardContent className="space-y-4 p-4">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!institutionId || !displayName.trim() || ownerIds.length === 0) {
                toast.error("Choose an institution, account name, and at least one owner.");
                return;
              }
              createAccount.mutate({
                institutionId,
                displayName: displayName.trim(),
                accountType,
                identifierSuffix: identifierSuffix.trim() || null,
                status,
                openedDate: openedDate || null,
                closedDate: closedDate || null,
                notes: notes.trim() || null,
                ownerIds,
              });
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Institution</Label>
                <Select value={institutionId} onValueChange={setInstitutionId}>
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
              <div className="space-y-2">
                <Label htmlFor="account-name">Display name</Label>
                <Input
                  id="account-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Account type</Label>
                <Select value={accountType} onValueChange={(value) => setAccountType(value as typeof accountType)}>
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
                  value={identifierSuffix}
                  onChange={(event) => setIdentifierSuffix(event.target.value)}
                  placeholder="Last 4 digits"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
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
                  value={openedDate}
                  onChange={(event) => setOpenedDate(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Owners</Label>
              <div className="flex flex-wrap gap-2">
                {members.data?.map((member) => {
                  const selected = ownerIds.includes(member.id);
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
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
              />
            </div>
            <Button type="submit" disabled={createAccount.isPending}>
              <Plus /> Add account
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {accounts.data?.map((account) => (
          <Card key={account.id} className="shadow-none">
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <div className="space-y-1">
                <p className="font-medium">{account.displayName}</p>
                <p className="text-sm text-muted-foreground">
                  {account.institutionName} · {accountTypeLabels[account.accountType]}
                  {account.identifierSuffix ? ` · …${account.identifierSuffix}` : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {accountStatusLabels[account.status]} ·{" "}
                  {account.owners.map((owner) => owner.displayName).join(", ")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${account.displayName}`}
                onClick={() => deleteAccount.mutate({ id: account.id })}
              >
                <Trash2 />
              </Button>
            </CardContent>
          </Card>
        ))}
        {accounts.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts yet.</p>
        ) : null}
      </div>
    </div>
  );
}
