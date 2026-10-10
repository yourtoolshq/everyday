import { Badge } from "@yourtoolshq/ui/badge";

import type { InvestmentDetailsStatus } from "~/components/investment-statements/investment-labels";
import type { SnapshotDto } from "~/modules/investment-statements/domain/snapshot-dto";
import {
  deriveInvestmentDetailsStatus,
  investmentDetailsStatusLabel,
} from "~/components/investment-statements/investment-labels";

export function InvestmentDetailsBadge({
  snapshot,
}: {
  snapshot: SnapshotDto | null | undefined;
}) {
  const status = deriveInvestmentDetailsStatus(snapshot);
  const variant =
    status === "not_entered"
      ? "outline"
      : status === "draft"
        ? "secondary"
        : status === "reviewed_partial"
          ? "outline"
          : "default";

  return (
    <Badge variant={variant} title={investmentDetailsStatusLabel(status)}>
      {shortDetailsLabel(status)}
    </Badge>
  );
}

function shortDetailsLabel(status: InvestmentDetailsStatus): string {
  switch (status) {
    case "not_entered":
      return "No details";
    case "draft":
      return "Draft details";
    case "reviewed_partial":
      return "Reviewed · partial";
    case "reviewed":
      return "Details reviewed";
  }
}
