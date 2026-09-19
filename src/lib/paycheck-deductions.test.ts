import { describe, expect, it } from "vitest";

import { calculateNetPay } from "~/lib/paycheck-deductions";

describe("paycheck deductions", () => {
  it("calculates net pay from gross and deductions", () => {
    const net = calculateNetPay({
      grossPayCents: 100_000,
      incomeTaxCents: 20_000,
      federalIncomeTaxCents: 0,
      manitobaIncomeTaxCents: 0,
      cppCents: 3_000,
      cpp2Cents: 0,
      eiCents: 1_000,
      wiCents: 0,
      ltdCents: 0,
      extendedHealthCents: 0,
      travelMedicalCents: 0,
      unionDuesCents: 0,
      otherDeductionsCents: 500,
    });

    expect(net).toBe(75_500);
  });
});
