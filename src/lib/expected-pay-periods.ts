import type { PayFrequency } from "~/lib/pay-frequency";

export type PeriodDisplayStatus =
  | "not_expected"
  | "future"
  | "current"
  | "past_expected";

export type ExpectedPayPeriod = {
  key: string;
  label: string;
  shortLabel: string;
  year: number;
  periodStartDate: string;
  periodEndDate: string;
  status: PeriodDisplayStatus;
};

export type EmploymentLifecycle = {
  startDate: string | null;
  endDate: string | null;
  status: "current" | "former";
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

function formatIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function utcDate(value: string): Date {
  const parsed = parseDateOnly(value);
  if (!parsed) return new Date(NaN);
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
}

function addDays(value: string, days: number): string {
  const date = utcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function compareIsoDates(left: string, right: string): number {
  return left.localeCompare(right);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function classifyPeriod(
  periodStart: string,
  periodEnd: string,
  asOfDate: Date,
): PeriodDisplayStatus {
  const today = startOfDay(asOfDate);
  const start = startOfDay(utcDate(periodStart));
  const end = startOfDay(utcDate(periodEnd));

  if (today < start) return "future";
  if (today > end) return "past_expected";
  return "current";
}

export function canDerivePayPeriods(
  lifecycle: EmploymentLifecycle,
  frequency: PayFrequency,
): boolean {
  if (frequency === "irregular") return false;
  return lifecycle.startDate !== null;
}

export function payYearRange(
  lifecycle: EmploymentLifecycle,
  asOfDate: Date = new Date(),
): { minYear: number; maxYear: number } | null {
  const started = lifecycle.startDate ? parseDateOnly(lifecycle.startDate) : null;
  if (!started) return null;

  const asOfYear = asOfDate.getFullYear();
  let maxYear = asOfYear;

  if (lifecycle.status === "former" && lifecycle.endDate) {
    const ended = parseDateOnly(lifecycle.endDate);
    if (ended) maxYear = Math.min(maxYear, ended.year);
  }

  return { minYear: started.year, maxYear };
}

function periodOverlapsEmployment(
  periodStart: string,
  periodEnd: string,
  lifecycle: EmploymentLifecycle,
): boolean {
  if (!lifecycle.startDate) return false;
  if (compareIsoDates(periodEnd, lifecycle.startDate) < 0) return false;
  if (lifecycle.endDate && compareIsoDates(periodStart, lifecycle.endDate) > 0) {
    return false;
  }
  return true;
}

function alignPeriodStart(date: string, anchor: string, intervalDays: number): string {
  const dayMs = 86_400_000;
  const anchorMs = utcDate(anchor).getTime();
  const dateMs = utcDate(date).getTime();
  const diffDays = Math.floor((dateMs - anchorMs) / dayMs);
  const periodIndex = Math.floor(diffDays / intervalDays);
  let periodStartMs = anchorMs + periodIndex * intervalDays * dayMs;
  if (periodStartMs > dateMs) {
    periodStartMs -= intervalDays * dayMs;
  }
  return new Date(periodStartMs).toISOString().slice(0, 10);
}

function deriveWeeklyPeriodsForYear(
  year: number,
  lifecycle: EmploymentLifecycle,
  anchor: string,
  asOfDate: Date,
): ExpectedPayPeriod[] {
  const yearStart = formatIsoDate(year, 1, 1);
  const yearEnd = formatIsoDate(year, 12, 31);
  const employmentStart = lifecycle.startDate ?? yearStart;
  const rangeStart = compareIsoDates(employmentStart, yearStart) > 0 ? employmentStart : yearStart;

  let periodStart = alignPeriodStart(rangeStart, anchor, 7);
  if (compareIsoDates(periodStart, rangeStart) > 0) {
    periodStart = addDays(periodStart, -7);
  }

  const periods: ExpectedPayPeriod[] = [];
  while (compareIsoDates(periodStart, yearEnd) <= 0) {
    const periodEnd = addDays(periodStart, 6);
    const expected = periodOverlapsEmployment(periodStart, periodEnd, lifecycle);
    periods.push({
      key: periodStart,
      label: `${formatShortDate(periodStart)} – ${formatShortDate(periodEnd)}`,
      shortLabel: formatCompactPeriodRange(periodStart, periodEnd),
      year,
      periodStartDate: periodStart,
      periodEndDate: periodEnd,
      status: expected
        ? classifyPeriod(periodStart, periodEnd, asOfDate)
        : "not_expected",
    });
    periodStart = addDays(periodStart, 7);
  }

  return periods.filter((period) => {
    const parsed = parseDateOnly(period.periodStartDate);
    return parsed?.year === year;
  });
}

function deriveBiweeklyPeriodsForYear(
  year: number,
  lifecycle: EmploymentLifecycle,
  anchor: string,
  asOfDate: Date,
): ExpectedPayPeriod[] {
  const yearStart = formatIsoDate(year, 1, 1);
  const yearEnd = formatIsoDate(year, 12, 31);
  const employmentStart = lifecycle.startDate ?? yearStart;
  const rangeStart = compareIsoDates(employmentStart, yearStart) > 0 ? employmentStart : yearStart;

  let periodStart = alignPeriodStart(rangeStart, anchor, 14);

  const periods: ExpectedPayPeriod[] = [];
  while (compareIsoDates(periodStart, yearEnd) <= 0) {
    const periodEnd = addDays(periodStart, 13);
    const expected = periodOverlapsEmployment(periodStart, periodEnd, lifecycle);
    periods.push({
      key: periodStart,
      label: `${formatShortDate(periodStart)} – ${formatShortDate(periodEnd)}`,
      shortLabel: formatCompactPeriodRange(periodStart, periodEnd),
      year,
      periodStartDate: periodStart,
      periodEndDate: periodEnd,
      status: expected
        ? classifyPeriod(periodStart, periodEnd, asOfDate)
        : "not_expected",
    });
    periodStart = addDays(periodStart, 14);
  }

  return periods.filter((period) => {
    const parsed = parseDateOnly(period.periodStartDate);
    return parsed?.year === year || parseDateOnly(period.periodEndDate)?.year === year;
  });
}

function deriveMonthlyPeriodsForYear(
  year: number,
  lifecycle: EmploymentLifecycle,
  asOfDate: Date,
): ExpectedPayPeriod[] {
  return MONTH_NAMES.map((name, index) => {
    const month = index + 1;
    const periodStart = formatIsoDate(year, month, 1);
    const periodEnd = formatIsoDate(year, month, new Date(year, month, 0).getDate());
    const expected = periodOverlapsEmployment(periodStart, periodEnd, lifecycle);

    return {
      key: `${year}-${String(month).padStart(2, "0")}`,
      label: `${name} ${year}`,
      shortLabel: MONTH_SHORT[index] ?? name.slice(0, 3),
      year,
      periodStartDate: periodStart,
      periodEndDate: periodEnd,
      status: expected
        ? classifyPeriod(periodStart, periodEnd, asOfDate)
        : "not_expected",
    };
  });
}

function deriveSemimonthlyPeriodsForYear(
  year: number,
  lifecycle: EmploymentLifecycle,
  asOfDate: Date,
): ExpectedPayPeriod[] {
  const periods: ExpectedPayPeriod[] = [];

  for (let month = 1; month <= 12; month += 1) {
    const firstStart = formatIsoDate(year, month, 1);
    const firstEnd = formatIsoDate(year, month, 15);
    const secondStart = formatIsoDate(year, month, 16);
    const secondEnd = formatIsoDate(year, month, new Date(year, month, 0).getDate());

    for (const [half, periodStart, periodEnd] of [
      ["1", firstStart, firstEnd],
      ["2", secondStart, secondEnd],
    ] as const) {
      const expected = periodOverlapsEmployment(periodStart, periodEnd, lifecycle);
      periods.push({
        key: `${year}-${String(month).padStart(2, "0")}-${half}`,
        label: `${MONTH_NAMES[month - 1]} ${half === "1" ? "1–15" : `16–${new Date(year, month, 0).getDate()}`}, ${year}`,
        shortLabel: formatCompactPeriodRange(periodStart, periodEnd),
        year,
        periodStartDate: periodStart,
        periodEndDate: periodEnd,
        status: expected
          ? classifyPeriod(periodStart, periodEnd, asOfDate)
          : "not_expected",
      });
    }
  }

  return periods;
}

export function deriveExpectedPayPeriodsForYear(
  lifecycle: EmploymentLifecycle,
  frequency: PayFrequency,
  year: number,
  anchorDate: string | null,
  asOfDate: Date = new Date(),
): ExpectedPayPeriod[] {
  if (!canDerivePayPeriods(lifecycle, frequency)) return [];

  const anchor = anchorDate ?? lifecycle.startDate;
  if (!anchor) return [];

  switch (frequency) {
    case "weekly":
      return deriveWeeklyPeriodsForYear(year, lifecycle, anchor, asOfDate);
    case "biweekly":
      return deriveBiweeklyPeriodsForYear(year, lifecycle, anchor, asOfDate);
    case "monthly":
      return deriveMonthlyPeriodsForYear(year, lifecycle, asOfDate);
    case "semimonthly":
      return deriveSemimonthlyPeriodsForYear(year, lifecycle, asOfDate);
    default:
      return [];
  }
}

export function periodKeyForPaycheck(
  frequency: PayFrequency,
  periodStartDate: string,
): string | null {
  const parsed = parseDateOnly(periodStartDate);
  if (!parsed) return null;

  switch (frequency) {
    case "weekly":
    case "biweekly":
      return periodStartDate;
    case "monthly":
      return `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
    case "semimonthly":
      return `${parsed.year}-${String(parsed.month).padStart(2, "0")}-${parsed.day <= 15 ? "1" : "2"}`;
    default:
      return null;
  }
}

export function paycheckMatchesPeriod(
  frequency: PayFrequency,
  period: ExpectedPayPeriod,
  paycheckPeriodStart: string,
  paycheckPeriodEnd: string,
): boolean {
  if (
    paycheckPeriodStart === period.periodStartDate &&
    paycheckPeriodEnd === period.periodEndDate
  ) {
    return true;
  }

  const paycheckKey = periodKeyForPaycheck(frequency, paycheckPeriodStart);
  return paycheckKey !== null && paycheckKey === period.key;
}

function formatShortDate(value: string): string {
  const parsed = parseDateOnly(value);
  if (!parsed) return value;
  const month = MONTH_SHORT[parsed.month - 1] ?? "";
  return `${month} ${parsed.day}`;
}

/** Compact range for grid cells, e.g. "Jan 1–15" or "Jan 3–16". */
export function formatCompactPeriodRange(periodStart: string, periodEnd: string): string {
  const start = parseDateOnly(periodStart);
  const end = parseDateOnly(periodEnd);
  if (!start || !end) return periodStart;

  const startMonth = MONTH_SHORT[start.month - 1] ?? "";
  const endMonth = MONTH_SHORT[end.month - 1] ?? "";

  if (start.year === end.year && start.month === end.month) {
    if (start.day === end.day) return `${startMonth} ${start.day}`;
    return `${startMonth} ${start.day}–${end.day}`;
  }

  return `${startMonth} ${start.day} – ${endMonth} ${end.day}`;
}

function comparePeriodsDesc(left: ExpectedPayPeriod, right: ExpectedPayPeriod): number {
  return right.periodStartDate.localeCompare(left.periodStartDate);
}

export function deriveAllSelectablePayPeriods(
  lifecycle: EmploymentLifecycle,
  frequency: PayFrequency,
  anchorDate: string | null,
  asOfDate: Date = new Date(),
): ExpectedPayPeriod[] {
  const yearRange = payYearRange(lifecycle, asOfDate);
  if (!yearRange || !canDerivePayPeriods(lifecycle, frequency)) return [];

  const periods: ExpectedPayPeriod[] = [];
  for (let year = yearRange.minYear; year <= yearRange.maxYear; year += 1) {
    periods.push(
      ...deriveExpectedPayPeriodsForYear(
        lifecycle,
        frequency,
        year,
        anchorDate,
        asOfDate,
      ).filter(
        (period) => period.status !== "not_expected" && period.status !== "future",
      ),
    );
  }

  return periods.sort(comparePeriodsDesc);
}

export function findPayPeriodByKey(
  periods: ExpectedPayPeriod[],
  periodKey: string,
): ExpectedPayPeriod | null {
  return periods.find((period) => period.key === periodKey) ?? null;
}

function graceDaysAfterPeriodEnd(frequency: PayFrequency): number {
  switch (frequency) {
    case "weekly":
      return 7;
    case "biweekly":
      return 14;
    case "semimonthly":
      return 15;
    case "monthly":
      return 31;
    default:
      return 0;
  }
}

export function findExpectedPeriodForPayDate(
  lifecycle: EmploymentLifecycle,
  frequency: PayFrequency,
  anchorDate: string | null,
  payDate: string,
  asOfDate: Date = new Date(),
): ExpectedPayPeriod | null {
  if (!canDerivePayPeriods(lifecycle, frequency)) return null;

  const parsed = parseDateOnly(payDate);
  if (!parsed) return null;

  const periods = deriveExpectedPayPeriodsForYear(
    lifecycle,
    frequency,
    parsed.year,
    anchorDate,
    asOfDate,
  ).filter((period) => period.status !== "not_expected");

  const grace = graceDaysAfterPeriodEnd(frequency);
  const afterPeriodEnd = periods.filter((period) => {
    if (compareIsoDates(payDate, period.periodEndDate) < 0) return false;
    const graceEnd = addDays(period.periodEndDate, grace);
    return compareIsoDates(payDate, graceEnd) <= 0;
  });

  if (afterPeriodEnd.length > 0) {
    return [...afterPeriodEnd].sort((left, right) =>
      right.periodEndDate.localeCompare(left.periodEndDate),
    )[0]!;
  }

  return (
    periods.find(
      (period) =>
        compareIsoDates(payDate, period.periodStartDate) >= 0 &&
        compareIsoDates(payDate, period.periodEndDate) <= 0,
    ) ?? null
  );
}

export function suggestDefaultPayPeriodKey(
  selectablePeriods: ExpectedPayPeriod[],
  coveredPeriodKeys: ReadonlySet<string>,
): string | null {
  const chronological = [...selectablePeriods].sort((left, right) =>
    left.periodStartDate.localeCompare(right.periodStartDate),
  );
  const nextMissing = chronological.find(
    (period) => !coveredPeriodKeys.has(period.key),
  );
  return nextMissing?.key ?? selectablePeriods[0]?.key ?? null;
}

export function formatPayPeriodKey(periodKey: string): string {
  const semimonthlyMatch = /^(\d{4})-(\d{2})-([12])$/.exec(periodKey);
  if (semimonthlyMatch) {
    const year = Number(semimonthlyMatch[1]);
    const month = Number(semimonthlyMatch[2]);
    const name = MONTH_SHORT[month - 1] ?? semimonthlyMatch[2];
    const lastDay = new Date(year, month, 0).getDate();
    return `${name} ${semimonthlyMatch[3] === "1" ? "1–15" : `16–${lastDay}`} ${year}`;
  }

  const monthlyMatch = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (monthlyMatch) {
    const month = Number(monthlyMatch[2]);
    const name = MONTH_NAMES[month - 1];
    return name ? `${name} ${monthlyMatch[1]}` : periodKey;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(periodKey)) {
    return formatShortDate(periodKey);
  }

  return periodKey;
}
