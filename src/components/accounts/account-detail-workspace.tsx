"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, Pencil, Settings, Upload } from "lucide-react";
import { useMemo, useState } from "react";

import { AccountFormSheet } from "~/components/accounts/account-form-sheet";
import { AccountSettingsSheet } from "~/components/accounts/account-settings-sheet";
import { AccountStatementPeriods } from "~/components/accounts/account-statement-periods";
import { StatementUploadSheet } from "~/components/documents/statement-upload-sheet";
import { accountStatusLabels } from "~/lib/account-status";
import { accountTypeLabels } from "~/lib/account-types";
import { canDeriveStatementPeriods } from "~/lib/expected-periods";
import { formatDateLabel } from "~/lib/format-date";
import { buildMissingStatements } from "~/lib/statement-completeness";
import { statementFrequencyLabels } from "~/lib/statement-frequency";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";

type UploadTarget = {
  periodKey?: string;
};

export function AccountDetailWorkspace({ accountId }: { accountId: string }) {
  const account = api.accounts.get.useQuery({ id: accountId });
  const statementDocuments = api.documents.statementDocumentsByAccount.useQuery();
  const [formOpen, setFormOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null);

  const missingStatements = useMemo(() => {
    if (!account.data) return [];
    return buildMissingStatements([account.data], statementDocuments.data ?? {});
  }, [account.data, statementDocuments.data]);

  if (account.isLoading || statementDocuments.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (account.error || !account.data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/accounts">
            <ArrowLeft />
            Back to accounts
          </Link>
        </Button>
        <p className="text-sm text-destructive">
          {account.error?.message ?? "Account not found."}
        </p>
      </div>
    );
  }

  const openedLabel = formatDateLabel(account.data.openedDate);
  const closedLabel = formatDateLabel(account.data.closedDate);
  const showOpenedDateWarning =
    account.data.statementFrequency !== "none" &&
    !canDeriveStatementPeriods(
      {
        openedDate: account.data.openedDate,
        closedDate: account.data.closedDate,
        status: account.data.status,
      },
      account.data.statementFrequency,
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/accounts">
            <ArrowLeft />
            Accounts
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">{account.data.institutionName}</p>
            <h2 className="text-3xl font-semibold tracking-tight">{account.data.displayName}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{accountTypeLabels[account.data.accountType]}</Badge>
              <Badge variant="outline">{accountStatusLabels[account.data.status]}</Badge>
              <Badge variant="secondary">
                {statementFrequencyLabels[account.data.statementFrequency]}
              </Badge>
              {showOpenedDateWarning ? (
                <Badge variant="outline" className="border-amber-500/40 text-amber-800">
                  <AlertTriangle />
                  Missing opened date
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span>
              <span className="text-foreground">Owners</span>{" "}
              {account.data.owners.map((owner) => owner.displayName).join(", ")}
            </span>
            {account.data.identifierSuffix ? (
              <span>
                <span className="text-foreground">Identifier</span> …{account.data.identifierSuffix}
              </span>
            ) : null}
            {openedLabel ? (
              <span>
                <span className="text-foreground">Opened</span> {openedLabel}
              </span>
            ) : null}
            {closedLabel ? (
              <span>
                <span className="text-foreground">Closed</span> {closedLabel}
              </span>
            ) : null}
          </div>

          {account.data.notes ? (
            <p className="max-w-3xl text-sm text-muted-foreground">{account.data.notes}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {account.data.statementFrequency !== "none" ? (
            <Button onClick={() => setUploadTarget({})}>
              <Upload />
              Upload statement
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings />
            Schedule
          </Button>
          <Button variant="outline" onClick={() => setFormOpen(true)}>
            <Pencil />
            Edit
          </Button>
        </div>
      </div>

      {account.data.statementFrequency !== "none" ? (
        <Card className="shadow-none">
          <CardContent className="space-y-4 p-4">
            <div>
              <h3 className="font-medium">Statements</h3>
              <p className="text-sm text-muted-foreground">
                Track completeness by period for this account.
              </p>
            </div>
            <Separator />
            <AccountStatementPeriods
              account={account.data}
              statementDocumentsByPeriod={statementDocuments.data?.[account.data.id] ?? {}}
              onUploadPeriod={(periodKey) => setUploadTarget({ periodKey })}
            />
          </CardContent>
        </Card>
      ) : null}

      {account.data.statementFrequency !== "none" ? (
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Needs attention</CardTitle>
          </CardHeader>
          <CardContent>
            {missingStatements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No missing statements for this account.
              </p>
            ) : (
              <ul className="divide-y">
                {missingStatements.map((item) => (
                  <li
                    key={item.periodKey}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <span className="font-medium">{item.periodLabel}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setUploadTarget({ periodKey: item.periodKey })}
                    >
                      Upload
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {formOpen ? (
        <AccountFormSheet
          key={account.data.id}
          account={account.data}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      ) : null}

      {settingsOpen ? (
        <AccountSettingsSheet
          key={account.data.id}
          account={account.data}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      ) : null}

      {uploadTarget ? (
        <StatementUploadSheet
          key={`${account.data.id}-${uploadTarget.periodKey ?? "new"}`}
          open={Boolean(uploadTarget)}
          onOpenChange={(open) => {
            if (!open) setUploadTarget(null);
          }}
          accountId={account.data.id}
          periodKey={uploadTarget.periodKey}
        />
      ) : null}
    </div>
  );
}
