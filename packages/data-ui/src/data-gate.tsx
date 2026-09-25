import type { ReactNode } from "react";

import type { DataPlatform } from "@yourtoolshq/data";

import { MaintenanceScreen } from "./maintenance-screen";

// Put the gate in the same component tree as the work it protects: Next.js renders
// layouts and pages in parallel, so a gate in a parent layout does not stop a child
// segment from querying the database.
export async function DataGate({
  platform,
  children,
}: {
  platform: Pick<DataPlatform, "status">;
  children: ReactNode;
}) {
  const status = await platform.status();
  if (status.state === "ready") return children;
  return <MaintenanceScreen initialStatus={status} />;
}
