"use client";

import Link from "next/link";

import { Badge } from "@yourtoolshq/ui/badge";

import type { InstrumentRecord } from "~/components/investment-statements/instrument-sheets";
import { displayAmount } from "~/components/investment-statements/investment-form-state";
import {
  instrumentKindLabels,
  reviewStatusLabels,
  sectionCoverageLabels,
} from "~/components/investment-statements/investment-labels";
import { formatDateLabel } from "~/lib/format-date";
import { api } from "~/trpc/react";

export function HoldingsWorkspace() {
  const holdings = api.investmentInstruments.holdings.useQuery();

  if (holdings.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading holdings…</p>;
  }

  if (holdings.error) {
    return <p className="text-destructive text-sm">{holdings.error.message}</p>;
  }

  const instruments = (holdings.data?.instruments ?? []) as InstrumentRecord[];
  const positions = holdings.data?.positions ?? [];

  const positionsByInstrument = new Map<string, typeof positions>();
  for (const row of positions) {
    const list = positionsByInstrument.get(row.instrumentId) ?? [];
    list.push(row);
    positionsByInstrument.set(row.instrumentId, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Holdings</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm">
          Catalog of instruments reused across statements. Each row links to its
          source account and valuation date. This view does not sum snapshots
          into a household total.
        </p>
      </div>

      {instruments.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-sm">
          No instruments yet. Link holdings while entering investment statement
          details.
        </p>
      ) : (
        <div className="space-y-4">
          {instruments.map((instrument) => {
            const rows = positionsByInstrument.get(instrument.id) ?? [];
            return (
              <section
                key={instrument.id}
                className="rounded-xl border p-4 shadow-none"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-medium">
                      {instrument.displayName}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {instrumentKindLabels[instrument.kind]}
                      {instrument.series
                        ? ` · Series ${instrument.series}`
                        : ""}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {rows.length} observation{rows.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                {rows.length === 0 ? (
                  <p className="text-muted-foreground mt-3 text-sm">
                    No saved positions reference this instrument yet.
                  </p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead>
                        <tr className="text-muted-foreground border-b text-left">
                          <th className="px-2 py-2 font-medium">Account</th>
                          <th className="px-2 py-2 font-medium">Valuation</th>
                          <th className="px-2 py-2 font-medium">Details</th>
                          <th className="px-2 py-2 font-medium">Quantity</th>
                          <th className="px-2 py-2 font-medium">Value</th>
                          <th className="px-2 py-2 font-medium">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, index) => (
                          <tr key={index} className="border-b last:border-b-0">
                            <td className="px-2 py-2">{row.accountName}</td>
                            <td className="px-2 py-2">
                              {formatDateLabel(row.valuationDate)}
                            </td>
                            <td className="px-2 py-2">
                              <span className="text-muted-foreground">
                                {reviewStatusLabels[row.reviewStatus]} ·{" "}
                                {sectionCoverageLabels[row.holdingsCoverage]}
                              </span>
                            </td>
                            <td className="px-2 py-2">
                              {displayAmount(row.quantity)}
                            </td>
                            <td className="px-2 py-2">
                              {displayAmount(row.marketValue)}{" "}
                              {row.valueCurrency}
                            </td>
                            <td className="px-2 py-2">
                              <Link
                                href={`/statements/${row.documentId}/investments`}
                                className="text-primary hover:underline"
                              >
                                {row.documentTitle}
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
