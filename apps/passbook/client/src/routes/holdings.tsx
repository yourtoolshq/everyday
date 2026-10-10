import { HoldingsWorkspace } from "~/components/investment-statements/holdings-workspace";

export function HoldingsRoute() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4 md:p-6">
      <HoldingsWorkspace />
    </main>
  );
}
