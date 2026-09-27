import { redirect } from "next/navigation";

import { DataGate } from "@yourtoolshq/data-ui/server";

import { AppShell } from "~/components/layout/app-shell";
import { dataPlatform } from "~/server/data";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";

export default function ApplicationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <DataGate platform={dataPlatform}>
      <RequireHousehold>
        <AppShell>{children}</AppShell>
      </RequireHousehold>
    </DataGate>
  );
}

async function RequireHousehold({ children }: { children: React.ReactNode }) {
  if (!(await db.query.households.findFirst())) redirect("/setup");
  return children;
}
