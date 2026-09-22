import { describe, expect, it } from "vitest";

import {
  deriveAllSelectablePayPeriods,
  deriveExpectedPayPeriodsForYear,
  findExpectedPeriodForPayDate,
  formatCompactPeriodRange,
  paycheckMatchesPeriod,
  periodKeyForPaycheck,
  suggestDefaultPayPeriodKey,
} from "~/lib/expected-pay-periods";

describe("expected pay periods", () => {
  const lifecycle = {
    startDate: "2026-01-01",
    endDate: null,
    status: "current" as const,
  };

  it("derives biweekly periods from an anchor date", () => {
    const periods = deriveExpectedPayPeriodsForYear(
      lifecycle,
      "biweekly",
      2026,
      "2026-01-03",
      new Date("2026-02-15T12:00:00"),
    );

    expect(periods.some((period) => period.key === "2026-01-03")).toBe(true);
    expect(periods.some((period) => period.key === "2026-01-17")).toBe(true);
    expect(
      periods.find((period) => period.key === "2026-01-03")?.periodEndDate,
    ).toBe("2026-01-16");
  });

  it("maps paycheck period keys for biweekly schedules", () => {
    expect(periodKeyForPaycheck("biweekly", "2026-01-17")).toBe("2026-01-17");
  });

  it("lists selectable pay periods and suggests the next missing one", () => {
    const periods = deriveAllSelectablePayPeriods(
      lifecycle,
      "semimonthly",
      null,
      new Date("2026-02-15T12:00:00"),
    );

    expect(periods.length).toBeGreaterThan(0);
    expect(periods.every((period) => period.status !== "future")).toBe(true);
    expect(suggestDefaultPayPeriodKey(periods, new Set(["2026-01-1"]))).toBe(
      "2026-01-2",
    );
  });

  it("uses descriptive date ranges for semimonthly grid labels", () => {
    const periods = deriveExpectedPayPeriodsForYear(
      lifecycle,
      "semimonthly",
      2026,
      null,
      new Date("2026-03-01T12:00:00"),
    );

    const januaryFirst = periods.find((period) => period.key === "2026-01-1");
    const januarySecond = periods.find((period) => period.key === "2026-01-2");
    const februarySecond = periods.find((period) => period.key === "2026-02-2");

    expect(januaryFirst?.shortLabel).toBe("Jan 1–15");
    expect(januarySecond?.shortLabel).toBe("Jan 16–31");
    expect(februarySecond?.shortLabel).toBe("Feb 16–28");
    expect(formatCompactPeriodRange("2026-01-03", "2026-01-16")).toBe(
      "Jan 3–16",
    );
  });

  it("finds the expected period for a pay date after period end", () => {
    const period = findExpectedPeriodForPayDate(
      lifecycle,
      "biweekly",
      "2026-01-03",
      "2026-01-20",
      new Date("2026-03-01T12:00:00"),
    );

    expect(period?.key).toBe("2026-01-03");
    expect(period?.periodEndDate).toBe("2026-01-16");
  });

  it("matches multiple paychecks to the same pay period", () => {
    const periods = deriveExpectedPayPeriodsForYear(
      lifecycle,
      "biweekly",
      2026,
      "2026-01-03",
      new Date("2026-03-01T12:00:00"),
    );
    const period = periods.find((item) => item.key === "2026-01-03");
    expect(period).toBeDefined();

    expect(
      paycheckMatchesPeriod("biweekly", period!, "2026-01-03", "2026-01-16"),
    ).toBe(true);
    expect(
      paycheckMatchesPeriod("biweekly", period!, "2026-01-03", "2026-01-16"),
    ).toBe(true);
  });
});
