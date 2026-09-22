import { notFound } from "next/navigation";

import { BenefitDetailWorkspace } from "~/components/benefits/benefit-detail-workspace";
import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function BenefitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await api.benefits.benefitDetail({ id });
  if (!detail) notFound();
  return <BenefitDetailWorkspace initialDetail={detail} />;
}
