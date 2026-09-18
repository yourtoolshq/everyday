import { MembersWorkspace } from "~/components/members/members-workspace";

export default function MembersPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Household</p>
        <h2 className="text-3xl font-semibold tracking-tight">Members</h2>
        <p className="text-muted-foreground">People who can own financial accounts.</p>
      </div>
      <MembersWorkspace />
    </main>
  );
}
