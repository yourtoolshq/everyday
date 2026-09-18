"use client";

import { ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react";
import { useMemo, useState } from "react";

import {
  canDeriveStatementPeriods,
  countExpectedPeriods,
  deriveExpectedPeriodsForYear,
  periodStatusLabels,
  statementYearRange,
  type ExpectedPeriod,
  type PeriodDisplayStatus,
} from "~/lib/expected-periods";
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

const periodStatusStyles: Record<
  PeriodDisplayStatus,
  { cell: string; dot: string }
> = {
  not_expected: {
    cell: "border border-dashed border-border/80 bg-transparent text-muted-foreground/50",
    dot: "bg-muted-foreground/30",
  },
  future: {
    cell: "border border-border/60 bg-muted/40 text-muted-foreground",
    dot: "bg-muted-foreground/40",
  },
  current: {
    cell: "border border-primary/25 bg-gradient-to-br from-primary/15 to-primary/5 text-primary",
    dot: "bg-primary",
  },
  past_expected: {
    cell: "border border-sky-500/20 bg-gradient-to-br from-sky-500/15 to-sky-500/5 text-sky-900 dark:text-sky-100",
    dot: "bg-sky-500",
  },
};

function PeriodCell({ period }: { period: ExpectedPeriod }) {
  const styles = periodStatusStyles[period.status];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex aspect-[4/3] min-h-14 flex-col items-center justify-center rounded-lg px-2 py-2 text-center transition-colors",
            styles.cell,
          )}
        >
          <span className="text-sm font-medium">{period.shortLabel}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-left">
        <p className="font-medium">{period.label}</p>
        <p>{periodStatusLabels[period.status]}</p>
        <p className="text-background/70">Upload tracking coming soon</p>
      </TooltipContent>
    </Tooltip>
  );
}

function PeriodLegend() {
  const items: { status: PeriodDisplayStatus; label: string }[] = [
    { status: "past_expected", label: "Expected" },
    { status: "current", label: "Current" },
    { status: "future", label: "Future" },
    { status: "not_expected", label: "Not expected" },
  ];

  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.status} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", periodStatusStyles[item.status].dot)} />
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

export function AccountStatementPeriods({ account }: { account: Account }) {
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

  const expectedCount = countExpectedPeriods(periods);

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
            {expectedCount} expected in {year}
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
              <PeriodCell key={period.key} period={period} />
            ))}
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {periods.map((period) => {
              const styles = periodStatusStyles[period.status];
              return (
                <div
                  key={period.key}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", styles.dot)} />
                    <span className="font-medium">{period.label}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {periodStatusLabels[period.status]}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </TooltipProvider>

      <PeriodLegend />
      <p className="text-xs text-muted-foreground">
        Period colors reflect timing only. Upload tracking will show complete and missing
        statements in a later phase.
      </p>
    </div>
  );
}
