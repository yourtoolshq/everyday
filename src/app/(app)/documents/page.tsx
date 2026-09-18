import { DocumentsWorkspace } from "~/components/documents/documents-workspace";

export default function DocumentsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Records</p>
        <h2 className="text-3xl font-semibold tracking-tight">Documents</h2>
        <p className="text-muted-foreground">
          Account records and files, including those linked to activity or terms changes.
          Statements are tracked separately on each account.
        </p>
      </div>
      <DocumentsWorkspace />
    </main>
  );
}
