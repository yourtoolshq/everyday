import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { formatCad } from "~/domain/money";
import { taxTreatmentLabels } from "~/domain/tax-item";
import type { EstimateData, EstimateMode } from "./types";

export function SupportingSources({
  data,
  mode,
}: {
  data: EstimateData;
  mode: EstimateMode;
}) {
  const amountForItem = (
    item: EstimateData["sources"]["taxItems"][number],
  ) => (mode === "actual" ? item.actualCents : item.projectedCents);
  const amountForEmployment = (
    employment: EstimateData["sources"]["employments"][number],
  ) => mode === "actual"
    ? employment.actualGrossCents
    : employment.projectedGrossCents;
  const groups = data.projected.people.map((person) => ({
    name: person.personName,
    personId: person.personId,
    items: data.sources.taxItems.filter(
      (item) => item.personId === person.personId,
    ),
    employments: data.sources.employments.filter(
      (employment) => employment.personId === person.personId,
    ),
  }));
  const householdItems = data.sources.taxItems.filter(
    (item) => item.personId === null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contributing items and paycheques</CardTitle>
        <CardDescription>
          Sources are grouped by return. Only the active estimate view is shown.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        {groups.map((group) => (
          <SourceGroup
            key={group.personId}
            name={group.name}
            empty={group.items.length === 0 && group.employments.length === 0}
          >
            {group.employments.map((employment) => (
              <EmploymentSource
                key={employment.id}
                employment={employment}
                amount={amountForEmployment(employment)}
                mode={mode}
              />
            ))}
            {group.items.map((item) => (
              <TaxItemSource
                key={item.id}
                item={item}
                amount={amountForItem(item)}
              />
            ))}
          </SourceGroup>
        ))}
        <SourceGroup
          name="Household items"
          empty={householdItems.length === 0}
        >
          {householdItems.map((item) => (
            <TaxItemSource
              key={item.id}
              item={item}
              amount={amountForItem(item)}
            />
          ))}
        </SourceGroup>
      </CardContent>
    </Card>
  );
}

function EmploymentSource({
  employment,
  amount,
  mode,
}: {
  employment: EstimateData["sources"]["employments"][number];
  amount: number;
  mode: EstimateMode;
}) {
  const paychequeCount = employment.paycheques.length;
  const paychequeLabel = `${paychequeCount} recorded paycheque${paychequeCount === 1 ? "" : "s"}`;

  return (
    <div className="rounded-md border p-3">
      <div className="flex justify-between gap-4">
        <span className="font-medium">{employment.employerName}</span>
        <span className="tabular-nums">{formatCad(amount)}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Employment income · {mode === "actual" ? paychequeLabel : `Projected from ${paychequeLabel}`}
      </p>
      {mode === "actual" ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-primary">
            View paycheques
          </summary>
          <div className="mt-2 space-y-1">
            {employment.paycheques.map((paycheque) => (
              <p
                className="flex justify-between gap-3 text-xs text-muted-foreground"
                key={paycheque.id}
              >
                <span>{paycheque.payDate}</span>
                <span>
                  {formatCad(paycheque.grossPayCents)} gross · {formatCad(paycheque.incomeTaxCents)} tax
                </span>
              </p>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function TaxItemSource({
  item,
  amount,
}: {
  item: EstimateData["sources"]["taxItems"][number];
  amount: number;
}) {
  return (
    <div className="flex justify-between gap-4 rounded-md border p-3">
      <div>
        <Link
          className="font-medium text-primary hover:underline"
          href={`/items/${item.id}`}
        >
          {item.name}
        </Link>
        <p className="mt-1 text-xs text-muted-foreground">
          {taxTreatmentLabels[item.treatment]}
        </p>
      </div>
      <span className="tabular-nums">{formatCad(amount)}</span>
    </div>
  );
}

function SourceGroup({
  name,
  empty,
  children,
}: {
  name: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h4 className="font-semibold">{name}</h4>
      {empty ? (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          No mapped sources.
        </p>
      ) : children}
    </section>
  );
}
