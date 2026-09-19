import { notFound } from "next/navigation";

import { EmployerDetail } from "~/components/employers/employer-detail";
import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

type EmployerDetailPageProps = {
  params: Promise<{ employerId: string }>;
};

export default async function EmployerDetailPage({ params }: EmployerDetailPageProps) {
  const { employerId } = await params;

  try {
    const employer = await api.employers.getById({ id: employerId });
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
        <EmployerDetail employer={employer} />
      </main>
    );
  } catch {
    notFound();
  }
}
