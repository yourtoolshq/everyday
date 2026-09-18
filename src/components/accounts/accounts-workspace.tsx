"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { AccountFormSheet } from "~/components/accounts/account-form-sheet";
import { accountStatusLabels } from "~/lib/account-status";
import { accountTypeLabels } from "~/lib/account-types";
import { canDeriveStatementPeriods } from "~/lib/expected-periods";
import { formatDateLabel } from "~/lib/format-date";
import { buildMissingStatements } from "~/lib/statement-completeness";
import {
  statementFrequencyLabels,
  type StatementFrequency,
} from "~/lib/statement-frequency";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";

function needsOpenedDateWarning(account: {
  openedDate: string | null;
  closedDate: string | null;
  status: "active" | "closed";
  statementFrequency: StatementFrequency;
}) {
  return (
    account.statementFrequency !== "none" &&
    !canDeriveStatementPeriods(
      {
        openedDate: account.openedDate,
        closedDate: account.closedDate,
        status: account.status,
      },
      account.statementFrequency,
    )
  );
}

export function AccountsWorkspace() {
  const accounts = api.accounts.list.useQuery();
  const statementDocuments = api.documents.statementDocumentsByAccount.useQuery();
  const [formOpen, setFormOpen] = useState(false);

  const missingCountByAccount = useMemo(() => {
    if (!accounts.data) return {};
    const missing = buildMissingStatements(accounts.data, statementDocuments.data ?? {});
    const counts: Record<string, number> = {};
    for (const item of missing) {
      counts[item.accountId] = (counts[item.accountId] ?? 0) + 1;
    }
    return counts;
  }, [accounts.data, statementDocuments.data]);

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
        <Button onClick={() => setFormOpen(true)}>
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
            <Button className="mt-4" variant="outline" onClick={() => setFormOpen(true)}>
              <Plus /> Add account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((account) => {
            const openedLabel = formatDateLabel(account.openedDate);
            const closedLabel = formatDateLabel(account.closedDate);
            const showOpenedDateWarning = needsOpenedDateWarning(account);
            const missingCount = missingCountByAccount[account.id] ?? 0;

            return (
              <Link key={account.id} href={`/accounts/${account.id}`} className="block">
                <Card className="shadow-none transition-colors hover:bg-muted/30">
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{account.displayName}</p>
                        <Badge variant="secondary">
                          {statementFrequencyLabels[account.statementFrequency]}
                        </Badge>
                        {missingCount > 0 ? (
                          <Badge variant="outline" className="border-red-500/40 text-red-700">
                            {missingCount} missing
                          </Badge>
                        ) : null}
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
                        {openedLabel || closedLabel
                          ? ` · ${openedLabel ? `Opened ${openedLabel}` : ""}${openedLabel && closedLabel ? " · " : ""}${closedLabel ? `Closed ${closedLabel}` : ""}`
                          : ""}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {formOpen ? (
        <AccountFormSheet
          key="new"
          account={null}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      ) : null}
    </div>
  );
}
