import { InstitutionDetailWorkspace } from "~/components/institutions/institution-detail-workspace";

export default async function InstitutionPage({
  params,
}: {
  params: Promise<{ institutionId: string }>;
}) {
  const { institutionId } = await params;
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4 md:p-6">
      <InstitutionDetailWorkspace institutionId={institutionId} />
    </main>
  );
}
