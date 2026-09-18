import { z } from "zod";

import { parseMoneyValue, parseRateValue } from "~/lib/format-term-value";

export const accountTermsFields = [
  "interestRate",
  "promotionalInterestRate",
  "promotionalInterestRateExpires",
  "creditLimit",
  "annualFee",
  "renewalDate",
  "insurance",
] as const;

export type AccountTermsField = (typeof accountTermsFields)[number];

export const accountTermsFieldLabels = {
  interestRate: "Interest rate",
  promotionalInterestRate: "Promotional interest rate",
  promotionalInterestRateExpires: "Promo rate expires",
  creditLimit: "Credit limit",
  annualFee: "Annual fee",
  renewalDate: "Renewal date",
  insurance: "Insurance",
} satisfies Record<AccountTermsField, string>;

export const accountTermsFieldKinds = {
  interestRate: "rate",
  promotionalInterestRate: "rate",
  promotionalInterestRateExpires: "date",
  creditLimit: "money",
  annualFee: "money",
  renewalDate: "date",
  insurance: "text",
} satisfies Record<AccountTermsField, "rate" | "money" | "date" | "text">;

export const accountTermsSchema = z.object({
  interestRate: z.string().trim().max(40).nullable().optional(),
  promotionalInterestRate: z.string().trim().max(40).nullable().optional(),
  promotionalInterestRateExpires: z.string().trim().max(10).nullable().optional(),
  creditLimit: z.string().trim().max(40).nullable().optional(),
  annualFee: z.string().trim().max(40).nullable().optional(),
  renewalDate: z.string().trim().max(10).nullable().optional(),
  insurance: z.string().trim().max(500).nullable().optional(),
});

export type AccountTerms = z.infer<typeof accountTermsSchema>;

export const emptyAccountTerms = (): AccountTerms => ({
  interestRate: null,
  promotionalInterestRate: null,
  promotionalInterestRateExpires: null,
  creditLimit: null,
  annualFee: null,
  renewalDate: null,
  insurance: null,
});

export function normalizeAccountTerms(input: AccountTerms): AccountTerms {
  return {
    interestRate: parseRateValue(input.interestRate),
    promotionalInterestRate: parseRateValue(input.promotionalInterestRate),
    promotionalInterestRateExpires: input.promotionalInterestRateExpires?.trim() || null,
    creditLimit: parseMoneyValue(input.creditLimit),
    annualFee: parseMoneyValue(input.annualFee),
    renewalDate: input.renewalDate?.trim() || null,
    insurance: input.insurance?.trim() || null,
  };
}

export function accountTermsChanged(before: AccountTerms, after: AccountTerms) {
  return accountTermsFields.some((field) => before[field] !== after[field]);
}

export function hasAccountTerms(terms: AccountTerms) {
  return accountTermsFields.some((field) => Boolean(terms[field]));
}

export function listAccountTermsEntries(terms: AccountTerms) {
  return accountTermsFields.flatMap((field) => {
    const value = terms[field];
    if (!value) return [];
    return [{ field, label: accountTermsFieldLabels[field], value }];
  });
}
