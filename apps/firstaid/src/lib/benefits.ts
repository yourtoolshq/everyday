import { z } from "zod";

import { planYearSchema } from "~/lib/care-planning";
import { sumCents } from "~/lib/money";

export const benefitCoverageScopes = ["person", "household"] as const;
export const claimStatuses = ["submitted", "paid", "denied"] as const;

export type BenefitCoverageScope = (typeof benefitCoverageScopes)[number];
export type ClaimStatus = (typeof claimStatuses)[number];

export const benefitCoverageScopeLabels = {
  person: "Person-specific",
  household: "Household shared",
} satisfies Record<BenefitCoverageScope, string>;

export const claimStatusLabels = {
  submitted: "Submitted",
  paid: "Paid",
  denied: "Denied",
} satisfies Record<ClaimStatus, string>;

const optionalText = z.string().trim().max(2_000).nullable();
const centsSchema = z.number().int().nonnegative();

export const insurancePlanFieldsSchema = z.object({
  name: z.string().trim().min(1).max(160),
  year: planYearSchema,
  notes: optionalText,
});

export const benefitFieldsSchema = z
  .object({
    insurancePlanId: z.string().uuid(),
    name: z.string().trim().min(1).max(160),
    coverageScope: z.enum(benefitCoverageScopes),
    personId: z.string().uuid().nullable(),
    annualLimitCents: centsSchema,
    openingUsedCents: centsSchema.default(0),
    notes: optionalText,
  })
  .superRefine((value, ctx) => {
    if (value.coverageScope === "person" && !value.personId) {
      ctx.addIssue({
        code: "custom",
        path: ["personId"],
        message: "Choose the household member this benefit covers.",
      });
    }
    if (value.coverageScope === "household" && value.personId) {
      ctx.addIssue({
        code: "custom",
        path: ["personId"],
        message: "Household benefits cannot be assigned to one person.",
      });
    }
    if (value.openingUsedCents > value.annualLimitCents) {
      ctx.addIssue({
        code: "custom",
        path: ["openingUsedCents"],
        message: "Opening usage cannot exceed the annual limit.",
      });
    }
  });

export const claimFieldsSchema = z.object({
  visitId: z.string().uuid(),
  benefitId: z.string().uuid(),
  status: z.enum(claimStatuses),
  amountCents: z.number().int().positive(),
  notes: optionalText,
});

export type ClaimLike = {
  status: ClaimStatus;
  amountCents: number;
};

export type BenefitEligibility = {
  coverageScope: BenefitCoverageScope;
  personId: string | null;
  planYear: number;
};

export type VisitEligibility = {
  personId: string;
  startsAt: string;
};

export function visitCalendarYear(startsAt: string): number {
  return new Date(startsAt).getFullYear();
}

export function benefitUsedCents(
  openingUsedCents: number,
  paidClaimAmounts: number[],
): number {
  return openingUsedCents + sumCents(paidClaimAmounts);
}

export function benefitRemainingCents(
  annualLimitCents: number,
  usedCents: number,
): { remainingCents: number; overLimitCents: number } {
  if (usedCents <= annualLimitCents) {
    return { remainingCents: annualLimitCents - usedCents, overLimitCents: 0 };
  }
  return { remainingCents: 0, overLimitCents: usedCents - annualLimitCents };
}

export function benefitPendingCents(claims: ClaimLike[]): number {
  return sumCents(
    claims
      .filter((claim) => claim.status === "submitted")
      .map((claim) => claim.amountCents),
  );
}

export function visitFinancials(
  costCents: number | null,
  claims: ClaimLike[],
): {
  reimbursedCents: number;
  pendingCents: number;
  outOfPocketCents: number;
} | null {
  if (costCents === null) return null;

  const reimbursedCents = sumCents(
    claims
      .filter((claim) => claim.status === "paid")
      .map((claim) => claim.amountCents),
  );
  const pendingCents = benefitPendingCents(claims);

  return {
    reimbursedCents,
    pendingCents,
    outOfPocketCents: costCents - reimbursedCents,
  };
}

export function careItemFinancials(
  visits: Array<{ id: string; costCents: number | null }>,
  claimsByVisit: Map<string, ClaimLike[]>,
): {
  totalCostCents: number;
  reimbursedCents: number;
  outOfPocketCents: number;
  hasMissingCosts: boolean;
} | null {
  if (visits.length === 0) return null;

  const hasAnyCost = visits.some((visit) => visit.costCents !== null);
  if (!hasAnyCost) return null;

  const knownCosts = visits
    .map((visit) => visit.costCents)
    .filter((cost): cost is number => cost !== null);
  const totalCostCents = sumCents(knownCosts);
  const hasMissingCosts = visits.some((visit) => visit.costCents === null);

  let reimbursedCents = 0;
  for (const visit of visits) {
    if (visit.costCents === null) continue;
    const claims = claimsByVisit.get(visit.id) ?? [];
    reimbursedCents += sumCents(
      claims
        .filter((claim) => claim.status === "paid")
        .map((claim) => claim.amountCents),
    );
  }

  return {
    totalCostCents,
    reimbursedCents,
    outOfPocketCents: totalCostCents - reimbursedCents,
    hasMissingCosts,
  };
}

export function isBenefitEligible(
  benefit: BenefitEligibility,
  visit: VisitEligibility,
): boolean {
  if (benefit.planYear !== visitCalendarYear(visit.startsAt)) return false;
  if (benefit.coverageScope === "household") return true;
  return benefit.personId === visit.personId;
}

export function paidClaimsTotal(claims: ClaimLike[]): number {
  return sumCents(
    claims
      .filter((claim) => claim.status === "paid")
      .map((claim) => claim.amountCents),
  );
}

export function validateClaimAllocation(
  visitCostCents: number,
  existingClaims: ClaimLike[],
  nextClaim: ClaimLike,
  excludeIndex?: number,
): string | null {
  const otherClaims = existingClaims.filter(
    (_, index) => index !== excludeIndex,
  );
  const hypothetical = [...otherClaims, nextClaim];
  const paidTotal = paidClaimsTotal(hypothetical);
  if (paidTotal > visitCostCents) {
    return "Paid claims cannot total more than the visit cost.";
  }
  return null;
}

export function validateVisitCostChange(
  newCostCents: number | null,
  existingClaims: ClaimLike[],
): string | null {
  if (newCostCents === null) return null;
  const paidTotal = paidClaimsTotal(existingClaims);
  if (paidTotal > newCostCents) {
    return "Visit cost cannot be lower than the total of paid claims.";
  }
  return null;
}
