import { CareProvidersWorkspace } from "~/components/care-providers/care-providers-workspace";
import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function CareProvidersPage() {
  const initialOverview = await api.careProviders.overview();
  return <CareProvidersWorkspace initialOverview={initialOverview} />;
}
