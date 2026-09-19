import { describe, expect, it } from "vitest";

import {
  detectDocumentFile,
  documentMetadataSchema,
  formatFileSize,
  maxDocumentBytes,
  titleFromFilename,
} from "~/lib/documents";

describe("document files", () => {
  it.each([
    [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), "application/pdf"],
    [new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg"],
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"],
    [new TextEncoder().encode("RIFF0000WEBP"), "image/webp"],
    [new Uint8Array([0, 0, 0, 20, ...new TextEncoder().encode("ftypheic")]), "image/heic"],
  ])("detects allowed content signatures", (bytes, mimeType) => {
    expect(detectDocumentFile(bytes)?.mimeType).toBe(mimeType);
  });

  it("rejects unsupported or misleading content", () => {
    expect(detectDocumentFile(new TextEncoder().encode("not a PDF"))).toBeNull();
    expect(detectDocumentFile(new Uint8Array())).toBeNull();
  });

  it("validates required metadata", () => {
    expect(documentMetadataSchema.safeParse({ title: "Offer letter", type: "offer_letter" }).success).toBe(
      true,
    );
    expect(documentMetadataSchema.safeParse({ title: "", type: "offer_letter" }).success).toBe(false);
    expect(documentMetadataSchema.safeParse({ title: "Offer letter", type: "unknown" }).success).toBe(
      false,
    );
  });

  it("provides upload and display helpers", () => {
    expect(maxDocumentBytes).toBe(25 * 1024 * 1024);
    expect(titleFromFilename("offer-letter.pdf")).toBe("offer-letter");
    expect(formatFileSize(1536)).toBe("2 KB");
  });
});
