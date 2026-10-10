import { invalidInput } from "@yourtoolshq/server/errors";

import type { SectionCoverage } from "~/modules/investment-statements/domain/enums";
import type {
  PositionInput,
  SaveSnapshotCommand,
  TotalInput,
} from "~/modules/investment-statements/domain/snapshot-dto";
import {
  normalizeNullableDecimalString,
  parseDecimalAmount,
  validateCurrency,
  validateIsoDate,
  validateNullableIsoDate,
} from "~/modules/investment-statements/domain/decimal-money";
import { sectionCoverages } from "~/modules/investment-statements/domain/enums";

const monetaryFields: (keyof TotalInput)[] = [
  "closingValue",
  "openingValue",
  "cash",
  "bookCost",
  "contributions",
  "withdrawals",
  "transfersIn",
  "transfersOut",
  "income",
  "fees",
  "reportedValueChange",
];

function assertCoverage(value: SectionCoverage, label: string) {
  if (!sectionCoverages.includes(value)) {
    throw invalidInput(`${label} coverage is invalid.`);
  }
}

function normalizeTotalRow(row: TotalInput): TotalInput {
  const currency = validateCurrency(row.currency);
  const normalized: TotalInput = {
    currency,
    scope: row.scope,
    closingValue: normalizeNullableDecimalString(
      row.closingValue,
      "Closing value",
    ),
    openingValue: normalizeNullableDecimalString(
      row.openingValue,
      "Opening value",
    ),
    cash: normalizeNullableDecimalString(row.cash, "Cash"),
    bookCost: normalizeNullableDecimalString(row.bookCost, "Book cost"),
    contributions: normalizeNullableDecimalString(
      row.contributions,
      "Contributions",
    ),
    withdrawals: normalizeNullableDecimalString(row.withdrawals, "Withdrawals"),
    transfersIn: normalizeNullableDecimalString(
      row.transfersIn,
      "Transfers in",
    ),
    transfersOut: normalizeNullableDecimalString(
      row.transfersOut,
      "Transfers out",
    ),
    income: normalizeNullableDecimalString(row.income, "Income"),
    fees: normalizeNullableDecimalString(row.fees, "Fees"),
    reportedValueChange: normalizeNullableDecimalString(
      row.reportedValueChange,
      "Reported value change",
    ),
    sourcePage: row.sourcePage,
    sourceNote: row.sourceNote?.trim() || null,
  };
  return normalized;
}

function normalizePositionRow(row: PositionInput): PositionInput {
  const sourceLabel = row.sourceLabel.trim();
  if (!sourceLabel) {
    throw invalidInput("Each position needs a source label.");
  }
  const valueCurrency = validateCurrency(row.valueCurrency, "Value currency");
  const unitPriceCurrency = row.unitPriceCurrency
    ? validateCurrency(row.unitPriceCurrency, "Unit price currency")
    : null;
  const bookCostCurrency = row.bookCostCurrency
    ? validateCurrency(row.bookCostCurrency, "Book cost currency")
    : null;

  if (row.lineKind === "cash") {
    if (row.instrumentId) {
      throw invalidInput("Cash lines cannot reference an instrument.");
    }
    if (row.quantity?.trim()) {
      throw invalidInput("Cash lines cannot include quantity.");
    }
  }

  if (
    row.lineKind === "investment" &&
    row.quantity?.trim() &&
    !row.instrumentId
  ) {
    // quantity without instrument is allowed in draft; review catches instrument
  }

  return {
    instrumentId: row.instrumentId,
    lineKind: row.lineKind,
    sourceLabel,
    sourceIdentifier: row.sourceIdentifier?.trim() || null,
    sourceSeries: row.sourceSeries?.trim() || null,
    valueCurrency,
    marketValue: normalizeNullableDecimalString(
      row.marketValue,
      "Market value",
    ),
    quantity: normalizeNullableDecimalString(row.quantity, "Quantity"),
    unitPrice: normalizeNullableDecimalString(row.unitPrice, "Unit price"),
    unitPriceCurrency,
    bookCost: normalizeNullableDecimalString(row.bookCost, "Book cost"),
    bookCostCurrency,
    sourcePage: row.sourcePage,
    sourceNote: row.sourceNote?.trim() || null,
  };
}

export function normalizeSaveCommand(
  command: SaveSnapshotCommand,
): SaveSnapshotCommand {
  assertCoverage(command.summaryCoverage, "Summary");
  assertCoverage(command.holdingsCoverage, "Holdings");

  const valuationDate = validateIsoDate(
    command.valuationDate,
    "Valuation date",
  );
  const coverageStart = validateNullableIsoDate(
    command.coverageStart,
    "Coverage start",
  );
  const coverageEnd = validateNullableIsoDate(
    command.coverageEnd,
    "Coverage end",
  );
  if (coverageStart && coverageEnd && coverageStart > coverageEnd) {
    throw invalidInput("Coverage start cannot be after coverage end.");
  }

  const totalKeys = new Set<string>();
  const totals = command.totals.map((row) => {
    const normalized = normalizeTotalRow(row);
    const key = `${normalized.currency}:${normalized.scope}`;
    if (totalKeys.has(key)) {
      throw invalidInput(
        "Only one total row is allowed per currency and scope.",
      );
    }
    totalKeys.add(key);
    return normalized;
  });

  const positions = command.positions.map((row) => normalizePositionRow(row));

  return {
    ...command,
    valuationDate,
    coverageStart,
    coverageEnd,
    notes: command.notes?.trim() || null,
    totals,
    positions,
  };
}

export function totalHasAnyFact(total: TotalInput): boolean {
  return monetaryFields.some((field) => {
    const value = total[field];
    return typeof value === "string" && value.trim().length > 0;
  });
}

export function positionHasAnyFact(position: PositionInput): boolean {
  return (
    Boolean(position.marketValue?.trim()) ||
    Boolean(position.quantity?.trim()) ||
    Boolean(position.unitPrice?.trim()) ||
    Boolean(position.bookCost?.trim())
  );
}

export function snapshotHasAnyFinancialFact(
  totals: TotalInput[],
  positions: PositionInput[],
): boolean {
  return totals.some(totalHasAnyFact) || positions.some(positionHasAnyFact);
}

function assertNonNegativeAmount(
  value: string | null | undefined,
  label: string,
): void {
  if (!value?.trim()) return;
  const parsed = parseDecimalAmount(value, label);
  if (parsed?.isNegative()) {
    throw invalidInput(`${label} cannot be negative.`);
  }
}

export function assertReviewReady(
  totals: TotalInput[],
  positions: PositionInput[],
  valuationDate: string,
): void {
  validateIsoDate(valuationDate, "Valuation date");
  if (!snapshotHasAnyFinancialFact(totals, positions)) {
    throw invalidInput("Enter at least one financial fact before review.");
  }
  for (const total of totals) {
    for (const field of monetaryFields) {
      assertNonNegativeAmount(total[field] as string | null, field);
    }
  }
  for (const position of positions) {
    if (position.lineKind === "investment" && !position.instrumentId) {
      throw invalidInput(
        `Resolve an instrument for investment line "${position.sourceLabel}" before review.`,
      );
    }
    if (position.unitPrice?.trim() && !position.unitPriceCurrency) {
      throw invalidInput(
        `Enter a unit price currency for "${position.sourceLabel}" before review.`,
      );
    }
    if (position.bookCost?.trim() && !position.bookCostCurrency) {
      throw invalidInput(
        `Enter a book cost currency for "${position.sourceLabel}" before review.`,
      );
    }
    assertNonNegativeAmount(position.marketValue, "Market value");
    assertNonNegativeAmount(position.quantity, "Quantity");
    assertNonNegativeAmount(position.unitPrice, "Unit price");
    assertNonNegativeAmount(position.bookCost, "Book cost");
  }
}
