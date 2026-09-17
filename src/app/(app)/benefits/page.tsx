import { BenefitsWorkspace } from "~/components/benefits/benefits-workspace";
import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function BenefitsPage() {
  const overview = await api.benefits.overview();
  return <BenefitsWorkspace initialOverview={overview} />;
}
