import { describe, expect, it } from "vitest";

import {
  buildHouseholdPaySummary,
  sumPaychecks,
} from "~/lib/employment-pay-summaries";

const paychecks = [
  { payDate: "2024-03-15", grossPayCents: 4_000_00, netPayCents: 3_000_00 },
  { payDate: "2025-01-15", grossPayCents: 5_000_00, netPayCents: 3_800_00 },
  { payDate: "2025-06-15", grossPayCents: 5_000_00, netPayCents: 3_800_00 },
];

describe("employment pay summaries", () => {
  it("sums lifetime paycheck totals", () => {
    const summary = sumPaychecks(paychecks);
    expect(summary.grossCents).toBe(14_000_00);
    expect(summary.netCents).toBe(10_600_00);
    expect(summary.paycheckCount).toBe(3);
  });

  it("filters totals to a calendar year", () => {
    const summary = sumPaychecks(paychecks, 2025);
    expect(summary.grossCents).toBe(10_000_00);
    expect(summary.netCents).toBe(7_600_00);
    expect(summary.paycheckCount).toBe(2);
  });

  it("builds household lifetime and this-year summaries", () => {
    const summary = buildHouseholdPaySummary(paychecks, new Date("2025-09-19T12:00:00"));
    expect(summary.year).toBe(2025);
    expect(summary.lifetime.paycheckCount).toBe(3);
    expect(summary.thisYear.paycheckCount).toBe(2);
  });
});
