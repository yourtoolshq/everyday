import { EmploymentsWorkspace } from "~/components/employments/employments-workspace";

export default function EmploymentsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Employments</h2>
        <p className="text-sm text-muted-foreground">
          Record each person&apos;s employment period with an employer.
        </p>
      </div>
      <EmploymentsWorkspace />
    </main>
  );
}
