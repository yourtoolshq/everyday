import { EmployersWorkspace } from "~/components/employers/employers-workspace";

export default function EmployersPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Employers</h2>
        <p className="text-sm text-muted-foreground">
          Organizations where household members work or have worked.
        </p>
      </div>
      <EmployersWorkspace />
    </main>
  );
}
