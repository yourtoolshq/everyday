import { describe, expect, it } from "vitest";

import { documentPath } from "~/server/documents/storage";

describe("document storage paths", () => {
  it("accepts generated opaque storage keys", () => {
    expect(documentPath("123e4567-e89b-12d3-a456-426614174000.pdf")).toContain(
      "123e4567-e89b-12d3-a456-426614174000.pdf",
    );
    expect(documentPath("123e4567-e89b-12d3-a456-426614174000.eml")).toContain(
      "123e4567-e89b-12d3-a456-426614174000.eml",
    );
  });

  it.each([
    "../private.pdf",
    "receipt.pdf",
    "123e4567-e89b-12d3-a456-426614174000.exe",
  ])("rejects unsafe or non-generated keys", (storageKey) => {
    expect(() => documentPath(storageKey)).toThrow(
      "Invalid document storage key",
    );
  });
});
