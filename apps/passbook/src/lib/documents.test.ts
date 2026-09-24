import { describe, expect, it } from "vitest";

import {
  defaultDocumentTitle,
  documentMetadataSchema,
  formatFileSize,
  suggestDocumentTitle,
  titleFromFilename,
} from "~/lib/documents";

describe("document files", () => {
  it("validates required metadata", () => {
    expect(
      documentMetadataSchema.safeParse({
        title: "Statement",
        type: "statement",
      }).success,
    ).toBe(true);
    expect(
      documentMetadataSchema.safeParse({ title: "", type: "statement" })
        .success,
    ).toBe(false);
    expect(
      documentMetadataSchema.safeParse({ title: "Statement", type: "unknown" })
        .success,
    ).toBe(false);
  });

  it("provides display helpers", () => {
    expect(titleFromFilename("statement.pdf")).toBe("statement");
    expect(formatFileSize(1536)).toBe("2 KB");
  });

  it("suggests titles for statements and void cheques only", () => {
    expect(
      suggestDocumentTitle({
        type: "statement",
        accountDisplayName: "Momentum Visa",
        periodKey: "2026-07",
      }),
    ).toBe("2026-07 Momentum Visa Statement");

    expect(
      suggestDocumentTitle({
        type: "void_cheque",
        accountDisplayName: "Chequing",
      }),
    ).toBe("Chequing Void cheque");

    expect(
      defaultDocumentTitle({
        type: "agreement",
        accountDisplayName: "Chequing",
        filename: "welcome-letter.pdf",
      }),
    ).toBe("welcome-letter");

    expect(
      defaultDocumentTitle({
        type: "card_letter",
        accountDisplayName: "Chequing",
        filename: "card-letter.pdf",
      }),
    ).toBe("card-letter");
  });
});
