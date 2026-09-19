import { describe, expect, it } from "vitest";

import { formatPayPeriodTitle, suggestPayStubTitle } from "~/lib/pay-stubs";

describe("pay stub titles", () => {
  it("formats semimonthly pay periods", () => {
    expect(formatPayPeriodTitle("2026-01-01", "2026-01-15")).toBe("January 1–15, 2026");
    expect(formatPayPeriodTitle("2026-01-16", "2026-01-31")).toBe("January 16–31, 2026");
  });

  it("suggests a document title from employment and pay period", () => {
    expect(
      suggestPayStubTitle({
        employerName: "Acme Corp",
        personName: "Alex",
        periodStartDate: "2026-01-01",
        periodEndDate: "2026-01-15",
        payDate: "2026-01-20",
      }),
    ).toBe("January 1–15, 2026 Acme Corp Alex Pay stub");
  });
});
