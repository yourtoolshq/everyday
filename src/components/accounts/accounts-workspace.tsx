"use client";

import { AlertTriangle, Pencil, Plus, Settings, Upload } from "lucide-react";
import { useState } from "react";

import { AccountFormSheet } from "~/components/accounts/account-form-sheet";
import { AccountSettingsSheet } from "~/components/accounts/account-settings-sheet";
import { AccountStatementPeriods } from "~/components/accounts/account-statement-periods";
import { StatementUploadSheet } from "~/components/documents/statement-upload-sheet";
import { accountStatusLabels } from "~/lib/account-status";
import { accountTypeLabels } from "~/lib/account-types";
import { canDeriveStatementPeriods } from "~/lib/expected-periods";
import { formatDateLabel } from "~/lib/format-date";
import { statementFrequencyLabels } from "~/lib/statement-frequency";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { api, type RouterOutputs } from "~/trpc/react";

type Account = RouterOutputs["accounts"]["list"][number];

function needsOpenedDateWarning(account: Account): boolean {
  return (
    account.statementFrequency !== "none" && !canDeriveStatementPeriods(
      {
        openedDate: account.openedDate,
        closedDate: account.closedDate,
        status: account.status,
      },
      account.statementFrequency,
    )
  );
}

type UploadTarget = {
  accountId: string;
  periodKey?: string;
};

export function AccountsWorkspace() {
  const accounts = api.accounts.list.useQuery();
  const statementDocuments = api.documents.statementDocumentsByAccount.useQuery();
  const [editing, setEditing] = useState<Account | null>(null);
  const [settingsAccount, setSettingsAccount] = useState<Account | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null);

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
        <div className="space-y-4">
          {items.map((account) => {
            const openedLabel = formatDateLabel(account.openedDate);
            const closedLabel = formatDateLabel(account.closedDate);
            const showOpenedDateWarning = needsOpenedDateWarning(account);

            return (
              <Card key={account.id} className="shadow-none">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{account.displayName}</p>
                        <Badge variant="secondary">
                          {statementFrequencyLabels[account.statementFrequency]}
                        </Badge>
                        {showOpenedDateWarning ? (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-800">
                            <AlertTriangle />
                            Missing opened date
                          </Badge>
                        ) : null}
                      </div>
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
                    <div className="flex shrink-0 gap-1">
                      {account.statementFrequency !== "none" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Upload statement for ${account.displayName}`}
                          onClick={() => setUploadTarget({ accountId: account.id })}
                        >
                          <Upload />
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Settings for ${account.displayName}`}
                        onClick={() => setSettingsAccount(account)}
                      >
                        <Settings />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${account.displayName}`}
                        onClick={() => editAccount(account)}
                      >
                        <Pencil />
                      </Button>
                    </div>
                  </div>

                  {account.statementFrequency !== "none" ? (
                    <>
                      <Separator />
                      <AccountStatementPeriods
                        account={account}
                        statementDocumentsByPeriod={statementDocuments.data?.[account.id] ?? {}}
                        onUploadPeriod={(periodKey) =>
                          setUploadTarget({ accountId: account.id, periodKey })
                        }
                      />
                    </>
                  ) : null}
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

      {settingsAccount ? (
        <AccountSettingsSheet
          key={settingsAccount.id}
          account={settingsAccount}
          open={Boolean(settingsAccount)}
          onOpenChange={(open) => {
            if (!open) setSettingsAccount(null);
          }}
        />
      ) : null}

      {uploadTarget ? (
        <StatementUploadSheet
          key={`${uploadTarget.accountId}-${uploadTarget.periodKey ?? "new"}`}
          open={Boolean(uploadTarget)}
          onOpenChange={(open) => {
            if (!open) setUploadTarget(null);
          }}
          accountId={uploadTarget.accountId}
          periodKey={uploadTarget.periodKey}
        />
      ) : null}
    </div>
  );
}
