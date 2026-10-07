"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Plus, Users } from "lucide-react";

import { Badge } from "@yourtoolshq/ui/badge";
import { Button } from "@yourtoolshq/ui/button";
import { Card, CardContent } from "@yourtoolshq/ui/card";
import { Skeleton } from "@yourtoolshq/ui/skeleton";

import type { StatementFrequency } from "~/lib/statement-frequency";
import { AccountFormSheet } from "~/components/accounts/account-form-sheet";
import { InstitutionIcon } from "~/components/institutions/institution-icon";
import { groupAccounts } from "~/lib/account-groups";
import { accountStatusLabels } from "~/lib/account-status";
import { accountTypeLabels } from "~/lib/account-types";
import { canDeriveStatementPeriods } from "~/lib/expected-periods";
import {
  buildExceptionsByAccount,
  buildMissingStatements,
} from "~/lib/statement-completeness";
import { statementFrequencyLabels } from "~/lib/statement-frequency";
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
  const statementDocuments =
    api.documents.statementDocumentsByAccount.useQuery();
  const periodExceptions = api.statementPeriodExceptions.listAll.useQuery();
  const [formOpen, setFormOpen] = useState(false);
  const [grouping, setGrouping] = useState<"institution" | "owners">(
    "institution",
  );
  const [status, setStatus] = useState<"active" | "closed" | "all">("active");

  const exceptionsByAccount = useMemo(
    () => buildExceptionsByAccount(periodExceptions.data ?? []),
    [periodExceptions.data],
  );

  const missingCountByAccount = useMemo(() => {
    if (!accounts.data) return {};
    const missing = buildMissingStatements(
      accounts.data,
      statementDocuments.data ?? {},
      exceptionsByAccount,
    );
    const counts: Record<string, number> = {};
    for (const item of missing) {
      counts[item.accountId] = (counts[item.accountId] ?? 0) + 1;
    }
    return counts;
  }, [accounts.data, exceptionsByAccount, statementDocuments.data]);

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
      <p className="text-destructive text-sm">
        Unable to load accounts. {accounts.error.message}
      </p>
    );
  }

  const items = accounts.data ?? [];
  const filtered = items.filter(
    (account) => status === "all" || account.status === status,
  );
  const groups = groupAccounts(filtered, grouping);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-primary text-sm font-medium">Inventory</p>
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
            <p className="text-muted-foreground mt-1 text-sm">
              Add your first financial account to start building the household
              inventory.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => setFormOpen(true)}
            >
              <Plus /> Add account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label="Filter accounts by status"
            >
              {(["active", "closed", "all"] as const).map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={status === value ? "secondary" : "ghost"}
                  aria-pressed={status === value}
                  onClick={() => setStatus(value)}
                >
                  {{ active: "Active", closed: "Closed", all: "All" }[value]}
                </Button>
              ))}
              <span
                className="text-muted-foreground ml-2 text-xs"
                role="status"
              >
                {filtered.length}{" "}
                {filtered.length === 1 ? "account" : "accounts"}
              </span>
            </div>
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label="Group accounts by"
            >
              <span className="text-muted-foreground mr-1 text-xs">
                Group by
              </span>
              <Button
                size="sm"
                variant={grouping === "institution" ? "secondary" : "ghost"}
                aria-pressed={grouping === "institution"}
                onClick={() => setGrouping("institution")}
              >
                Institution
              </Button>
              <Button
                size="sm"
                variant={grouping === "owners" ? "secondary" : "ghost"}
                aria-pressed={grouping === "owners"}
                onClick={() => setGrouping("owners")}
              >
                Owners
              </Button>
            </div>
          </div>
          {filtered.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border p-6 text-sm">
              No {status === "all" ? "" : `${status} `}accounts. Choose another
              status to see your accounts.
            </p>
          ) : null}
          <div className="divide-y overflow-hidden rounded-lg border">
            {groups.map((group) => (
              <details
                key={`${grouping}-${status}-${group.key}`}
                open
                className="group/section"
              >
                <summary className="bg-muted/30 hover:bg-muted/50 focus-visible:ring-ring flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                  <ChevronRight
                    aria-hidden="true"
                    className="text-muted-foreground size-4 shrink-0 transition-transform group-open/section:rotate-90"
                  />
                  {grouping === "institution" ? (
                    <InstitutionIcon
                      fileId={group.accounts[0]?.institutionIconFileId ?? null}
                      className="size-6"
                    />
                  ) : (
                    <Users
                      aria-hidden="true"
                      className="text-muted-foreground size-4 shrink-0"
                    />
                  )}
                  <h3 className="min-w-0 flex-1 font-medium break-words">
                    {group.label}
                  </h3>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {group.accounts.length}{" "}
                    {group.accounts.length === 1 ? "account" : "accounts"}
                  </span>
                </summary>
                <ul className="divide-y">
                  {group.accounts.map((account) => {
                    const showOpenedDateWarning =
                      needsOpenedDateWarning(account);
                    const missingCount = missingCountByAccount[account.id] ?? 0;
                    const owners =
                      account.owners
                        .map((owner) => owner.displayName)
                        .sort((a, b) => a.localeCompare(b))
                        .join(" + ") || "Unassigned";
                    return (
                      <li key={account.id}>
                        <Link
                          href={`/accounts/${account.id}`}
                          className="hover:bg-muted/30 focus-visible:ring-ring flex items-center gap-3 px-3 py-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                        >
                          {grouping === "owners" ? (
                            <InstitutionIcon
                              fileId={account.institutionIconFileId}
                              className="size-7"
                            />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-sm font-medium break-words">
                                {account.displayName}
                              </span>
                              {account.identifierSuffix ? (
                                <span className="text-muted-foreground text-xs">
                                  …{account.identifierSuffix}
                                </span>
                              ) : null}
                              {account.status === "closed" ? (
                                <Badge variant="secondary">
                                  {accountStatusLabels[account.status]}
                                </Badge>
                              ) : null}
                              {missingCount > 0 &&
                              !statementDocuments.isLoading &&
                              !periodExceptions.isLoading &&
                              !statementDocuments.error &&
                              !periodExceptions.error ? (
                                <Badge
                                  variant="outline"
                                  className="border-destructive/30 text-destructive"
                                >
                                  {missingCount} missing
                                </Badge>
                              ) : null}
                              {showOpenedDateWarning ? (
                                <Badge
                                  variant="outline"
                                  className="border-amber-500/40 text-amber-800 dark:text-amber-300"
                                >
                                  <AlertTriangle aria-hidden="true" />
                                  Missing opened date
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-muted-foreground mt-0.5 text-xs break-words">
                              {grouping === "institution"
                                ? owners
                                : account.institutionName}{" "}
                              · {accountTypeLabels[account.accountType]} ·{" "}
                              {
                                statementFrequencyLabels[
                                  account.statementFrequency
                                ]
                              }
                            </p>
                          </div>
                          <ChevronRight
                            aria-hidden="true"
                            className="text-muted-foreground size-4 shrink-0"
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </details>
            ))}
          </div>
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
