import { PeopleWorkspace } from "~/components/people/people-workspace";

export default function PeoplePage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">People</h2>
        <p className="text-sm text-muted-foreground">
          Household members whose employment records you keep.
        </p>
      </div>
      <PeopleWorkspace />
    </main>
  );
}
