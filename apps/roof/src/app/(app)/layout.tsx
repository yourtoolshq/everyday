import { DataGate } from "@yourtoolshq/data-ui/server";

import { AppShell } from "~/components/layout/app-shell";
import { dataPlatform } from "~/server/data";

export const dynamic = "force-dynamic";

export default function ApplicationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <DataGate platform={dataPlatform}>
      <AppShell>{children}</AppShell>
    </DataGate>
  );
}
