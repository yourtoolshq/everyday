"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { AccountFormSheet } from "~/components/accounts/account-form-sheet";
import { accountStatusLabels } from "~/lib/account-status";
import { accountTypeLabels } from "~/lib/account-types";
import { formatDateLabel } from "~/lib/format-date";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { api, type RouterOutputs } from "~/trpc/react";

type Account = RouterOutputs["accounts"]["list"][number];

export function AccountsWorkspace() {
  const accounts = api.accounts.list.useQuery();
  const [editing, setEditing] = useState<Account | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  function addAccount() {
    setEditing(null);
    setFormOpen(true);
  }

  function editAccount(account: Account) {
    setEditing(account);
    setFormOpen(true);
  }

  if (accounts.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (accounts.error) {
    return (
      <p className="text-sm text-destructive">
        Unable to load accounts. {accounts.error.message}
      </p>
    );
  }

  const items = accounts.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">Inventory</p>
          <h2 className="text-3xl font-semibold tracking-tight">Accounts</h2>
          <p className="text-muted-foreground">
            Financial relationships held with institutions.
          </p>
        </div>
        <Button onClick={addAccount}>
          <Plus /> Add account
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="flex h-64 flex-col items-center justify-center text-center">
            <p className="font-medium">No accounts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your first financial account to start building the household inventory.
            </p>
            <Button className="mt-4" variant="outline" onClick={addAccount}>
              <Plus /> Add account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((account) => {
            const openedLabel = formatDateLabel(account.openedDate);
            const closedLabel = formatDateLabel(account.closedDate);

            return (
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
                    {openedLabel || closedLabel ? (
                      <p className="text-sm text-muted-foreground">
                        {openedLabel ? `Opened ${openedLabel}` : null}
                        {openedLabel && closedLabel ? " · " : null}
                        {closedLabel ? `Closed ${closedLabel}` : null}
                      </p>
                    ) : null}
                    {account.notes ? (
                      <p className="text-sm text-muted-foreground">{account.notes}</p>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${account.displayName}`}
                    onClick={() => editAccount(account)}
                  >
                    <Pencil />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {formOpen ? (
        <AccountFormSheet
          key={editing?.id ?? "new"}
          account={editing}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      ) : null}
    </div>
  );
}
