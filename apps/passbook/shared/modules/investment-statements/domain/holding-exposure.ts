import type { EnrichmentReviewStatus, SectionCoverage } from "./enums";
import type { PositionInput } from "./snapshot-dto";
import { addAmounts, parseDecimalAmount } from "./decimal-money";

export type ExposureStatement = {
  id: string;
  accountId: string;
  accountName: string;
  documentId: string;
  documentTitle: string;
  valuationDate: string;
  reviewStatus: EnrichmentReviewStatus;
  holdingsCoverage: SectionCoverage;
  positions: PositionInput[];
};

function knownSum(values: (string | null)[]): string | null {
  return values.some((value) => value == null)
    ? null
    : addAmounts(values).toFixed();
}

/** Observed native-currency exposure, never an inferred sale or FX conversion. */
export function holdingExposure(
  statements: ExposureStatement[],
  instrumentId: string,
  currency: string,
  asOf: string,
) {
  const latest = new Map<string, ExposureStatement>();
  const sources = new Map<string, ExposureStatement[]>();
  for (const statement of [...statements].sort(
    (a, b) =>
      a.valuationDate.localeCompare(b.valuationDate) ||
      a.documentId.localeCompare(b.documentId),
  )) {
    if (
      statement.reviewStatus === "reviewed" &&
      statement.valuationDate <= asOf
    ) {
      const previous = latest.get(statement.accountId);
      const candidates =
        previous?.valuationDate === statement.valuationDate
          ? (sources.get(statement.accountId) ?? [])
          : [];
      sources.set(statement.accountId, [...candidates, statement]);
      latest.set(statement.accountId, statement);
    }
  }
  const accounts = [...latest.values()].map((statement) => {
    const rows = statement.positions.filter(
      (row) => row.valueCurrency === currency,
    );
    const holdingRows = rows.filter(
      (row) =>
        row.instrumentId === instrumentId && row.lineKind === "investment",
    );
    const candidates = sources.get(statement.accountId)!;
    const ambiguous = candidates.length > 1;
    const value = ambiguous
      ? null
      : holdingRows.length
        ? knownSum(holdingRows.map((row) => row.marketValue))
        : statement.holdingsCoverage === "complete"
          ? "0"
          : null;
    const total = ambiguous
      ? null
      : knownSum(rows.map((row) => row.marketValue));
    return {
      accountId: statement.accountId,
      accountName: statement.accountName,
      documentId: statement.documentId,
      documentTitle: statement.documentTitle,
      valuationDate: statement.valuationDate,
      coverage: statement.holdingsCoverage,
      ambiguous,
      sources: candidates.map((item) => ({
        documentId: item.documentId,
        title: item.documentTitle,
      })),
      value,
      total,
      quantity:
        !ambiguous && holdingRows.length
          ? knownSum(holdingRows.map((row) => row.quantity))
          : null,
      share:
        value != null && total != null && parseDecimalAmount(total)!.gt(0)
          ? parseDecimalAmount(value)!
              .div(parseDecimalAmount(total)!)
              .times(100)
              .toFixed(2)
          : null,
    };
  });
  const value = knownSum(accounts.map((account) => account.value));
  const total = knownSum(accounts.map((account) => account.total));
  return {
    accounts,
    value,
    total,
    share:
      value != null && total != null && parseDecimalAmount(total)!.gt(0)
        ? parseDecimalAmount(value)!
            .div(parseDecimalAmount(total)!)
            .times(100)
            .toFixed(2)
        : null,
    rest:
      value != null && total != null
        ? parseDecimalAmount(total)!.minus(parseDecimalAmount(value)!).toFixed()
        : null,
    ambiguous: accounts.some((account) => account.ambiguous),
    partial: accounts.some((account) => account.coverage !== "complete"),
    mixedDates:
      new Set(accounts.map((account) => account.valuationDate)).size > 1,
  };
}
