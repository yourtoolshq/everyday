import { describe, expect, it } from "vitest";

import type { PositionInput, SnapshotDto } from "./snapshot-dto";
import {
  formatInvestmentAmount,
  holdingDifference,
  normalizeInvestmentEntry,
  rememberedPositions,
  suggestedMarketValue,
  suggestStatementDates,
} from "./entry-helpers";

const position: PositionInput = {
  instrumentId: "instrument",
  lineKind: "investment",
  sourceLabel: "Sample ETF",
  sourceIdentifier: null,
  sourceSeries: null,
  valueCurrency: "CAD",
  marketValue: "100",
  quantity: "2.5",
  unitPrice: "40",
  unitPriceCurrency: "CAD",
  bookCost: "90",
  bookCostCurrency: "CAD",
  sourcePage: null,
  sourceNote: null,
};
const snapshot = (date: string, positions: PositionInput[]): SnapshotDto => ({
  id: date,
  documentId: date,
  accountId: "account",
  documentTitle: "Sample statement",
  periodKey: null,
  revision: 1,
  schemaVersion: 1,
  reviewStatus: "reviewed",
  reviewedAt: date,
  valuationDate: date,
  coverageStart: null,
  coverageEnd: null,
  summaryCoverage: "partial",
  holdingsCoverage: "partial",
  notes: null,
  totals: [],
  positions,
});
describe("investment entry assistance", () => {
  it("evaluates restricted expressions with exact decimals and preserves unit price precision", () => {
    expect(normalizeInvestmentEntry("0.1+0.2")).toEqual({
      ok: true,
      value: "0.3",
    });
    expect(normalizeInvestmentEntry("10+2*3")).toEqual({
      ok: true,
      value: "16",
    });
    expect(normalizeInvestmentEntry("81.025", 20)).toEqual({
      ok: true,
      value: "81.025",
    });
    expect(normalizeInvestmentEntry("12,510.00")).toEqual({
      ok: true,
      value: "12510",
    });
    expect(normalizeInvestmentEntry("-2*-3")).toEqual({ ok: true, value: "6" });
    expect(normalizeInvestmentEntry("1/0").ok).toBe(false);
    expect(normalizeInvestmentEntry("12+").ok).toBe(false);
    expect(normalizeInvestmentEntry("alert(1)").ok).toBe(false);
  });

  it("suggests monthly, quarterly and annual dates including leap years", () => {
    expect(suggestStatementDates("2024-02")).toEqual({
      start: "2024-02-01",
      end: "2024-02-29",
    });
    expect(suggestStatementDates("2026-Q2")).toEqual({
      start: "2026-04-01",
      end: "2026-06-30",
    });
    expect(suggestStatementDates("2026")).toEqual({
      start: "2026-01-01",
      end: "2026-12-31",
    });
    expect(suggestStatementDates("2026-13")).toBeNull();
    expect(suggestStatementDates(null)).toBeNull();
  });
  it("only multiplies quantities and prices in matching currencies", () => {
    expect(suggestedMarketValue(position)).toBe("100.00");
    expect(
      suggestedMarketValue({ ...position, unitPriceCurrency: "USD" }),
    ).toBeNull();
    expect(
      suggestedMarketValue({ ...position, quantity: "unfinished" }),
    ).toBeNull();
    expect(
      holdingDifference({ ...position, bookCostCurrency: "USD" }),
    ).toBeNull();
    expect(holdingDifference(position)?.toFixed()).toBe("10");
  });
  it("seeds identities without stale values and retires explicit zeros", () => {
    const first = snapshot("2026-01-31", [position]);
    expect(rememberedPositions([first], "2026-02-28")[0]).toMatchObject({
      instrumentId: "instrument",
      marketValue: null,
      quantity: null,
      bookCost: null,
    });
    const retired = snapshot("2026-02-28", [
      { ...position, marketValue: "0", quantity: "0", bookCost: "0" },
    ]);
    expect(rememberedPositions([first, retired], "2026-03-31")).toEqual([]);
    expect(first.positions[0]?.marketValue).toBe("100");
    expect(
      rememberedPositions([first, snapshot("2026-02-28", [])], "2026-03-31"),
    ).toHaveLength(1);
    expect(
      rememberedPositions(
        [
          snapshot("2026-01-31", [
            { ...position, marketValue: "0", quantity: "10" },
          ]),
        ],
        "2026-02-28",
      ),
    ).toHaveLength(1);
    expect(rememberedPositions([first, retired], "2026-02-01")).toHaveLength(1);
    expect(
      rememberedPositions(
        [first, { ...first, documentId: "duplicate" }],
        "2026-02-28",
      ),
    ).toEqual([]);
  });
  it("formats exact decimal amounts without converting to binary numbers", () => {
    expect(formatInvestmentAmount("12345678901234567.89", "CAD")).toBe(
      "12,345,678,901,234,567.89 CAD",
    );
    expect(formatInvestmentAmount(null)).toBe("—");
  });
});
