"use client";

import Link from "next/link";

import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { api } from "~/trpc/react";

export function MissingEmploymentRecordsPanel() {
  const review = api.employmentRecords.listForReview.useQuery();
  const missing = review.data?.missing.slice(0, 8) ?? [];

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Employment record review</CardTitle>
        <Link
          href="/review/employment-records"
          className="text-sm font-medium text-primary hover:underline"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {review.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : missing.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No missing employment records right now.
          </p>
        ) : (
          <ul className="divide-y">
            {missing.map((item) => (
              <li
                key={`${item.employmentId}-${item.requirementKey}`}
                className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.employerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.label} · {item.personName}
                  </p>
                </div>
                <Badge variant="destructive" className="shrink-0">
                  Missing
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
