"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { cn } from "cn";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Minus,
  Paperclip,
} from "lucide-react";

import { Badge } from "./badge";
import { Button } from "./button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

const periodToneStyles = {
  complete: {
    cell: "border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 text-emerald-900 dark:text-emerald-100",
    dot: "bg-emerald-500",
  },
  missing: {
    cell: "border border-red-500/30 bg-gradient-to-br from-red-500/15 to-red-500/5 text-red-900 dark:text-red-100",
    dot: "bg-red-500",
  },
  attention: {
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
  inactive: {
    cell: "border border-dashed border-border/80 bg-transparent text-muted-foreground/50",
    dot: "bg-muted-foreground/30",
  },
  exempt: {
    cell: "border border-zinc-500/30 bg-gradient-to-br from-zinc-500/15 to-zinc-500/5 text-zinc-700 dark:text-zinc-200",
    dot: "bg-zinc-500",
  },
} as const;

export type PeriodTone = keyof typeof periodToneStyles;

const periodIcons = {
  check: Check,
  minus: Minus,
  paperclip: Paperclip,
} as const;

export type PeriodCoverageIcon = keyof typeof periodIcons;

export interface PeriodCoverageCell {
  key: string;
  shortLabel: string;
  label: string;
  tone: PeriodTone;
  ariaLabel?: string;
  onActivate?: () => void;
  icon?: PeriodCoverageIcon;
  meta?: string;
  /** Stack the label and an optional secondary control, as with an N/A action. */
  stacked?: boolean;
  accessory?: {
    label: string;
    onClick: () => void;
  };
  tooltip: ReactNode;
  listMeta?: string;
  listAction: ReactNode;
}

interface PeriodCoverageProps {
  year: number;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  frequencyLabel?: string;
  summary?: string;
  columnsClassName: string;
  cells: PeriodCoverageCell[];
  legend: { tone: PeriodTone; label: string }[];
  emptyLabel?: string;
  note?: ReactNode;
}

function PeriodCell({ cell }: { cell: PeriodCoverageCell }) {
  const styles = periodToneStyles[cell.tone];
  const Icon = cell.icon ? periodIcons[cell.icon] : null;
  const interactive = Boolean(cell.onActivate) || Boolean(cell.accessory);
  const cellClassName = cn(
    "flex aspect-[4/3] min-h-14 w-full flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-center transition-colors",
    styles.cell,
    interactive && "cursor-pointer hover:brightness-95",
    !interactive && "cursor-default",
  );
  const label = (
    <span className="text-xs leading-tight font-medium sm:text-sm">
      {cell.shortLabel}
    </span>
  );
  const icon = Icon ? (
    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
  ) : null;
  const meta = cell.meta ? (
    <span className="text-[10px] font-medium opacity-80">{cell.meta}</span>
  ) : null;

  const control =
    cell.stacked || cell.accessory ? (
      <div className={cn(cellClassName, "gap-1")}>
        <button
          type="button"
          aria-label={cell.ariaLabel}
          disabled={!cell.onActivate}
          onClick={cell.onActivate}
          className="flex h-full w-full flex-1 flex-col items-center justify-center"
        >
          {label}
          {icon}
          {meta}
        </button>
        {cell.accessory ? (
          <button
            type="button"
            className="text-[10px] font-medium text-red-800/80 underline underline-offset-2 dark:text-red-100/80"
            onClick={(event) => {
              event.stopPropagation();
              cell.accessory?.onClick();
            }}
          >
            {cell.accessory.label}
          </button>
        ) : null}
      </div>
    ) : (
      <button
        type="button"
        aria-label={cell.ariaLabel}
        className={cellClassName}
        disabled={!cell.onActivate}
        onClick={cell.onActivate}
      >
        {label}
        {icon}
        {meta}
      </button>
    );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{control}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-56 text-left">
        {cell.tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function PeriodCoverage({
  year,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  frequencyLabel,
  summary,
  columnsClassName,
  cells,
  legend,
  emptyLabel,
  note,
}: PeriodCoverageProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous year"
            disabled={!canPrevious}
            onClick={onPrevious}
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
            disabled={!canNext}
            onClick={onNext}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {frequencyLabel ? (
            <Badge variant="secondary">{frequencyLabel}</Badge>
          ) : null}
          {summary ? (
            <span className="text-muted-foreground text-sm">{summary}</span>
          ) : null}
          <div className="flex rounded-lg border p-0.5">
            <Button
              type="button"
              size="icon"
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid />
            </Button>
            <Button
              type="button"
              size="icon"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              aria-label="List view"
              aria-pressed={viewMode === "list"}
              onClick={() => setViewMode("list")}
            >
              <List />
            </Button>
          </div>
        </div>
      </div>

      <TooltipProvider>
        {cells.length === 0 && emptyLabel ? (
          <p className="text-muted-foreground text-sm">{emptyLabel}</p>
        ) : viewMode === "grid" ? (
          <div className={cn("grid gap-2", columnsClassName)}>
            {cells.map((cell) => (
              <PeriodCell key={cell.key} cell={cell} />
            ))}
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {cells.map((cell) => (
              <div
                key={cell.key}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      periodToneStyles[cell.tone].dot,
                    )}
                  />
                  <span className="truncate font-medium">{cell.label}</span>
                  {cell.listMeta ? (
                    <span className="text-muted-foreground text-xs">
                      {cell.listMeta}
                    </span>
                  ) : null}
                </div>
                {cell.listAction}
              </div>
            ))}
          </div>
        )}
      </TooltipProvider>

      <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
        {legend.map((item) => (
          <span
            key={`${item.tone}-${item.label}`}
            className="inline-flex items-center gap-1.5"
          >
            <span
              className={cn(
                "size-2 rounded-full",
                periodToneStyles[item.tone].dot,
              )}
            />
            {item.label}
          </span>
        ))}
      </div>
      {note}
    </div>
  );
}
