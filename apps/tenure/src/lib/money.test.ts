import { describe, expect, it } from "vitest";

import { dollarsToCents } from "~/lib/money";

describe("dollarsToCents", () => {
  it("allows signed values only when requested", () => {
    expect(dollarsToCents("-145.68")).toBeNull();
    expect(dollarsToCents("-145.68", { allowNegative: true })).toBe(-14_568);
  });
});
