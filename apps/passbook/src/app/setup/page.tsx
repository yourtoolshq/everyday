import { redirect } from "next/navigation";

import { DataGate } from "@yourtoolshq/data-ui/server";

import { SetupForm } from "~/components/setup/setup-form";
import { dataPlatform } from "~/server/data";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  return (
    <DataGate platform={dataPlatform}>
      <Setup />
    </DataGate>
  );
}

async function Setup() {
  if (await db.query.households.findFirst()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <SetupForm />
    </main>
  );
}
