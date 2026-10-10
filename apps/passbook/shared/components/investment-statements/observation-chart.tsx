"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@yourtoolshq/ui/chart";

import type { SnapshotDto } from "~/modules/investment-statements/domain/snapshot-dto";
import type {
  EnrichmentReviewStatus,
  SectionCoverage,
} from "~/server/db/schema";
import { reviewStatusLabels } from "~/components/investment-statements/investment-labels";
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

  return (
    <figure className="space-y-3">
      <figcaption className="text-muted-foreground text-xs">
        Reported closing value ({currencyFilter}). Lines connect statement
        observations; they do not represent daily prices or investment returns.
        Drafts use open markers.
      </figcaption>
      <ChartContainer
        config={{
          value: {
            label: `Closing value (${currencyFilter})`,
            color: "var(--primary)",
          },
        }}
        className="h-64 w-full"
      >
        <LineChart
          accessibilityLayer
          data={points.map((point) => ({
            ...point,
            value: Number(point.closingValue),
            date: new Date(`${point.valuationDate}T00:00:00Z`).getTime(),
          }))}
          margin={{ left: 8, right: 20, top: 12 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(value) =>
              formatDateLabel(
                new Date(Number(value)).toISOString().slice(0, 10),
              ) ?? ""
            }
            tickLine={false}
            axisLine={false}
            minTickGap={32}
          />
          <YAxis
            tickFormatter={formatAxisAmount}
            tickLine={false}
            axisLine={false}
            width={72}
            domain={["auto", "auto"]}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_, items) =>
                  items[0]?.payload
                    ? (items[0].payload as ChartPoint).valuationDate
                    : ""
                }
                formatter={(_, __, item) => {
                  const point = item.payload as ChartPoint;
                  return (
                    <div className="space-y-1">
                      <p>
                        {point.closingValue} {point.currency}
                      </p>
                      <p className="text-muted-foreground">
                        {reviewStatusLabels[point.reviewStatus]}
                        {coverageHint(point.summaryCoverage)}
                      </p>
                      <p>{point.label}</p>
                    </div>
                  );
                }}
              />
            }
          />
          <Line
            dataKey="value"
            type="linear"
            stroke="var(--color-value)"
            strokeWidth={2}
            isAnimationActive={false}
            dot={(props) => {
              const point = props.payload as ChartPoint;
              return (
                <circle
                  key={point.documentId}
                  cx={props.cx}
                  cy={props.cy}
                  r={point.documentId === selectedDocumentId ? 6 : 4}
                  fill={
                    point.reviewStatus === "draft"
                      ? "var(--background)"
                      : "var(--primary)"
                  }
                  stroke="var(--primary)"
                  strokeWidth={2}
                />
              );
            }}
          />
        </LineChart>
      </ChartContainer>
      <details className="text-sm">
        <summary className="text-muted-foreground cursor-pointer">
          Source observations ({points.length})
        </summary>
        <ul className="mt-2 space-y-1">
          {points.map((point) => (
            <li key={point.documentId}>
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => onSelectDocument?.(point.documentId)}
              >
                {formatDateLabel(point.valuationDate)}: {point.closingValue}{" "}
                {point.currency}
              </button>{" "}
              <span className="text-muted-foreground">
                {reviewStatusLabels[point.reviewStatus]}
                {coverageHint(point.summaryCoverage)}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </figure>
  );
}
