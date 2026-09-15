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
  },
  {
    amountField: "cppCents",
    enabledField: "cppEnabled",
    label: "CPP",
    defaultEnabled: true,
  },
  {
    amountField: "cpp2Cents",
    enabledField: "cpp2Enabled",
    label: "CPP2",
    defaultEnabled: true,
  },
  {
    amountField: "eiCents",
    enabledField: "eiEnabled",
    label: "EI",
    defaultEnabled: true,
  },
  {
    amountField: "wiCents",
    enabledField: "wiEnabled",
    label: "WI",
    defaultEnabled: false,
  },
  {
    amountField: "ltdCents",
    enabledField: "ltdEnabled",
    label: "LTD",
    defaultEnabled: false,
  },
  {
    amountField: "otherDeductionsCents",
    enabledField: "otherDeductionsEnabled",
    label: "Other deductions",
    defaultEnabled: true,
  },
] as const;

export type PayFrequency = (typeof payFrequencies)[number];
export type EmploymentStatus = (typeof employmentStatuses)[number];
export type DeductionAmountField = (typeof deductionFields)[number]["amountField"];
export type DeductionEnabledField = (typeof deductionFields)[number]["enabledField"];

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
    cppEnabled: z.boolean().default(true),
    cpp2Enabled: z.boolean().default(true),
    eiEnabled: z.boolean().default(true),
    wiEnabled: z.boolean().default(false),
    ltdEnabled: z.boolean().default(false),
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
    cppCents: z.number().int().nonnegative(),
    cpp2Cents: z.number().int().nonnegative(),
    eiCents: z.number().int().nonnegative(),
    wiCents: z.number().int().nonnegative().default(0),
    ltdCents: z.number().int().nonnegative().default(0),
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
    (total, field) => total + amounts[field.amountField],
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
  const actualGrossCents = grossPaysCents.reduce((total, value) => total + value, 0);
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
