import { describe, expect, it } from "vitest";

import {
  formatMoneyValue,
  formatRateValue,
  formatTermValue,
  parseMoneyValue,
  parseRateValue,
} from "~/lib/format-term-value";

describe("parseRateValue", () => {
  it("normalizes rate input to canonical numbers", () => {
    expect(parseRateValue("  19.99%  ")).toBe("19.99");
    expect(parseRateValue("0%")).toBe("0");
    expect(parseRateValue("4.5")).toBe("4.5");
  });

  it("returns null for blank input", () => {
    expect(parseRateValue("")).toBeNull();
    expect(parseRateValue("   ")).toBeNull();
    expect(parseRateValue(null)).toBeNull();
  });

  it("falls back to trimmed input when unparseable", () => {
    expect(parseRateValue("variable")).toBe("variable");
  });
});

describe("parseMoneyValue", () => {
  it("normalizes money input to canonical numbers", () => {
    expect(parseMoneyValue("$10,000")).toBe("10000");
    expect(parseMoneyValue("120.50")).toBe("120.5");
    expect(parseMoneyValue("  5000  ")).toBe("5000");
  });

  it("returns null for blank input", () => {
    expect(parseMoneyValue("")).toBeNull();
    expect(parseMoneyValue(undefined)).toBeNull();
  });

  it("falls back to trimmed input when unparseable", () => {
    expect(parseMoneyValue("waived")).toBe("waived");
  });
});

describe("formatRateValue", () => {
  it("formats numeric rates with a percent suffix", () => {
    expect(formatRateValue("4.5")).toBe("4.5%");
    expect(formatRateValue("19.99")).toBe("19.99%");
    expect(formatRateValue("0")).toBe("0%");
  });

  it("returns unparseable values unchanged", () => {
    expect(formatRateValue("variable")).toBe("variable");
  });
});

describe("formatMoneyValue", () => {
  it("formats whole-dollar money values", () => {
    expect(formatMoneyValue("10000", "whole")).toBe("$10,000");
  });

  it("formats decimal money values", () => {
    expect(formatMoneyValue("120", "decimal")).toBe("$120");
    expect(formatMoneyValue("120.5", "decimal")).toBe("$120.50");
  });

  it("returns unparseable values unchanged", () => {
    expect(formatMoneyValue("waived", "whole")).toBe("waived");
  });
});

describe("formatTermValue", () => {
  it("formats values based on field kind", () => {
    expect(formatTermValue("interestRate", "4.5")).toBe("4.5%");
    expect(formatTermValue("creditLimit", "10000")).toBe("$10,000");
    expect(formatTermValue("annualFee", "120.5")).toBe("$120.50");
    expect(formatTermValue("insurance", "Balance protection")).toBe("Balance protection");
    expect(formatTermValue("renewalDate", "2026-09-18")).toMatch(/Sep 18, 2026/);
  });
});
