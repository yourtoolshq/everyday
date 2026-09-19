"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { formatCad } from "~/lib/money";
import { api } from "~/trpc/react";

type EmploymentPaySummaryCardProps = {
  employmentId: string;
};

export function EmploymentPaySummaryCard({ employmentId }: EmploymentPaySummaryCardProps) {
  const summary = api.employmentRecords.paySummaryByEmployment.useQuery({ employmentId });

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
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Pay totals</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Lifetime</p>
          <p className="text-lg font-semibold">{formatCad(lifetime.grossCents)} gross</p>
          <p className="text-sm text-muted-foreground">
            {formatCad(lifetime.netCents)} net · {lifetime.paycheckCount} paycheck
            {lifetime.paycheckCount === 1 ? "" : "s"}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{year}</p>
          <p className="text-lg font-semibold">{formatCad(thisYear.grossCents)} gross</p>
          <p className="text-sm text-muted-foreground">
            {formatCad(thisYear.netCents)} net · {thisYear.paycheckCount} paycheck
            {thisYear.paycheckCount === 1 ? "" : "s"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
