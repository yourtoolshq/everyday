import { describe, expect, it } from "vitest";

import {
  applyPaychequeIncomeTax,
  calculateEmploymentProjection,
  calculateIncomeTaxCents,
  calculateNetPay,
  countRemainingPaycheques,
  deductionFields,
  normalizeDeductionFieldOrder,
  orderedDeductionFields,
  paychequeInput,
} from "./employment";

describe("paycheque amounts", () => {
  const amounts = {
    grossPayCents: 200_000,
    incomeTaxCents: 35_000,
    federalIncomeTaxCents: 0,
    manitobaIncomeTaxCents: 0,
    cppCents: 11_000,
    cpp2Cents: 1_000,
    eiCents: 3_200,
    wiCents: 1_500,
    ltdCents: 2_300,
    extendedHealthCents: 0,
    travelMedicalCents: 0,
    unionDuesCents: 0,
    otherDeductionsCents: 4_800,
  };

  it("calculates net pay from every supported deduction", () => {
    expect(calculateNetPay(amounts)).toBe(141_200);
  });

  it("does not double-count federal and Manitoba tax in net pay", () => {
    expect(
      calculateNetPay({
        ...amounts,
        federalIncomeTaxCents: 20_000,
        manitobaIncomeTaxCents: 15_000,
      }),
    ).toBe(141_200);
  });

  it("calculates combined income tax from federal and Manitoba amounts", () => {
    expect(
      calculateIncomeTaxCents(
        {
          incomeTaxCents: 1,
          federalIncomeTaxCents: 20_000,
          manitobaIncomeTaxCents: 15_000,
        },
        true,
      ),
    ).toBe(35_000);
    expect(
      calculateIncomeTaxCents(
        {
          incomeTaxCents: 35_000,
          federalIncomeTaxCents: 20_000,
          manitobaIncomeTaxCents: 15_000,
        },
        false,
      ),
    ).toBe(35_000);
  });

  it("overwrites combined income tax when the split is enabled", () => {
    expect(
      applyPaychequeIncomeTax(
        {
          ...amounts,
          incomeTaxCents: 1,
          federalIncomeTaxCents: 20_000,
          manitobaIncomeTaxCents: 15_000,
        },
        true,
      ).incomeTaxCents,
    ).toBe(35_000);
  });

  it("rejects deductions greater than gross pay", () => {
    expect(
      paychequeInput.safeParse({
        ...amounts,
        employmentId: 1,
        payDate: "2026-06-19",
        grossPayCents: 10_000,
      }).success,
    ).toBe(false);
  });
});

describe("deduction field order", () => {
  it("applies a saved order and appends missing fields in canonical order", () => {
    expect(
      orderedDeductionFields(["eiCents", "cppCents", "unknown"]).map(
        (field) => field.amountField,
      ),
    ).toEqual(normalizeDeductionFieldOrder(["eiCents", "cppCents"]));
    expect(normalizeDeductionFieldOrder(["eiCents", "cppCents"])).toHaveLength(
      deductionFields.length,
    );
    expect(normalizeDeductionFieldOrder(["eiCents", "cppCents"])[0]).toBe(
      "eiCents",
    );
    expect(normalizeDeductionFieldOrder(["eiCents", "cppCents"])[1]).toBe(
      "cppCents",
    );
    expect(normalizeDeductionFieldOrder(null)).toEqual(
      deductionFields.map((field) => field.amountField),
    );
  });
});

describe("employment projection", () => {
  it("projects an active employment from its average and remaining pay periods", () => {
    const result = calculateEmploymentProjection({
      year: 2026,
      status: "active",
      payFrequency: "biweekly",
      typicalGrossOverrideCents: null,
      grossPaysCents: [100_000, 120_000],
      latestPayDate: "2026-06-19",
    });

    expect(result.actualGrossCents).toBe(220_000);
    expect(result.averageGrossCents).toBe(110_000);
    expect(result.remainingPaycheques).toBe(
      countRemainingPaycheques("biweekly", "2026-06-19", 2026),
    );
    expect(result.projectedGrossCents).toBe(
      220_000 + 110_000 * result.remainingPaycheques,
    );
  });

  it("uses a typical-pay override without changing the recorded average", () => {
    const result = calculateEmploymentProjection({
      year: 2026,
      status: "active",
      payFrequency: "monthly",
      typicalGrossOverrideCents: 150_000,
      grossPaysCents: [80_000, 120_000],
      latestPayDate: "2026-06-30",
    });

    expect(result.averageGrossCents).toBe(100_000);
    expect(result.typicalGrossCents).toBe(150_000);
    expect(result.projectedGrossCents).toBe(
      200_000 + 150_000 * result.remainingPaycheques,
    );
  });

  it("does not project future pay for ended or irregular employment", () => {
    expect(
      calculateEmploymentProjection({
        year: 2026,
        status: "ended",
        payFrequency: "biweekly",
        typicalGrossOverrideCents: null,
        grossPaysCents: [100_000],
        latestPayDate: "2026-04-30",
      }).projectedGrossCents,
    ).toBe(100_000);
    expect(countRemainingPaycheques("irregular", "2026-04-30", 2026)).toBe(0);
  });
});
