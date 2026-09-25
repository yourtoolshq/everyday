import { DataSettingsPage } from "@yourtoolshq/data-ui";

export default function DataSettingsRoute() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="space-y-2">
        <p className="text-primary text-sm font-medium">Settings</p>
        <h2 className="text-3xl font-semibold tracking-tight">
          Data &amp; backups
        </h2>
        <p className="text-muted-foreground">
          Storage, backups, and restores for this household&apos;s data.
        </p>
      </div>
      <DataSettingsPage />
    </main>
  );
}
