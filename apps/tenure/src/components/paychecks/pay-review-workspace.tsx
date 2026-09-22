"use client";

import Link from "next/link";

import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { api } from "~/trpc/react";

export function PayReviewWorkspace() {
  const review = api.paychecks.listForReview.useQuery();

  const missing = review.data?.missing ?? [];
  const missingPaychecks = missing.filter(
    (item) => item.issue === "missing_paycheck",
  );
  const missingStubs = missing.filter((item) => item.issue === "missing_stub");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Missing paychecks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{missingPaychecks.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Missing stubs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{missingStubs.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Employments tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {review.data?.employmentCount ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Needs attention</CardTitle>
        </CardHeader>
        <CardContent>
          {review.isLoading ? (
            <p className="text-muted-foreground text-sm">
              Loading review items…
            </p>
          ) : missing.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No missing paychecks or pay stubs across your employments.
            </p>
          ) : (
            <ul className="divide-y">
              {missing.map((item) => (
                <li
                  key={`${item.employmentId}-${item.periodKey}-${item.issue}`}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium">
                      {item.employerName}
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        · {item.personName}
                      </span>
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {item.periodLabel}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="destructive">
                      {item.issue === "missing_paycheck"
                        ? "Missing paycheck"
                        : "Missing stub"}
                    </Badge>
                    <Link
                      href={`/employments/${item.employmentId}`}
                      className="text-primary text-sm font-medium hover:underline"
                    >
                      View
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
