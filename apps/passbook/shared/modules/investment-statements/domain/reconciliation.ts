import type { SectionCoverage } from "~/modules/investment-statements/domain/enums";
import type {
  PositionInput,
  TotalInput,
} from "~/modules/investment-statements/domain/snapshot-dto";
import {
  addAmounts,
  parseDecimalAmount,
  roundingToleranceFor,
} from "~/modules/investment-statements/domain/decimal-money";

export type ReconciliationStatus =
  | "not_applicable"
  | "comparable"
  | "warning"
  | "currency_mismatch"
  | "partial_coverage";

export interface HoldingsReconciliationResult {
  status: ReconciliationStatus;
  currency: string | null;
  reportedTotal: string | null;
  positionsSum: string | null;
  difference: string | null;
  message: string;
}

export interface CashCrossCheckResult {
  status: ReconciliationStatus;
  currency: string | null;
  summaryCash: string | null;
  cashPositionsSum: string | null;
  difference: string | null;
  message: string;
}

function isCompleteCoverage(coverage: SectionCoverage): boolean {
  return coverage === "complete";
}

export function reconcileHoldingsToTotal(
  totals: TotalInput[],
  positions: PositionInput[],
  summaryCoverage: SectionCoverage,
  holdingsCoverage: SectionCoverage,
  preferredCurrency?: string,
): HoldingsReconciliationResult {
  if (
    !isCompleteCoverage(holdingsCoverage) ||
    !isCompleteCoverage(summaryCoverage)
  ) {
    return {
      status: "partial_coverage",
      currency: null,
      reportedTotal: null,
      positionsSum: null,
      difference: null,
      message:
        "Holdings reconciliation needs complete holdings and summary coverage.",
    };
  }

  const accountTotals = totals.filter((row) => row.scope === "account_total");
  if (accountTotals.length === 0) {
    return {
      status: "not_applicable",
      currency: null,
      reportedTotal: null,
      positionsSum: null,
      difference: null,
      message: "No account total was entered for reconciliation.",
    };
  }

  const currency =
    preferredCurrency ??
    accountTotals.find((row) => row.closingValue)?.currency ??
    accountTotals[0]?.currency ??
    null;
  if (!currency) {
    return {
      status: "not_applicable",
      currency: null,
      reportedTotal: null,
      positionsSum: null,
      difference: null,
      message: "Choose a currency to reconcile.",
    };
  }

  const totalRow = accountTotals.find((row) => row.currency === currency);
  if (!totalRow?.closingValue) {
    return {
      status: "not_applicable",
      currency,
      reportedTotal: null,
      positionsSum: null,
      difference: null,
      message: "Enter a closing account total in this currency to reconcile.",
    };
  }

  const foreignPositions = positions.some(
    (row) => row.marketValue?.trim() && row.valueCurrency !== currency,
  );
  if (foreignPositions) {
    return {
      status: "currency_mismatch",
      currency,
      reportedTotal: totalRow.closingValue,
      positionsSum: null,
      difference: null,
      message:
        "Foreign-currency holdings cannot be reconciled against this account total without reported converted values.",
    };
  }

  const inCurrencyPositions = positions.filter(
    (row) => row.valueCurrency === currency,
  );
  const missingMarketValue = inCurrencyPositions.some(
    (row) => !row.marketValue?.trim(),
  );
  if (missingMarketValue) {
    return {
      status: "partial_coverage",
      currency,
      reportedTotal: totalRow.closingValue,
      positionsSum: null,
      difference: null,
      message:
        "Holdings reconciliation needs a reported market value on every position in this currency.",
    };
  }

  const positionValues = inCurrencyPositions.map((row) => row.marketValue);
  const positionsSum = addAmounts(positionValues);
  const reported = parseDecimalAmount(totalRow.closingValue)!;
  const difference = reported.minus(positionsSum);
  const tolerance = roundingToleranceFor([
    totalRow.closingValue,
    ...(positionValues.filter(Boolean) as string[]),
  ]);
  const withinTolerance = difference.abs().lte(tolerance);

  return {
    status: withinTolerance ? "comparable" : "warning",
    currency,
    reportedTotal: reported.toFixed(),
    positionsSum: positionsSum.toFixed(),
    difference: difference.toFixed(),
    message: withinTolerance
      ? "Entered holdings match the reported account total within rounding tolerance."
      : "Entered holdings do not match the reported account total.",
  };
}

export function crossCheckSummaryCash(
  totals: TotalInput[],
  positions: PositionInput[],
  summaryCoverage: SectionCoverage,
  holdingsCoverage: SectionCoverage,
): CashCrossCheckResult {
  if (
    !isCompleteCoverage(summaryCoverage) ||
    !isCompleteCoverage(holdingsCoverage)
  ) {
    return {
      status: "partial_coverage",
      currency: null,
      summaryCash: null,
      cashPositionsSum: null,
      difference: null,
      message: "Cash cross-check needs complete summary and holdings coverage.",
    };
  }

  const cashTotals = totals.filter((row) => row.cash?.trim());
  if (cashTotals.length === 0) {
    return {
      status: "not_applicable",
      currency: null,
      summaryCash: null,
      cashPositionsSum: null,
      difference: null,
      message: "No summary cash figure was entered.",
    };
  }

  const currencies = new Set(cashTotals.map((row) => row.currency));
  if (currencies.size !== 1) {
    return {
      status: "currency_mismatch",
      currency: null,
      summaryCash: null,
      cashPositionsSum: null,
      difference: null,
      message: "Summary cash cross-check supports one currency at a time.",
    };
  }
  const currency = [...currencies][0]!;
  const summaryCash = cashTotals.find((row) => row.currency === currency)?.cash;
  if (!summaryCash) {
    return {
      status: "not_applicable",
      currency,
      summaryCash: null,
      cashPositionsSum: null,
      difference: null,
      message: "No summary cash figure was entered for this currency.",
    };
  }

  const cashPositions = positions.filter(
    (row) => row.lineKind === "cash" && row.valueCurrency === currency,
  );
  const missingCashValue = cashPositions.some(
    (row) => !row.marketValue?.trim(),
  );
  if (missingCashValue) {
    return {
      status: "partial_coverage",
      currency,
      summaryCash,
      cashPositionsSum: null,
      difference: null,
      message:
        "Cash cross-check needs a reported market value on every cash position in this currency.",
    };
  }

  const cashPositionValues = cashPositions.map((row) => row.marketValue);
  const positionsSum = addAmounts(cashPositionValues);
  const reported = parseDecimalAmount(summaryCash)!;
  const difference = reported.minus(positionsSum);
  const tolerance = roundingToleranceFor([
    summaryCash,
    ...(cashPositionValues.filter(Boolean) as string[]),
  ]);
  const withinTolerance = difference.abs().lte(tolerance);

  return {
    status: withinTolerance ? "comparable" : "warning",
    currency,
    summaryCash: reported.toFixed(),
    cashPositionsSum: positionsSum.toFixed(),
    difference: difference.toFixed(),
    message: withinTolerance
      ? "Summary cash matches cash position lines within rounding tolerance."
      : "Summary cash does not match entered cash position lines.",
  };
}

export function reportedBookCostDifference(
  marketValue: string | null,
  bookCost: string | null,
  valueCurrency: string,
  bookCostCurrency: string | null,
): { comparable: boolean; difference: string | null; message: string } {
  if (!marketValue?.trim() || !bookCost?.trim() || !bookCostCurrency) {
    return {
      comparable: false,
      difference: null,
      message:
        "Book cost comparison needs market value and book cost in the same currency.",
    };
  }
  if (bookCostCurrency !== valueCurrency) {
    return {
      comparable: false,
      difference: null,
      message: "Book cost and market value must use the same currency.",
    };
  }
  const difference = parseDecimalAmount(marketValue)!.minus(
    parseDecimalAmount(bookCost)!,
  );
  return {
    comparable: true,
    difference: difference.toFixed(),
    message: "Reported market value minus reported book cost.",
  };
}
