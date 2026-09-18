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
  | "not_expected"
  | "not_applicable";

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
  notApplicableCount: number;
  missingCount: number;
  waitingCount: number;
};

export type PeriodExceptionsByAccount = Readonly<
  Record<string, Readonly<Record<string, true>>>
>;

export const completenessStatusLabels: Record<StatementCompletenessStatus, string> = {
  complete: "Complete",
  missing: "Missing",
  waiting: "Waiting",
  future: "Future",
  not_expected: "Not expected",
  not_applicable: "Not applicable",
};

export function deriveStatementCompleteness(
  period: ExpectedPeriod,
  hasDocument: boolean,
  hasException = false,
): StatementCompletenessStatus {
  if (period.status === "not_expected") return "not_expected";
  if (hasDocument) return "complete";
  if (period.status === "future") return "future";
  if (period.status === "current") return "waiting";
  if (hasException) return "not_applicable";
  return "missing";
}

function comparePeriodKeysDesc(left: string, right: string): number {
  return right.localeCompare(left, undefined, { numeric: true });
}

function hasPeriodException(
  exceptionsByAccount: PeriodExceptionsByAccount,
  accountId: string,
  periodKey: string,
): boolean {
  return Boolean(exceptionsByAccount[accountId]?.[periodKey]);
}

export function buildMissingStatements(
  accounts: AccountForCompleteness[],
  statementDocumentsByAccount: Readonly<Record<string, Readonly<Record<string, string>>>>,
  exceptionsByAccount: PeriodExceptionsByAccount = {},
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
        const hasException = hasPeriodException(exceptionsByAccount, account.id, period.key);
        if (
          deriveStatementCompleteness(period, Boolean(uploaded[period.key]), hasException) !==
          "missing"
        ) {
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
  exceptionsByAccount: PeriodExceptionsByAccount = {},
  asOfDate: Date = new Date(),
): YearCompletenessSummary {
  let expectedCount = 0;
  let completeCount = 0;
  let notApplicableCount = 0;
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
      const hasException = hasPeriodException(exceptionsByAccount, account.id, period.key);
      const completeness = deriveStatementCompleteness(
        period,
        Boolean(uploaded[period.key]),
        hasException,
      );
      if (completeness === "not_expected" || completeness === "future") continue;

      expectedCount += 1;
      if (completeness === "complete") completeCount += 1;
      if (completeness === "not_applicable") notApplicableCount += 1;
      if (completeness === "missing") missingCount += 1;
      if (completeness === "waiting") waitingCount += 1;
    }
  }

  return { year, expectedCount, completeCount, notApplicableCount, missingCount, waitingCount };
}

export function countCompletenessForYear(
  periods: ExpectedPeriod[],
  statementDocumentsByPeriod: Readonly<Record<string, string>>,
  exceptionsByPeriod: Readonly<Record<string, true>> = {},
): {
  completeCount: number;
  notApplicableCount: number;
  missingCount: number;
  waitingCount: number;
  expectedCount: number;
} {
  let completeCount = 0;
  let notApplicableCount = 0;
  let missingCount = 0;
  let waitingCount = 0;
  let expectedCount = 0;

  for (const period of periods) {
    const completeness = deriveStatementCompleteness(
      period,
      Boolean(statementDocumentsByPeriod[period.key]),
      Boolean(exceptionsByPeriod[period.key]),
    );
    if (completeness === "not_expected" || completeness === "future") continue;

    expectedCount += 1;
    if (completeness === "complete") completeCount += 1;
    if (completeness === "not_applicable") notApplicableCount += 1;
    if (completeness === "missing") missingCount += 1;
    if (completeness === "waiting") waitingCount += 1;
  }

  return { completeCount, notApplicableCount, missingCount, waitingCount, expectedCount };
}

export function buildExceptionsByAccount(
  rows: ReadonlyArray<{ accountId: string; periodKey: string }>,
): PeriodExceptionsByAccount {
  const exceptionsByAccount: Record<string, Record<string, true>> = {};

  for (const row of rows) {
    const accountExceptions = exceptionsByAccount[row.accountId] ?? {};
    accountExceptions[row.periodKey] = true;
    exceptionsByAccount[row.accountId] = accountExceptions;
  }

  return exceptionsByAccount;
}
