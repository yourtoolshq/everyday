import type { AccountType } from "~/lib/account-types";

const investmentEligibleAccountTypes: ReadonlySet<AccountType> = new Set([
  "investment",
  "tfsa",
  "rrsp",
  "fhsa",
]);

export function isInvestmentEligibleAccountType(
  accountType: AccountType,
): boolean {
  return investmentEligibleAccountTypes.has(accountType);
}
