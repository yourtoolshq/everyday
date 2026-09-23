"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Minus,
  Paperclip,
} from "lucide-react";

import type { PayFrequency } from "~/lib/pay-frequency";
import type { PayStubCompletenessStatus } from "~/lib/pay-stub-completeness";
import type { RouterOutputs } from "~/trpc/react";
import { PayPeriodDetailSheet } from "~/components/paychecks/pay-period-detail-sheet";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { payYearRange } from "~/lib/expected-pay-periods";
import { payFrequencyLabels } from "~/lib/pay-frequency";
import { payStubCompletenessLabels } from "~/lib/pay-stub-completeness";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

type PeriodRow =
  RouterOutputs["paychecks"]["periodCompleteness"]["periods"][number];
type ViewMode = "grid" | "list";

type Paycheck = RouterOutputs["paychecks"]["listByEmployment"][number];

type EmploymentPayPeriodsProps = {
  employmentId: string;
  payFrequency: PayFrequency;
  startDate: string | null;
  endDate: string | null;
  status: "current" | "former";
  paychecks: Paycheck[];
  onAddPaycheck: (periodKey: string) => void;
  onEditPaycheck: (paycheckId: string) => void;
  onAttachStub: (paycheckId: string) => void;
};

const completenessStatusStyles: Record<
  PayStubCompletenessStatus,
  { cell: string; dot: string }
> = {
  complete: {
    cell: "border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 text-emerald-900 dark:text-emerald-100",
    dot: "bg-emerald-500",
  },
  missing_paycheck: {
    cell: "border border-red-500/30 bg-gradient-to-br from-red-500/15 to-red-500/5 text-red-900 dark:text-red-100",
    dot: "bg-red-500",
  },
  missing_stub: {
    cell: "border border-amber-500/30 bg-gradient-to-br from-amber-500/15 to-amber-500/5 text-amber-900 dark:text-amber-100",
    dot: "bg-amber-500",
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
  not_applicable: {
    cell: "border border-zinc-500/30 bg-gradient-to-br from-zinc-500/15 to-zinc-500/5 text-zinc-700 dark:text-zinc-200",
    dot: "bg-zinc-500",
  },
};

function gridColumns(frequency: PayFrequency): string {
  switch (frequency) {
    case "monthly":
      return "grid-cols-3 sm:grid-cols-4";
    case "semimonthly":
      return "grid-cols-4 sm:grid-cols-6";
    case "biweekly":
      return "grid-cols-4 sm:grid-cols-6 lg:grid-cols-8";
    case "weekly":
      return "grid-cols-4 sm:grid-cols-6 lg:grid-cols-8";
    default:
      return "grid-cols-2 sm:grid-cols-4";
  }
}

function formatYearSummary(
  summary: RouterOutputs["paychecks"]["periodCompleteness"]["summary"],
) {
  const satisfiedCount = summary.completeCount + summary.notApplicableCount;
  const parts = [`${satisfiedCount}/${summary.expectedCount} satisfied`];

  if (summary.missingPaycheckCount > 0) {
    parts.push(`${summary.missingPaycheckCount} missing paycheck`);
  }
  if (summary.missingStubCount > 0) {
    parts.push(`${summary.missingStubCount} missing stub`);
  }
  if (summary.waitingCount > 0) {
    parts.push(`${summary.waitingCount} waiting`);
  }

  return parts.join(" · ");
}

function PeriodCell({
  period,
  onOpen,
  onUndoNotApplicable,
}: {
  period: PeriodRow;
  onOpen?: () => void;
  onUndoNotApplicable?: () => void;
}) {
  const completeness = period.completeness;
  const styles = completenessStatusStyles[completeness];
  const canOpen =
    completeness === "complete" ||
    completeness === "missing_stub" ||
    completeness === "missing_paycheck" ||
    completeness === "waiting";
  const canUndoNotApplicable =
    completeness === "not_applicable" && Boolean(onUndoNotApplicable);

  const cellClassName = cn(
    "flex aspect-[4/3] min-h-14 w-full flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-center transition-colors",
    styles.cell,
    (canOpen || canUndoNotApplicable) && "cursor-pointer hover:brightness-95",
    !canOpen && !canUndoNotApplicable && "cursor-default",
  );

  const icon =
    completeness === "complete" ? (
      <Check className="size-3.5 shrink-0" aria-hidden="true" />
    ) : completeness === "not_applicable" ? (
      <Minus className="size-3.5 shrink-0" aria-hidden="true" />
    ) : completeness === "missing_stub" ? (
      <Paperclip className="size-3.5 shrink-0" aria-hidden="true" />
    ) : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {canUndoNotApplicable ? (
          <button
            type="button"
            aria-label={`Undo not applicable for ${period.label}`}
            className={cellClassName}
            onClick={onUndoNotApplicable}
          >
            <span className="text-xs leading-tight font-medium sm:text-sm">
              {period.shortLabel}
            </span>
            {icon}
          </button>
        ) : (
          <button
            type="button"
            aria-label={`${period.label} details`}
            className={cellClassName}
            disabled={!canOpen}
            onClick={canOpen ? onOpen : undefined}
          >
            <span className="text-xs leading-tight font-medium sm:text-sm">
              {period.shortLabel}
            </span>
            {icon}
            {period.paycheckCount > 1 ? (
              <span className="text-[10px] font-medium opacity-80">
                {period.paycheckCount}
              </span>
            ) : null}
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-56 text-left">
        <p className="font-medium">{period.label}</p>
        <p>{payStubCompletenessLabels[completeness]}</p>
        {period.paycheckCount > 0 ? (
          <p className="text-background/70">
            {period.paycheckCount} paycheck
            {period.paycheckCount === 1 ? "" : "s"}
          </p>
        ) : null}
        {canOpen ? (
          <p className="text-background/70">Click for details</p>
        ) : null}
        {canUndoNotApplicable ? (
          <p className="text-background/70">Click to undo</p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

function PeriodLegend() {
  const items: { status: PayStubCompletenessStatus; label: string }[] = [
    { status: "complete", label: "Complete" },
    { status: "missing_paycheck", label: "Missing paycheck" },
    { status: "missing_stub", label: "Missing stub" },
    { status: "not_applicable", label: "Not applicable" },
    { status: "waiting", label: "Waiting" },
    { status: "future", label: "Future" },
    { status: "not_expected", label: "Not expected" },
  ];

  return (
    <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
      {items.map((item) => (
        <span key={item.status} className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              "size-2 rounded-full",
              completenessStatusStyles[item.status].dot,
            )}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function EmploymentPayPeriods({
  employmentId,
  payFrequency,
  startDate,
  endDate,
  status,
  paychecks,
  onAddPaycheck,
  onEditPaycheck,
  onAttachStub,
}: EmploymentPayPeriodsProps) {
  const lifecycle = useMemo(
    () => ({ startDate, endDate, status }),
    [endDate, startDate, status],
  );
  const yearRange = useMemo(() => payYearRange(lifecycle), [lifecycle]);
  const defaultYear = yearRange?.maxYear ?? new Date().getFullYear();
  const [year, setYear] = useState(defaultYear);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodRow | null>(null);

  const completeness = api.paychecks.periodCompleteness.useQuery({
    employmentId,
    year,
  });
  const markNotApplicable = api.paychecks.markPeriodNotApplicable.useMutation({
    onSuccess: () => completeness.refetch(),
  });
  const removeException = api.paychecks.removePeriodException.useMutation({
    onSuccess: () => completeness.refetch(),
  });

  const periods = completeness.data?.periods ?? [];

  if (payFrequency === "irregular") {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        Set a pay frequency in pay settings to track expected pay periods.
      </div>
    );
  }

  if (!startDate) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-900 dark:text-amber-100">
        <p className="font-medium">Start date required</p>
        <p className="mt-1 text-amber-800/80 dark:text-amber-100/80">
          Add an employment start date to derive expected pay periods.
        </p>
      </div>
    );
  }

  if (completeness.isLoading) {
    return (
      <p className="text-muted-foreground text-sm">Loading pay periods…</p>
    );
  }

  const summary = completeness.data?.summary;
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
          <span className="min-w-16 text-center text-sm font-medium">
            {year}
          </span>
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
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{payFrequencyLabels[payFrequency]}</Badge>
          {summary ? (
            <span className="text-muted-foreground text-sm">
              {formatYearSummary(summary)}
            </span>
          ) : null}
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
        {periods.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No expected pay periods for {year}.
          </p>
        ) : viewMode === "grid" ? (
          <div className={cn("grid gap-2", gridColumns(payFrequency))}>
            {periods.map((period) => (
              <PeriodCell
                key={period.key}
                period={period}
                onOpen={() => setSelectedPeriod(period)}
                onUndoNotApplicable={() =>
                  removeException.mutate({
                    employmentId,
                    periodKey: period.key,
                  })
                }
              />
            ))}
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {periods.map((period) => {
              const styles = completenessStatusStyles[period.completeness];
              const canOpen =
                period.completeness === "complete" ||
                period.completeness === "missing_stub" ||
                period.completeness === "missing_paycheck" ||
                period.completeness === "waiting";
              const canUndoNotApplicable =
                period.completeness === "not_applicable";

              return (
                <div
                  key={period.key}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn("size-2 shrink-0 rounded-full", styles.dot)}
                    />
                    <span className="truncate font-medium">{period.label}</span>
                    {period.paycheckCount > 1 ? (
                      <span className="text-muted-foreground text-xs">
                        {period.paycheckCount} paychecks
                      </span>
                    ) : null}
                  </div>
                  {canOpen ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedPeriod(period)}
                    >
                      Details
                    </Button>
                  ) : canUndoNotApplicable ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        removeException.mutate({
                          employmentId,
                          periodKey: period.key,
                        })
                      }
                    >
                      Undo
                    </Button>
                  ) : (
                    <span className="text-muted-foreground shrink-0">
                      {payStubCompletenessLabels[period.completeness]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </TooltipProvider>

      <PeriodLegend />

      <PayPeriodDetailSheet
        period={selectedPeriod}
        paychecks={paychecks}
        open={Boolean(selectedPeriod)}
        onOpenChange={(open) => {
          if (!open) setSelectedPeriod(null);
        }}
        onAddPaycheck={onAddPaycheck}
        onEditPaycheck={onEditPaycheck}
        onAttachStub={onAttachStub}
        onMarkNotApplicable={(periodKey) =>
          markNotApplicable.mutate({
            employmentId,
            periodKey,
          })
        }
        onUndoNotApplicable={(periodKey) =>
          removeException.mutate({
            employmentId,
            periodKey,
          })
        }
      />
    </div>
  );
}
