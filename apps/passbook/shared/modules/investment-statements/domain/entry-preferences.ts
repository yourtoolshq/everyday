import type { TotalInput } from "./snapshot-dto";

export const optionalSummaryFields = [
  "cash",
  "contributions",
  "withdrawals",
  "transfersIn",
  "transfersOut",
  "income",
  "fees",
  "reportedValueChange",
] as const;
export type OptionalSummaryField = (typeof optionalSummaryFields)[number];
export type SummaryField =
  OptionalSummaryField | "openingValue" | "closingValue" | "bookCost";
export type EntryPreferences = {
  fields: OptionalSummaryField[];
  aliases: Partial<Record<SummaryField, string>>;
  currency: string;
};
export const defaultEntryPreferences: EntryPreferences = {
  fields: [],
  aliases: {},
  currency: "CAD",
};
export const summaryFieldLabels: Record<SummaryField, string> = {
  openingValue: "Opening value",
  closingValue: "Closing market value",
  bookCost: "Book value",
  cash: "Cash balance",
  contributions: "Contributions",
  withdrawals: "Withdrawals",
  transfersIn: "Transfers in",
  transfersOut: "Transfers out",
  income: "Investment income",
  fees: "Fees",
  reportedValueChange: "Reported value change",
};
export const summaryAliases: Partial<Record<SummaryField, string[]>> = {
  closingValue: [
    "Closing market value",
    "Closing value",
    "Total portfolio market value",
  ],
  openingValue: ["Opening value", "Opening market value"],
  bookCost: ["Book value", "Book cost"],
  cash: ["Cash balance", "Closing cash balance"],
  contributions: ["Contributions", "Deposits"],
  fees: ["Fees", "Account fees"],
};
export function populatedOptionalFields(
  totals: TotalInput[],
): OptionalSummaryField[] {
  return optionalSummaryFields.filter((key) =>
    totals.some((row) => row[key] != null && row[key] !== ""),
  );
}
