"use client";

import { useMemo, useState } from "react";
import { cn } from "cn";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Minus,
} from "lucide-react";

import type { ExpectedPeriod } from "~/lib/expected-periods";
import type { StatementCompletenessStatus } from "~/lib/statement-completeness";
import type { StatementFrequency } from "~/lib/statement-frequency";
import type { RouterOutputs } from "~/trpc/react";
import { useDeleteDocumentDialog } from "~/components/documents/delete-document-dialog";
import { DocumentActionButtons } from "~/components/documents/document-action-buttons";
import { DocumentEditSheet } from "~/components/documents/document-edit-sheet";
import { StatementDetailSheet } from "~/components/documents/statement-detail-sheet";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
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
  not_applicable: {
    cell: "border border-zinc-500/30 bg-gradient-to-br from-zinc-500/15 to-zinc-500/5 text-zinc-700 dark:text-zinc-200",
    dot: "bg-zinc-500",
  },
};

function PeriodCell({
  period,
  document,
  hasException,
  onSelect,
  onUpload,
  onMarkNotApplicable,
  onUndoNotApplicable,
}: {
  period: ExpectedPeriod;
  document?: StatementDocument;
  hasException: boolean;
  onSelect?: (document: StatementDocument) => void;
  onUpload?: () => void;
  onMarkNotApplicable?: () => void;
  onUndoNotApplicable?: () => void;
}) {
  const completeness = deriveStatementCompleteness(
    period,
    Boolean(document),
    hasException,
  );
  const styles = completenessStatusStyles[completeness];
  const canUpload =
    (completeness === "missing" || completeness === "waiting") &&
    Boolean(onUpload);
  const canMarkNotApplicable =
    completeness === "missing" && Boolean(onMarkNotApplicable);
  const canUndoNotApplicable =
    completeness === "not_applicable" && Boolean(onUndoNotApplicable);
  const cellClassName = cn(
    "flex aspect-[4/3] min-h-14 w-full flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-center transition-colors",
    styles.cell,
    (canUpload || completeness === "complete" || canUndoNotApplicable) &&
      "cursor-pointer hover:brightness-95",
    !canUpload &&
      completeness !== "complete" &&
      completeness !== "not_expected" &&
      !canUndoNotApplicable &&
      "cursor-default",
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {completeness === "complete" && document ? (
          <button
            type="button"
            aria-label={`View ${period.label} statement`}
            className={cellClassName}
            onClick={() => onSelect?.(document)}
          >
            <span className="text-sm leading-none font-medium">
              {period.shortLabel}
            </span>
            <Check className="size-3.5 shrink-0" aria-hidden="true" />
          </button>
        ) : completeness === "not_applicable" ? (
          <button
            type="button"
            aria-label={`Undo not applicable for ${period.label}`}
            className={cellClassName}
            onClick={onUndoNotApplicable}
          >
            <span className="text-sm leading-none font-medium">
              {period.shortLabel}
            </span>
            <Minus className="size-3.5 shrink-0" aria-hidden="true" />
          </button>
        ) : (
          <div className={cn(cellClassName, "gap-1")}>
            <button
              type="button"
              disabled={!canUpload}
              onClick={canUpload ? onUpload : undefined}
              className="flex flex-1 flex-col items-center justify-center"
            >
              <span className="text-sm font-medium">{period.shortLabel}</span>
            </button>
            {canMarkNotApplicable ? (
              <button
                type="button"
                className="text-[10px] font-medium text-red-800/80 underline underline-offset-2 dark:text-red-100/80"
                onClick={(event) => {
                  event.stopPropagation();
                  onMarkNotApplicable?.();
                }}
              >
                N/A
              </button>
            ) : null}
          </div>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" className="text-left">
        <p className="font-medium">{period.label}</p>
        <p>{completenessStatusLabels[completeness]}</p>
        {completeness === "complete" ? (
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
      </TooltipContent>
    </Tooltip>
  );
}

function PeriodLegend() {
  const items: { status: StatementCompletenessStatus; label: string }[] = [
    { status: "complete", label: "Complete" },
    { status: "missing", label: "Missing" },
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
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
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
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {statementFrequencyLabels[frequency]}
          </Badge>
          <span className="text-muted-foreground text-sm">
            {formatYearSummary({
              completeCount,
              notApplicableCount,
              expectedCount,
              missingCount,
              waitingCount,
              year,
            })}
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
                document={statementDocumentsByPeriod[period.key]}
                hasException={Boolean(exceptionsByPeriod[period.key])}
                onSelect={(document) =>
                  setSelectedStatement({ document, periodLabel: period.label })
                }
                onUpload={
                  onUploadPeriod ? () => onUploadPeriod(period.key) : undefined
                }
                onMarkNotApplicable={
                  onMarkNotApplicable
                    ? () => onMarkNotApplicable(period.key)
                    : undefined
                }
                onUndoNotApplicable={
                  onUndoNotApplicable
                    ? () => onUndoNotApplicable(period.key)
                    : undefined
                }
              />
            ))}
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {periods.map((period) => {
              const document = statementDocumentsByPeriod[period.key];
              const hasException = Boolean(exceptionsByPeriod[period.key]);
              const completeness = deriveStatementCompleteness(
                period,
                Boolean(document),
                hasException,
              );
              const styles = completenessStatusStyles[completeness];
              const canUpload =
                (completeness === "missing" || completeness === "waiting") &&
                Boolean(onUploadPeriod);
              const canMarkNotApplicable =
                completeness === "missing" && Boolean(onMarkNotApplicable);
              const canUndoNotApplicable =
                completeness === "not_applicable" &&
                Boolean(onUndoNotApplicable);
              return (
                <div
                  key={period.key}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", styles.dot)} />
                    <span className="font-medium">{period.label}</span>
                  </div>
                  {completeness === "complete" && document ? (
                    <DocumentActionButtons
                      fileId={document.fileId}
                      title={document.title}
                      mimeType={document.mimeType}
                      onEdit={() => setEditingStatement(document)}
                      onDelete={() =>
                        requestDelete({
                          id: document.id,
                          title: document.title,
                        })
                      }
                    />
                  ) : canUpload ||
                    canMarkNotApplicable ||
                    canUndoNotApplicable ? (
                    <div className="flex items-center gap-1">
                      {canUpload ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onUploadPeriod?.(period.key)}
                        >
                          Upload
                        </Button>
                      ) : null}
                      {canMarkNotApplicable ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onMarkNotApplicable?.(period.key)}
                        >
                          Not applicable
                        </Button>
                      ) : null}
                      {canUndoNotApplicable ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onUndoNotApplicable?.(period.key)}
                        >
                          Undo
                        </Button>
                      ) : null}
                    </div>
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
      <p className="text-muted-foreground text-xs">
        Red periods are missing. Gray periods are marked not applicable. Blue is
        the current period still waiting for a statement.
      </p>

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
    </div>
  );
}
