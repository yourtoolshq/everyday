import { VisitsWorkspace } from "~/components/visits/visits-workspace";
import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function VisitsPage() {
  const initialOverview = await api.visits.overview();
  return <VisitsWorkspace initialOverview={initialOverview} />;
}
