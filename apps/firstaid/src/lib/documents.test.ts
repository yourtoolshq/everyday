import { describe, expect, it } from "vitest";

import {
  documentMetadataSchema,
  formatFileSize,
  isClaimDocumentType,
  titleFromFilename,
  validateDocumentClaimLink,
} from "~/lib/documents";

describe("document files", () => {
  it("validates required metadata", () => {
    expect(
      documentMetadataSchema.safeParse({ title: "Receipt", type: "receipt" })
        .success,
    ).toBe(true);
    expect(
      documentMetadataSchema.safeParse({ title: "", type: "receipt" }).success,
    ).toBe(false);
    expect(
      documentMetadataSchema.safeParse({ title: "Receipt", type: "unknown" })
        .success,
    ).toBe(false);
  });

  it("identifies claim document types and validates claim links", () => {
    expect(isClaimDocumentType("claim_record")).toBe(true);
    expect(isClaimDocumentType("explanation_of_benefits")).toBe(true);
    expect(isClaimDocumentType("receipt")).toBe(false);
    expect(validateDocumentClaimLink("receipt", "claim-id")).toMatch(
      /claim records/,
    );
    expect(validateDocumentClaimLink("claim_record", null)).toBeNull();
  });

  it("provides title and display helpers", () => {
    expect(titleFromFilename("visit.receipt.pdf")).toBe("visit.receipt");
    expect(formatFileSize(1536)).toBe("2 KB");
  });
});
