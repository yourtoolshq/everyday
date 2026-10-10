"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Layers } from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";

import { Button } from "@yourtoolshq/ui/button";
import { Card, CardContent } from "@yourtoolshq/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@yourtoolshq/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@yourtoolshq/ui/select";
import { Skeleton } from "@yourtoolshq/ui/skeleton";

import type { AccountType } from "~/lib/account-types";
import { formatDateLabel } from "~/lib/format-date";
import { isInvestmentEligibleAccountType } from "~/modules/investment-statements/domain/account-eligibility";
import {
  enteredDistribution,
  formatInvestmentAmount,
} from "~/modules/investment-statements/domain/entry-helpers";
import { api } from "~/trpc/react";
import { ComparisonPanel } from "./comparison-panel";
import { ObservationChart } from "./observation-chart";
import { ValueChangePill } from "./value-change-pill";

const allocationColors = [
  "var(--primary)",
  "#2b9a91",
  "#8c70b5",
  "#b28336",
  "#668696",
];
export function AccountInvestmentPanel({
  accountId,
  accountType,
}: {
  accountId: string;
  accountType: AccountType;
}) {
  const eligible = isInvestmentEligibleAccountType(accountType);
  const query = api.investmentStatements.listByAccount.useQuery(
    { accountId },
    { enabled: eligible },
  );
  const [currencyChoice, setCurrencyChoice] = useState<string | null>(null);
  const [range, setRange] = useState("1Y");
  const [earlier, setEarlier] = useState<string | null>(null);
  const [later, setLater] = useState<string | null>(null);
  if (!eligible) return null;
  if (query.isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (query.error)
    return (
      <Card>
        <CardContent className="p-5">
          <p role="alert" className="text-destructive text-sm">
            {query.error.message}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  const saved = (query.data ?? []).filter(
    (row) => row.reviewStatus === "reviewed",
  );
  const latestDate = saved.at(-1)?.valuationDate;
  const latestCandidates = saved.filter(
    (row) => row.valuationDate === latestDate,
  );
  const latest = latestCandidates.length === 1 ? latestCandidates[0] : null;
  if (!latest)
    return (
      <Card className="shadow-none">
        <CardContent className="space-y-3 p-6">
          <Layers className="text-muted-foreground size-5" />
          <h3 className="font-semibold">
            {latestCandidates.length > 1
              ? "Choose the statement for this date"
              : "Your account at a glance"}
          </h3>
          <p className="text-muted-foreground text-sm">
            {latestCandidates.length > 1
              ? "Multiple saved statements share the latest valuation date. Resolve them before comparing balances."
              : "Save details from a statement to see balance history and holdings here."}
          </p>
          {latestCandidates.map((row) => (
            <Button key={row.documentId} variant="outline" size="sm" asChild>
              <Link href={`/statements/${row.documentId}/investments`}>
                {row.documentTitle}
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>
    );
  const currencies = [
    ...new Set([
      ...latest.totals.map((row) => row.currency),
      ...latest.positions.map((row) => row.valueCurrency),
    ]),
  ].sort();
  const currency =
    currencyChoice && currencies.includes(currencyChoice)
      ? currencyChoice
      : (currencies[0] ?? "CAD");
  const total = latest.totals.find(
    (row) => row.scope === "account_total" && row.currency === currency,
  );
  const previousDate = saved
    .filter((row) => row.valuationDate < latest.valuationDate)
    .at(-1)?.valuationDate;
  const previousCandidates = saved.filter(
    (row) => row.valuationDate === previousDate,
  );
  const previous =
    previousCandidates.length === 1 ? previousCandidates[0] : null;
  const previousTotal = previous?.totals.find(
    (row) => row.scope === "account_total" && row.currency === currency,
  );
  const cutoff = new Date(`${latest.valuationDate}T00:00:00Z`);
  if (range !== "All") {
    const day = cutoff.getUTCDate();
    cutoff.setUTCDate(1);
    cutoff.setUTCMonth(
      cutoff.getUTCMonth() - ({ "3M": 3, "6M": 6, "1Y": 12 }[range] ?? 12),
    );
    const lastDay = new Date(
      Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0),
    ).getUTCDate();
    cutoff.setUTCDate(Math.min(day, lastDay));
  }
  const chartSnapshots = saved.filter(
    (row) =>
      (range === "All" ||
        row.valuationDate >= cutoff.toISOString().slice(0, 10)) &&
      saved.filter((other) => other.valuationDate === row.valuationDate)
        .length === 1,
  );
  const { entries: distribution, missingValues } = enteredDistribution(
    latest,
    currency,
  );
  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6">
          <div>
            <h2 className="text-muted-foreground text-sm font-medium">
              Closing market value
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="text-3xl font-semibold tracking-tight tabular-nums">
                {formatInvestmentAmount(total?.closingValue)}
                <span className="text-muted-foreground ml-2 text-sm font-normal">
                  {currency}
                </span>
              </p>
              {total?.closingValue && previousTotal?.closingValue ? (
                <ValueChangePill
                  later={total.closingValue}
                  earlier={previousTotal.closingValue}
                  currency={currency}
                  label={`Since previous statement: ${formatDateLabel(previous!.valuationDate)} to ${formatDateLabel(latest.valuationDate)}`}
                />
              ) : null}
            </div>
            <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
              <CalendarDays className="size-3.5" />
              As of {formatDateLabel(latest.valuationDate)}
              {previousTotal?.closingValue
                ? " · Change since previous statement"
                : ""}
            </p>
          </div>
          <div className="flex gap-2">
            {currencies.length > 1 ? (
              <Select value={currency} onValueChange={setCurrencyChoice}>
                <SelectTrigger aria-label="Overview currency" className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/statements/${latest.documentId}/investments`}>
                Latest statement
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
          <section className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Balance history</h3>
              <div
                className="bg-muted/60 flex gap-0.5 rounded-lg p-1"
                aria-label="Balance history range"
              >
                {["3M", "6M", "1Y", "All"].map((item) => (
                  <Button
                    key={item}
                    variant={range === item ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    aria-pressed={range === item}
                    onClick={() => setRange(item)}
                  >
                    {item}
                  </Button>
                ))}
              </div>
            </div>
            <ObservationChart
              snapshots={chartSnapshots}
              currencyFilter={currency}
              selectedDocumentId={latest.documentId}
            />
          </section>
          <section className="min-w-0 space-y-4">
            <div>
              <h3 className="text-sm font-medium">Holdings distribution</h3>
              <p className="text-muted-foreground mt-1 text-xs">
                Latest statement ·{" "}
                {missingValues ? "Valued entries only" : "Entered holdings"} (
                {currency})
              </p>
            </div>
            {distribution.length ? (
              <>
                <ChartContainer
                  config={{ value: { label: "Market value" } }}
                  className="mx-auto h-48 w-full"
                >
                  <PieChart accessibilityLayer>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          nameKey="label"
                          formatter={(_, __, item) => {
                            const row = item.payload as {
                              label: string;
                              reported: string;
                            };
                            return (
                              <span>
                                {row.label}:{" "}
                                {formatInvestmentAmount(row.reported, currency)}
                              </span>
                            );
                          }}
                        />
                      }
                    />
                    <Pie
                      data={distribution.map((row) => ({
                        label: row.label,
                        reported: row.value,
                        value: Number(row.value),
                      }))}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={58}
                      outerRadius={84}
                      paddingAngle={3}
                      stroke="var(--card)"
                      strokeWidth={3}
                      isAnimationActive={false}
                    >
                      {distribution.map((row, index) => (
                        <Cell
                          key={`${row.label}-${index}`}
                          fill={
                            allocationColors[index % allocationColors.length]
                          }
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <ul className="space-y-2.5 text-sm">
                  {distribution.map((row, index) => (
                    <li
                      key={`${row.label}-${index}`}
                      className="flex items-center gap-2"
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-sm"
                        style={{
                          background:
                            allocationColors[index % allocationColors.length],
                        }}
                      />
                      <span
                        className="min-w-0 flex-1 truncate"
                        title={row.label}
                      >
                        {row.label}
                      </span>
                      <span className="tabular-nums">
                        {formatInvestmentAmount(row.value)}
                      </span>
                      <span className="text-muted-foreground w-12 text-right text-xs tabular-nums">
                        {row.share}%
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground text-xs">
                  Share of entered values, including cash.{" "}
                  {missingValues
                    ? "Some holding values have not been entered."
                    : ""}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground py-8 text-sm">
                Add holding market values to the latest statement to see their
                distribution.
              </p>
            )}
          </section>
        </div>
        <details className="border-t px-6 py-4">
          <summary className="cursor-pointer text-sm font-medium">
            Statement history & comparisons ({saved.length})
          </summary>
          <div className="mt-4 space-y-5">
            <ul className="divide-y text-sm">
              {[...saved].reverse().map((row) => (
                <li
                  key={row.documentId}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <span>
                    {formatDateLabel(row.valuationDate)}
                    <span className="text-muted-foreground ml-2">
                      {row.documentTitle}
                    </span>
                  </span>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/statements/${row.documentId}/investments`}>
                      Open statement
                      <ArrowUpRight />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
            <h3 className="text-sm font-medium">What changed?</h3>
            <ComparisonPanel
              snapshots={saved}
              earlierDocumentId={earlier}
              laterDocumentId={later}
              onEarlierChange={setEarlier}
              onLaterChange={setLater}
            />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
