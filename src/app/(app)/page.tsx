import { Briefcase, Building2, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const summary = await api.overview.summary();

  const stats = [
    { label: "People", value: summary.peopleCount, icon: Users },
    { label: "Employers", value: summary.employerCount, icon: Building2 },
    { label: "Employments", value: summary.employmentCount, icon: Briefcase },
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
          <Card key={stat.label} className="shadow-none">
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
        ))}
      </div>
    </main>
  );
}
