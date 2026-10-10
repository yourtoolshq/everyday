import type {
  EnrichmentReviewStatus,
  PositionLineKind,
  SectionCoverage,
  TotalScope,
} from "~/modules/investment-statements/domain/enums";

export type { PositionLineKind, TotalScope };

export interface TotalInput {
  currency: string;
  scope: TotalScope;
  closingValue: string | null;
  openingValue: string | null;
  cash: string | null;
  bookCost: string | null;
  contributions: string | null;
  withdrawals: string | null;
  transfersIn: string | null;
  transfersOut: string | null;
  income: string | null;
  fees: string | null;
  reportedValueChange: string | null;
  sourcePage: number | null;
  sourceNote: string | null;
}

export interface PositionInput {
  instrumentId: string | null;
  lineKind: PositionLineKind;
  sourceLabel: string;
  sourceIdentifier: string | null;
  sourceSeries: string | null;
  valueCurrency: string;
  marketValue: string | null;
  quantity: string | null;
  unitPrice: string | null;
  unitPriceCurrency: string | null;
  bookCost: string | null;
  bookCostCurrency: string | null;
  sourcePage: number | null;
  sourceNote: string | null;
}

export interface SnapshotDto {
  id: string;
  documentId: string;
  accountId: string;
  documentTitle: string;
  periodKey: string | null;
  revision: number;
  schemaVersion: number;
  reviewStatus: EnrichmentReviewStatus;
  reviewedAt: string | null;
  valuationDate: string;
  coverageStart: string | null;
  coverageEnd: string | null;
  summaryCoverage: SectionCoverage;
  holdingsCoverage: SectionCoverage;
  notes: string | null;
  totals: TotalDto[];
  positions: PositionDto[];
}

export interface TotalDto extends TotalInput {
  id?: string;
}

export interface PositionDto extends PositionInput {
  id?: string;
}

export interface SaveSnapshotCommand {
  documentId: string;
  expectedRevision: number | null;
  valuationDate: string;
  coverageStart: string | null;
  coverageEnd: string | null;
  summaryCoverage: SectionCoverage;
  holdingsCoverage: SectionCoverage;
  notes: string | null;
  totals: TotalInput[];
  positions: PositionInput[];
}
