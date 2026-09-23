"use client";

import Link from "next/link";

import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { api } from "~/trpc/react";

export function MissingPayStubsPanel() {
  const review = api.paychecks.listForReview.useQuery();
  const missing = review.data?.missing.slice(0, 8) ?? [];

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Pay stub review</CardTitle>
        <Link
          href="/review/pay-stubs"
          className="text-primary text-sm font-medium hover:underline"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {review.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : missing.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No missing paychecks or pay stubs right now.
          </p>
        ) : (
          <ul className="divide-y">
            {missing.map((item) => (
              <li
                key={`${item.employmentId}-${item.periodKey}-${item.issue}`}
                className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.employerName}</p>
                  <p className="text-muted-foreground text-xs">
                    {item.periodLabel} · {item.personName}
                  </p>
                </div>
                <Badge variant="destructive" className="shrink-0">
                  {item.issue === "missing_paycheck" ? "Paycheck" : "Stub"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
