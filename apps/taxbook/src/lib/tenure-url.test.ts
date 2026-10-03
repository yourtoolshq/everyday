import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolveTenureFetchBaseUrl,
  tenureEmploymentUrl,
  tenureHomeUrl,
} from "./tenure-url";

describe("tenure-url", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds home and employment URLs without trailing slashes", () => {
    expect(tenureHomeUrl("http://localhost:3003/")).toBe(
      "http://localhost:3003",
    );
    expect(tenureEmploymentUrl("http://localhost:3003/", "abc-123")).toBe(
      "http://localhost:3003/employments/abc-123",
    );
  });

  it("uses TENURE_FETCH_BASE_URL for server-side Tenure API calls", () => {
    vi.stubEnv("TENURE_FETCH_BASE_URL", "http://tenure.internal:3000/");
    expect(resolveTenureFetchBaseUrl("https://tenure.tools.local")).toBe(
      "http://tenure.internal:3000",
    );
  });

  it("falls back to the configured base URL when no override is set", () => {
    expect(resolveTenureFetchBaseUrl("https://tenure.tools.local/")).toBe(
      "https://tenure.tools.local",
    );
  });
});
