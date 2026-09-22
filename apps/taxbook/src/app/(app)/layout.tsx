import { redirect } from "next/navigation";

import { AppShell } from "~/components/layout/app-shell";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";

export default async function TaxBookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await db.query.households.findFirst())) redirect("/setup");
  return <AppShell>{children}</AppShell>;
}
