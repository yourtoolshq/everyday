import type { AccountLifecycle, ExpectedPeriod } from "~/lib/expected-periods";
import type { StatementFrequency } from "~/lib/statement-frequency";
import {
  canDeriveStatementPeriods,
  deriveExpectedPeriodsForYear,
  statementYearRange,
} from "~/lib/expected-periods";
import { deriveStatementCompleteness } from "~/lib/statement-completeness";

export type AccountForPeriodException = AccountLifecycle & {
  statementFrequency: StatementFrequency;
};

export function findDerivedPeriod(
  account: AccountForPeriodException,
  periodKey: string,
  asOfDate: Date = new Date(),
): ExpectedPeriod | null {
  if (!canDeriveStatementPeriods(account, account.statementFrequency)) {
    return null;
  }

  const yearRange = statementYearRange(account, asOfDate);
  if (!yearRange) return null;

  for (let year = yearRange.minYear; year <= yearRange.maxYear; year += 1) {
    const periods = deriveExpectedPeriodsForYear(
      account,
      account.statementFrequency,
      year,
      asOfDate,
    );
    const period = periods.find((candidate) => candidate.key === periodKey);
    if (period) return period;
  }

  return null;
}

export function canMarkPeriodNotApplicable(
  account: AccountForPeriodException,
  periodKey: string,
  hasDocument: boolean,
  asOfDate: Date = new Date(),
): { ok: true; period: ExpectedPeriod } | { ok: false; error: string } {
  const period = findDerivedPeriod(account, periodKey, asOfDate);
  if (!period) {
    return {
      ok: false,
      error: "Choose a valid statement period for this account.",
    };
  }

  const completeness = deriveStatementCompleteness(period, hasDocument);
  if (completeness !== "missing") {
    return {
      ok: false,
      error: "Only missing statement periods can be marked not applicable.",
    };
  }

  return { ok: true, period };
}
