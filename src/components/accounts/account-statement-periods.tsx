"use client";

import { Check, ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react";
import { useMemo, useState } from "react";

import {
  canDeriveStatementPeriods,
  deriveExpectedPeriodsForYear,
  statementYearRange,
  type ExpectedPeriod,
} from "~/lib/expected-periods";
import {
  completenessStatusLabels,
  countCompletenessForYear,
  deriveStatementCompleteness,
  type StatementCompletenessStatus,
} from "~/lib/statement-completeness";
import { statementFrequencyLabels, type StatementFrequency } from "~/lib/statement-frequency";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "cn";
import type { RouterOutputs } from "~/trpc/react";

type Account = RouterOutputs["accounts"]["list"][number];

type ViewMode = "grid" | "list";

const completenessStatusStyles: Record<
  StatementCompletenessStatus,
  { cell: string; dot: string }
> = {
  complete: {
    cell: "border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 text-emerald-900 dark:text-emerald-100",
    dot: "bg-emerald-500",
  },
  missing: {
    cell: "border border-red-500/30 bg-gradient-to-br from-red-500/15 to-red-500/5 text-red-900 dark:text-red-100",
    dot: "bg-red-500",
  },
  waiting: {
    cell: "border border-primary/25 bg-gradient-to-br from-primary/15 to-primary/5 text-primary",
    dot: "bg-primary",
  },
  future: {
    cell: "border border-border/60 bg-muted/40 text-muted-foreground",
    dot: "bg-muted-foreground/40",
  },
  not_expected: {
    cell: "border border-dashed border-border/80 bg-transparent text-muted-foreground/50",
    dot: "bg-muted-foreground/30",
  },
};

function documentFileUrl(documentId: string) {
  return `/api/documents/${documentId}/file`;
}

function PeriodCell({
  period,
  documentId,
  onUpload,
}: {
  period: ExpectedPeriod;
  documentId?: string;
  onUpload?: () => void;
}) {
  const completeness = deriveStatementCompleteness(period, Boolean(documentId));
  const styles = completenessStatusStyles[completeness];
  const canUpload =
    (completeness === "missing" || completeness === "waiting") && Boolean(onUpload);
  const cellClassName = cn(
    "flex aspect-[4/3] min-h-14 w-full flex-col items-center justify-center rounded-lg px-2 py-2 text-center transition-colors",
    styles.cell,
    (canUpload || completeness === "complete") && "cursor-pointer hover:brightness-95",
    !canUpload && completeness !== "complete" && completeness !== "not_expected" && "cursor-default",
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {completeness === "complete" && documentId ? (
          <a
            href={documentFileUrl(documentId)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${period.label} statement`}
            className={cellClassName}
          >
            <Check className="size-4" aria-hidden="true" />
          </a>
        ) : (
          <button
            type="button"
            disabled={!canUpload}
            onClick={canUpload ? onUpload : undefined}
            className={cellClassName}
          >
            <span className="text-sm font-medium">{period.shortLabel}</span>
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" className="text-left">
        <p className="font-medium">{period.label}</p>
        <p>{completenessStatusLabels[completeness]}</p>
        {completeness === "complete" ? <p className="text-background/70">Click to open</p> : null}
        {canUpload ? <p className="text-background/70">Click to upload</p> : null}
      </TooltipContent>
    </Tooltip>
  );
}

function PeriodLegend() {
  const items: { status: StatementCompletenessStatus; label: string }[] = [
    { status: "complete", label: "Complete" },
    { status: "missing", label: "Missing" },
    { status: "waiting", label: "Waiting" },
    { status: "future", label: "Future" },
    { status: "not_expected", label: "Not expected" },
  ];

  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.status} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", completenessStatusStyles[item.status].dot)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function gridColumns(frequency: StatementFrequency): string {
  switch (frequency) {
    case "monthly":
      return "grid-cols-2 sm:grid-cols-4";
    case "quarterly":
      return "grid-cols-2 sm:grid-cols-4";
    case "annually":
      return "grid-cols-1";
    default:
      return "grid-cols-1";
  }
}

export function AccountStatementPeriods({
  account,
  statementDocumentsByPeriod = {},
  onUploadPeriod,
}: {
  account: Account;
  statementDocumentsByPeriod?: Readonly<Record<string, string>>;
  onUploadPeriod?: (periodKey: string) => void;
}) {
  const frequency = account.statementFrequency;
  const lifecycle = useMemo(
    () => ({
      openedDate: account.openedDate,
      closedDate: account.closedDate,
      status: account.status,
    }),
    [account.closedDate, account.openedDate, account.status],
  );

  const yearRange = useMemo(() => statementYearRange(lifecycle), [lifecycle]);

  const defaultYear = yearRange?.maxYear ?? new Date().getFullYear();
  const [year, setYear] = useState(defaultYear);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const periods = useMemo(
    () => deriveExpectedPeriodsForYear(lifecycle, frequency, year),
    [frequency, lifecycle, year],
  );

  const { completeCount, missingCount, waitingCount, expectedCount } = countCompletenessForYear(
    periods,
    statementDocumentsByPeriod,
  );

  if (frequency === "none") {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No statement schedule configured for this account.
      </div>
    );
  }

  if (!canDeriveStatementPeriods(lifecycle, frequency)) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-900 dark:text-amber-100">
        <p className="font-medium">Opened date required</p>
        <p className="mt-1 text-amber-800/80 dark:text-amber-100/80">
          Add an opened date to derive expected statement periods for this account.
        </p>
      </div>
    );
  }

  const canGoBack = yearRange ? year > yearRange.minYear : false;
  const canGoForward = yearRange ? year < yearRange.maxYear : false;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous year"
            disabled={!canGoBack}
            onClick={() => setYear((current) => current - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-16 text-center text-sm font-medium">{year}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next year"
            disabled={!canGoForward}
            onClick={() => setYear((current) => current + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{statementFrequencyLabels[frequency]}</Badge>
          <span className="text-sm text-muted-foreground">
            {completeCount}/{expectedCount} complete in {year}
            {missingCount > 0 ? ` · ${missingCount} missing` : ""}
            {waitingCount > 0 ? ` · ${waitingCount} waiting` : ""}
          </span>
          <div className="flex rounded-lg border p-0.5">
            <Button
              type="button"
              size="icon"
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              aria-label="Grid view"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid />
            </Button>
            <Button
              type="button"
              size="icon"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              aria-label="List view"
              onClick={() => setViewMode("list")}
            >
              <List />
            </Button>
          </div>
        </div>
      </div>

      <TooltipProvider>
        {viewMode === "grid" ? (
          <div className={cn("grid gap-2", gridColumns(frequency))}>
            {periods.map((period) => (
              <PeriodCell
                key={period.key}
                period={period}
                documentId={statementDocumentsByPeriod[period.key]}
                onUpload={
                  onUploadPeriod ? () => onUploadPeriod(period.key) : undefined
                }
              />
            ))}
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {periods.map((period) => {
              const documentId = statementDocumentsByPeriod[period.key];
              const completeness = deriveStatementCompleteness(period, Boolean(documentId));
              const styles = completenessStatusStyles[completeness];
              const canUpload =
                (completeness === "missing" || completeness === "waiting") &&
                Boolean(onUploadPeriod);
              return (
                <div
                  key={period.key}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", styles.dot)} />
                    <span className="font-medium">{period.label}</span>
                  </div>
                  {completeness === "complete" && documentId ? (
                    <Button size="sm" variant="ghost" asChild>
                      <a
                        href={documentFileUrl(documentId)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>
                    </Button>
                  ) : canUpload ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onUploadPeriod?.(period.key)}
                    >
                      Upload
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">
                      {completenessStatusLabels[completeness]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </TooltipProvider>

      <PeriodLegend />
      <p className="text-xs text-muted-foreground">
        Red periods are missing. Blue is the current period still waiting for a statement.
      </p>
    </div>
  );
}
