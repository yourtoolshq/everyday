import { describe, expect, it } from "vitest";

import { tenureEmploymentUrl, tenureHomeUrl } from "./tenure-url";

describe("tenure-url", () => {
  it("builds home and employment URLs without trailing slashes", () => {
    expect(tenureHomeUrl("http://localhost:3003/")).toBe(
      "http://localhost:3003",
    );
    expect(tenureEmploymentUrl("http://localhost:3003/", "abc-123")).toBe(
      "http://localhost:3003/employments/abc-123",
    );
  });
});
