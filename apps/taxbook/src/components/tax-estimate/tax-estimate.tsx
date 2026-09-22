"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import { useState } from "react";

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
import { api, type RouterOutputs } from "~/trpc/react";
import { EstimateWarnings } from "./estimate-warnings";
import { HouseholdItems } from "./household-items";
import { InputReference } from "./input-reference";
import { PersonEstimateCard } from "./person-estimate-card";
import { ScenarioSandbox } from "./scenario-sandbox";
import { SupportingSources } from "./supporting-sources";
import { resultLabel, type EstimateData, type EstimateMode } from "./types";

export function TaxEstimate({ taxYearId }: { taxYearId?: number }) {
  const estimate = api.taxEstimate.get.useQuery(
    taxYearId ? { taxYearId } : undefined,
    { enabled: Boolean(taxYearId) },
  );

  if (estimate.isLoading) {
    return (
      <div className="space-y-5 p-6">
        <Skeleton className="h-20 w-80" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }
  if (estimate.error || !estimate.data) {
    return (
      <div className="p-6 text-sm text-destructive">
        Unable to load Tax Estimate. {estimate.error?.message}
      </div>
    );
  }
  if (!estimate.data.supported) {
    return <Unsupported data={estimate.data} />;
  }
  return <EstimateContent key={estimate.data.year.id} data={estimate.data} />;
}

function Unsupported({
  data,
}: {
  data: Exclude<RouterOutputs["taxEstimate"]["get"], { supported: true }>;
}) {
  return (
    <div className="flex flex-col gap-5 p-6">
      <div>
        <p className="text-sm font-medium text-primary">{data.year.year} tax year</p>
        <h2 className="mt-1 text-2xl font-semibold">Tax Estimate</h2>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Estimate unavailable</CardTitle>
          <CardDescription>
            This first estimate is intentionally limited to the current household workflow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {data.blockingReasons.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function EstimateContent({ data }: { data: EstimateData }) {
  const [mode, setMode] = useState<EstimateMode>("projected");
  const selected = data[mode];
  const modeLabel = mode === "actual" ? "Recorded" : "Projected";

  return (
    <div className="flex flex-col gap-6 p-6">
      <EstimateHeader data={data} mode={mode} setMode={setMode} />
      <Card className={selected.householdResultCents >= 0 ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/40" : "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/40"}>
        <CardHeader>
          <CardDescription>{modeLabel} household result</CardDescription>
          <CardTitle className="text-4xl tabular-nums">
            {resultLabel(selected.householdResultCents)}
          </CardTitle>
          <CardDescription>
            The combined result of the individual estimates below—not a joint tax return.
          </CardDescription>
        </CardHeader>
      </Card>
      <section className="space-y-3" aria-labelledby="member-estimates-heading">
        <div>
          <h3 id="member-estimates-heading" className="text-lg font-semibold">
            Estimates by person
          </h3>
          <p className="text-sm text-muted-foreground">
            Each statement shows how the {modeLabel.toLowerCase()} refund or amount owing is calculated.
          </p>
        </div>
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {selected.people.map((person) => (
            <PersonEstimateCard
              key={person.personId}
              person={person}
              modeLabel={modeLabel}
            />
          ))}
        </div>
      </section>
      <HouseholdItems data={data} result={selected} modeLabel={modeLabel} />
      <EstimateWarnings data={data} />
      {mode === "projected" ? <ScenarioSandbox data={data} /> : null}
      <SupportingSources data={data} mode={mode} />
      <InputReference data={data} mode={mode} />
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          2026 Manitoba planning estimate—not filing software.
        </p>
        <p className="mt-1">
          Gross employment income is assumed to be pensionable and insurable. Contribution room, eligibility, and complete tax-return coverage are not validated.
        </p>
      </div>
    </div>
  );
}

function EstimateHeader({
  data,
  mode,
  setMode,
}: {
  data: EstimateData;
  mode: EstimateMode;
  setMode: (mode: EstimateMode) => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-primary">{data.year.year} Manitoba</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Tax Estimate</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          See what is recorded so far or the expected year-end result.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {data.incomplete ? (
          <Badge
            variant="outline"
            className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <IconAlertTriangle />
            Incomplete estimate
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            Inputs complete
          </Badge>
        )}
        <div className="inline-flex rounded-lg border bg-muted/40 p-1" aria-label="Estimate view">
          <Button
            type="button"
            size="sm"
            variant={mode === "actual" ? "default" : "ghost"}
            aria-pressed={mode === "actual"}
            onClick={() => setMode("actual")}
          >
            Recorded
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "projected" ? "default" : "ghost"}
            aria-pressed={mode === "projected"}
            onClick={() => setMode("projected")}
          >
            Projected
          </Button>
        </div>
      </div>
    </div>
  );
}
