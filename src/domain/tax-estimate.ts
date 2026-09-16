import { z } from "zod";

export const housingModes = ["none", "renter", "homeowner", "rent_then_own"] as const;
export type HousingMode = (typeof housingModes)[number];

const ownershipDate = z.string().regex(/^2026-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid date in 2026.");

export const estimateSettingsInput = z.object({
  manitobaCreditsClaimantPersonId: z.number().int().positive(),
  housingMode: z.enum(housingModes),
  homeOwnershipStartDate: ownershipDate.nullable(),
  eligibleSchoolTaxCents: z.number().int().nonnegative().nullable(),
  homeownerAdvanceReceivedCents: z.number().int().nonnegative().nullable(),
  study: z.array(z.object({
    personId: z.number().int().positive(),
    fullTimeStudyMonths: z.number().int().min(0).max(12),
    partTimeStudyMonths: z.number().int().min(0).max(12),
  }).refine((value) => value.fullTimeStudyMonths + value.partTimeStudyMonths <= 12, {
    message: "Full-time and part-time study months cannot total more than 12.",
  })),
}).superRefine((value, context) => {
  const owns = value.housingMode === "homeowner" || value.housingMode === "rent_then_own";
  if (value.housingMode === "rent_then_own" && !value.homeOwnershipStartDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["homeOwnershipStartDate"], message: "Enter the date home ownership began." });
  }
  if (owns && value.eligibleSchoolTaxCents === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["eligibleSchoolTaxCents"], message: "Enter eligible school tax." });
  }
});

export const scenarioInput = z.object({
  people: z.array(z.object({
    personId: z.number().int().positive(),
    rrspContributionCents: z.number().int().nonnegative(),
    rrspDeductionCents: z.number().int().nonnegative(),
    fhsaContributionCents: z.number().int().nonnegative(),
    fhsaDeductionCents: z.number().int().nonnegative(),
  })),
});

export type EstimateSettingsInput = z.infer<typeof estimateSettingsInput>;
export type ScenarioInput = z.infer<typeof scenarioInput>;

export type EstimateWarning = {
  code: string;
  message: string;
  itemId?: number;
};

export function projectedManualAmount(item: {
  status: "planned" | "in_progress" | "complete";
  expectedAmountCents: number | null;
  actualAmountCents: number | null;
}) {
  if (item.status === "complete") return item.actualAmountCents ?? 0;
  if (item.actualAmountCents === null) return item.expectedAmountCents ?? 0;
  if (item.expectedAmountCents === null) return item.actualAmountCents;
  return Math.max(item.actualAmountCents, item.expectedAmountCents);
}
