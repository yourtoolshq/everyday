import { useParams } from "react-router-dom";

import { InvestmentStatementWorkspace } from "~/components/investment-statements/investment-statement-workspace";

export function InvestmentStatementRoute() {
  const { documentId = "" } = useParams();
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col p-4 md:p-6">
      <InvestmentStatementWorkspace documentId={documentId} />
    </main>
  );
}
