import { describe, expect, it } from "vitest";

import {
  documentMetadataSchema,
  formatFileSize,
  titleFromFilename,
} from "~/lib/documents";

describe("document files", () => {
  it("validates required metadata", () => {
    expect(
      documentMetadataSchema.safeParse({
        title: "Offer letter",
        type: "offer_letter",
      }).success,
    ).toBe(true);
    expect(
      documentMetadataSchema.safeParse({ title: "", type: "offer_letter" })
        .success,
    ).toBe(false);
    expect(
      documentMetadataSchema.safeParse({
        title: "Offer letter",
        type: "unknown",
      }).success,
    ).toBe(false);
  });

  it("provides display helpers", () => {
    expect(titleFromFilename("offer-letter.pdf")).toBe("offer-letter");
    expect(formatFileSize(1536)).toBe("2 KB");
  });
});
