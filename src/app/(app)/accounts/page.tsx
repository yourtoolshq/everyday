import { AccountsWorkspace } from "~/components/accounts/accounts-workspace";

export default function AccountsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Inventory</p>
        <h2 className="text-3xl font-semibold tracking-tight">Accounts</h2>
        <p className="text-muted-foreground">
          Financial relationships held with institutions.
        </p>
      </div>
      <AccountsWorkspace />
    </main>
  );
}
