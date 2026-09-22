import { CarePlanWorkspace } from "~/components/care-plan/care-plan-workspace";
import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const initialOverview = await api.planning.overview();
  return <CarePlanWorkspace initialOverview={initialOverview} />;
}
