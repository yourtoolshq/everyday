import { Briefcase, Building2, Users } from "lucide-react";
import Link from "next/link";

import { HouseholdPaySummaryPanel } from "~/components/employment-records/household-pay-summary-panel";
import { MissingEmploymentRecordsPanel } from "~/components/employment-records/missing-employment-records-panel";
import { MissingPayStubsPanel } from "~/components/paychecks/missing-pay-stubs-panel";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const summary = await api.overview.summary();

  const stats = [
    { label: "People", value: summary.peopleCount, icon: Users, href: "/people" },
    { label: "Employers", value: summary.employerCount, icon: Building2, href: "/employers" },
    {
      label: "Employments",
      value: summary.employmentCount,
      icon: Briefcase,
      href: "/employments",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Household overview</p>
        <h2 className="text-3xl font-semibold tracking-tight">
          {summary.householdName ?? "Your household"}
        </h2>
        <p className="max-w-2xl text-muted-foreground">
          Keep employment records, documents, and pay history organized by employer.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="shadow-none transition-colors hover:bg-muted/40">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className="size-4 text-primary" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{stat.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <HouseholdPaySummaryPanel />

      <div className="grid gap-4 lg:grid-cols-2">
        <MissingPayStubsPanel />
        <MissingEmploymentRecordsPanel />
      </div>
    </main>
  );
}
