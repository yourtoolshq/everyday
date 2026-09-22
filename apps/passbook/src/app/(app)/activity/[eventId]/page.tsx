import { ActivityDetailWorkspace } from "~/components/activity/activity-detail-workspace";

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4 md:p-6">
      <ActivityDetailWorkspace eventId={eventId} />
    </main>
  );
}
