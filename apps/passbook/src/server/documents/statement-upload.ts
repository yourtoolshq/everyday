import { findUploadablePeriod, type AccountLifecycle } from "~/lib/expected-periods";
import type { StatementFrequency } from "~/lib/statement-frequency";

export type StatementUploadAccount = AccountLifecycle & {
  statementFrequency: StatementFrequency;
};

export function validateStatementPeriod(
  account: StatementUploadAccount,
  periodKey: string,
  asOfDate: Date = new Date(),
) {
  if (account.statementFrequency === "none") {
    return { ok: false as const, error: "This account does not expect statements." };
  }

  const period = findUploadablePeriod(
    account,
    account.statementFrequency,
    periodKey,
    asOfDate,
  );
  if (!period) {
    return { ok: false as const, error: "Choose a valid statement period for this account." };
  }

  return { ok: true as const, period };
}
