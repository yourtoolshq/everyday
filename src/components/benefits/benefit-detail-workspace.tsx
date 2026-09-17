"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { claimStatusLabels } from "~/lib/benefits";
import { formatDateTime } from "~/lib/date-time";
import { formatCents } from "~/lib/money";
import { api, type RouterOutputs } from "~/trpc/react";

type BenefitDetail = NonNullable<RouterOutputs["benefits"]["benefitDetail"]>;

export function BenefitDetailWorkspace({ initialDetail }: { initialDetail: BenefitDetail }) {
  const detail = api.benefits.benefitDetail.useQuery(
    { id: initialDetail.benefit.id },
    { initialData: initialDetail },
  );
  const data = detail.data;
  if (!data) return null;

  return (
    <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/benefits"><ArrowLeft />Back to benefits</Link>
        </Button>

        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{data.benefit.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.plan.name} · {data.plan.year}
            {data.person ? ` · ${data.person.displayName}` : " · Household shared"}
          </p>
          <p className="mt-2 text-sm">
            <span className="font-medium">{formatCents(data.remainingCents)} remaining</span>
            <span className="text-muted-foreground"> · resets {data.resetDate}</span>
          </p>
        </div>

        <Card className="shadow-none">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
            <Detail label="Annual limit" value={formatCents(data.benefit.annualLimitCents)} />
            <Detail label="Used" value={formatCents(data.usedCents)} />
            <Detail label="Pending" value={formatCents(data.pendingCents)} />
            <Detail label="Opening used" value={formatCents(data.benefit.openingUsedCents)} />
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Contributing claims</h2>
          {data.claims.length === 0 ? (
            <Card className="border-dashed shadow-none">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No claims recorded against this benefit yet.
              </CardContent>
            </Card>
          ) : (
            data.claims.map((claim) => (
              <Card key={claim.id} className="shadow-none">
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{claim.visitTitle}</p>
                      <Badge variant="outline">{claimStatusLabels[claim.status]}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDateTime(claim.visitStartsAt)} · {formatCents(claim.amountCents)}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/visits/${claim.visitId}`}>Open visit</Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}
