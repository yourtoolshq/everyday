import { formatCompactPeriodRange, parseDateOnly } from "~/lib/expected-pay-periods";

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

function joinTitleParts(...parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .slice(0, 160);
}

export function formatPayPeriodTitle(periodStartDate: string, periodEndDate: string): string {
  const start = parseDateOnly(periodStartDate);
  const end = parseDateOnly(periodEndDate);
  if (!start) return periodStartDate;

  if (end && start.year === end.year && start.month === end.month) {
    const lastDay = new Date(start.year, start.month, 0).getDate();
    if (start.day === 1 && end.day === lastDay) {
      return `${MONTH_NAMES[start.month - 1]} ${start.year}`;
    }
    return `${MONTH_NAMES[start.month - 1]} ${start.day}–${end.day}, ${start.year}`;
  }

  if (end && start.year === end.year) {
    return `${formatCompactPeriodRange(periodStartDate, periodEndDate)}, ${start.year}`;
  }

  return `${formatCompactPeriodRange(periodStartDate, periodEndDate)}`;
}

export function suggestPayStubTitle(input: {
  employerName: string;
  periodStartDate: string;
  periodEndDate: string;
  payDate?: string | null;
  personName?: string | null;
}) {
  const employer = input.employerName.trim() || "Employer";
  const period = formatPayPeriodTitle(input.periodStartDate, input.periodEndDate);

  return joinTitleParts(period, employer, input.personName, "Pay stub");
}
