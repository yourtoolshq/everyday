import { describe, expect, it } from "vitest";

import { centsToDollars, dollarsToCents, formatCad } from "./money";

describe("money helpers", () => {
  it("preserves unknown separately from zero", () => {
    expect(dollarsToCents("")).toBeNull();
    expect(dollarsToCents("0")).toBe(0);
    expect(centsToDollars(null)).toBe("");
    expect(centsToDollars(0)).toBe("0.00");
  });

  it("rounds entered dollars to integer cents", () => {
    expect(dollarsToCents("1,234.567")).toBe(123457);
    expect(dollarsToCents("-1")).toBeNull();
    expect(dollarsToCents("not money")).toBeNull();
  });

  it("formats Canadian dollars", () => {
    expect(formatCad(123456)).toContain("1,234.56");
    expect(formatCad(null)).toBe("—");
  });
});
