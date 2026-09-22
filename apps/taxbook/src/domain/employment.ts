import { z } from "zod";

export const payFrequencies = [
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
  "irregular",
] as const;
export const employmentStatuses = ["active", "ended"] as const;

export const deductionFields = [
  {
    amountField: "incomeTaxCents",
    enabledField: "incomeTaxEnabled",
    label: "Income tax withheld",
    defaultEnabled: true,
    countsTowardNet: true,
  },
  {
    amountField: "federalIncomeTaxCents",
    enabledField: "federalIncomeTaxEnabled",
    label: "Federal tax withheld",
    defaultEnabled: false,
    countsTowardNet: false,
  },
  {
    amountField: "manitobaIncomeTaxCents",
    enabledField: "manitobaIncomeTaxEnabled",
    label: "Manitoba tax withheld",
    defaultEnabled: false,
    countsTowardNet: false,
  },
  {
    amountField: "cppCents",
    enabledField: "cppEnabled",
    label: "CPP",
    defaultEnabled: true,
    countsTowardNet: true,
  },
  {
    amountField: "cpp2Cents",
    enabledField: "cpp2Enabled",
    label: "CPP2",
    defaultEnabled: true,
    countsTowardNet: true,
  },
  {
    amountField: "eiCents",
    enabledField: "eiEnabled",
    label: "EI",
    defaultEnabled: true,
    countsTowardNet: true,
  },
  {
    amountField: "wiCents",
    enabledField: "wiEnabled",
    label: "WI",
    defaultEnabled: false,
    countsTowardNet: true,
  },
  {
    amountField: "ltdCents",
    enabledField: "ltdEnabled",
    label: "LTD",
    defaultEnabled: false,
    countsTowardNet: true,
  },
  {
    amountField: "extendedHealthCents",
    enabledField: "extendedHealthEnabled",
    label: "Extended health",
    defaultEnabled: false,
    countsTowardNet: true,
  },
  {
    amountField: "travelMedicalCents",
    enabledField: "travelMedicalEnabled",
    label: "Travel medical insurance",
    defaultEnabled: false,
    countsTowardNet: true,
  },
  {
    amountField: "unionDuesCents",
    enabledField: "unionDuesEnabled",
    label: "Union dues",
    defaultEnabled: false,
    countsTowardNet: true,
  },
  {
    amountField: "otherDeductionsCents",
    enabledField: "otherDeductionsEnabled",
    label: "Other deductions",
    defaultEnabled: true,
    countsTowardNet: true,
  },
] as const;

export type PayFrequency = (typeof payFrequencies)[number];
export type EmploymentStatus = (typeof employmentStatuses)[number];
export type DeductionField = (typeof deductionFields)[number];
export type DeductionAmountField = DeductionField["amountField"];
export type DeductionEnabledField = DeductionField["enabledField"];

const deductionAmountFieldSet = new Set<string>(
  deductionFields.map((field) => field.amountField),
);

export function isDeductionAmountField(
  value: string,
): value is DeductionAmountField {
  return deductionAmountFieldSet.has(value);
}

export function orderedDeductionFields(
  order: readonly string[] | null | undefined,
): DeductionField[] {
  const byKey = new Map(
    deductionFields.map((field) => [field.amountField, field]),
  );
  const seen = new Set<DeductionAmountField>();
  const result: DeductionField[] = [];
  for (const key of order ?? []) {
    if (!isDeductionAmountField(key) || seen.has(key)) continue;
    const field = byKey.get(key);
    if (!field) continue;
    result.push(field);
    seen.add(key);
  }
  for (const field of deductionFields) {
    if (!seen.has(field.amountField)) result.push(field);
  }
  return result;
}

export function normalizeDeductionFieldOrder(
  order: readonly string[] | null | undefined,
): DeductionAmountField[] {
  return orderedDeductionFields(order).map((field) => field.amountField);
}

export function isIncomeTaxSplit(flags: {
  federalIncomeTaxEnabled?: boolean | null;
  manitobaIncomeTaxEnabled?: boolean | null;
}) {
  return Boolean(
    flags.federalIncomeTaxEnabled || flags.manitobaIncomeTaxEnabled,
  );
}

export function calculateIncomeTaxCents(
  amounts: {
    incomeTaxCents: number;
    federalIncomeTaxCents: number;
    manitobaIncomeTaxCents: number;
  },
  split: boolean,
) {
  return split
    ? amounts.federalIncomeTaxCents + amounts.manitobaIncomeTaxCents
    : amounts.incomeTaxCents;
}

export function applyPaychequeIncomeTax<
  T extends {
    incomeTaxCents: number;
    federalIncomeTaxCents: number;
    manitobaIncomeTaxCents: number;
  },
>(amounts: T, split: boolean): T {
  if (!split) {
    return {
      ...amounts,
      federalIncomeTaxCents: 0,
      manitobaIncomeTaxCents: 0,
    };
  }
  return {
    ...amounts,
    incomeTaxCents: calculateIncomeTaxCents(amounts, true),
  };
}

export function employmentDeductionSettings<
  T extends {
    incomeTaxEnabled: boolean;
    federalIncomeTaxEnabled: boolean;
    manitobaIncomeTaxEnabled: boolean;
    deductionFieldOrder?: string[] | null;
  },
>(input: T) {
  return {
    ...input,
    incomeTaxEnabled: isIncomeTaxSplit(input) ? true : input.incomeTaxEnabled,
    deductionFieldOrder: normalizeDeductionFieldOrder(
      input.deductionFieldOrder,
    ),
  };
}

export const payFrequencyLabels: Record<PayFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Every two weeks",
  semimonthly: "Twice a month",
  monthly: "Monthly",
  irregular: "Irregular",
};

export const employmentStatusLabels: Record<EmploymentStatus, string> = {
  active: "Current",
  ended: "Ended",
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const isoDate = z
  .string()
  .regex(isoDatePattern, "Enter a valid date.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year!, month! - 1, day));
    return date.toISOString().slice(0, 10) === value;
  }, "Enter a valid date.");

export const employmentInput = z
  .object({
    personId: z.number().int().positive(),
    employerName: z.string().trim().min(1).max(100),
    payFrequency: z.enum(payFrequencies),
    status: z.enum(employmentStatuses),
    endDate: isoDate.nullable(),
    typicalGrossOverrideCents: z.number().int().nonnegative().nullable(),
    incomeTaxEnabled: z.boolean().default(true),
    federalIncomeTaxEnabled: z.boolean().default(false),
    manitobaIncomeTaxEnabled: z.boolean().default(false),
    deductionFieldOrder: z.array(z.string()).nullable().optional(),
    cppEnabled: z.boolean().default(true),
    cpp2Enabled: z.boolean().default(true),
    eiEnabled: z.boolean().default(true),
    wiEnabled: z.boolean().default(false),
    ltdEnabled: z.boolean().default(false),
    extendedHealthEnabled: z.boolean().default(false),
    travelMedicalEnabled: z.boolean().default(false),
    unionDuesEnabled: z.boolean().default(false),
    phspReportedOnT4: z.boolean().default(false),
    unionDuesReportedOnT4: z.boolean().default(false),
    otherDeductionsEnabled: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    if (value.status === "ended" && value.endDate === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "Enter the date this employment ended.",
      });
    }
    if (value.status === "active" && value.endDate !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "A current employment cannot have an end date.",
      });
    }
    if (isIncomeTaxSplit(value) && !value.incomeTaxEnabled) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["incomeTaxEnabled"],
        message:
          "Income tax withheld is required when federal or Manitoba tax is split.",
      });
    }
  });

export const employmentUpdateInput = z.intersection(
  employmentInput,
  z.object({ id: z.number().int().positive() }),
);

export const paychequeInput = z
  .object({
    employmentId: z.number().int().positive(),
    payDate: isoDate,
    grossPayCents: z.number().int().nonnegative(),
    incomeTaxCents: z.number().int().nonnegative(),
    federalIncomeTaxCents: z.number().int().nonnegative().default(0),
    manitobaIncomeTaxCents: z.number().int().nonnegative().default(0),
    cppCents: z.number().int().nonnegative(),
    cpp2Cents: z.number().int().nonnegative(),
    eiCents: z.number().int().nonnegative(),
    wiCents: z.number().int().nonnegative().default(0),
    ltdCents: z.number().int().nonnegative().default(0),
    extendedHealthCents: z.number().int().nonnegative().default(0),
    travelMedicalCents: z.number().int().nonnegative().default(0),
    unionDuesCents: z.number().int().nonnegative().default(0),
    otherDeductionsCents: z.number().int().nonnegative(),
  })
  .superRefine((value, context) => {
    if (calculateTotalDeductions(value) > value.grossPayCents) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["grossPayCents"],
        message: "Total deductions cannot exceed gross pay.",
      });
    }
  });

export const paychequeUpdateInput = z.intersection(
  paychequeInput,
  z.object({ id: z.number().int().positive() }),
);

export function calculateTotalDeductions(
  amounts: Record<DeductionAmountField, number>,
) {
  return deductionFields.reduce(
    (total, field) =>
      field.countsTowardNet ? total + amounts[field.amountField] : total,
    0,
  );
}

export function calculateNetPay(
  amounts: Record<DeductionAmountField, number> & { grossPayCents: number },
) {
  return amounts.grossPayCents - calculateTotalDeductions(amounts);
}

const periodsPerYear: Partial<Record<PayFrequency, number>> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
};

function utcDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

export function countRemainingPaycheques(
  frequency: PayFrequency,
  latestPayDate: string | null,
  year: number,
) {
  const annualPeriods = periodsPerYear[frequency];
  if (!annualPeriods || latestPayDate === null) return 0;
  const latest = utcDate(latestPayDate);
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  if (latest >= yearEnd) return 0;
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const millisecondsPerDay = 86_400_000;
  const daysInYear =
    (yearEnd.getTime() - yearStart.getTime()) / millisecondsPerDay + 1;
  const daysRemaining =
    (yearEnd.getTime() - latest.getTime()) / millisecondsPerDay;
  return Math.floor((daysRemaining * annualPeriods) / daysInYear);
}

export function calculateEmploymentProjection({
  year,
  status,
  payFrequency,
  typicalGrossOverrideCents,
  grossPaysCents,
  latestPayDate,
}: {
  year: number;
  status: EmploymentStatus;
  payFrequency: PayFrequency;
  typicalGrossOverrideCents: number | null;
  grossPaysCents: number[];
  latestPayDate: string | null;
}) {
  const actualGrossCents = grossPaysCents.reduce(
    (total, value) => total + value,
    0,
  );
  const averageGrossCents = grossPaysCents.length
    ? Math.round(actualGrossCents / grossPaysCents.length)
    : null;
  const typicalGrossCents = typicalGrossOverrideCents ?? averageGrossCents;
  const remainingPaycheques =
    status === "active"
      ? countRemainingPaycheques(payFrequency, latestPayDate, year)
      : 0;
  const projectedGrossCents =
    typicalGrossCents === null
      ? actualGrossCents
      : actualGrossCents + typicalGrossCents * remainingPaycheques;
  return {
    actualGrossCents,
    averageGrossCents,
    typicalGrossCents,
    remainingPaycheques,
    projectedGrossCents,
  };
}
