import { describe, expect, it } from "vitest";

import { formatCents, parseDollarsToCents, sumCents } from "~/lib/money";

describe("parseDollarsToCents", () => {
  it("parses whole dollars", () => {
    expect(parseDollarsToCents("110")).toBe(11000);
    expect(parseDollarsToCents("$110")).toBe(11000);
    expect(parseDollarsToCents("1,234")).toBe(123400);
  });

  it("parses dollars with cents", () => {
    expect(parseDollarsToCents("110.50")).toBe(11050);
    expect(parseDollarsToCents("$110.5")).toBe(11050);
    expect(parseDollarsToCents("0.99")).toBe(99);
  });

  it("returns null for empty or invalid input", () => {
    expect(parseDollarsToCents("")).toBeNull();
    expect(parseDollarsToCents("   ")).toBeNull();
    expect(parseDollarsToCents("abc")).toBeNull();
    expect(parseDollarsToCents("10.999")).toBeNull();
    expect(parseDollarsToCents("-5")).toBeNull();
  });
});

describe("formatCents", () => {
  it("formats positive and negative amounts", () => {
    expect(formatCents(11050)).toBe("$110.50");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(99)).toBe("$0.99");
    expect(formatCents(-500)).toBe("-$5.00");
  });
});

describe("sumCents", () => {
  it("sums cent values", () => {
    expect(sumCents([10000, 5000, 50])).toBe(15050);
    expect(sumCents([])).toBe(0);
  });
});
