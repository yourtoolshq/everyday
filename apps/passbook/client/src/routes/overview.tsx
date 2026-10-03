import { Building2, Users, Wallet } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@yourtoolshq/ui/card";

import { MissingStatementsPanel } from "~/components/overview/missing-statements-panel";
import { api } from "../trpc/react";

export function OverviewRoute() {
  const summary = api.overview.summary.useQuery();
  const statementStatus = api.overview.statementStatus.useQuery();

  if (summary.isLoading || statementStatus.isLoading) return null;
  if (!summary.data || !statementStatus.data) return null;

  const stats = [
    { label: "Members", value: summary.data.memberCount, icon: Users },
    {
      label: "Institutions",
      value: summary.data.institutionCount,
      icon: Building2,
    },
    { label: "Accounts", value: summary.data.accountCount, icon: Wallet },
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-6">
      <div className="space-y-2">
        <p className="text-primary text-sm font-medium">Household overview</p>
        <h2 className="text-3xl font-semibold tracking-tight">
          {summary.data.householdName ?? "Your household"}
        </h2>
        <p className="text-muted-foreground max-w-2xl">
          See which statement periods are complete, waiting, or missing across
          your accounts.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {stat.label}
              </CardTitle>
              <stat.icon className="text-primary size-4" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <MissingStatementsPanel status={statementStatus.data} />
    </main>
  );
}
