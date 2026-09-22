import { z } from "zod";

export const itemTypes = [
  "income",
  "deduction_contribution",
  "eligible_expense",
  "credit_benefit",
  "other",
] as const;
export const itemStatuses = ["planned", "in_progress", "complete"] as const;
export const ownerKinds = ["household", "person"] as const;
export const valueSources = [
  "manual",
  "paycheques",
  "records",
  "self_employment",
] as const;
export const taxTreatments = [
  "employment_income",
  "self_employment_income",
  "interest_income",
  "rrsp_deduction",
  "fhsa_deduction",
  "professional_dues",
  "current_tuition",
  "federal_tuition_carryforward",
  "manitoba_tuition_carryforward",
  "medical_expense",
  "manitoba_eligible_rent",
  "manitoba_eligible_school_tax",
  "manitoba_homeowner_advance",
] as const;

export type ItemType = (typeof itemTypes)[number];
export type ItemStatus = (typeof itemStatuses)[number];
export type ValueSource = (typeof valueSources)[number];
export type TaxTreatment = (typeof taxTreatments)[number];

export const taxTreatmentLabels: Record<TaxTreatment, string> = {
  employment_income: "Employment income",
  self_employment_income: "Self-employment income / loss",
  interest_income: "Interest income",
  rrsp_deduction: "RRSP deduction",
  fhsa_deduction: "FHSA deduction",
  professional_dues: "Professional dues",
  current_tuition: "Current-year tuition",
  federal_tuition_carryforward: "Federal tuition carryforward",
  manitoba_tuition_carryforward: "Manitoba tuition carryforward",
  medical_expense: "Medical expenses",
  manitoba_eligible_rent: "Manitoba eligible rent",
  manitoba_eligible_school_tax: "Manitoba eligible school tax",
  manitoba_homeowner_advance: "Manitoba homeowner advance received",
};

export const taxTreatmentDescriptions: Record<TaxTreatment, string> = {
  employment_income: "Gross employment income calculated from paycheques.",
  self_employment_income:
    "Net business income or loss calculated from Self-employment Records.",
  interest_income: "Interest this person expects to report.",
  rrsp_deduction: "The RRSP deduction claimed for this tax year.",
  fhsa_deduction: "The FHSA deduction claimed for this tax year.",
  professional_dues:
    "Deductible union or professional dues, often confirmed by T4 box 44.",
  current_tuition: "Eligible tuition fees from this year's T2202.",
  federal_tuition_carryforward:
    "Unused federal tuition balance from the prior assessment.",
  manitoba_tuition_carryforward:
    "Unused Manitoba tuition and education balance.",
  medical_expense: "Eligible household medical expenses after reimbursements.",
  manitoba_eligible_rent:
    "Rent paid; Records determine eligible rental months.",
  manitoba_eligible_school_tax:
    "Eligible school tax paid for a Manitoba principal residence.",
  manitoba_homeowner_advance:
    "Advance payment already received for the Manitoba homeowner credit.",
};

export const taxTreatmentLineSuggestions: Partial<
  Record<TaxTreatment, string>
> = {
  employment_income: "10100",
  self_employment_income: "T2125 9946 → 13500",
  interest_income: "12100",
  rrsp_deduction: "20800",
  fhsa_deduction: "20805",
  professional_dues: "21200",
  current_tuition: "32300 / Schedule MB(S11)",
  federal_tuition_carryforward: "Schedule 11",
  manitoba_tuition_carryforward: "Schedule MB(S11)",
  medical_expense: "33099 / 58689",
  manitoba_eligible_rent: "Form MB479",
  manitoba_eligible_school_tax: "Form MB479",
  manitoba_homeowner_advance: "Form MB479",
};

type TreatmentRule = { type: ItemType; ownerKind: (typeof ownerKinds)[number] };
export const taxTreatmentRules: Record<TaxTreatment, TreatmentRule> = {
  employment_income: { type: "income", ownerKind: "person" },
  self_employment_income: { type: "income", ownerKind: "person" },
  interest_income: { type: "income", ownerKind: "person" },
  rrsp_deduction: { type: "deduction_contribution", ownerKind: "person" },
  fhsa_deduction: { type: "deduction_contribution", ownerKind: "person" },
  professional_dues: { type: "deduction_contribution", ownerKind: "person" },
  current_tuition: { type: "credit_benefit", ownerKind: "person" },
  federal_tuition_carryforward: { type: "credit_benefit", ownerKind: "person" },
  manitoba_tuition_carryforward: {
    type: "credit_benefit",
    ownerKind: "person",
  },
  medical_expense: { type: "eligible_expense", ownerKind: "household" },
  manitoba_eligible_rent: { type: "eligible_expense", ownerKind: "household" },
  manitoba_eligible_school_tax: {
    type: "eligible_expense",
    ownerKind: "household",
  },
  manitoba_homeowner_advance: {
    type: "credit_benefit",
    ownerKind: "household",
  },
};

export function isTaxTreatmentCompatible(
  treatment: TaxTreatment | null,
  type: ItemType,
  ownerKind: (typeof ownerKinds)[number],
) {
  if (treatment === null) return true;
  const rule = taxTreatmentRules[treatment];
  return rule.type === type && rule.ownerKind === ownerKind;
}

export const itemTypeLabels: Record<ItemType, string> = {
  income: "Income",
  deduction_contribution: "Deduction / contribution",
  eligible_expense: "Eligible expense",
  credit_benefit: "Credit / benefit",
  other: "Other",
};

export const itemStatusLabels: Record<ItemStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  complete: "Complete",
};

const name = z.string().trim().min(1).max(100);

export const setupInput = z.object({
  householdName: name,
  people: z.array(name).min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

export const taxItemInput = z
  .object({
    name,
    taxLineReference: z.string().trim().max(50).nullable(),
    type: z.enum(itemTypes),
    ownerKind: z.enum(ownerKinds),
    personId: z.number().int().positive().nullable(),
    expectedAmountCents: z.number().int().nonnegative().nullable(),
    actualAmountCents: z.number().int().nonnegative().nullable(),
    status: z.enum(itemStatuses),
    notes: z.string().trim().max(4000).nullable(),
    taxTreatment: z.enum(taxTreatments).nullable().default(null),
  })
  .superRefine((value, context) => {
    const valid =
      (value.ownerKind === "household" && value.personId === null) ||
      (value.ownerKind === "person" && value.personId !== null);
    if (!valid) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["personId"],
        message: "Choose a person for person-owned items.",
      });
    }
    if (
      !isTaxTreatmentCompatible(value.taxTreatment, value.type, value.ownerKind)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["taxTreatment"],
        message:
          "Choose a tax treatment that matches this item's Type and Owner.",
      });
    }
    if (
      value.taxTreatment === "employment_income" ||
      value.taxTreatment === "self_employment_income"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["taxTreatment"],
        message:
          "This calculated treatment is managed from its dedicated workspace.",
      });
    }
  });

export type TaxItemInput = z.infer<typeof taxItemInput>;
export const taxItemUpdateInput = z.intersection(
  taxItemInput,
  z.object({ id: z.number().int().positive() }),
);
