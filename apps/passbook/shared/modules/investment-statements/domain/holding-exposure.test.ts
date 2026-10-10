import { describe, expect, it } from "vitest";

import type { ExposureStatement } from "./holding-exposure";
import type { PositionInput } from "./snapshot-dto";
import { holdingExposure } from "./holding-exposure";

const position = (
  instrumentId: string | null,
  marketValue: string | null,
  currency = "CAD",
): PositionInput => ({
  instrumentId,
  marketValue,
  valueCurrency: currency,
  sourceLabel: "Fictional holding",
  quantity: "2",
  lineKind: "investment",
  sourceIdentifier: null,
  sourceSeries: null,
  unitPrice: null,
  unitPriceCurrency: null,
  bookCost: null,
  bookCostCurrency: null,
  sourcePage: null,
  sourceNote: null,
});
function statement(patch: Partial<ExposureStatement> = {}): ExposureStatement {
  return {
    id: "s1",
    accountId: "a1",
    accountName: "Demo account",
    documentId: "d1",
    documentTitle: "Demo statement",
    valuationDate: "2026-03-31",
    reviewStatus: "reviewed",
    holdingsCoverage: "complete",
    positions: [position("equity", "80.05"), position("bond", "19.95")],
    ...patch,
  };
}
describe("statement-based holding exposure", () => {
  it("uses one latest reviewed snapshot per account, not every historical position", () => {
    const result = holdingExposure(
      [
        statement(),
        statement({
          documentId: "d2",
          valuationDate: "2026-06-30",
          positions: [position("equity", "90"), position(null, "10")],
        }),
        statement({
          documentId: "draft",
          valuationDate: "2026-09-30",
          reviewStatus: "draft",
          positions: [position("equity", "999")],
        }),
      ],
      "equity",
      "CAD",
      "2026-10-01",
    );
    expect(result.value).toBe("90");
    expect(result.total).toBe("100");
    expect(result.share).toBe("90.00");
    expect(result.accounts[0]?.documentId).toBe("d2");
  });
  it("respects the cutoff date and never combines currencies", () => {
    const result = holdingExposure(
      [
        statement({
          positions: [
            position("equity", "80.05"),
            position("equity", "500", "USD"),
            position("bond", "19.95"),
          ],
        }),
        statement({
          documentId: "later",
          valuationDate: "2026-06-30",
          positions: [position("equity", "200")],
        }),
      ],
      "equity",
      "CAD",
      "2026-04-01",
    );
    expect(result.value).toBe("80.05");
    expect(result.total).toBe("100");
    expect(result.share).toBe("80.05");
  });
  it("an absent holding in partial coverage is unknown, rather than a stale position or zero", () => {
    const result = holdingExposure(
      [
        statement(),
        statement({
          documentId: "later",
          valuationDate: "2026-06-30",
          holdingsCoverage: "partial",
          positions: [position("bond", "25")],
        }),
      ],
      "equity",
      "CAD",
      "2026-07-01",
    );
    expect(result.value).toBeNull();
    expect(result.share).toBeNull();
    expect(result.partial).toBe(true);
    expect(
      holdingExposure(
        [statement({ positions: [position("bond", "25")] })],
        "equity",
        "CAD",
        "2026-07-01",
      ).value,
    ).toBe("0");
  });
  it("unknown prices block totals and portions even if other prices are known", () => {
    const result = holdingExposure(
      [
        statement({
          positions: [position("equity", "80"), position("bond", null)],
        }),
      ],
      "equity",
      "CAD",
      "2026-07-01",
    );
    expect(result.value).toBe("80");
    expect(result.total).toBeNull();
    expect(result.share).toBeNull();
    expect(result.rest).toBeNull();
  });
  it("does not arbitrarily choose between two reviewed sources at the same latest date", () => {
    const result = holdingExposure(
      [
        statement(),
        statement({
          documentId: "same-date-other",
          positions: [position("equity", "500")],
        }),
      ],
      "equity",
      "CAD",
      "2026-07-01",
    );
    expect(result.ambiguous).toBe(true);
    expect(result.value).toBeNull();
    expect(result.share).toBeNull();
    expect(result.accounts[0]?.sources).toHaveLength(2);
  });
  it("sums repeated lines exactly and exposes different account dates", () => {
    const result = holdingExposure(
      [
        statement({
          positions: [position("equity", "0.1"), position("equity", "0.2")],
        }),
        statement({
          accountId: "a2",
          documentId: "d2",
          valuationDate: "2026-06-30",
          positions: [position("equity", "0.3")],
        }),
      ],
      "equity",
      "CAD",
      "2026-07-01",
    );
    expect(result.value).toBe("0.6");
    expect(result.accounts[0]?.quantity).toBe("4");
    expect(result.mixedDates).toBe(true);
  });
});
