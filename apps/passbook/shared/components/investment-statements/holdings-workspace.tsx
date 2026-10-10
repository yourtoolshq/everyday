"use client";

import { useState } from "react";
import Link from "next/link";

import { Input } from "@yourtoolshq/ui/input";
import { Label } from "@yourtoolshq/ui/label";

import { instrumentKindLabels } from "~/components/investment-statements/investment-labels";
import { api } from "~/trpc/react";

export function HoldingsWorkspace() {
  const holdings = api.investmentInstruments.holdings.useQuery();
  const [query, setQuery] = useState("");
  if (holdings.isLoading)
    return (
      <p role="status" className="text-muted-foreground text-sm">
        Loading holdings…
      </p>
    );
  if (holdings.error)
    return (
      <p role="alert" className="text-destructive text-sm">
        {holdings.error.message}
      </p>
    );
  const instruments = (holdings.data?.instruments ?? []).filter((instrument) =>
    [
      instrument.displayName,
      instrument.series,
      ...instrument.identifiers.map(
        (id) => `${id.value} ${id.namespace ?? ""}`,
      ),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase().trim()),
  );
  const positions = holdings.data?.positions ?? [];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Holdings</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Reusable holdings across your accounts. Open a holding to see
          exposure, history and source statements.
        </p>
      </div>
      <div className="max-w-md space-y-2">
        <Label htmlFor="holdings-search">Find a holding</Label>
        <Input
          id="holdings-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, symbol, exchange or fund code"
        />
      </div>
      {instruments.length ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[660px] text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-left">
              <tr>
                {[
                  "Holding",
                  "Symbol / exchange or fund code",
                  "Type",
                  "Accounts",
                  "Latest observation",
                ].map((label) => (
                  <th key={label} className="p-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {instruments.map((instrument) => {
                const rows = positions.filter(
                  (row) => row.instrumentId === instrument.id,
                );
                const latest = rows
                  .map((row) => row.valuationDate)
                  .sort()
                  .at(-1);
                return (
                  <tr
                    key={instrument.id}
                    className="hover:bg-muted/20 border-t"
                  >
                    <td className="p-3">
                      <Link
                        className="text-primary font-medium hover:underline"
                        href={`/holdings/${instrument.id}`}
                      >
                        {instrument.displayName}
                      </Link>
                      {instrument.series ? (
                        <p className="text-muted-foreground text-xs">
                          Series {instrument.series}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-3">
                      {instrument.identifiers.length ? (
                        instrument.identifiers.map((identifier) => (
                          <p
                            key={`${identifier.kind}:${identifier.value}:${identifier.namespace}`}
                          >
                            {identifier.value}
                            {identifier.namespace
                              ? ` / ${identifier.namespace}`
                              : ""}
                          </p>
                        ))
                      ) : (
                        <span className="text-muted-foreground">
                          No identifier
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {instrumentKindLabels[instrument.kind]}
                    </td>
                    <td className="p-3 tabular-nums">
                      {new Set(rows.map((row) => row.accountId)).size}
                    </td>
                    <td className="p-3">{latest ?? "No statements yet"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
          {query
            ? "No holdings match this search."
            : "Link or create a holding while entering investment statement details."}
        </p>
      )}
    </div>
  );
}
