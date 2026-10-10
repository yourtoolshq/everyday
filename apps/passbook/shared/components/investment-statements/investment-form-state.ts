import type {
  PositionInput,
  SaveSnapshotCommand,
  SnapshotDto,
  TotalInput,
} from "~/modules/investment-statements/domain/snapshot-dto";
import type { SectionCoverage } from "~/server/db/schema";

export type InvestmentStatementFormState = {
  expectedRevision: number | null;
  valuationDate: string;
  coverageStart: string;
  coverageEnd: string;
  summaryCoverage: SectionCoverage;
  holdingsCoverage: SectionCoverage;
  notes: string;
  totals: TotalInput[];
  positions: PositionInput[];
};

export function emptyTotalRow(currency = "CAD"): TotalInput {
  return {
    currency,
    scope: "account_total",
    closingValue: null,
    openingValue: null,
    cash: null,
    bookCost: null,
    contributions: null,
    withdrawals: null,
    transfersIn: null,
    transfersOut: null,
    income: null,
    fees: null,
    reportedValueChange: null,
    sourcePage: null,
    sourceNote: null,
  };
}

export function emptyPositionRow(): PositionInput {
  return {
    instrumentId: null,
    lineKind: "investment",
    sourceLabel: "",
    sourceIdentifier: null,
    sourceSeries: null,
    valueCurrency: "CAD",
    marketValue: null,
    quantity: null,
    unitPrice: null,
    unitPriceCurrency: null,
    bookCost: null,
    bookCostCurrency: null,
    sourcePage: null,
    sourceNote: null,
  };
}

export function formStateFromSnapshot(
  snapshot: SnapshotDto | null,
  suggestedValuationDate?: string | null,
): InvestmentStatementFormState {
  if (!snapshot) {
    return {
      expectedRevision: null,
      valuationDate: suggestedValuationDate ?? "",
      coverageStart: "",
      coverageEnd: "",
      summaryCoverage: "not_entered",
      holdingsCoverage: "not_entered",
      notes: "",
      totals: [emptyTotalRow()],
      positions: [],
    };
  }

  return {
    expectedRevision: snapshot.revision,
    valuationDate: snapshot.valuationDate,
    coverageStart: snapshot.coverageStart ?? "",
    coverageEnd: snapshot.coverageEnd ?? "",
    summaryCoverage: snapshot.summaryCoverage,
    holdingsCoverage: snapshot.holdingsCoverage,
    notes: snapshot.notes ?? "",
    totals:
      snapshot.totals.length > 0
        ? snapshot.totals.map((row) => ({ ...row }))
        : [emptyTotalRow()],
    positions: snapshot.positions.map((row) => ({ ...row })),
  };
}

export function toSaveCommand(
  documentId: string,
  form: InvestmentStatementFormState,
): SaveSnapshotCommand {
  return {
    documentId,
    expectedRevision: form.expectedRevision,
    valuationDate: form.valuationDate,
    coverageStart: form.coverageStart.trim() || null,
    coverageEnd: form.coverageEnd.trim() || null,
    summaryCoverage: form.summaryCoverage,
    holdingsCoverage: form.holdingsCoverage,
    notes: form.notes.trim() || null,
    totals: form.totals,
    positions: form.positions,
  };
}

export function displayAmount(value: string | null | undefined): string {
  if (value == null || !value.trim()) return "—";
  return value.trim();
}
