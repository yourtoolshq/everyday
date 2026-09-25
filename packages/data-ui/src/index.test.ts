import { describe, expect, it } from "vitest";

import { fileUrl } from "./index";

describe("fileUrl", () => {
  it("builds inline and download URLs", () => {
    const id = "4f7d3c2a-1b0e-4a9f-8c6d-5e4f3a2b1c0d";
    expect(fileUrl(id)).toBe(`/api/data/files/${id}`);
    expect(fileUrl(id, { download: true })).toBe(
      `/api/data/files/${id}?download=1`,
    );
  });
});
