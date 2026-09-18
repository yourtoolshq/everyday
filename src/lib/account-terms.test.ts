import { describe, expect, it } from "vitest";

import {
  accountTermsChanged,
  emptyAccountTerms,
  hasAccountTerms,
  listAccountTermsEntries,
  normalizeAccountTerms,
} from "~/lib/account-terms";

describe("account terms", () => {
  it("normalizes blank strings to null", () => {
    expect(
      normalizeAccountTerms({
        interestRate: "  19.99  ",
        promotionalInterestRate: "",
        promotionalInterestRateExpires: null,
        creditLimit: "5000",
        annualFee: "   ",
        renewalDate: undefined,
        insurance: null,
      }),
    ).toEqual({
      interestRate: "19.99",
      promotionalInterestRate: null,
      promotionalInterestRateExpires: null,
      creditLimit: "5000",
      annualFee: null,
      renewalDate: null,
      insurance: null,
    });
  });

  it("detects when terms changed", () => {
    const before = emptyAccountTerms();
    const after = { ...before, creditLimit: "10000" };
    expect(accountTermsChanged(before, after)).toBe(true);
    expect(accountTermsChanged(after, { ...after })).toBe(false);
  });

  it("lists only populated fields", () => {
    expect(
      listAccountTermsEntries({
        ...emptyAccountTerms(),
        interestRate: "4.5",
        insurance: "Balance protection",
      }),
    ).toEqual([
      { field: "interestRate", label: "Interest rate", value: "4.5" },
      { field: "insurance", label: "Insurance", value: "Balance protection" },
    ]);
    expect(hasAccountTerms(emptyAccountTerms())).toBe(false);
    expect(hasAccountTerms({ ...emptyAccountTerms(), annualFee: "99" })).toBe(true);
  });
});
