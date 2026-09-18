import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { RouterOutputs } from "~/trpc/react";

type StatementStatus = RouterOutputs["overview"]["statementStatus"];

export function MissingStatementsPanel({ status }: { status: StatementStatus }) {
  const { yearSummary, missingStatements } = status;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{yearSummary.year} statement completeness</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Expected</p>
              <p className="text-2xl font-semibold">{yearSummary.expectedCount}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Satisfied</p>
              <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                {yearSummary.completeCount + yearSummary.notApplicableCount}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Missing</p>
              <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
                {yearSummary.missingCount}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Waiting</p>
              <p className="text-2xl font-semibold">{yearSummary.waitingCount}</p>
            </div>
          </div>
          {yearSummary.notApplicableCount > 0 ? (
            <p className="text-sm text-muted-foreground">
              {yearSummary.completeCount} complete · {yearSummary.notApplicableCount} not applicable
            </p>
          ) : null}
          {yearSummary.missingCount === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-4" />
              No missing statements for {yearSummary.year}.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {missingStatements.length > 0 ? (
              <AlertCircle className="size-4 text-red-600 dark:text-red-400" />
            ) : null}
            Missing statements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {missingStatements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Every expected past statement has been uploaded.
            </p>
          ) : (
            <ul className="divide-y">
              {missingStatements.map((item) => (
                <li key={`${item.accountId}-${item.periodKey}`} className="flex py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.accountName}</p>
                    <p className="text-muted-foreground">
                      {item.institutionName} · {item.periodLabel}
                    </p>
                  </div>
                  <Link
                    href={`/accounts/${item.accountId}`}
                    className="shrink-0 text-sm font-medium text-primary hover:underline"
                  >
                    View account
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
