"use client";

import { AlertTriangle, Info } from "lucide-react";

import type { InvestmentStatementFormState } from "~/components/investment-statements/investment-form-state";
import {
  crossCheckSummaryCash,
  reconcileHoldingsToTotal,
} from "~/modules/investment-statements/domain/reconciliation";

export function ReconciliationAlerts({
  form,
  preferredCurrency,
}: {
  form: InvestmentStatementFormState;
  preferredCurrency?: string;
}) {
  const holdings = reconcileHoldingsToTotal(
    form.totals,
    form.positions,
    form.summaryCoverage,
    form.holdingsCoverage,
    preferredCurrency,
  );
  const cash = crossCheckSummaryCash(
    form.totals,
    form.positions,
    form.summaryCoverage,
    form.holdingsCoverage,
  );

  const items = [holdings, cash].filter(
    (item) => item.status !== "not_applicable" && item.status !== "comparable",
  );

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={index}
          className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-950 dark:text-amber-50"
          role="status"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="space-y-1">
            <p>{item.message}</p>
            {item.difference ? (
              <p className="text-xs opacity-80">
                Difference: {item.difference}
                {item.currency ? ` ${item.currency}` : ""}
              </p>
            ) : null}
          </div>
        </div>
      ))}
      <p className="text-muted-foreground flex items-start gap-2 text-xs">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Reconciliation compares entered facts only. It does not calculate
        investment return or convert currencies.
      </p>
    </div>
  );
}
