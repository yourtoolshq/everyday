import { redirect } from "next/navigation";

import { SetupForm } from "~/components/setup/setup-form";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await db.query.households.findFirst()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <SetupForm />
    </main>
  );
}
