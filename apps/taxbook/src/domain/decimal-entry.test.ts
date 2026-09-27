import { describe, expect, it } from "vitest";

import { normalizeDecimalEntry } from "@yourtoolshq/ui/decimal-entry";

describe("normalizeDecimalEntry", () => {
  it("keeps an empty field empty", () => {
    expect(normalizeDecimalEntry("  ")).toEqual({ ok: true, value: "" });
  });

  it("normalizes a leading dot and short decimals", () => {
    expect(normalizeDecimalEntry(".89")).toEqual({ ok: true, value: "0.89" });
    expect(normalizeDecimalEntry("147.3")).toEqual({
      ok: true,
      value: "147.30",
    });
  });

  it("evaluates simple arithmetic without eval", () => {
    expect(normalizeDecimalEntry("10+20+30")).toEqual({
      ok: true,
      value: "60.00",
    });
    expect(normalizeDecimalEntry("10 + 2 * 3")).toEqual({
      ok: true,
      value: "16.00",
    });
    expect(normalizeDecimalEntry("-2.5")).toEqual({ ok: true, value: "-2.50" });
  });

  it("rejects invalid input and division by zero", () => {
    expect(normalizeDecimalEntry("10++2").ok).toBe(false);
    expect(normalizeDecimalEntry("abc").ok).toBe(false);
    expect(normalizeDecimalEntry("10/0")).toEqual({
      ok: false,
      message: "Can't divide by zero.",
    });
  });
});
