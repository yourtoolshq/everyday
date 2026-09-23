import { describe, expect, it } from "vitest";

import {
  canSuggestRequiredDocumentTitle,
  suggestRequiredDocumentDate,
  suggestRequiredDocumentTitle,
  suggestRequiredDocumentType,
} from "~/lib/employment-document-suggestions";

describe("employment document suggestions", () => {
  it("suggests offer letter metadata from employment context", () => {
    expect(suggestRequiredDocumentType("offer_letter")).toBe("offer_letter");
    expect(suggestRequiredDocumentDate({ kind: "offer_letter" })).toBe("");
    expect(
      suggestRequiredDocumentTitle({
        kind: "offer_letter",
        employerName: "Acme Corp",
        personName: "Alex",
        documentDate: "2024-03-01",
      }),
    ).toBe("Mar 1, 2024 Acme Corp Alex Offer letter");
  });

  it("suggests compensation supporting document metadata", () => {
    const change = {
      id: "change-1",
      employmentId: "emp-1",
      type: "annual_salary" as const,
      currency: "CAD" as const,
      effectiveDate: "2024-06-01",
      amountCents: 90_000_00,
      commissionBasisPoints: null,
      notes: null,
      documentId: null,
      discussionId: null,
    };

    expect(suggestRequiredDocumentType("compensation_change")).toBe(
      "salary_letter",
    );
    expect(
      suggestRequiredDocumentDate({
        kind: "compensation_change",
        compensationChange: change,
      }),
    ).toBe("2024-06-01");
    expect(
      suggestRequiredDocumentTitle({
        kind: "compensation_change",
        employerName: "Acme Corp",
        documentDate: "2024-06-01",
        compensationChange: change,
      }),
    ).toBe("Jun 1, 2024 Acme Corp $90,000.00/year Supporting document");
  });

  it("only suggests a title once file and date are present", () => {
    expect(
      canSuggestRequiredDocumentTitle({
        file: null,
        documentDate: "2024-03-01",
      }),
    ).toBe(false);
    expect(
      canSuggestRequiredDocumentTitle({
        file: new File(["x"], "offer.pdf"),
        documentDate: "",
      }),
    ).toBe(false);
    expect(
      canSuggestRequiredDocumentTitle({
        file: new File(["x"], "offer.pdf"),
        documentDate: "2024-03-01",
      }),
    ).toBe(true);
  });
});
