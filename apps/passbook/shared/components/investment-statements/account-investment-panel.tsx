"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Badge } from "@yourtoolshq/ui/badge";
import { Button } from "@yourtoolshq/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@yourtoolshq/ui/card";
import { Label } from "@yourtoolshq/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@yourtoolshq/ui/select";
import { Separator } from "@yourtoolshq/ui/separator";
import { Skeleton } from "@yourtoolshq/ui/skeleton";

import type { AccountType } from "~/lib/account-types";
import type { SnapshotDto } from "~/modules/investment-statements/domain/snapshot-dto";
import { ComparisonPanel } from "~/components/investment-statements/comparison-panel";
import { InvestmentDetailsBadge } from "~/components/investment-statements/investment-details-badge";
import { displayAmount } from "~/components/investment-statements/investment-form-state";
import { sectionCoverageLabels } from "~/components/investment-statements/investment-labels";
import {
  accountTotalChartCurrencies,
  ObservationChart,
} from "~/components/investment-statements/observation-chart";
import { formatDateLabel } from "~/lib/format-date";
import { isInvestmentEligibleAccountType } from "~/modules/investment-statements/domain/account-eligibility";
import { api } from "~/trpc/react";

export function AccountInvestmentPanel({
  accountId,
  accountType,
}: {
  accountId: string;
  accountType: AccountType;
}) {
  const eligible = isInvestmentEligibleAccountType(accountType);
  const snapshotsQuery = api.investmentStatements.listByAccount.useQuery(
    { accountId },
    { enabled: eligible },
  );
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null,
  );
  const [compareEarlier, setCompareEarlier] = useState<string | null>(null);
  const [compareLater, setCompareLater] = useState<string | null>(null);
  const [chartCurrency, setChartCurrency] = useState<string | null>(null);

  const snapshots = useMemo(
    () => (snapshotsQuery.data ?? []) as SnapshotDto[],
    [snapshotsQuery.data],
  );
  const chartCurrencies = useMemo(
    () => accountTotalChartCurrencies(snapshots),
    [snapshots],
  );

  useEffect(() => {
    if (chartCurrencies.length === 0) {
      setChartCurrency(null);
      return;
    }
    if (!chartCurrency || !chartCurrencies.includes(chartCurrency)) {
      setChartCurrency(chartCurrencies[0]!);
    }
  }, [chartCurrencies, chartCurrency]);
  const selected =
    snapshots.find((row) => row.documentId === selectedDocumentId) ??
    snapshots[snapshots.length - 1] ??
    null;

  const holdingsByCurrency = useMemo(() => {
    if (!selected) return [];
    const groups = new Map<string, typeof selected.positions>();
    for (const position of selected.positions) {
      const list = groups.get(position.valueCurrency) ?? [];
      list.push(position);
      groups.set(position.valueCurrency, list);
    }
    return [...groups.entries()];
  }, [selected]);

  if (!eligible) {
    return null;
  }

  if (snapshotsQuery.isLoading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  if (snapshotsQuery.error) {
    return (
      <Card className="shadow-none">
        <CardContent className="text-destructive p-4 text-sm">
          {snapshotsQuery.error.message}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Investment statement history
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Observations use valuation dates from entered details. Select a
          statement to inspect holdings at that date.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {chartCurrencies.length > 1 ? (
          <div className="max-w-xs space-y-2">
            <Label htmlFor="chart-currency">Chart currency</Label>
            <Select
              value={chartCurrency ?? ""}
              onValueChange={setChartCurrency}
            >
              <SelectTrigger id="chart-currency">
                <SelectValue placeholder="Choose currency" />
              </SelectTrigger>
              <SelectContent>
                {chartCurrencies.map((currency) => (
                  <SelectItem key={currency} value={currency}>
                    {currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {chartCurrency ? (
          <ObservationChart
            snapshots={snapshots}
            selectedDocumentId={selected?.documentId}
            onSelectDocument={setSelectedDocumentId}
            currencyFilter={chartCurrency}
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            Add closing account totals with valuation dates to see account value
            observations.
          </p>
        )}

        <Separator />

        <div className="space-y-3">
          <h3 className="text-sm font-medium">Enriched statements</h3>
          {snapshots.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No investment details yet. Open a statement from the period grid
              to enter summary and holdings beside the PDF.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border text-sm">
              {snapshots.map((row) => (
                <li
                  key={row.documentId}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div className="space-y-1">
                    <p className="font-medium">
                      {formatDateLabel(row.valuationDate)} · {row.documentTitle}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <InvestmentDetailsBadge snapshot={row} />
                      <Badge variant="outline">
                        Summary: {sectionCoverageLabels[row.summaryCoverage]}
                      </Badge>
                      <Badge variant="outline">
                        Holdings: {sectionCoverageLabels[row.holdingsCoverage]}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        selected?.documentId === row.documentId
                          ? "default"
                          : "outline"
                      }
                      onClick={() => setSelectedDocumentId(row.documentId)}
                    >
                      Inspect
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/statements/${row.documentId}/investments`}>
                        Open workspace
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected ? (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-medium">
                Holdings at {formatDateLabel(selected.valuationDate)}
              </h3>
              {selected.holdingsCoverage !== "complete" ? (
                <p className="text-muted-foreground text-sm">
                  Holdings list is{" "}
                  {sectionCoverageLabels[
                    selected.holdingsCoverage
                  ].toLowerCase()}
                  . Totals below include only entered lines, not the whole
                  portfolio.
                </p>
              ) : null}
              {holdingsByCurrency.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No position lines saved for this statement.
                </p>
              ) : (
                holdingsByCurrency.map(([currency, positions]) => (
                  <div key={currency} className="space-y-2">
                    <p className="text-xs font-medium tracking-wide uppercase">
                      {currency}
                    </p>
                    <ul className="divide-y rounded-lg border text-sm">
                      {positions.map((position, index) => (
                        <li
                          key={index}
                          className="flex flex-wrap justify-between gap-2 px-3 py-2"
                        >
                          <span>
                            {position.sourceLabel}{" "}
                            <span className="text-muted-foreground">
                              ({position.lineKind})
                            </span>
                          </span>
                          <span>
                            {displayAmount(position.marketValue)} {currency}
                            {position.quantity
                              ? ` · qty ${displayAmount(position.quantity)}`
                              : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </>
        ) : null}

        <Separator />
        <div className="space-y-3">
          <h3 className="text-sm font-medium">What changed?</h3>
          <ComparisonPanel
            snapshots={snapshots}
            earlierDocumentId={compareEarlier}
            laterDocumentId={compareLater}
            onEarlierChange={setCompareEarlier}
            onLaterChange={setCompareLater}
          />
        </div>
      </CardContent>
    </Card>
  );
}
