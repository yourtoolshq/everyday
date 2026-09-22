"use client";

import Link from "next/link";
import {
  IconArrowRight,
  IconCalculator,
  IconCircleCheck,
  IconClock,
  IconFileDescription,
  IconListCheck,
} from "@tabler/icons-react";

import type { ItemStatus } from "~/domain/tax-item";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { formatCad } from "~/domain/money";
import { itemStatusLabels, itemTypeLabels, itemTypes } from "~/domain/tax-item";
import { api } from "~/trpc/react";

const statusStyles: Record<ItemStatus, string> = {
  planned:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200",
  in_progress:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  complete:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
};

export function Overview() {
  const overview = api.taxItem.overview.useQuery();
  const documents = api.taxDocument.overview.useQuery();
  const estimate = api.taxEstimate.get.useQuery(
    overview.data ? { taxYearId: overview.data.year.id } : undefined,
    { enabled: Boolean(overview.data) },
  );

  if (overview.isLoading || documents.isLoading || estimate.isLoading)
    return <OverviewSkeleton />;
  const error = overview.error ?? documents.error ?? estimate.error;
  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Overview unavailable</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  if (!overview.data || !documents.data || !estimate.data) return null;
  const data = overview.data;
  const documentData = documents.data;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-primary text-sm font-medium">
            {data.year.year} tax year
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            {data.household.name}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            A household view of the amounts you are tracking—not a tax
            calculation.
          </p>
        </div>
        <Button asChild>
          <Link href="/items">
            Manage tax items <IconArrowRight />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {itemTypes.map((type) => {
          const amount = data.amounts[type];
          return (
            <Card
              key={type}
              className="from-primary/[0.04] to-card bg-gradient-to-b shadow-xs"
            >
              <CardHeader className="pb-2">
                <CardDescription>{itemTypeLabels[type]}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {formatCad(amount.actualAmountCents)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-xs">
                  Expected {formatCad(amount.expectedAmountCents)} ·{" "}
                  {amount.itemCount} {amount.itemCount === 1 ? "item" : "items"}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.6fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Needs attention</CardTitle>
            <CardDescription>
              Open work and expected amounts that have not been recorded as
              actual.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.attention.length === 0 ? (
              <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed text-center">
                <IconCircleCheck className="mb-3 size-8 text-emerald-600" />
                <p className="font-medium">
                  {data.totalItems === 0
                    ? "No tax items yet"
                    : "Everything is up to date"}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {data.totalItems === 0
                    ? "Add your first item to start tracking this year."
                    : "There are no items requiring attention."}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {data.attention.map((item) => (
                  <Link
                    key={item.id}
                    href="/items"
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="bg-muted flex size-9 items-center justify-center rounded-lg">
                      <IconClock className="text-muted-foreground size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {item.name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {itemTypeLabels[item.type]}
                      </span>
                    </span>
                    <Badge
                      variant="outline"
                      className={statusStyles[item.status]}
                    >
                      {itemStatusLabels[item.status]}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card
            className={
              estimate.data.supported &&
              estimate.data.projected.householdResultCents >= 0
                ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/40"
                : undefined
            }
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <IconCalculator className="text-primary size-5" /> Tax estimate
              </CardTitle>
              <CardDescription>
                {estimate.data.supported
                  ? `${estimate.data.projected.householdResultCents >= 0 ? "Projected refund" : "Projected amount owing"}: ${formatCad(Math.abs(estimate.data.projected.householdResultCents))}${estimate.data.incomplete ? " · incomplete" : ""}`
                  : estimate.data.blockingReasons[0]}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/estimate" prefetch={false}>
                  View Tax Estimate <IconArrowRight />
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <IconListCheck className="text-primary size-5" /> Tracking
                progress
              </CardTitle>
              <CardDescription>
                {data.totalItems} total{" "}
                {data.totalItems === 1 ? "item" : "items"} for {data.year.year}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(["planned", "in_progress", "complete"] as const).map(
                (status) => {
                  const count = data.statuses[status];
                  const width =
                    data.totalItems === 0
                      ? 0
                      : Math.round((count / data.totalItems) * 100);
                  return (
                    <div key={status}>
                      <div className="mb-1.5 flex justify-between text-sm">
                        <span>{itemStatusLabels[status]}</span>
                        <span className="font-medium tabular-nums">
                          {count}
                        </span>
                      </div>
                      <div className="bg-muted h-2 overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full rounded-full transition-all"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                },
              )}
            </CardContent>
          </Card>
          <Card
            className={
              documentData.isReady
                ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/40"
                : undefined
            }
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <IconFileDescription className="text-primary size-5" /> Filing
                documents
              </CardTitle>
              <CardDescription>
                {documentData.total === 0
                  ? "No tax documents tracked"
                  : documentData.isReady
                    ? "All tracked documents are ready"
                    : `${documentData.counts.expected} waiting · ${documentData.counts.received} need review`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/documents">
                  View Tax Documents <IconArrowRight />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid gap-4 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
