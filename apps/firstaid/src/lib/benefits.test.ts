import { describe, expect, it } from "vitest";

import {
  benefitRemainingCents,
  benefitUsedCents,
  careItemFinancials,
  isBenefitEligible,
  validateClaimAllocation,
  validateVisitCostChange,
  visitFinancials,
} from "~/lib/benefits";

describe("benefit calculations", () => {
  it("includes opening usage in used totals", () => {
    expect(benefitUsedCents(5000, [10000, 5000])).toBe(20000);
  });

  it("calculates remaining and over-limit amounts", () => {
    expect(benefitRemainingCents(50000, 21000)).toEqual({
      remainingCents: 29000,
      overLimitCents: 0,
    });
    expect(benefitRemainingCents(50000, 55000)).toEqual({
      remainingCents: 0,
      overLimitCents: 5000,
    });
  });
});

describe("visit financials", () => {
  it("returns null when visit cost is unknown", () => {
    expect(visitFinancials(null, [])).toBeNull();
  });

  it("counts only paid claims toward reimbursement", () => {
    expect(
      visitFinancials(11000, [
        { status: "paid", amountCents: 10000 },
        { status: "submitted", amountCents: 5000 },
        { status: "denied", amountCents: 2000 },
      ]),
    ).toEqual({
      reimbursedCents: 10000,
      pendingCents: 5000,
      outOfPocketCents: 1000,
    });
  });
});

describe("care item financials", () => {
  it("aggregates linked visits and flags missing costs", () => {
    const claimsByVisit = new Map([
      ["v1", [{ status: "paid" as const, amountCents: 10000 }]],
      ["v2", [{ status: "paid" as const, amountCents: 5000 }]],
    ]);

    expect(
      careItemFinancials(
        [
          { id: "v1", costCents: 11000 },
          { id: "v2", costCents: null },
        ],
        claimsByVisit,
      ),
    ).toEqual({
      totalCostCents: 11000,
      reimbursedCents: 10000,
      outOfPocketCents: 1000,
      hasMissingCosts: true,
    });
  });

  it("returns null when no visit has a recorded cost", () => {
    expect(
      careItemFinancials([{ id: "v1", costCents: null }], new Map()),
    ).toBeNull();
  });
});

describe("benefit eligibility", () => {
  const householdBenefit = {
    coverageScope: "household" as const,
    personId: null,
    planYear: 2027,
  };
  const personBenefit = {
    coverageScope: "person" as const,
    personId: "person-1",
    planYear: 2027,
  };

  it("matches calendar year and person scope", () => {
    expect(
      isBenefitEligible(householdBenefit, {
        personId: "person-2",
        startsAt: "2027-06-01T12:00:00.000Z",
      }),
    ).toBe(true);
    expect(
      isBenefitEligible(personBenefit, {
        personId: "person-1",
        startsAt: "2027-06-01T12:00:00.000Z",
      }),
    ).toBe(true);
    expect(
      isBenefitEligible(personBenefit, {
        personId: "person-2",
        startsAt: "2027-06-01T12:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      isBenefitEligible(personBenefit, {
        personId: "person-1",
        startsAt: "2026-12-31T23:59:59.000Z",
      }),
    ).toBe(false);
  });
});

describe("validation", () => {
  it("rejects paid claims above visit cost", () => {
    expect(
      validateClaimAllocation(
        11000,
        [{ status: "paid", amountCents: 8000 }],
        { status: "paid", amountCents: 4000 },
      ),
    ).toBe("Paid claims cannot total more than the visit cost.");
  });

  it("allows submitted claims above reimbursement ceiling", () => {
    expect(
      validateClaimAllocation(
        11000,
        [{ status: "submitted", amountCents: 11000 }],
        { status: "paid", amountCents: 10000 },
      ),
    ).toBeNull();
  });

  it("rejects visit cost below paid claims", () => {
    expect(
      validateVisitCostChange(9000, [{ status: "paid", amountCents: 10000 }]),
    ).toBe("Visit cost cannot be lower than the total of paid claims.");
  });
});
