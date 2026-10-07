import { describe, expect, it } from "vitest";

import {
  isAllowedNavigation,
  isAllowedPreviewOpen,
} from "../electron/navigation";

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

describe("isAllowedPreviewOpen", () => {
  const origins = ["http://127.0.0.1:5173", "http://127.0.0.1:3847"];

  it("allows in-app file and viewer routes", () => {
    expect(
      isAllowedPreviewOpen(
        "http://127.0.0.1:3847/api/data/files/4f7d3c2a-1b0e-4a9f-8c6d-5e4f3a2b1c0d",
        origins,
      ),
    ).toBe(true);
    expect(
      isAllowedPreviewOpen(
        "http://127.0.0.1:5173/files/4f7d3c2a-1b0e-4a9f-8c6d-5e4f3a2b1c0d",
        origins,
      ),
    ).toBe(true);
  });

  it("blocks external preview targets", () => {
    expect(isAllowedPreviewOpen("https://example.com/evil.pdf", origins)).toBe(
      false,
    );
  });
});
