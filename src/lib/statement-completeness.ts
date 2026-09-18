import {
  canDeriveStatementPeriods,
  deriveExpectedPeriodsForYear,
  statementYearRange,
  type AccountLifecycle,
  type ExpectedPeriod,
} from "~/lib/expected-periods";
import type { StatementFrequency } from "~/lib/statement-frequency";

export type StatementCompletenessStatus =
  | "complete"
  | "missing"
  | "waiting"
  | "future"
  | "not_expected";

export type AccountForCompleteness = AccountLifecycle & {
  id: string;
  displayName: string;
  institutionName: string;
  statementFrequency: StatementFrequency;
};

export type MissingStatement = {
  accountId: string;
  accountName: string;
  institutionName: string;
  periodKey: string;
  periodLabel: string;
};

export type YearCompletenessSummary = {
  year: number;
  expectedCount: number;
  completeCount: number;
  missingCount: number;
  waitingCount: number;
};

export const completenessStatusLabels: Record<StatementCompletenessStatus, string> = {
  complete: "Complete",
  missing: "Missing",
  waiting: "Waiting",
  future: "Future",
  not_expected: "Not expected",
};

export function deriveStatementCompleteness(
  period: ExpectedPeriod,
  hasDocument: boolean,
): StatementCompletenessStatus {
  if (period.status === "not_expected") return "not_expected";
  if (hasDocument) return "complete";
  if (period.status === "future") return "future";
  if (period.status === "current") return "waiting";
  return "missing";
}

function comparePeriodKeysDesc(left: string, right: string): number {
  return right.localeCompare(left, undefined, { numeric: true });
}

export function buildMissingStatements(
  accounts: AccountForCompleteness[],
  statementDocumentsByAccount: Readonly<Record<string, Readonly<Record<string, string>>>>,
  asOfDate: Date = new Date(),
): MissingStatement[] {
  const missing: MissingStatement[] = [];

  for (const account of accounts) {
    if (!canDeriveStatementPeriods(account, account.statementFrequency)) continue;

    const uploaded = statementDocumentsByAccount[account.id] ?? {};
    const yearRange = statementYearRange(account, asOfDate);
    if (!yearRange) continue;

    for (let year = yearRange.minYear; year <= yearRange.maxYear; year += 1) {
      const periods = deriveExpectedPeriodsForYear(
        account,
        account.statementFrequency,
        year,
        asOfDate,
      );

      for (const period of periods) {
        if (deriveStatementCompleteness(period, Boolean(uploaded[period.key])) !== "missing") {
          continue;
        }

        missing.push({
          accountId: account.id,
          accountName: account.displayName,
          institutionName: account.institutionName,
          periodKey: period.key,
          periodLabel: period.label,
        });
      }
    }
  }

  return missing.sort((left, right) => {
    const byPeriod = comparePeriodKeysDesc(left.periodKey, right.periodKey);
    if (byPeriod !== 0) return byPeriod;
    return left.accountName.localeCompare(right.accountName);
  });
}

export function buildYearCompletenessSummary(
  accounts: AccountForCompleteness[],
  statementDocumentsByAccount: Readonly<Record<string, Readonly<Record<string, string>>>>,
  year: number,
  asOfDate: Date = new Date(),
): YearCompletenessSummary {
  let expectedCount = 0;
  let completeCount = 0;
  let missingCount = 0;
  let waitingCount = 0;

  for (const account of accounts) {
    if (!canDeriveStatementPeriods(account, account.statementFrequency)) continue;

    const uploaded = statementDocumentsByAccount[account.id] ?? {};
    const periods = deriveExpectedPeriodsForYear(
      account,
      account.statementFrequency,
      year,
      asOfDate,
    );

    for (const period of periods) {
      const completeness = deriveStatementCompleteness(period, Boolean(uploaded[period.key]));
      if (completeness === "not_expected" || completeness === "future") continue;

      expectedCount += 1;
      if (completeness === "complete") completeCount += 1;
      if (completeness === "missing") missingCount += 1;
      if (completeness === "waiting") waitingCount += 1;
    }
  }

  return { year, expectedCount, completeCount, missingCount, waitingCount };
}

export function countCompletenessForYear(
  periods: ExpectedPeriod[],
  statementDocumentsByPeriod: Readonly<Record<string, string>>,
): { completeCount: number; missingCount: number; waitingCount: number; expectedCount: number } {
  let completeCount = 0;
  let missingCount = 0;
  let waitingCount = 0;
  let expectedCount = 0;

  for (const period of periods) {
    const completeness = deriveStatementCompleteness(
      period,
      Boolean(statementDocumentsByPeriod[period.key]),
    );
    if (completeness === "not_expected" || completeness === "future") continue;

    expectedCount += 1;
    if (completeness === "complete") completeCount += 1;
    if (completeness === "missing") missingCount += 1;
    if (completeness === "waiting") waitingCount += 1;
  }

  return { completeCount, missingCount, waitingCount, expectedCount };
}
