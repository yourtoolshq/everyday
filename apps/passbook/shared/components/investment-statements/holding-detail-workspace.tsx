"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@yourtoolshq/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@yourtoolshq/ui/chart";
import { DateField } from "@yourtoolshq/ui/date-field";
import { Label } from "@yourtoolshq/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@yourtoolshq/ui/select";

import { displayAmount } from "~/components/investment-statements/investment-form-state";
import {
  instrumentKindLabels,
  sectionCoverageLabels,
} from "~/components/investment-statements/investment-labels";
import { holdingExposure } from "~/modules/investment-statements/domain/holding-exposure";
import { api } from "~/trpc/react";

const chartConfig = {
  value: { label: "Reported value", color: "var(--primary)" },
  holding: { label: "This holding", color: "var(--primary)" },
  rest: {
    label: "Other entered holdings & cash",
    color: "var(--muted-foreground)",
  },
};

export function HoldingDetailWorkspace({
  instrumentId,
}: {
  instrumentId: string;
}) {
  const [currencySelection, setCurrency] = useState<string | null>(null);
  const [dateSelection, setDate] = useState<string | null>(null);
  const asOf = dateSelection ?? new Date().toISOString().slice(0, 10);
  const result = api.investmentInstruments.detail.useQuery({
    id: instrumentId,
    asOf,
  });
  const [accountSelection, setAccount] = useState<string | null>(null);
  if (result.isLoading)
    return (
      <p role="status" className="text-muted-foreground">
        Loading holding…
      </p>
    );
  if (result.error || !result.data)
    return (
      <p role="alert" className="text-destructive">
        {result.error?.message ?? "Holding not found."}
      </p>
    );
  const { instrument, statements } = result.data;
  const currencies = [
    ...new Set(
      statements.flatMap((statement) =>
        statement.positions
          .filter((row) => row.instrumentId === instrumentId)
          .map((row) => row.valueCurrency),
      ),
    ),
  ].sort();
  const currency = currencySelection ?? currencies[0] ?? "CAD";
  const exposure = holdingExposure(statements, instrumentId, currency, asOf);
  const observedAccounts = [
    ...new Map(
      statements
        .filter((statement) =>
          statement.positions.some((row) => row.instrumentId === instrumentId),
        )
        .map((statement) => [statement.accountId, statement.accountName]),
    ).entries(),
  ];
  const accountId = accountSelection ?? observedAccounts[0]?.[0];
  const history = statements
    .filter(
      (statement) =>
        statement.accountId === accountId &&
        statement.reviewStatus === "reviewed" &&
        statement.valuationDate <= asOf,
    )
    .sort((a, b) => a.valuationDate.localeCompare(b.valuationDate))
    .map((statement) => {
      const observed = holdingExposure(
        [statement],
        instrumentId,
        currency,
        asOf,
      ).accounts[0]!;
      return {
        date: statement.valuationDate,
        value: observed.value == null ? null : Number(observed.value),
        exactValue: observed.value,
        documentId: statement.documentId,
        title: statement.documentTitle,
        coverage: observed.coverage,
      };
    });
  const allocation = exposure.accounts
    .filter((account) => account.value != null)
    .map((account) => ({
      name: account.accountName,
      value: Number(account.value),
      exactValue: account.value,
    }));
  const shareData =
    exposure.value != null && exposure.rest != null
      ? [
          {
            name: "This holding",
            value: Number(exposure.value),
            fill: "var(--primary)",
          },
          {
            name: "Other entered holdings & cash",
            value: Number(exposure.rest),
            fill: "var(--muted-foreground)",
          },
        ]
      : [];
  const excludedCount =
    new Set(statements.map((statement) => statement.accountId)).size -
    exposure.accounts.length;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/holdings">
          <ArrowLeft />
          Holdings
        </Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {instrument.displayName}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {instrumentKindLabels[instrument.kind]}
            {instrument.series ? ` · Series ${instrument.series}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {instrument.identifiers.map((identifier) => (
              <span
                key={`${identifier.kind}:${identifier.value}:${identifier.namespace}`}
                className="bg-muted rounded-md px-2 py-1 text-sm font-medium"
              >
                {identifier.value}
                {identifier.namespace ? ` / ${identifier.namespace}` : ""}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <Label htmlFor="exposure-currency">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="exposure-currency" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(currencies.length ? currencies : ["CAD"]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="exposure-date">Statements on or before</Label>
            <DateField
              id="exposure-date"
              value={asOf}
              onChange={(value) => setDate(value || null)}
            />
          </div>
        </div>
      </div>
      <p className="text-muted-foreground max-w-3xl text-sm">
        Exposure uses the latest reviewed statement for each account. Shares
        compare entered {currency} holdings and cash only; other currencies are
        kept separate. These are statement observations, not live prices.
      </p>
      {exposure.partial ||
      exposure.mixedDates ||
      exposure.ambiguous ||
      excludedCount ? (
        <div className="bg-muted/30 space-y-1 rounded-lg border p-3 text-sm">
          {exposure.ambiguous ? (
            <p>
              Some accounts have multiple reviewed statements at the latest
              valuation date. Their exposure is unknown until the source
              conflict is resolved.
            </p>
          ) : null}
          {exposure.partial ? (
            <p>
              Some statements have incomplete holdings. Shares cover entered
              lines only; an absent holding is unknown.
            </p>
          ) : null}
          {exposure.mixedDates ? (
            <p>
              Accounts have different valuation dates. See each source below.
            </p>
          ) : null}
          {excludedCount > 0 ? (
            <p>
              {excludedCount} account(s) with saved details have no reviewed
              statement on or before this date and are excluded.
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border p-4">
          <h2 className="font-medium">Where this holding is held</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {displayAmount(exposure.value)} {currency} across observed accounts
          </p>
          {allocation.some((row) => row.value > 0) ? (
            <ChartContainer config={chartConfig} className="mt-3 h-60 w-full">
              <BarChart
                accessibilityLayer
                data={allocation}
                layout="vertical"
                margin={{ left: 8, right: 20 }}
              >
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={110}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(_, __, item) => (
                        <span>
                          {(item.payload as { exactValue: string }).exactValue}{" "}
                          {currency}
                        </span>
                      )}
                    />
                  }
                />
                <Bar
                  dataKey="value"
                  fill="var(--color-value)"
                  radius={4}
                  maxBarSize={36}
                  isAnimationActive={false}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="text-muted-foreground py-12 text-sm">
              No known positive exposure at this date.
            </p>
          )}
        </section>
        <section className="rounded-lg border p-4">
          <h2 className="font-medium">Portion of entered holdings</h2>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {exposure.share == null ? "Unknown" : `${exposure.share}%`}
          </p>
          {shareData.length && Number(exposure.total) > 0 ? (
            <ChartContainer config={chartConfig} className="h-52 w-full">
              <PieChart accessibilityLayer>
                <ChartTooltip
                  content={<ChartTooltipContent nameKey="name" />}
                />
                <Pie
                  data={shareData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={80}
                  isAnimationActive={false}
                >
                  {shareData.map((row) => (
                    <Cell key={row.name} fill={row.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          ) : (
            <p className="text-muted-foreground py-12 text-sm">
              Complete known values are needed to calculate a portion.
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            This holding: {displayAmount(exposure.value)} {currency}. Other
            entered holdings and cash: {displayAmount(exposure.rest)} {currency}
            .
          </p>
        </section>
      </div>
      <section className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">Reported value over time</h2>
            <p className="text-muted-foreground text-xs">
              Lines connect reviewed statement observations. Missing values stay
              blank.
            </p>
          </div>
          <Select value={accountId} onValueChange={setAccount}>
            <SelectTrigger className="w-56" aria-label="History account">
              <SelectValue placeholder="Choose account" />
            </SelectTrigger>
            <SelectContent>
              {observedAccounts.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {history.length ? (
          <ChartContainer config={chartConfig} className="mt-4 h-64 w-full">
            <LineChart
              accessibilityLayer
              data={history}
              margin={{ left: 12, right: 20 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                minTickGap={32}
              />
              <YAxis
                width={72}
                tickLine={false}
                axisLine={false}
                domain={["auto", "auto"]}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(_, __, item) => (
                      <span>
                        {(item.payload as { exactValue: string }).exactValue}{" "}
                        {currency}
                      </span>
                    )}
                  />
                }
              />
              <Line
                dataKey="value"
                type="linear"
                stroke="var(--color-value)"
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <p className="text-muted-foreground py-8 text-sm">
            Review a statement containing this holding to see its history.
          </p>
        )}
        <details className="mt-3 text-sm">
          <summary className="text-muted-foreground cursor-pointer">
            History sources ({history.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {history.map((point) => (
              <li key={point.documentId}>
                <Link
                  className="text-primary hover:underline"
                  href={`/statements/${point.documentId}/investments`}
                >
                  {point.date}: {displayAmount(point.exactValue)} {currency} -{" "}
                  {point.title}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </section>
      <section>
        <h2 className="mb-3 font-medium">Exposure sources</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-left">
              <tr>
                {[
                  "Account",
                  "Valuation",
                  "Coverage",
                  "Quantity",
                  `Value (${currency})`,
                  "Account portion",
                  "Source",
                ].map((label) => (
                  <th key={label} className="p-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {exposure.accounts.map((account) => (
                <tr key={account.accountId} className="border-t">
                  <td className="p-3">
                    <Link
                      href={`/accounts/${account.accountId}`}
                      className="hover:underline"
                    >
                      {account.accountName}
                    </Link>
                  </td>
                  <td className="p-3">{account.valuationDate}</td>
                  <td className="p-3">
                    {sectionCoverageLabels[account.coverage]}
                  </td>
                  <td className="p-3 tabular-nums">
                    {displayAmount(account.quantity)}
                  </td>
                  <td className="p-3 tabular-nums">
                    {displayAmount(account.value)}
                  </td>
                  <td className="p-3 tabular-nums">
                    {account.share == null ? "Unknown" : `${account.share}%`}
                  </td>
                  <td className="space-y-1 p-3">
                    {account.sources.map((source) => (
                      <p key={source.documentId}>
                        <Link
                          className="text-primary hover:underline"
                          href={`/statements/${source.documentId}/investments`}
                        >
                          {source.title}
                        </Link>
                      </p>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Zero for an absent holding requires complete holdings coverage. It
          does not imply a sale transaction. Unknown values are never counted as
          zero.
        </p>
      </section>
    </div>
  );
}
