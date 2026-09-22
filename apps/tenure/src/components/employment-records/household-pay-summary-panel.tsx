"use client";

import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { formatCad } from "~/lib/money";
import { api } from "~/trpc/react";

export function HouseholdPaySummaryPanel() {
  const summary = api.overview.paySummary.useQuery();

  if (summary.isLoading) {
    return (
      <Card className="shadow-none">
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">Loading pay totals…</p>
        </CardContent>
      </Card>
    );
  }

  if (!summary.data || summary.data.lifetime.paycheckCount === 0) {
    return null;
  }

  const { year, lifetime, thisYear } = summary.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lifetime pay recorded
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-semibold">{formatCad(lifetime.grossCents)} gross</p>
            <p className="text-sm text-muted-foreground">
              {formatCad(lifetime.netCents)} net · {lifetime.paycheckCount} paycheck
              {lifetime.paycheckCount === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {year} pay recorded
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-semibold">{formatCad(thisYear.grossCents)} gross</p>
            <p className="text-sm text-muted-foreground">
              {formatCad(thisYear.netCents)} net · {thisYear.paycheckCount} paycheck
              {thisYear.paycheckCount === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
      </div>

      {summary.data.employments.length > 1 ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">By employment</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {summary.data.employments.map((employment) => (
                <li
                  key={employment.employmentId}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/employments/${employment.employmentId}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {employment.employerName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{employment.personName}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p>{formatCad(employment.thisYear.grossCents)} gross ({year})</p>
                    <p className="text-muted-foreground">
                      {formatCad(employment.lifetime.grossCents)} lifetime
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
