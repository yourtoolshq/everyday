import { notFound } from "next/navigation";

import { EmploymentDetail } from "~/components/employments/employment-detail";
import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

type EmploymentDetailPageProps = {
  params: Promise<{ employmentId: string }>;
};

export default async function EmploymentDetailPage({
  params,
}: EmploymentDetailPageProps) {
  const { employmentId } = await params;

  try {
    const employment = await api.employments.getById({ id: employmentId });
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
        <EmploymentDetail employment={employment} />
      </main>
    );
  } catch {
    notFound();
  }
}
