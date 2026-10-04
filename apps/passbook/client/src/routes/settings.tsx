import { ThemeSetting } from "@yourtoolshq/ui/theme-setting";

export function SettingsRoute() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="space-y-2">
        <p className="text-primary text-sm font-medium">Settings</p>
        <h2 className="text-3xl font-semibold tracking-tight">General</h2>
        <p className="text-muted-foreground">
          Appearance and other preferences for this household.
        </p>
      </div>
      <ThemeSetting />
    </main>
  );
}
