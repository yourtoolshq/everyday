import { describe, expect, it } from "vitest";

import { projectedManualAmount } from "./tax-estimate";
import { calculateHouseholdEstimate, progressiveTax, type PersonEstimateInput } from "./tax-calculator";
import { rules2026Manitoba } from "./tax-rules/2026-manitoba";

function person(id: number, income: number): PersonEstimateInput {
  return {
    id, name: `Person ${id}`, employmentIncomeCents: income, interestIncomeCents: 0,
    rrspDeductionCents: 0, fhsaDeductionCents: 0, professionalDuesCents: 0,
    incomeTaxWithheldCents: 0, cppCents: 0, cpp2Cents: 0, eiCents: 0,
    currentTuitionCents: 0, federalTuitionCarryforwardCents: 0,
    manitobaTuitionCarryforwardCents: 0,
  };
}

describe("2026 Manitoba tax calculator", () => {
  it("applies progressive federal and Manitoba brackets", () => {
    expect(progressiveTax(5_852_300, rules2026Manitoba.federal.brackets)).toBe(819_322);
    expect(progressiveTax(5_852_400, rules2026Manitoba.federal.brackets)).toBe(819_343);
    expect(progressiveTax(4_700_000, rules2026Manitoba.manitoba.brackets)).toBe(507_600);
    expect(progressiveTax(4_700_100, rules2026Manitoba.manitoba.brackets)).toBe(507_613);
  });

  it("uses the best-known amount while an item is open and actual when complete", () => {
    expect(projectedManualAmount({ status: "in_progress", expectedAmountCents: 100, actualAmountCents: 125 })).toBe(125);
    expect(projectedManualAmount({ status: "planned", expectedAmountCents: 200, actualAmountCents: 50 })).toBe(200);
    expect(projectedManualAmount({ status: "complete", expectedAmountCents: 200, actualAmountCents: 50 })).toBe(50);
  });

  it("chooses the better medical claimant and preserves tuition remainders", () => {
    const lowIncome = person(1, 3_500_000);
    lowIncome.currentTuitionCents = 500_000;
    lowIncome.federalTuitionCarryforwardCents = 200_000;
    lowIncome.manitobaTuitionCarryforwardCents = 300_000;
    const result = calculateHouseholdEstimate([lowIncome, person(2, 8_000_000)], {
      claimantPersonId: 1, medicalExpensesCents: 400_000, eligibleRentCents: 600_000,
      eligibleRentMonths: 6, eligibleSchoolTaxCents: 0, homeownerAdvanceReceivedCents: 0,
      homeOwnershipDays: 0,
    });
    expect(result.medicalClaimantPersonId).toBe(1);
    expect(result.manitobaCredits.renterCreditCents).toBe(31_250);
    expect(result.people[0]!.federalTuition.remainingCents).toBeGreaterThanOrEqual(0);
    expect(result.people[0]!.manitobaTuition.availableCents).toBe(800_000);
  });

  it("includes payroll overpayments in the result", () => {
    const input = person(1, 9_000_000);
    input.cppCents = 500_000;
    input.cpp2Cents = 60_000;
    input.eiCents = 150_000;
    const result = calculateHouseholdEstimate([input, person(2, 5_000_000)], {
      claimantPersonId: 1, medicalExpensesCents: 0, eligibleRentCents: 0,
      eligibleRentMonths: 0, eligibleSchoolTaxCents: 0, homeownerAdvanceReceivedCents: 0,
      homeOwnershipDays: 0,
    });
    expect(result.people[0]!.cppOverpaymentCents).toBe(95_355);
    expect(result.people[0]!.eiOverpaymentCents).toBe(37_693);
  });
});
