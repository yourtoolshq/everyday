import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@yourtoolshq/ui/tooltip";

import {
  calculateValueChange,
  formatInvestmentAmount,
} from "~/modules/investment-statements/domain/entry-helpers";

export function ValueChangePill({
  later,
  earlier,
  currency,
  label,
}: {
  later: string | null;
  earlier: string | null;
  currency: string;
  label: string;
}) {
  const change = calculateValueChange(later, earlier);
  if (!change) return null;
  const Icon =
    change.direction === "flat"
      ? Minus
      : change.direction === "up"
        ? ArrowUpRight
        : ArrowDownRight;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap tabular-nums ${change.direction === "up" ? "border-emerald-600/20 bg-emerald-600/5 text-emerald-700 dark:text-emerald-400" : change.direction === "down" ? "border-amber-600/20 bg-amber-600/5 text-amber-800 dark:text-amber-400" : "text-muted-foreground"}`}
          aria-label={`${label}: ${formatInvestmentAmount(change.amount, currency)}`}
        >
          <Icon className="size-3.5" />
          {change.direction === "up" ? "+" : ""}
          {formatInvestmentAmount(change.amount)}
          {change.percentage ? ` (${change.percentage}%)` : null}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          <p>{label}</p>
          <p>
            {formatInvestmentAmount(earlier, currency)} →{" "}
            {formatInvestmentAmount(later, currency)}
          </p>
          <p>This difference is not investment return or tax gain.</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
