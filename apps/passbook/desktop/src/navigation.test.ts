import { describe, expect, it } from "vitest";

import { isAllowedNavigation } from "../electron/navigation";

describe("isAllowedNavigation", () => {
  const origins = ["http://127.0.0.1:5173", "http://127.0.0.1:3847"];

  it("allows local client and host origins", () => {
    expect(isAllowedNavigation("http://127.0.0.1:5173/setup", origins)).toBe(
      true,
    );
    expect(
      isAllowedNavigation("http://127.0.0.1:3847/api/health", origins),
    ).toBe(true);
  });

  it("allows bundled file URLs", () => {
    expect(
      isAllowedNavigation("file:///tmp/passbook/index.html", origins),
    ).toBe(true);
  });

  it("blocks external navigation", () => {
    expect(isAllowedNavigation("https://example.com", origins)).toBe(false);
  });
});
