"use client";

import { IconCalculator } from "@tabler/icons-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { dollarsToCents, formatCad } from "~/domain/money";
import { api, type RouterOutputs } from "~/trpc/react";
import { resultLabel, type EstimateData } from "./types";

type ScenarioComparison = Extract<
  RouterOutputs["taxEstimate"]["calculateScenario"],
  { comparison: unknown }
>["comparison"];

export function ScenarioSandbox({ data }: { data: EstimateData }) {
  const blank = () => data.projected.people.map((person) => ({
    personId: person.personId,
    rrspContribution: "",
    rrspDeduction: "",
    fhsaContribution: "",
    fhsaDeduction: "",
  }));
  const [rows, setRows] = useState(blank);
  const scenario = api.taxEstimate.calculateScenario.useMutation({
    onError: (error) => toast.error(error.message),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    scenario.mutate({
      people: rows.map((row) => ({
        personId: row.personId,
        rrspContributionCents: dollarsToCents(row.rrspContribution) ?? 0,
        rrspDeductionCents: dollarsToCents(row.rrspDeduction) ?? 0,
        fhsaContributionCents: dollarsToCents(row.fhsaContribution) ?? 0,
        fhsaDeductionCents: dollarsToCents(row.fhsaDeduction) ?? 0,
      })),
    });
  }

  function update(
    personId: number,
    field: keyof Omit<(typeof rows)[number], "personId">,
    value: string,
  ) {
    setRows((current) => current.map((row) => (
      row.personId === personId ? { ...row, [field]: value } : row
    )));
  }

  const comparison = scenario.data && "comparison" in scenario.data
    ? scenario.data.comparison
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconCalculator className="size-5 text-primary" />
          RRSP/FHSA sandbox
        </CardTitle>
        <CardDescription>
          Try additional contributions and deductions without changing tracked Tax Items. Contribution room is not validated.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={submit}>
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((row) => {
              const person = data.projected.people.find(
                (item) => item.personId === row.personId,
              )!;
              return (
                <div key={row.personId} className="rounded-lg border p-4">
                  <p className="mb-3 font-medium">{person.personName}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <MoneyField
                      label={`${person.personName} RRSP contribution`}
                      value={row.rrspContribution}
                      setValue={(value) => update(row.personId, "rrspContribution", value)}
                    />
                    <MoneyField
                      label={`${person.personName} RRSP deduction`}
                      value={row.rrspDeduction}
                      setValue={(value) => update(row.personId, "rrspDeduction", value)}
                    />
                    <MoneyField
                      label={`${person.personName} FHSA contribution`}
                      value={row.fhsaContribution}
                      setValue={(value) => update(row.personId, "fhsaContribution", value)}
                    />
                    <MoneyField
                      label={`${person.personName} FHSA deduction`}
                      value={row.fhsaDeduction}
                      setValue={(value) => update(row.personId, "fhsaDeduction", value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <Button disabled={scenario.isPending}>
            {scenario.isPending ? "Calculating…" : "Calculate scenario"}
          </Button>
          {comparison ? <ScenarioComparison comparison={comparison} /> : null}
        </form>
      </CardContent>
    </Card>
  );
}

function ScenarioComparison({
  comparison,
}: {
  comparison: ScenarioComparison;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <ResultMetric
          label="Baseline"
          value={resultLabel(comparison.baselineResultCents)}
        />
        <ResultMetric
          label="Scenario"
          value={resultLabel(comparison.scenarioResultCents)}
        />
        <ResultMetric
          label="Household tax savings"
          value={formatCad(comparison.taxSavingsCents)}
        />
        <ResultMetric
          label="After-tax cost"
          value={formatCad(comparison.afterTaxCostCents)}
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {comparison.personSavings.map((person) => (
          `${person.personName}: ${formatCad(person.taxSavingsCents)} savings`
        )).join(" · ")}
      </p>
    </div>
  );
}

function MoneyField({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">
          $
        </span>
        <Input
          aria-label={label}
          className="pl-7"
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}
