import { describe, expect, it } from "vitest";

import {
  canDeriveStatementPeriods,
  deriveAllUploadablePeriods,
  deriveExpectedPeriodsForYear,
  findUploadablePeriod,
  statementYearRange,
  suggestDefaultPeriodKey,
} from "~/lib/expected-periods";

const asOf = new Date("2026-09-17");

describe("canDeriveStatementPeriods", () => {
  it("requires an opened date when frequency is set", () => {
    expect(
      canDeriveStatementPeriods(
        { openedDate: null, closedDate: null, status: "active" },
        "monthly",
      ),
    ).toBe(false);
    expect(
      canDeriveStatementPeriods(
        { openedDate: "2025-06-01", closedDate: null, status: "active" },
        "monthly",
      ),
    ).toBe(true);
    expect(
      canDeriveStatementPeriods(
        { openedDate: "2025-06-01", closedDate: null, status: "active" },
        "none",
      ),
    ).toBe(false);
  });
});

describe("statementYearRange", () => {
  it("uses opened year through the current year for active accounts", () => {
    expect(
      statementYearRange(
        { openedDate: "2024-03-15", closedDate: null, status: "active" },
        asOf,
      ),
    ).toEqual({ minYear: 2024, maxYear: 2026 });
  });

  it("caps the range at the closed year", () => {
    expect(
      statementYearRange(
        {
          openedDate: "2024-01-01",
          closedDate: "2025-08-01",
          status: "closed",
        },
        asOf,
      ),
    ).toEqual({ minYear: 2024, maxYear: 2025 });
  });
});

describe("deriveExpectedPeriodsForYear", () => {
  it("derives monthly periods within the account lifetime", () => {
    const periods = deriveExpectedPeriodsForYear(
      {
        openedDate: "2025-06-01",
        closedDate: "2026-02-28",
        status: "closed",
      },
      "monthly",
      2026,
      asOf,
    );

    expect(periods).toHaveLength(12);
    expect(periods[0]?.status).toBe("past_expected");
    expect(periods[1]?.status).toBe("past_expected");
    expect(periods[2]?.status).toBe("not_expected");
  });

  it("marks the current and future months for active accounts", () => {
    const periods = deriveExpectedPeriodsForYear(
      {
        openedDate: "2024-01-01",
        closedDate: null,
        status: "active",
      },
      "monthly",
      2026,
      asOf,
    );

    expect(periods[8]?.status).toBe("current");
    expect(periods[9]?.status).toBe("future");
    expect(periods[7]?.status).toBe("past_expected");
  });

  it("derives quarterly periods", () => {
    const periods = deriveExpectedPeriodsForYear(
      {
        openedDate: "2025-06-01",
        closedDate: "2026-02-28",
        status: "closed",
      },
      "quarterly",
      2026,
      asOf,
    );

    expect(periods).toHaveLength(4);
    expect(periods[0]?.status).toBe("past_expected");
    expect(periods[1]?.status).toBe("not_expected");
  });

  it("derives a single annual period", () => {
    const periods = deriveExpectedPeriodsForYear(
      {
        openedDate: "2024-01-01",
        closedDate: null,
        status: "active",
      },
      "annually",
      2026,
      asOf,
    );

    expect(periods).toHaveLength(1);
    expect(periods[0]?.status).toBe("current");
  });

  it("returns no periods when schedule cannot be derived", () => {
    expect(
      deriveExpectedPeriodsForYear(
        { openedDate: null, closedDate: null, status: "active" },
        "monthly",
        2026,
        asOf,
      ),
    ).toEqual([]);
  });
});

describe("uploadable periods", () => {
  const lifecycle = {
    openedDate: "2025-06-01",
    closedDate: "2026-02-28",
    status: "closed" as const,
  };

  it("collects expected periods across the account lifetime", () => {
    const periods = deriveAllUploadablePeriods(lifecycle, "monthly", asOf);
    expect(periods.map((period) => period.key)).toEqual([
      "2026-02",
      "2026-01",
      "2025-12",
      "2025-11",
      "2025-10",
      "2025-09",
      "2025-08",
      "2025-07",
      "2025-06",
    ]);
  });

  it("finds a specific uploadable period", () => {
    expect(
      findUploadablePeriod(lifecycle, "monthly", "2025-07", asOf)?.label,
    ).toBe("July 2025");
    expect(
      findUploadablePeriod(lifecycle, "monthly", "2025-05", asOf),
    ).toBeNull();
  });

  it("excludes future periods for active accounts", () => {
    const activeLifecycle = {
      openedDate: "2026-01-01",
      closedDate: null,
      status: "active" as const,
    };
    const periods = deriveAllUploadablePeriods(
      activeLifecycle,
      "monthly",
      asOf,
    );

    expect(periods.map((period) => period.key)).toEqual([
      "2026-09",
      "2026-08",
      "2026-07",
      "2026-06",
      "2026-05",
      "2026-04",
      "2026-03",
      "2026-02",
      "2026-01",
    ]);
    expect(
      findUploadablePeriod(activeLifecycle, "monthly", "2026-10", asOf),
    ).toBeNull();
  });

  it("suggests the newest missing period first", () => {
    const periods = deriveAllUploadablePeriods(lifecycle, "monthly", asOf);
    expect(
      suggestDefaultPeriodKey(periods, new Set(["2026-02", "2026-01"])),
    ).toBe("2025-12");
    expect(
      suggestDefaultPeriodKey(
        periods,
        new Set(periods.map((period) => period.key)),
      ),
    ).toBe("2026-02");
  });
});
