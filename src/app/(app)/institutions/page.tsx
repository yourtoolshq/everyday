import { InstitutionsWorkspace } from "~/components/institutions/institutions-workspace";

export default function InstitutionsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Inventory</p>
        <h2 className="text-3xl font-semibold tracking-tight">Institutions</h2>
        <p className="text-muted-foreground">Banks, lenders, and investment providers.</p>
      </div>
      <InstitutionsWorkspace />
    </main>
  );
}
