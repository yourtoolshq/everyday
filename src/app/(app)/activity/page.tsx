import { ActivityWorkspace } from "~/components/activity/activity-workspace";

export default function ActivityPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Records</p>
        <h2 className="text-3xl font-semibold tracking-tight">Activity</h2>
        <p className="text-muted-foreground">
          Correspondence, calls, and account changes across the household.
        </p>
      </div>
      <ActivityWorkspace />
    </main>
  );
}
