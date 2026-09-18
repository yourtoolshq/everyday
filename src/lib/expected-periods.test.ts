import { describe, expect, it } from "vitest";

import {
  canDeriveStatementPeriods,
  deriveExpectedPeriodsForYear,
  statementYearRange,
} from "~/lib/expected-periods";

const asOf = new Date("2026-09-17");

describe("canDeriveStatementPeriods", () => {
  it("requires an opened date when frequency is set", () => {
    expect(
      canDeriveStatementPeriods({ openedDate: null, closedDate: null, status: "active" }, "monthly"),
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
