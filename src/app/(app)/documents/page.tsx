import { DocumentsWorkspace } from "~/components/documents/documents-workspace";

export default function DocumentsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Documents</h2>
        <p className="text-sm text-muted-foreground">
          Contracts, letters, pay stubs, and other files linked to employments.
        </p>
      </div>
      <DocumentsWorkspace />
    </main>
  );
}
