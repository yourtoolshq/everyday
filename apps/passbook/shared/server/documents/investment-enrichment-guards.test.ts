import { describe, expect, it } from "vitest";

import { documentMetadataInvalidatesInvestmentReview } from "~/server/documents/investment-enrichment-guards";
import { resolveUpdatedDocumentDate } from "~/server/documents/resolve-document-date";

describe("resolveUpdatedDocumentDate", () => {
  it("preserves the stored date when the field is omitted", () => {
    expect(resolveUpdatedDocumentDate("2026-01-15", undefined)).toBe(
      "2026-01-15",
    );
  });

  it("clears the stored date when null is sent explicitly", () => {
    expect(resolveUpdatedDocumentDate("2026-01-15", null)).toBeNull();
  });
});

describe("documentMetadataInvalidatesInvestmentReview", () => {
  it("does not invalidate when only the title would change (date omitted)", () => {
    expect(
      documentMetadataInvalidatesInvestmentReview({
        previousPeriodKey: "2026-01",
        nextPeriodKey: "2026-01",
        previousDocumentDate: "2026-04-01",
        nextStoredDocumentDate: "2026-04-01",
      }),
    ).toBe(false);
  });

  it("invalidates when the stored document date changes", () => {
    expect(
      documentMetadataInvalidatesInvestmentReview({
        previousPeriodKey: "2026-01",
        nextPeriodKey: "2026-01",
        previousDocumentDate: "2026-04-01",
        nextStoredDocumentDate: null,
      }),
    ).toBe(true);
  });

  it("invalidates when the statement period changes", () => {
    expect(
      documentMetadataInvalidatesInvestmentReview({
        previousPeriodKey: "2026-01",
        nextPeriodKey: "2026-02",
        previousDocumentDate: null,
        nextStoredDocumentDate: null,
      }),
    ).toBe(true);
  });
});
