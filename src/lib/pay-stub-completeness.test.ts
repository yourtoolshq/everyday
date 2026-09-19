import { describe, expect, it } from "vitest";

import type { ExpectedPayPeriod } from "~/lib/expected-pay-periods";
import {
  derivePayStubCompleteness,
  buildMissingPayStubItems,
} from "~/lib/pay-stub-completeness";

describe("pay stub completeness", () => {
  const period: ExpectedPayPeriod = {
    key: "2026-01-03",
    label: "Jan 3 – Jan 16",
    shortLabel: "Jan 3",
    year: 2026,
    periodStartDate: "2026-01-03",
    periodEndDate: "2026-01-16",
    status: "past_expected",
  };

  it("marks a period complete when all paychecks have stubs", () => {
    const status = derivePayStubCompleteness(
      period,
      [
        { id: "a", periodStartDate: "2026-01-03", periodEndDate: "2026-01-16", hasStub: true },
        { id: "b", periodStartDate: "2026-01-03", periodEndDate: "2026-01-16", hasStub: true },
      ],
      "biweekly",
    );

    expect(status).toBe("complete");
  });

  it("marks a period missing stub when any paycheck lacks a stub", () => {
    const status = derivePayStubCompleteness(
      period,
      [
        { id: "a", periodStartDate: "2026-01-03", periodEndDate: "2026-01-16", hasStub: true },
        { id: "b", periodStartDate: "2026-01-03", periodEndDate: "2026-01-16", hasStub: false },
      ],
      "biweekly",
    );

    expect(status).toBe("missing_stub");
  });

  it("builds missing items across employments", () => {
    const missing = buildMissingPayStubItems(
      [
        {
          id: "emp-1",
          employerName: "Acme",
          personName: "Alex",
          startDate: "2026-01-01",
          endDate: null,
          status: "current",
          payFrequency: "biweekly",
          biweeklyAnchorDate: "2026-01-03",
        },
      ],
      { "emp-1": [] },
      {},
      new Date("2026-02-15T12:00:00"),
    );

    expect(missing.length).toBeGreaterThan(0);
    expect(missing[0]?.issue).toBe("missing_paycheck");
  });
});
