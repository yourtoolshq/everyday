"use client";

import { useMemo, useState } from "react";

import type {
  PeriodCoverageCell,
  PeriodTone,
} from "@yourtoolshq/ui/period-coverage";
import { DocumentActionButtons } from "@yourtoolshq/data-ui";
import { Button } from "@yourtoolshq/ui/button";
import { PeriodCoverage } from "@yourtoolshq/ui/period-coverage";

import type { ExpectedPeriod } from "~/lib/expected-periods";
import type { StatementCompletenessStatus } from "~/lib/statement-completeness";
import type { StatementFrequency } from "~/lib/statement-frequency";
import type { RouterOutputs } from "~/trpc/react";
import { useDeleteDocumentDialog } from "~/components/documents/delete-document-dialog";
import { DocumentEditSheet } from "~/components/documents/document-edit-sheet";
import { StatementDetailSheet } from "~/components/documents/statement-detail-sheet";
import {
  canDeriveStatementPeriods,
  deriveExpectedPeriodsForYear,
  statementYearRange,
} from "~/lib/expected-periods";
import {
  completenessStatusLabels,
  countCompletenessForYear,
  deriveStatementCompleteness,
} from "~/lib/statement-completeness";
import { statementFrequencyLabels } from "~/lib/statement-frequency";

type Account = RouterOutputs["accounts"]["list"][number];
type StatementDocument = RouterOutputs["documents"]["overview"][number];

const periodTones: Record<StatementCompletenessStatus, PeriodTone> = {
  complete: "complete",
  missing: "missing",
  waiting: "waiting",
  future: "future",
  not_expected: "inactive",
  not_applicable: "exempt",
};

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

function formatYearSummary({
  completeCount,
  notApplicableCount,
  expectedCount,
  missingCount,
  waitingCount,
  year,
}: {
  completeCount: number;
  notApplicableCount: number;
  expectedCount: number;
  missingCount: number;
  waitingCount: number;
  year: number;
}) {
  const satisfiedCount = completeCount + notApplicableCount;
  const parts = [`${satisfiedCount}/${expectedCount} satisfied in ${year}`];

  if (notApplicableCount > 0) {
    parts.push(
      `${completeCount} complete · ${notApplicableCount} not applicable`,
    );
  }

  if (missingCount > 0) parts.push(`${missingCount} missing`);
  if (waitingCount > 0) parts.push(`${waitingCount} waiting`);

  return parts.join(" · ");
}

const legend: { tone: PeriodTone; label: string }[] = [
  { tone: "complete", label: "Complete" },
  { tone: "missing", label: "Missing" },
  { tone: "exempt", label: "Not applicable" },
  { tone: "waiting", label: "Waiting" },
  { tone: "future", label: "Future" },
  { tone: "inactive", label: "Not expected" },
];

export function AccountStatementPeriods({
  account,
  statementDocumentsByPeriod = {},
  exceptionsByPeriod = {},
  onUploadPeriod,
  onMarkNotApplicable,
  onUndoNotApplicable,
}: {
  account: Account;
  statementDocumentsByPeriod?: Readonly<Record<string, StatementDocument>>;
  exceptionsByPeriod?: Readonly<Record<string, true>>;
  onUploadPeriod?: (periodKey: string) => void;
  onMarkNotApplicable?: (periodKey: string) => void;
  onUndoNotApplicable?: (periodKey: string) => void;
}) {
  const { requestDelete, dialog: deleteDialog } = useDeleteDocumentDialog();
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
  const [selectedStatement, setSelectedStatement] = useState<{
    document: StatementDocument;
    periodLabel: string;
  } | null>(null);
  const [editingStatement, setEditingStatement] =
    useState<StatementDocument | null>(null);

  const periods = useMemo(
    () => deriveExpectedPeriodsForYear(lifecycle, frequency, year),
    [frequency, lifecycle, year],
  );

  const statementIdsByPeriod = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [periodKey, document] of Object.entries(
      statementDocumentsByPeriod,
    )) {
      map[periodKey] = document.id;
    }
    return map;
  }, [statementDocumentsByPeriod]);

  const {
    completeCount,
    notApplicableCount,
    missingCount,
    waitingCount,
    expectedCount,
  } = countCompletenessForYear(
    periods,
    statementIdsByPeriod,
    exceptionsByPeriod,
  );

  if (frequency === "none") {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
        No statement schedule configured for this account.
      </div>
    );
  }

  if (!canDeriveStatementPeriods(lifecycle, frequency)) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-900 dark:text-amber-100">
        <p className="font-medium">Opened date required</p>
        <p className="mt-1 text-amber-800/80 dark:text-amber-100/80">
          Add an opened date to derive expected statement periods for this
          account.
        </p>
      </div>
    );
  }

  const canGoBack = yearRange ? year > yearRange.minYear : false;
  const canGoForward = yearRange ? year < yearRange.maxYear : false;

  const cells: PeriodCoverageCell[] = periods.map((period) =>
    statementCell({
      period,
      document: statementDocumentsByPeriod[period.key],
      hasException: Boolean(exceptionsByPeriod[period.key]),
      onSelect: (document) =>
        setSelectedStatement({ document, periodLabel: period.label }),
      onUpload: onUploadPeriod ? () => onUploadPeriod(period.key) : undefined,
      onMarkNotApplicable: onMarkNotApplicable
        ? () => onMarkNotApplicable(period.key)
        : undefined,
      onUndoNotApplicable: onUndoNotApplicable
        ? () => onUndoNotApplicable(period.key)
        : undefined,
      onEdit: (document) => setEditingStatement(document),
      onDelete: (document) =>
        requestDelete({
          id: document.id,
          title: document.title,
        }),
    }),
  );

  return (
    <>
      <PeriodCoverage
        year={year}
        canPrevious={canGoBack}
        canNext={canGoForward}
        onPrevious={() => setYear((current) => current - 1)}
        onNext={() => setYear((current) => current + 1)}
        frequencyLabel={statementFrequencyLabels[frequency]}
        summary={formatYearSummary({
          completeCount,
          notApplicableCount,
          expectedCount,
          missingCount,
          waitingCount,
          year,
        })}
        columnsClassName={gridColumns(frequency)}
        cells={cells}
        legend={legend}
        note={
          <p className="text-muted-foreground text-xs">
            Red periods are missing. Gray periods are marked not applicable.
            Blue is the current period still waiting for a statement.
          </p>
        }
      />

      {selectedStatement ? (
        <StatementDetailSheet
          document={selectedStatement.document}
          periodLabel={selectedStatement.periodLabel}
          open={Boolean(selectedStatement)}
          onOpenChange={(open) => {
            if (!open) setSelectedStatement(null);
          }}
          onEdit={() => {
            setEditingStatement(selectedStatement.document);
            setSelectedStatement(null);
          }}
        />
      ) : null}

      {editingStatement ? (
        <DocumentEditSheet
          key={editingStatement.id}
          document={editingStatement}
          account={account}
          open={Boolean(editingStatement)}
          onOpenChange={(open) => {
            if (!open) setEditingStatement(null);
          }}
        />
      ) : null}
      {deleteDialog}
    </>
  );
}

function statementCell({
  period,
  document,
  hasException,
  onSelect,
  onUpload,
  onMarkNotApplicable,
  onUndoNotApplicable,
  onEdit,
  onDelete,
}: {
  period: ExpectedPeriod;
  document?: StatementDocument;
  hasException: boolean;
  onSelect?: (document: StatementDocument) => void;
  onUpload?: () => void;
  onMarkNotApplicable?: () => void;
  onUndoNotApplicable?: () => void;
  onEdit: (document: StatementDocument) => void;
  onDelete: (document: StatementDocument) => void;
}): PeriodCoverageCell {
  const completeness = deriveStatementCompleteness(
    period,
    Boolean(document),
    hasException,
  );
  const canUpload =
    (completeness === "missing" || completeness === "waiting") &&
    Boolean(onUpload);
  const canMarkNotApplicable =
    completeness === "missing" && Boolean(onMarkNotApplicable);
  const canUndoNotApplicable =
    completeness === "not_applicable" && Boolean(onUndoNotApplicable);
  const isComplete = completeness === "complete" && Boolean(document);

  return {
    key: period.key,
    shortLabel: period.shortLabel,
    label: period.label,
    tone: periodTones[completeness],
    ariaLabel: isComplete
      ? `View ${period.label} statement`
      : canUndoNotApplicable
        ? `Undo not applicable for ${period.label}`
        : undefined,
    onActivate: isComplete
      ? () => {
          if (document) onSelect?.(document);
        }
      : canUndoNotApplicable
        ? onUndoNotApplicable
        : canUpload
          ? onUpload
          : undefined,
    icon: isComplete ? "check" : canUndoNotApplicable ? "minus" : undefined,
    stacked: !isComplete && !canUndoNotApplicable,
    accessory: canMarkNotApplicable
      ? { label: "N/A", onClick: () => onMarkNotApplicable?.() }
      : undefined,
    tooltip: (
      <>
        <p className="font-medium">{period.label}</p>
        <p>{completenessStatusLabels[completeness]}</p>
        {isComplete ? (
          <p className="text-background/70">Click for details</p>
        ) : null}
        {canUpload ? (
          <p className="text-background/70">Click to upload</p>
        ) : null}
        {canMarkNotApplicable ? (
          <p className="text-background/70">
            Use N/A if no statement was issued
          </p>
        ) : null}
        {canUndoNotApplicable ? (
          <p className="text-background/70">Click to undo</p>
        ) : null}
      </>
    ),
    listAction:
      isComplete && document ? (
        <DocumentActionButtons
          fileId={document.fileId}
          title={document.title}
          mimeType={document.mimeType}
          onEdit={() => onEdit(document)}
          onDelete={() => onDelete(document)}
        />
      ) : canUpload || canMarkNotApplicable || canUndoNotApplicable ? (
        <div className="flex items-center gap-1">
          {canUpload ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onUpload?.()}
            >
              Upload
            </Button>
          ) : null}
          {canMarkNotApplicable ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onMarkNotApplicable?.()}
            >
              Not applicable
            </Button>
          ) : null}
          {canUndoNotApplicable ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onUndoNotApplicable?.()}
            >
              Undo
            </Button>
          ) : null}
        </div>
      ) : (
        <span className="text-muted-foreground">
          {completenessStatusLabels[completeness]}
        </span>
      ),
  };
}
