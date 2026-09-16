import { notFound } from "next/navigation";

import { VisitDetailWorkspace } from "~/components/visits/visit-detail-workspace";
import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function VisitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await api.visits.detail({ id });
  if (!detail) notFound();
  return <VisitDetailWorkspace initialDetail={detail} />;
}
