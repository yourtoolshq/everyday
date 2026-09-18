import type { StatementFrequency } from "~/lib/statement-frequency";

export type PeriodDisplayStatus =
  | "not_expected"
  | "future"
  | "current"
  | "past_expected";

export type ExpectedPeriod = {
  key: string;
  label: string;
  shortLabel: string;
  year: number;
  month?: number;
  quarter?: number;
  status: PeriodDisplayStatus;
};

export type AccountLifecycle = {
  openedDate: string | null;
  closedDate: string | null;
  status: "active" | "closed";
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function parseDateOnly(value: string): { year: number; month: number; day: number } | null {
  const [year, month, day] = value.split("-");
  if (!year || !month) return null;

  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  const parsedDay = day ? Number(day) : 1;

  if (
    !Number.isInteger(parsedYear) ||
    !Number.isInteger(parsedMonth) ||
    parsedMonth < 1 ||
    parsedMonth > 12
  ) {
    return null;
  }

  return { year: parsedYear, month: parsedMonth, day: parsedDay };
}

export function canDeriveStatementPeriods(
  lifecycle: AccountLifecycle,
  frequency: StatementFrequency,
): boolean {
  if (frequency === "none") return false;
  return lifecycle.openedDate !== null;
}

export function statementYearRange(
  lifecycle: AccountLifecycle,
  asOfDate: Date = new Date(),
): { minYear: number; maxYear: number } | null {
  const opened = lifecycle.openedDate ? parseDateOnly(lifecycle.openedDate) : null;
  if (!opened) return null;

  const asOfYear = asOfDate.getFullYear();
  let maxYear = asOfYear;

  if (lifecycle.status === "closed" && lifecycle.closedDate) {
    const closed = parseDateOnly(lifecycle.closedDate);
    if (closed) {
      maxYear = Math.min(maxYear, closed.year);
    }
  }

  return { minYear: opened.year, maxYear };
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function classifyPeriod(
  periodStart: Date,
  periodEnd: Date,
  asOfDate: Date,
): PeriodDisplayStatus {
  const today = startOfDay(asOfDate);
  const start = startOfDay(periodStart);
  const end = startOfDay(periodEnd);

  if (today < start) return "future";
  if (today > end) return "past_expected";
  return "current";
}

function monthIsExpected(
  year: number,
  month: number,
  opened: { year: number; month: number },
  closed: { year: number; month: number } | null,
): boolean {
  if (year < opened.year || (year === opened.year && month < opened.month)) {
    return false;
  }

  if (!closed) return true;

  return year < closed.year || (year === closed.year && month <= closed.month);
}

function quarterIsExpected(
  year: number,
  quarter: number,
  opened: { year: number; month: number },
  closed: { year: number; month: number } | null,
): boolean {
  const quarterStartMonth = (quarter - 1) * 3 + 1;
  const quarterEndMonth = quarterStartMonth + 2;

  for (let month = quarterStartMonth; month <= quarterEndMonth; month += 1) {
    if (monthIsExpected(year, month, opened, closed)) {
      return true;
    }
  }

  return false;
}

function yearIsExpected(
  year: number,
  opened: { year: number; month: number },
  closed: { year: number; month: number } | null,
): boolean {
  for (let month = 1; month <= 12; month += 1) {
    if (monthIsExpected(year, month, opened, closed)) {
      return true;
    }
  }

  return false;
}

function deriveMonthlyPeriods(
  year: number,
  lifecycle: AccountLifecycle,
  asOfDate: Date,
): ExpectedPeriod[] {
  const opened = parseDateOnly(lifecycle.openedDate!);
  if (!opened) return [];

  const closed = lifecycle.closedDate ? parseDateOnly(lifecycle.closedDate) : null;

  return MONTH_NAMES.map((name, index) => {
    const month = index + 1;
    const expected = monthIsExpected(year, month, opened, closed);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);

    return {
      key: `${year}-${String(month).padStart(2, "0")}`,
      label: `${name} ${year}`,
      shortLabel: MONTH_SHORT[index] ?? name.slice(0, 3),
      year,
      month,
      status: expected ? classifyPeriod(periodStart, periodEnd, asOfDate) : "not_expected",
    };
  });
}

function deriveQuarterlyPeriods(
  year: number,
  lifecycle: AccountLifecycle,
  asOfDate: Date,
): ExpectedPeriod[] {
  const opened = parseDateOnly(lifecycle.openedDate!);
  if (!opened) return [];

  const closed = lifecycle.closedDate ? parseDateOnly(lifecycle.closedDate) : null;

  return [1, 2, 3, 4].map((quarter) => {
    const expected = quarterIsExpected(year, quarter, opened, closed);
    const startMonth = (quarter - 1) * 3;
    const periodStart = new Date(year, startMonth, 1);
    const periodEnd = new Date(year, startMonth + 3, 0);

    return {
      key: `${year}-Q${quarter}`,
      label: `Q${quarter} ${year}`,
      shortLabel: `Q${quarter}`,
      year,
      quarter,
      status: expected ? classifyPeriod(periodStart, periodEnd, asOfDate) : "not_expected",
    };
  });
}

function deriveAnnualPeriods(
  year: number,
  lifecycle: AccountLifecycle,
  asOfDate: Date,
): ExpectedPeriod[] {
  const opened = parseDateOnly(lifecycle.openedDate!);
  if (!opened) return [];

  const closed = lifecycle.closedDate ? parseDateOnly(lifecycle.closedDate) : null;
  const expected = yearIsExpected(year, opened, closed);
  const periodStart = new Date(year, 0, 1);
  const periodEnd = new Date(year, 11, 31);

  return [
    {
      key: String(year),
      label: String(year),
      shortLabel: String(year),
      year,
      status: expected ? classifyPeriod(periodStart, periodEnd, asOfDate) : "not_expected",
    },
  ];
}

export function deriveExpectedPeriodsForYear(
  lifecycle: AccountLifecycle,
  frequency: StatementFrequency,
  year: number,
  asOfDate: Date = new Date(),
): ExpectedPeriod[] {
  if (frequency === "none" || !canDeriveStatementPeriods(lifecycle, frequency)) {
    return [];
  }

  switch (frequency) {
    case "monthly":
      return deriveMonthlyPeriods(year, lifecycle, asOfDate);
    case "quarterly":
      return deriveQuarterlyPeriods(year, lifecycle, asOfDate);
    case "annually":
      return deriveAnnualPeriods(year, lifecycle, asOfDate);
    default:
      return [];
  }
}

export const periodStatusLabels: Record<PeriodDisplayStatus, string> = {
  not_expected: "Not expected",
  future: "Future",
  current: "Current period",
  past_expected: "Expected",
};

export function countExpectedPeriods(periods: ExpectedPeriod[]): number {
  return periods.filter((period) => period.status !== "not_expected").length;
}

function comparePeriodsDesc(a: ExpectedPeriod, b: ExpectedPeriod): number {
  if (a.year !== b.year) return b.year - a.year;
  const aOrdinal = a.month ?? (a.quarter ? a.quarter * 3 : 0);
  const bOrdinal = b.month ?? (b.quarter ? b.quarter * 3 : 0);
  return bOrdinal - aOrdinal;
}

export function deriveAllUploadablePeriods(
  lifecycle: AccountLifecycle,
  frequency: StatementFrequency,
  asOfDate: Date = new Date(),
): ExpectedPeriod[] {
  const yearRange = statementYearRange(lifecycle, asOfDate);
  if (!yearRange || !canDeriveStatementPeriods(lifecycle, frequency)) {
    return [];
  }

  const periods: ExpectedPeriod[] = [];
  for (let year = yearRange.minYear; year <= yearRange.maxYear; year += 1) {
    periods.push(
      ...deriveExpectedPeriodsForYear(lifecycle, frequency, year, asOfDate).filter(
        (period) => period.status !== "not_expected" && period.status !== "future",
      ),
    );
  }

  return periods.sort(comparePeriodsDesc);
}

export function findUploadablePeriod(
  lifecycle: AccountLifecycle,
  frequency: StatementFrequency,
  periodKey: string,
  asOfDate: Date = new Date(),
): ExpectedPeriod | null {
  return (
    deriveAllUploadablePeriods(lifecycle, frequency, asOfDate).find(
      (period) => period.key === periodKey,
    ) ?? null
  );
}

export function formatPeriodKey(periodKey: string): string {
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (monthMatch) {
    const month = Number(monthMatch[2]);
    const name = MONTH_NAMES[month - 1];
    return name ? `${name} ${monthMatch[1]}` : periodKey;
  }

  const quarterMatch = /^(\d{4})-Q(\d)$/.exec(periodKey);
  if (quarterMatch) return `Q${quarterMatch[2]} ${quarterMatch[1]}`;

  return periodKey;
}

export function suggestDefaultPeriodKey(
  uploadablePeriods: ExpectedPeriod[],
  uploadedPeriodKeys: ReadonlySet<string>,
): string | null {
  const nextMissing = uploadablePeriods.find((period) => !uploadedPeriodKeys.has(period.key));
  return nextMissing?.key ?? uploadablePeriods[0]?.key ?? null;
}
