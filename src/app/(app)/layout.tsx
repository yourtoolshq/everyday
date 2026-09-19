import { redirect } from "next/navigation";

import { AppShell } from "~/components/layout/app-shell";
import { databaseReady, db } from "~/server/db";

export const dynamic = "force-dynamic";

export default async function ApplicationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await databaseReady;
  if (!(await db.query.households.findFirst())) redirect("/setup");
  return <AppShell>{children}</AppShell>;
}
