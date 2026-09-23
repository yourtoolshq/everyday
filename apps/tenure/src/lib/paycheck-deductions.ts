import { z } from "zod";

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

export type DeductionField = (typeof deductionFields)[number];
export type DeductionAmountField = DeductionField["amountField"];
export type DeductionEnabledField = DeductionField["enabledField"];

export type DeductionSettings = {
  incomeTaxEnabled: boolean;
  federalIncomeTaxEnabled: boolean;
  manitobaIncomeTaxEnabled: boolean;
  cppEnabled: boolean;
  cpp2Enabled: boolean;
  eiEnabled: boolean;
  wiEnabled: boolean;
  ltdEnabled: boolean;
  extendedHealthEnabled: boolean;
  travelMedicalEnabled: boolean;
  unionDuesEnabled: boolean;
  otherDeductionsEnabled: boolean;
  deductionFieldOrder: DeductionAmountField[] | null;
};

export type PaycheckAmounts = Record<DeductionAmountField, number> & {
  grossPayCents: number;
};

const deductionAmountFieldSet = new Set<string>(
  deductionFields.map((field) => field.amountField),
);

export function isDeductionAmountField(
  value: string,
): value is DeductionAmountField {
  return deductionAmountFieldSet.has(value);
}

export function defaultDeductionSettings(): DeductionSettings {
  const settings = Object.fromEntries(
    deductionFields.map((field) => [field.enabledField, field.defaultEnabled]),
  ) as Omit<DeductionSettings, "deductionFieldOrder">;

  return {
    ...settings,
    deductionFieldOrder: null,
  };
}

export function parseDeductionSettings(
  value: string | null | undefined,
): DeductionSettings {
  if (!value?.trim()) return defaultDeductionSettings();

  try {
    const parsed = JSON.parse(value) as Partial<DeductionSettings>;
    return normalizeDeductionSettings({
      ...defaultDeductionSettings(),
      ...parsed,
    });
  } catch {
    return defaultDeductionSettings();
  }
}

export function serializeDeductionSettings(
  settings: DeductionSettings,
): string {
  return JSON.stringify(normalizeDeductionSettings(settings));
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

export function normalizeDeductionSettings(
  settings: DeductionSettings,
): DeductionSettings {
  const split = isIncomeTaxSplit(settings);
  return {
    ...settings,
    incomeTaxEnabled: split ? true : settings.incomeTaxEnabled,
    deductionFieldOrder: normalizeDeductionFieldOrder(
      settings.deductionFieldOrder,
    ),
  };
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
  amounts: Pick<
    PaycheckAmounts,
    "incomeTaxCents" | "federalIncomeTaxCents" | "manitobaIncomeTaxCents"
  >,
  split: boolean,
) {
  return split
    ? amounts.federalIncomeTaxCents + amounts.manitobaIncomeTaxCents
    : amounts.incomeTaxCents;
}

export function applyPaycheckIncomeTax<T extends PaycheckAmounts>(
  amounts: T,
  split: boolean,
): T {
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

export function calculateTotalDeductions(
  amounts: Record<DeductionAmountField, number>,
) {
  return deductionFields.reduce(
    (total, field) =>
      field.countsTowardNet ? total + amounts[field.amountField] : total,
    0,
  );
}

export function calculateNetPay(amounts: PaycheckAmounts) {
  return amounts.grossPayCents - calculateTotalDeductions(amounts);
}

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const isoDate = z
  .string()
  .regex(isoDatePattern, "Enter a valid date.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year!, month! - 1, day));
    return date.toISOString().slice(0, 10) === value;
  }, "Enter a valid date.");

export const paycheckAmountInput = z.object({
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
});

export const paycheckInput = paycheckAmountInput
  .extend({
    employmentId: z.string().uuid(),
    payDate: isoDate,
    periodStartDate: isoDate,
    periodEndDate: isoDate,
  })
  .superRefine((value, context) => {
    if (value.periodEndDate < value.periodStartDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["periodEndDate"],
        message: "Pay period end must be on or after the start date.",
      });
    }
    if (calculateTotalDeductions(value) > value.grossPayCents) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["grossPayCents"],
        message: "Total deductions cannot exceed gross pay.",
      });
    }
  });
