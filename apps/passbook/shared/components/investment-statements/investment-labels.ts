import type { SnapshotComparisonObservation } from "~/modules/investment-statements/domain/comparison";
import type {
  PositionLineKind,
  TotalScope,
} from "~/modules/investment-statements/domain/snapshot-dto";
import type {
  EnrichmentReviewStatus,
  SectionCoverage,
} from "~/server/db/schema";

export const sectionCoverageLabels: Record<SectionCoverage, string> = {
  not_entered: "Not entered",
  partial: "Partial",
  complete: "Complete",
};

export const reviewStatusLabels: Record<EnrichmentReviewStatus, string> = {
  draft: "Draft",
  reviewed: "Reviewed",
};

export type InvestmentDetailsStatus =
  "not_entered" | "draft" | "reviewed_partial" | "reviewed";

export function investmentDetailsStatusLabel(
  status: InvestmentDetailsStatus,
): string {
  switch (status) {
    case "not_entered":
      return "Details not entered";
    case "draft":
      return "Details draft";
    case "reviewed_partial":
      return "Reviewed (partial coverage)";
    case "reviewed":
      return "Details reviewed";
  }
}

export function deriveInvestmentDetailsStatus(
  snapshot:
    | {
        reviewStatus: EnrichmentReviewStatus;
        summaryCoverage: SectionCoverage;
        holdingsCoverage: SectionCoverage;
      }
    | null
    | undefined,
): InvestmentDetailsStatus {
  if (!snapshot) return "not_entered";
  if (snapshot.reviewStatus === "draft") return "draft";
  const partial =
    snapshot.summaryCoverage !== "complete" ||
    snapshot.holdingsCoverage !== "complete";
  return partial ? "reviewed_partial" : "reviewed";
}

export const totalScopeLabels: Record<TotalScope, string> = {
  account_total: "Account total",
  currency_component: "Currency component",
};

export const positionLineKindLabels: Record<PositionLineKind, string> = {
  investment: "Investment",
  cash: "Cash",
  other: "Other (unsupported product)",
};

export const instrumentKindLabels = {
  stock: "Stock",
  etf: "ETF",
  mutual_fund: "Mutual fund",
  other: "Other",
} as const;

export const identifierKindLabels = {
  ticker: "Ticker",
  fund_code: "Fund code",
  isin: "ISIN",
  cusip: "CUSIP",
} as const;

export function observationLabel(
  observation: SnapshotComparisonObservation,
): string {
  switch (observation.kind) {
    case "quantity_increased":
      return `${observation.label}: reported quantity increased between statements.`;
    case "quantity_decreased":
      return `${observation.label}: reported quantity decreased between statements.`;
    case "value_changed":
      return `${observation.label}: reported holding changed between statements.`;
    case "holding_new":
      return `${observation.label}: newly reported on the later statement.`;
    case "holding_missing":
      return `${observation.label}: not reported on the later statement (both lists were complete).`;
    case "coverage_incomplete":
      return observation.message;
    case "not_comparable":
      return observation.message;
  }
}

export const fieldDefinitions = {
  valuationDate:
    "Date the statement says holdings and values apply. This may differ from the document issue date or schedule period.",
  coverageDates:
    "Actual period this statement content covers, when the provider states it explicitly.",
  closingValue:
    "Institution-reported closing market value for the account or currency subtotal.",
  openingValue:
    "Institution-reported opening market value for the same scope and currency.",
  marketValue:
    "Reported market value for this line. Unknown is left blank, not zero.",
  quantity: "Reported units held. Leave blank when not shown on the statement.",
  unitPrice: "Reported price per unit when the statement provides it.",
  bookCost:
    "Institution-reported book or cost figure. This is not tax-adjusted cost base.",
  reportedValueChange:
    "Provider-reported change in market value for the period, when stated separately from flows.",
} as const;
