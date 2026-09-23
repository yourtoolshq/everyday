import { z } from "zod";

import { recordDate } from "./record";

export const businessRecordKinds = ["revenue", "expense"] as const;
export const businessExpenseCategories = [
  "advertising",
  "meals_entertainment",
  "bad_debts",
  "insurance",
  "interest_bank_charges",
  "taxes_licences_memberships",
  "office_expenses",
  "supplies",
  "professional_fees",
  "management_administration",
  "rent",
  "repairs_maintenance",
  "property_taxes",
  "travel",
  "utilities",
  "fuel_non_vehicle",
  "delivery_freight",
  "other",
] as const;
export type BusinessExpenseCategory =
  (typeof businessExpenseCategories)[number];
export const businessExpenseCategoryDetails: Record<
  BusinessExpenseCategory,
  { label: string; line: string }
> = {
  advertising: { label: "Advertising", line: "8521" },
  meals_entertainment: { label: "Meals and entertainment", line: "8523" },
  bad_debts: { label: "Bad debts", line: "8590" },
  insurance: { label: "Insurance", line: "8690" },
  interest_bank_charges: { label: "Interest and bank charges", line: "8710" },
  taxes_licences_memberships: {
    label: "Business taxes, licences, and memberships",
    line: "8760",
  },
  office_expenses: { label: "Office expenses", line: "8810" },
  supplies: { label: "Office stationery and supplies", line: "8811" },
  professional_fees: { label: "Professional fees", line: "8860" },
  management_administration: {
    label: "Management and administration fees",
    line: "8871",
  },
  rent: { label: "Rent", line: "8910" },
  repairs_maintenance: { label: "Repairs and maintenance", line: "8960" },
  property_taxes: { label: "Property taxes", line: "9180" },
  travel: { label: "Travel expenses", line: "9200" },
  utilities: { label: "Utilities", line: "9220" },
  fuel_non_vehicle: {
    label: "Fuel costs (except motor vehicles)",
    line: "9224",
  },
  delivery_freight: { label: "Delivery, freight, and express", line: "9275" },
  other: { label: "Other expenses", line: "9270" },
};
export const businessActivityInput = z.object({
  name: z.string().trim().min(1).max(100),
  personId: z.number().int().positive(),
});
export const businessActivityUpdateInput = businessActivityInput.extend({
  id: z.number().int().positive(),
});
const businessRecordFields = z.object({
  businessActivityId: z.number().int().positive(),
  kind: z.enum(businessRecordKinds),
  expenseCategory: z.enum(businessExpenseCategories).nullable(),
  date: recordDate,
  description: z.string().trim().min(1).max(200),
  amountCents: z.number().int().positive(),
  notes: z.string().trim().max(4000).nullable(),
});
const validateCategory = (
  value: { kind: "revenue" | "expense"; expenseCategory: string | null },
  context: z.RefinementCtx,
) => {
  if ((value.kind === "expense") !== (value.expenseCategory !== null))
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["expenseCategory"],
      message: "Choose a category for an expense only.",
    });
};
export const businessRecordInput =
  businessRecordFields.superRefine(validateCategory);
export const businessRecordUpdateInput = businessRecordFields
  .omit({ businessActivityId: true })
  .superRefine(validateCategory);
export type BusinessRecordInput = z.infer<typeof businessRecordInput>;
export type BusinessRecordUpdateInput = z.infer<
  typeof businessRecordUpdateInput
>;
