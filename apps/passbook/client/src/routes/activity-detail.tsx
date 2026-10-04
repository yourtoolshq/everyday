import { useParams } from "react-router-dom";

import { ActivityDetailWorkspace } from "~/components/activity/activity-detail-workspace";

export function ActivityDetailRoute() {
  const { eventId = "" } = useParams();
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4 md:p-6">
      <ActivityDetailWorkspace eventId={eventId} />
    </main>
  );
}
