import { notFound } from "next/navigation";

import { BusinessActivityDetail } from "~/components/self-employment/business-activity-detail";

export default async function BusinessActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  return <BusinessActivityDetail id={id} />;
}
