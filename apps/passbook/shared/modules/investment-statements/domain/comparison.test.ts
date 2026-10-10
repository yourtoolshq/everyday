import { describe, expect, it } from "vitest";

import type { SnapshotDto } from "~/modules/investment-statements/domain/snapshot-dto";
import { compareSnapshotHoldings } from "~/modules/investment-statements/domain/comparison";

function baseSnapshot(
  overrides: Partial<SnapshotDto> &
    Pick<SnapshotDto, "valuationDate" | "holdingsCoverage">,
): SnapshotDto {
  return {
    id: "snap-1",
    documentId: "doc-1",
    accountId: "acct-1",
    documentTitle: "Statement",
    periodKey: "2025-Q4",
    revision: 1,
    schemaVersion: 1,
    reviewStatus: "reviewed",
    reviewedAt: "2026-01-01",
    coverageStart: null,
    coverageEnd: null,
    summaryCoverage: "partial",
    notes: null,
    totals: [],
    positions: [],
    ...overrides,
  };
}

const instrumentA = "inst-a";

describe("compareSnapshotHoldings", () => {
  it("keeps aggregate quantity unknown when any repeated row omits quantity", () => {
    const earlier = baseSnapshot({
      valuationDate: "2025-12-31",
      holdingsCoverage: "complete",
      positions: [
        {
          instrumentId: instrumentA,
          lineKind: "investment",
          sourceLabel: "Fund A",
          sourceIdentifier: null,
          sourceSeries: null,
          valueCurrency: "CAD",
          marketValue: "100",
          quantity: "10",
          unitPrice: null,
          unitPriceCurrency: null,
          bookCost: null,
          bookCostCurrency: null,
          sourcePage: null,
          sourceNote: null,
        },
        {
          instrumentId: instrumentA,
          lineKind: "investment",
          sourceLabel: "Fund A lot 2",
          sourceIdentifier: null,
          sourceSeries: null,
          valueCurrency: "CAD",
          marketValue: "50",
          quantity: null,
          unitPrice: null,
          unitPriceCurrency: null,
          bookCost: null,
          bookCostCurrency: null,
          sourcePage: null,
          sourceNote: null,
        },
      ],
    });
    const later = baseSnapshot({
      valuationDate: "2026-03-31",
      holdingsCoverage: "complete",
      positions: [
        {
          instrumentId: instrumentA,
          lineKind: "investment",
          sourceLabel: "Fund A",
          sourceIdentifier: null,
          sourceSeries: null,
          valueCurrency: "CAD",
          marketValue: "160",
          quantity: "10",
          unitPrice: null,
          unitPriceCurrency: null,
          bookCost: null,
          bookCostCurrency: null,
          sourcePage: null,
          sourceNote: null,
        },
        {
          instrumentId: instrumentA,
          lineKind: "investment",
          sourceLabel: "Fund A lot 2",
          sourceIdentifier: null,
          sourceSeries: null,
          valueCurrency: "CAD",
          marketValue: "50",
          quantity: null,
          unitPrice: null,
          unitPriceCurrency: null,
          bookCost: null,
          bookCostCurrency: null,
          sourcePage: null,
          sourceNote: null,
        },
      ],
    });

    const result = compareSnapshotHoldings(earlier, later);
    expect(
      result.observations.some((row) => row.kind === "quantity_increased"),
    ).toBe(false);
    expect(
      result.observations.some((row) => row.kind === "value_changed"),
    ).toBe(false);
  });

  it("detects same-currency market value changes when quantities match", () => {
    const position = {
      instrumentId: instrumentA,
      lineKind: "investment" as const,
      sourceLabel: "ETF",
      sourceIdentifier: null,
      sourceSeries: null,
      valueCurrency: "CAD",
      marketValue: "1000",
      quantity: "10",
      unitPrice: null,
      unitPriceCurrency: null,
      bookCost: null,
      bookCostCurrency: null,
      sourcePage: null,
      sourceNote: null,
    };
    const earlier = baseSnapshot({
      valuationDate: "2025-12-31",
      holdingsCoverage: "complete",
      positions: [position],
    });
    const later = baseSnapshot({
      valuationDate: "2026-03-31",
      holdingsCoverage: "complete",
      positions: [{ ...position, marketValue: "1100" }],
    });

    const result = compareSnapshotHoldings(earlier, later);
    expect(result.observations).toContainEqual({
      kind: "value_changed",
      instrumentId: instrumentA,
      label: "ETF",
    });
  });

  it("does not compare market values across currencies", () => {
    const earlier = baseSnapshot({
      valuationDate: "2025-12-31",
      holdingsCoverage: "complete",
      positions: [
        {
          instrumentId: instrumentA,
          lineKind: "investment",
          sourceLabel: "Dual",
          sourceIdentifier: null,
          sourceSeries: null,
          valueCurrency: "CAD",
          marketValue: "100",
          quantity: "1",
          unitPrice: null,
          unitPriceCurrency: null,
          bookCost: null,
          bookCostCurrency: null,
          sourcePage: null,
          sourceNote: null,
        },
        {
          instrumentId: instrumentA,
          lineKind: "investment",
          sourceLabel: "Dual USD",
          sourceIdentifier: null,
          sourceSeries: null,
          valueCurrency: "USD",
          marketValue: "80",
          quantity: null,
          unitPrice: null,
          unitPriceCurrency: null,
          bookCost: null,
          bookCostCurrency: null,
          sourcePage: null,
          sourceNote: null,
        },
      ],
    });
    const later = baseSnapshot({
      valuationDate: "2026-03-31",
      holdingsCoverage: "complete",
      positions: [
        {
          instrumentId: instrumentA,
          lineKind: "investment",
          sourceLabel: "Dual",
          sourceIdentifier: null,
          sourceSeries: null,
          valueCurrency: "CAD",
          marketValue: "100",
          quantity: "1",
          unitPrice: null,
          unitPriceCurrency: null,
          bookCost: null,
          bookCostCurrency: null,
          sourcePage: null,
          sourceNote: null,
        },
        {
          instrumentId: instrumentA,
          lineKind: "investment",
          sourceLabel: "Dual USD",
          sourceIdentifier: null,
          sourceSeries: null,
          valueCurrency: "USD",
          marketValue: "90",
          quantity: null,
          unitPrice: null,
          unitPriceCurrency: null,
          bookCost: null,
          bookCostCurrency: null,
          sourcePage: null,
          sourceNote: null,
        },
      ],
    });

    const result = compareSnapshotHoldings(earlier, later);
    expect(
      result.observations.some((row) => row.kind === "value_changed"),
    ).toBe(false);
  });

  it("suppresses new and missing holding observations under partial coverage", () => {
    const earlier = baseSnapshot({
      valuationDate: "2025-12-31",
      holdingsCoverage: "complete",
      positions: [
        {
          instrumentId: instrumentA,
          lineKind: "investment",
          sourceLabel: "Only earlier",
          sourceIdentifier: null,
          sourceSeries: null,
          valueCurrency: "CAD",
          marketValue: "100",
          quantity: "1",
          unitPrice: null,
          unitPriceCurrency: null,
          bookCost: null,
          bookCostCurrency: null,
          sourcePage: null,
          sourceNote: null,
        },
      ],
    });
    const later = baseSnapshot({
      valuationDate: "2026-03-31",
      holdingsCoverage: "partial",
      positions: [],
    });

    const result = compareSnapshotHoldings(earlier, later);
    expect(
      result.observations.some((row) => row.kind === "coverage_incomplete"),
    ).toBe(true);
    expect(
      result.observations.some((row) => row.kind === "holding_missing"),
    ).toBe(false);
  });
});
