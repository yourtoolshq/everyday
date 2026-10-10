"use client";

import type { SnapshotDto } from "~/modules/investment-statements/domain/snapshot-dto";
import type {
  EnrichmentReviewStatus,
  SectionCoverage,
} from "~/server/db/schema";
import {
  reviewStatusLabels,
  sectionCoverageLabels,
} from "~/components/investment-statements/investment-labels";
import { formatDateLabel } from "~/lib/format-date";

type ChartPoint = {
  documentId: string;
  valuationDate: string;
  closingValue: string;
  currency: string;
  label: string;
  reviewStatus: EnrichmentReviewStatus;
  summaryCoverage: SectionCoverage;
};

export function accountTotalChartCurrencies(
  snapshots: SnapshotDto[],
): string[] {
  const currencies = new Set<string>();
  for (const snapshot of snapshots) {
    for (const row of snapshot.totals) {
      if (row.scope === "account_total" && row.closingValue?.trim()) {
        currencies.add(row.currency);
      }
    }
  }
  return [...currencies].sort((a, b) => a.localeCompare(b));
}

function extractPoints(
  snapshots: SnapshotDto[],
  currencyFilter: string,
): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (const snapshot of snapshots) {
    const total = snapshot.totals.find(
      (row) =>
        row.scope === "account_total" &&
        row.currency === currencyFilter &&
        row.closingValue?.trim(),
    );
    if (!total?.closingValue) continue;
    points.push({
      documentId: snapshot.documentId,
      valuationDate: snapshot.valuationDate,
      closingValue: total.closingValue,
      currency: total.currency,
      label: snapshot.documentTitle,
      reviewStatus: snapshot.reviewStatus,
      summaryCoverage: snapshot.summaryCoverage,
    });
  }
  return points.sort((a, b) => a.valuationDate.localeCompare(b.valuationDate));
}

function formatAxisAmount(value: number): string {
  return value.toLocaleString("en-CA", { maximumFractionDigits: 2 });
}

function coverageHint(coverage: SectionCoverage): string {
  if (coverage === "partial") return " · partial summary";
  if (coverage === "not_entered") return "";
  return "";
}

export function ObservationChart({
  snapshots,
  selectedDocumentId,
  onSelectDocument,
  currencyFilter,
}: {
  snapshots: SnapshotDto[];
  selectedDocumentId?: string | null;
  onSelectDocument?: (documentId: string) => void;
  currencyFilter: string;
}) {
  const points = extractPoints(snapshots, currencyFilter);

  if (points.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Add closing account totals in {currencyFilter} with valuation dates to
        see observations here. Only saved statement facts are plotted—gaps
        between dates are not interpolated.
      </p>
    );
  }

  const width = 640;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 36, left: 72 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const numericValues = points.map((point) =>
    Number.parseFloat(point.closingValue),
  );
  const minY = Math.min(...numericValues);
  const maxY = Math.max(...numericValues);
  const spanY = maxY - minY || 1;

  const minDate = points[0]!.valuationDate;
  const maxDate = points[points.length - 1]!.valuationDate;
  const dateSpan =
    minDate === maxDate
      ? 1
      : new Date(maxDate).getTime() - new Date(minDate).getTime();

  function xFor(date: string) {
    if (minDate === maxDate) return padding.left + innerW / 2;
    const t =
      (new Date(date).getTime() - new Date(minDate).getTime()) / dateSpan;
    return padding.left + t * innerW;
  }

  function yFor(value: string) {
    const n = Number.parseFloat(value);
    const t = (n - minY) / spanY;
    return padding.top + innerH - t * innerH;
  }

  const yTicks = [minY, minY + spanY / 2, maxY].filter(
    (value, index, list) => list.indexOf(value) === index,
  );

  const currency = currencyFilter;

  return (
    <figure className="space-y-2">
      <figcaption className="text-muted-foreground text-xs">
        Reported closing account value ({currency}) at valuation dates. Filled
        markers are reviewed; open markers are drafts. Chart coordinates use
        rounded numbers for layout only.
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full max-w-full"
        role="img"
        aria-label={`Account value observations in ${currency}`}
      >
        {yTicks.map((tick) => {
          const y = yFor(String(tick));
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={y}
                x2={padding.left + innerW}
                y2={y}
                className="stroke-border/60"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 6}
                y={y + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
              >
                {formatAxisAmount(tick)}
              </text>
            </g>
          );
        })}
        <line
          x1={padding.left}
          y1={padding.top + innerH}
          x2={padding.left + innerW}
          y2={padding.top + innerH}
          className="stroke-border"
          strokeWidth={1}
        />
        {points.map((point, index) => {
          const cx = xFor(point.valuationDate);
          const cy = yFor(point.closingValue);
          const selected = point.documentId === selectedDocumentId;
          const isDraft = point.reviewStatus === "draft";
          const statusLabel = reviewStatusLabels[point.reviewStatus];
          const partial =
            point.summaryCoverage === "partial"
              ? `, ${sectionCoverageLabels.partial} summary`
              : "";
          return (
            <g key={point.documentId}>
              <circle
                cx={cx}
                cy={cy}
                r={selected ? 6 : 4}
                className={
                  selected
                    ? "fill-primary stroke-primary"
                    : isDraft
                      ? "fill-background stroke-muted-foreground"
                      : "fill-muted-foreground stroke-muted-foreground"
                }
                strokeWidth={isDraft ? 2 : 0}
                tabIndex={onSelectDocument ? 0 : undefined}
                role={onSelectDocument ? "button" : undefined}
                aria-label={`${formatDateLabel(point.valuationDate)}: ${point.closingValue} ${point.currency}, ${statusLabel}${partial}`}
                onClick={() => onSelectDocument?.(point.documentId)}
                onKeyDown={(event) => {
                  if (!onSelectDocument) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectDocument(point.documentId);
                  }
                }}
              />
              <text
                x={cx}
                y={padding.top + innerH + 20}
                textAnchor={
                  index === 0
                    ? "start"
                    : index === points.length - 1
                      ? "end"
                      : "middle"
                }
                className="fill-muted-foreground text-[10px]"
              >
                {formatDateLabel(point.valuationDate)}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="text-muted-foreground space-y-1 text-xs">
        {points.map((point) => (
          <li key={point.documentId}>
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => onSelectDocument?.(point.documentId)}
            >
              {formatDateLabel(point.valuationDate)}
            </button>
            {" · "}
            {point.closingValue} {point.currency}
            {" · "}
            <span className={point.reviewStatus === "draft" ? "italic" : ""}>
              {reviewStatusLabels[point.reviewStatus]}
              {coverageHint(point.summaryCoverage)}
            </span>
            {point.label ? ` · ${point.label}` : null}
          </li>
        ))}
      </ul>
    </figure>
  );
}
