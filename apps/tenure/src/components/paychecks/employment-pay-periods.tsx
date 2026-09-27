"use client";

import { useMemo, useState } from "react";

import type {
  PeriodCoverageCell,
  PeriodTone,
} from "@yourtoolshq/ui/period-coverage";
import { Button } from "@yourtoolshq/ui/button";
import { PeriodCoverage } from "@yourtoolshq/ui/period-coverage";

import type { PayFrequency } from "~/lib/pay-frequency";
import type { PayStubCompletenessStatus } from "~/lib/pay-stub-completeness";
import type { RouterOutputs } from "~/trpc/react";
import { PayPeriodDetailSheet } from "~/components/paychecks/pay-period-detail-sheet";
import { payYearRange } from "~/lib/expected-pay-periods";
import { payFrequencyLabels } from "~/lib/pay-frequency";
import { payStubCompletenessLabels } from "~/lib/pay-stub-completeness";
import { api } from "~/trpc/react";

type PeriodRow =
  RouterOutputs["paychecks"]["periodCompleteness"]["periods"][number];

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
  onDeletePaycheck: (paycheckId: string) => void;
};

const periodTones: Record<PayStubCompletenessStatus, PeriodTone> = {
  complete: "complete",
  missing_paycheck: "missing",
  missing_stub: "attention",
  waiting: "waiting",
  future: "future",
  not_expected: "inactive",
  not_applicable: "exempt",
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

const legend: { tone: PeriodTone; label: string }[] = [
  { tone: "complete", label: "Complete" },
  { tone: "missing", label: "Missing paycheck" },
  { tone: "attention", label: "Missing stub" },
  { tone: "exempt", label: "Not applicable" },
  { tone: "waiting", label: "Waiting" },
  { tone: "future", label: "Future" },
  { tone: "inactive", label: "Not expected" },
];

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
  onDeletePaycheck,
}: EmploymentPayPeriodsProps) {
  const lifecycle = useMemo(
    () => ({ startDate, endDate, status }),
    [endDate, startDate, status],
  );
  const yearRange = useMemo(() => payYearRange(lifecycle), [lifecycle]);
  const defaultYear = yearRange?.maxYear ?? new Date().getFullYear();
  const [year, setYear] = useState(defaultYear);
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

  const cells: PeriodCoverageCell[] = periods.map((period) => {
    const completenessStatus = period.completeness;
    const canOpen =
      completenessStatus === "complete" ||
      completenessStatus === "missing_stub" ||
      completenessStatus === "missing_paycheck" ||
      completenessStatus === "waiting";
    const canUndoNotApplicable = completenessStatus === "not_applicable";

    return {
      key: period.key,
      shortLabel: period.shortLabel,
      label: period.label,
      tone: periodTones[completenessStatus],
      ariaLabel: canUndoNotApplicable
        ? `Undo not applicable for ${period.label}`
        : `${period.label} details`,
      onActivate: canUndoNotApplicable
        ? () =>
            removeException.mutate({
              employmentId,
              periodKey: period.key,
            })
        : canOpen
          ? () => setSelectedPeriod(period)
          : undefined,
      icon:
        completenessStatus === "complete"
          ? "check"
          : completenessStatus === "not_applicable"
            ? "minus"
            : completenessStatus === "missing_stub"
              ? "paperclip"
              : undefined,
      meta: period.paycheckCount > 1 ? String(period.paycheckCount) : undefined,
      tooltip: (
        <>
          <p className="font-medium">{period.label}</p>
          <p>{payStubCompletenessLabels[completenessStatus]}</p>
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
        </>
      ),
      listMeta:
        period.paycheckCount > 1
          ? `${period.paycheckCount} paychecks`
          : undefined,
      listAction: canOpen ? (
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
          {payStubCompletenessLabels[completenessStatus]}
        </span>
      ),
    };
  });

  return (
    <>
      <PeriodCoverage
        year={year}
        canPrevious={canGoBack}
        canNext={canGoForward}
        onPrevious={() => setYear((current) => current - 1)}
        onNext={() => setYear((current) => current + 1)}
        frequencyLabel={payFrequencyLabels[payFrequency]}
        summary={summary ? formatYearSummary(summary) : undefined}
        columnsClassName={gridColumns(payFrequency)}
        cells={cells}
        legend={legend}
        emptyLabel={`No expected pay periods for ${year}.`}
      />
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
        onDeletePaycheck={onDeletePaycheck}
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
    </>
  );
}
