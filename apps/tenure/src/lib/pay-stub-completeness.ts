import type {
  EmploymentLifecycle,
  ExpectedPayPeriod,
} from "~/lib/expected-pay-periods";
import type { PayFrequency } from "~/lib/pay-frequency";
import {
  canDerivePayPeriods,
  deriveExpectedPayPeriodsForYear,
  paycheckMatchesPeriod,
  payYearRange,
} from "~/lib/expected-pay-periods";

export type PayStubCompletenessStatus =
  | "complete"
  | "missing_paycheck"
  | "missing_stub"
  | "waiting"
  | "future"
  | "not_expected"
  | "not_applicable";

export type PaycheckForCompleteness = {
  id: string;
  periodStartDate: string;
  periodEndDate: string;
  hasStub: boolean;
};

export type EmploymentForCompleteness = EmploymentLifecycle & {
  id: string;
  employerName: string;
  personName: string;
  payFrequency: PayFrequency;
  biweeklyAnchorDate: string | null;
};

export type MissingPayStubItem = {
  employmentId: string;
  employerName: string;
  personName: string;
  periodKey: string;
  periodLabel: string;
  issue: "missing_paycheck" | "missing_stub";
};

export type YearPayCompletenessSummary = {
  year: number;
  expectedCount: number;
  completeCount: number;
  notApplicableCount: number;
  missingPaycheckCount: number;
  missingStubCount: number;
  waitingCount: number;
};

export const payStubCompletenessLabels: Record<
  PayStubCompletenessStatus,
  string
> = {
  complete: "Complete",
  missing_paycheck: "Missing paycheck",
  missing_stub: "Missing stub",
  waiting: "Waiting",
  future: "Future",
  not_expected: "Not expected",
  not_applicable: "Not applicable",
};

export type PeriodExceptionsByEmployment = Readonly<
  Record<string, Readonly<Record<string, true>>>
>;

function paychecksForPeriod(
  paychecks: PaycheckForCompleteness[],
  period: ExpectedPayPeriod,
  frequency: PayFrequency,
): PaycheckForCompleteness[] {
  return paychecks.filter((paycheck) =>
    paycheckMatchesPeriod(
      frequency,
      period,
      paycheck.periodStartDate,
      paycheck.periodEndDate,
    ),
  );
}

export function derivePayStubCompleteness(
  period: ExpectedPayPeriod,
  paychecks: PaycheckForCompleteness[],
  frequency: PayFrequency,
  hasException = false,
): PayStubCompletenessStatus {
  if (period.status === "not_expected") return "not_expected";

  const matched = paychecksForPeriod(paychecks, period, frequency);
  if (matched.length > 0) {
    if (matched.every((paycheck) => paycheck.hasStub)) return "complete";
    return "missing_stub";
  }

  if (period.status === "future") return "future";
  if (period.status === "current") return "waiting";
  if (hasException) return "not_applicable";
  return "missing_paycheck";
}

function hasPeriodException(
  exceptionsByEmployment: PeriodExceptionsByEmployment,
  employmentId: string,
  periodKey: string,
): boolean {
  return Boolean(exceptionsByEmployment[employmentId]?.[periodKey]);
}

export function buildMissingPayStubItems(
  employments: EmploymentForCompleteness[],
  paychecksByEmployment: Readonly<Record<string, PaycheckForCompleteness[]>>,
  exceptionsByEmployment: PeriodExceptionsByEmployment = {},
  asOfDate: Date = new Date(),
): MissingPayStubItem[] {
  const missing: MissingPayStubItem[] = [];

  for (const employment of employments) {
    if (!canDerivePayPeriods(employment, employment.payFrequency)) continue;

    const paychecks = paychecksByEmployment[employment.id] ?? [];
    const yearRange = payYearRange(employment, asOfDate);
    if (!yearRange) continue;

    for (let year = yearRange.minYear; year <= yearRange.maxYear; year += 1) {
      const periods = deriveExpectedPayPeriodsForYear(
        employment,
        employment.payFrequency,
        year,
        employment.biweeklyAnchorDate,
        asOfDate,
      );

      for (const period of periods) {
        const completeness = derivePayStubCompleteness(
          period,
          paychecks,
          employment.payFrequency,
          hasPeriodException(exceptionsByEmployment, employment.id, period.key),
        );

        if (completeness === "missing_paycheck") {
          missing.push({
            employmentId: employment.id,
            employerName: employment.employerName,
            personName: employment.personName,
            periodKey: period.key,
            periodLabel: period.label,
            issue: "missing_paycheck",
          });
          continue;
        }

        if (completeness === "missing_stub") {
          missing.push({
            employmentId: employment.id,
            employerName: employment.employerName,
            personName: employment.personName,
            periodKey: period.key,
            periodLabel: period.label,
            issue: "missing_stub",
          });
        }
      }
    }
  }

  return missing.sort((left, right) => {
    const byPeriod = right.periodKey.localeCompare(left.periodKey, undefined, {
      numeric: true,
    });
    if (byPeriod !== 0) return byPeriod;
    return left.employerName.localeCompare(right.employerName);
  });
}

export function countPayCompletenessForYear(
  periods: ExpectedPayPeriod[],
  paychecks: PaycheckForCompleteness[],
  frequency: PayFrequency,
  exceptionsByPeriod: Readonly<Record<string, true>> = {},
): YearPayCompletenessSummary {
  let expectedCount = 0;
  let completeCount = 0;
  let notApplicableCount = 0;
  let missingPaycheckCount = 0;
  let missingStubCount = 0;
  let waitingCount = 0;
  const year = periods[0]?.year ?? new Date().getFullYear();

  for (const period of periods) {
    const completeness = derivePayStubCompleteness(
      period,
      paychecks,
      frequency,
      Boolean(exceptionsByPeriod[period.key]),
    );

    if (completeness === "not_expected" || completeness === "future") continue;

    expectedCount += 1;
    if (completeness === "complete") completeCount += 1;
    if (completeness === "not_applicable") notApplicableCount += 1;
    if (completeness === "missing_paycheck") missingPaycheckCount += 1;
    if (completeness === "missing_stub") missingStubCount += 1;
    if (completeness === "waiting") waitingCount += 1;
  }

  return {
    year,
    expectedCount,
    completeCount,
    notApplicableCount,
    missingPaycheckCount,
    missingStubCount,
    waitingCount,
  };
}

export function buildExceptionsByEmployment(
  rows: ReadonlyArray<{ employmentId: string; periodKey: string }>,
): PeriodExceptionsByEmployment {
  const exceptionsByEmployment: Record<string, Record<string, true>> = {};

  for (const row of rows) {
    const employmentExceptions = exceptionsByEmployment[row.employmentId] ?? {};
    employmentExceptions[row.periodKey] = true;
    exceptionsByEmployment[row.employmentId] = employmentExceptions;
  }

  return exceptionsByEmployment;
}
